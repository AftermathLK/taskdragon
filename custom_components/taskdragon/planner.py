"""TaskDragon business logic.

:class:`Planner` owns every task lifecycle rule – completion with audit log,
recurrence and rollover, blocking dependencies, snoozing, shopping-list
deduplication, pantry low-stock actions, bills of materials, quick-list
sections and packing trips. It talks to the database and to a handful of
injected callbacks, but never imports Home Assistant, so it is exercised
directly by the unit tests. The coordinator wires the callbacks to Home
Assistant (state reads, bus events, dispatcher broadcasts).

Access control lives here too (:meth:`Planner.can_access`,
:meth:`Planner.authorize`): a private plan is visible only to its owner and the
users it is explicitly shared with. The WebSocket API, services and todo
entities call these before touching data on behalf of a Home Assistant user.
Internal callers (timers, automations) act as :data:`SYSTEM`, which has no user
id and full access.
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, tzinfo
from typing import Any
from urllib.parse import urlsplit

from . import dependencies, recurrence, reminders
from .const import (
    AISLE_HARDWARE,
    ARCHETYPE_DAILY,
    ARCHETYPE_HOARD,
    ARCHETYPE_MAINTENANCE,
    ARCHETYPE_PACKING,
    ARCHETYPE_PANTRY,
    ARCHETYPE_PROJECTS,
    ARCHETYPE_QUICK,
    ARCHETYPE_SHOPPING,
    ARCHETYPES,
    BUCKET_ANYTIME,
    BUCKETS,
    COLOR_PATTERN,
    COST_MODES,
    DEFAULT_QUICK_SECTIONS,
    EVENT_PANTRY_LOW,
    EVENT_TASK_COMPLETED,
    EVENT_TASK_UNSNOOZED,
    ICON_PATTERN,
    KANBAN_BACKLOG,
    KANBAN_COLUMNS,
    KANBAN_DONE,
    KANBAN_IN_PROGRESS,
    KANBAN_READY,
    LOW_ACTION_ASK,
    LOW_ACTION_BATCH,
    LOW_ACTION_NONE,
    LOW_ACTION_SHOPPING,
    LINK_SCHEMES,
    LOW_ACTIONS,
    MAX_LIST,
    MAX_NAME,
    MAX_SUMMARY,
    MAX_TEXT,
    POOL,
    PREF_KEYS,
    PREF_MAINT_VIEWS,
    PRIORITIES,
    RECURRENCE_MODES,
    RECURRENCE_NONE,
    ROLE_CHORES,
    ROLE_GROCERIES,
    ROLE_HARDWARE,
    ROLE_QUICK,
    SENSOR_MODES,
    SNOOZE_ALL_HOME,
    SNOOZE_PERSON_HOME,
    SNOOZE_TIME,
    SNOOZE_WEEKEND_DRY,
    SOURCE_BOM,
    SOURCE_BRAIN_DUMP,
    SOURCE_LEFTOVER,
    SOURCE_MANUAL,
    SOURCE_MEALIE_COOK,
    SOURCE_PANTRY,
    STATUS_BLOCKED,
    STATUS_COMPLETED,
    STATUS_IN_PROCESS,
    STATUS_NEEDS_ACTION,
    STATUS_SNOOZED,
    SHARED_ROLES,
    STATUSES,
    STOCK_IN,
    STOCK_STATES,
    TRIP_ACTIVE,
    TRIP_ARCHIVED,
    TRIP_STATUSES,
    TRIP_UPCOMING,
    UNDO_TTL_SECONDS,
)
from .database import MDOCS, MOBJECTS, MPARTS, MTASKS, TaskDragonDB, new_id
from .snooze import describe_rule, validate_rule
from .timeutil import (
    bucket_for_hour,
    logical_today,
    parse_date,
    parse_datetime,
    to_utc_iso,
    utc_now,
    utc_now_iso,
)
from .units import categorize_parsed, combine_quantity_text, name_key, parse_item

_LOGGER = logging.getLogger(__name__)


class PlannerError(Exception):
    """A user-facing validation error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class Actor:
    """Who performed an action."""

    user_id: str | None = None
    user_name: str | None = None
    person: str | None = None  # person.* entity id
    is_admin: bool = False

    @property
    def label(self) -> str | None:
        return self.person or self.user_name


SYSTEM = Actor(user_name="TaskDragon")

QUICK_LIST_PLAN: dict[str, Any] = {
    "name": "Quick List",
    "archetype": ARCHETYPE_QUICK,
    "icon": "mdi:lightning-bolt-outline",
    "settings": {"role": ROLE_QUICK},
}
PERSONAL_QUICK_KEY = "personal_quick"

DEFAULT_PLANS: tuple[dict[str, Any], ...] = (
    QUICK_LIST_PLAN,
    {"name": "Daily Chores", "archetype": ARCHETYPE_DAILY, "icon": "mdi:broom", "settings": {"role": ROLE_CHORES}},
    {"name": "Groceries", "archetype": ARCHETYPE_SHOPPING, "icon": "mdi:cart-outline", "settings": {"role": ROLE_GROCERIES}},
    {"name": "Hardware", "archetype": ARCHETYPE_SHOPPING, "icon": "mdi:hammer-wrench", "settings": {"role": ROLE_HARDWARE, "default_category": AISLE_HARDWARE}},
    {"name": "Projects", "archetype": ARCHETYPE_PROJECTS, "icon": "mdi:hammer-screwdriver", "settings": {}},
    {"name": "Home Maintenance", "archetype": ARCHETYPE_MAINTENANCE, "icon": "mdi:tools", "settings": {}},
    {"name": "Trip Packing", "archetype": ARCHETYPE_PACKING, "icon": "mdi:bag-suitcase-outline", "settings": {}},
    {"name": "Pantry & Spices", "archetype": ARCHETYPE_PANTRY, "icon": "mdi:shaker-outline", "settings": {}},
)

_TEXT_FIELDS = ("summary", "description", "category", "quantity", "link_url", "source_ref")
_TEXT_LIMITS = {"summary": MAX_SUMMARY, "description": MAX_TEXT, "category": MAX_NAME, "quantity": MAX_NAME, "link_url": 2048, "source_ref": 400}
_SETTINGS_TEXT = ("default_category", "shopping_plan_id", "chore_plan_id", "mealie_list_id")
_ADMIN_SETTINGS = ("role", "mealie_list_id", "notify_service")
_NOTIFY_RE = re.compile(r"^notify\.[a-z0-9_]+$")
_ICON_RE = re.compile(ICON_PATTERN)
_COLOR_RE = re.compile(COLOR_PATTERN)
_UNSET = object()
PANTRY_SHOPPING_PREFIX = "shop:"
# Icons that earlier versions used but Material Design Icons doesn't have (they render blank).
RETIRED_ICONS = {"mdi:home-wrench": "mdi:tools"}
MAX_UNDO_ENTRIES = 200
MAX_SHARED_WITH = 20
PREF_VALUE_MAX = 200


class Planner:
    """Task lifecycle rules on top of :class:`TaskDragonDB`."""

    def __init__(
        self,
        db: TaskDragonDB,
        *,
        tz: tzinfo,
        rollover_hour: int = 0,
        notify: Callable[[set[str]], None] | None = None,
        fire_event: Callable[[str, dict[str, Any]], None] | None = None,
        state_reader: Callable[[str], str | None] | None = None,
        recipe_url: Callable[[str], str | None] | None = None,
        household: Callable[[], list[str]] | None = None,
        weather_entity: Callable[[], str | None] | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.db = db
        self.tz = tz
        self.rollover_hour = rollover_hour
        self._notify_cb = notify
        self._fire_event_cb = fire_event
        self._state_reader = state_reader
        self._recipe_url = recipe_url
        self._household = household
        self._weather_entity = weather_entity
        self._clock = clock or utc_now
        self.on_cook_completed: Callable[[dict[str, Any]], Any] | None = None
        # Undo payloads stay server-side; clients only ever hold an opaque token.
        self._undo: dict[str, dict[str, Any]] = {}
        # Extension points used by the maintenance subsystem.
        self.completion_hooks: list[Callable[[dict[str, Any], Actor], Any]] = []
        self.undo_handlers: dict[str, Callable[[Any, Actor], Any]] = {}
        self.maintenance: Any = None
        self.hoard: Any = None  # the wishlist & price tracker (hoard.py)
        # Whether ``actor`` may send reminders to a ``notify.*`` target (wired to Home Assistant by the coordinator).
        self.reminder_allowed: Callable[[str, Actor], bool] | None = None
        # Find-or-create of the personal quick list runs one at a time (two tabs open at once).
        self._quick_lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Small helpers
    # ------------------------------------------------------------------
    def now(self) -> datetime:
        return self._clock()

    def now_local(self) -> datetime:
        return self.now().astimezone(self.tz)

    def today(self) -> date:
        return logical_today(self.now_local(), self.rollover_hour)

    def _notify(self, plan_ids: Iterable[str | None]) -> None:
        ids = {pid for pid in plan_ids if pid}
        if ids and self._notify_cb is not None:
            self._notify_cb(ids)

    def _fire(self, event: str, data: dict[str, Any]) -> None:
        if self._fire_event_cb is not None:
            self._fire_event_cb(event, data)

    # Public names for collaborators (the maintenance manager).
    def notify(self, plan_ids: Iterable[str | None]) -> None:
        self._notify(plan_ids)

    def fire(self, event: str, data: dict[str, Any]) -> None:
        self._fire(event, data)

    def event_payload(self, plan: Mapping[str, Any] | None, data: dict[str, Any], *text_keys: str) -> dict[str, Any]:
        return self._event_payload(plan, data, *text_keys)

    async def _plans_map(self) -> dict[str, dict[str, Any]]:
        return {plan["id"]: plan for plan in await self.db.list_plans(include_archived=True)}

    async def _require_plan(self, plan_id: str | None) -> dict[str, Any]:
        plan = await self.db.get_plan(plan_id) if plan_id else None
        if plan is None:
            raise PlannerError("plan_not_found", f"Plan {plan_id} not found")
        return plan

    async def _require_task(self, uid: str) -> dict[str, Any]:
        task = await self.db.get_task(uid)
        if task is None:
            raise PlannerError("task_not_found", f"Task {uid} not found")
        return task

    async def plan_for_role(self, role: str, archetype: str | None = None) -> dict[str, Any] | None:
        """The household plan that routing should use; private plans never take a role."""
        plans = [plan for plan in await self.db.list_plans() if not plan["is_private"]]
        for plan in plans:
            if (plan.get("settings") or {}).get("role") == role and not plan["is_template"]:
                return plan
        if archetype:
            for plan in plans:
                if plan["archetype"] == archetype and not plan["is_template"]:
                    return plan
        return None

    # ------------------------------------------------------------------
    # Access control
    # ------------------------------------------------------------------
    @staticmethod
    def can_access(plan: Mapping[str, Any] | None, actor: Actor) -> bool:
        """Whether ``actor`` may see and edit what is in ``plan``."""
        if plan is None:
            return False
        if actor.user_id is None or not plan.get("is_private"):
            return True
        return plan.get("owner_user_id") == actor.user_id or actor.user_id in (plan.get("shared_with") or [])

    @staticmethod
    def can_manage(plan: Mapping[str, Any], actor: Actor) -> bool:
        """Delete, archive or change the visibility of a plan.

        Household plans need an administrator; a private plan belongs to its owner.
        """
        if actor.user_id is None:
            return True
        if plan.get("is_private"):
            return plan.get("owner_user_id") == actor.user_id
        return actor.is_admin

    async def accessible_plans(self, actor: Actor, *, include_archived: bool = False) -> list[dict[str, Any]]:
        return [plan for plan in await self.db.list_plans(include_archived=include_archived) if self.can_access(plan, actor)]

    async def authorize(
        self,
        actor: Actor,
        *,
        plans: Iterable[str | None] = (),
        tasks: Iterable[str | None] = (),
        pantry: Iterable[str | None] = (),
        bom: Iterable[str | None] = (),
        sections: Iterable[str | None] = (),
        trips: Iterable[str | None] = (),
        mobjects: Iterable[str | None] = (),
        mtasks: Iterable[str | None] = (),
        mparts: Iterable[str | None] = (),
        mdocs: Iterable[str | None] = (),
    ) -> None:
        """Raise ``not_found`` unless every referenced record lives in a plan ``actor`` can access.

        Missing and forbidden records give the same answer, so ids of other
        people's private items can't be probed.
        """
        if actor.user_id is None:
            return
        plan_ids = {plan_id for plan_id in plans if plan_id}
        task_uids = [uid for uid in dict.fromkeys(tasks) if uid]
        if task_uids:
            found = {task["uid"]: task for task in await self.db.get_tasks(task_uids)}
            for uid in task_uids:
                if uid not in found:
                    raise _not_found()
                plan_ids.add(found[uid]["plan_id"])
        lookups = (
            (pantry, self.db.get_pantry_item),
            (bom, self.db.get_bom_item),
            (sections, self.db.get_section),
            (trips, self.db.get_trip),
            (mobjects, lambda key: self.db.row(MOBJECTS, key)),
            (mtasks, lambda key: self.db.row(MTASKS, key)),
            (mparts, lambda key: self.db.row(MPARTS, key)),
            (mdocs, lambda key: self.db.row(MDOCS, key)),
        )
        for ids, getter in lookups:
            for record_id in dict.fromkeys(ids):
                if not record_id:
                    continue
                record = await getter(record_id)
                if record is None:
                    raise _not_found()
                plan_ids.add(record["plan_id"])
        if plan_ids:
            plans_map = await self._plans_map()
            for plan_id in plan_ids:
                if not self.can_access(plans_map.get(plan_id), actor):
                    raise _not_found()

    async def accessible_plan_ids(self, plan_ids: Iterable[str], actor: Actor) -> set[str]:
        """Subset of ``plan_ids`` the actor may see (ids that no longer exist are kept)."""
        plans_map = await self._plans_map()
        return {pid for pid in plan_ids if pid not in plans_map or self.can_access(plans_map[pid], actor)}

    def _event_payload(self, plan: Mapping[str, Any] | None, data: dict[str, Any], *text_keys: str) -> dict[str, Any]:
        """Bus events reach every admin listener; keep private plans' text out of them."""
        if plan and plan.get("is_private"):
            data = {**data, "private": True, **{key: None for key in text_keys}}
        return data

    async def chores_plan(self) -> dict[str, Any] | None:
        return await self.plan_for_role(ROLE_CHORES, ARCHETYPE_DAILY)

    async def grocery_plan(self) -> dict[str, Any] | None:
        return await self.plan_for_role(ROLE_GROCERIES, ARCHETYPE_SHOPPING)

    async def hardware_plan(self) -> dict[str, Any] | None:
        return await self.plan_for_role(ROLE_HARDWARE) or await self.grocery_plan()

    def _local_due(self, task: Mapping[str, Any]) -> datetime | None:
        due = parse_datetime(task.get("due_datetime"))
        return due.astimezone(self.tz) if due else None

    # ------------------------------------------------------------------
    # Plans
    # ------------------------------------------------------------------
    async def seed_defaults(self) -> list[dict[str, Any]]:
        """Create the starter plans on a brand-new database."""
        if await self.db.list_plans(include_archived=True):
            return []
        created = []
        async with self.db.transaction():
            for position, template in enumerate(DEFAULT_PLANS, start=1):
                plan = await self.db.tx_create_plan({**template, "position": position})
                created.append(plan)
                if template is QUICK_LIST_PLAN:
                    for index, section in enumerate(DEFAULT_QUICK_SECTIONS, start=1):
                        await self.db.tx_create_section(plan["id"], section, index)
        await self.db.set_meta("quick_list_seeded", True)
        return created

    async def ensure_defaults(self) -> None:
        """Add plans introduced by newer versions to existing databases (once), and fix retired icons."""
        for old, new in RETIRED_ICONS.items():
            self._notify(await self.db.replace_plan_icon(old, new))
        if await self.db.get_meta("quick_list_seeded"):
            return
        plans = await self.db.list_plans(include_archived=True)
        if not any((p.get("settings") or {}).get("role") == ROLE_QUICK for p in plans):
            async with self.db.transaction():
                plan = await self.db.tx_create_plan({**QUICK_LIST_PLAN, "position": 0})
                for index, section in enumerate(DEFAULT_QUICK_SECTIONS, start=1):
                    await self.db.tx_create_section(plan["id"], section, index)
            self._notify([plan["id"]])
        await self.db.set_meta("quick_list_seeded", True)

    async def quick_lists(self, actor: Actor) -> dict[str, str | None]:
        """The household quick list and the actor's private one (created on first use)."""
        async with self._quick_lock:
            plans = await self.db.list_plans(include_archived=True)
            shared = next(
                (p for p in plans if not p["is_private"] and (p.get("settings") or {}).get("role") == ROLE_QUICK), None
            )
            private = None
            if actor.user_id:
                private = next(
                    (
                        p
                        for p in plans
                        if p["is_private"]
                        and p.get("owner_user_id") == actor.user_id
                        and (p.get("settings") or {}).get(PERSONAL_QUICK_KEY)
                    ),
                    None,
                )
                if private is None:
                    private = await self.db.create_plan(
                        {
                            "name": "My Quick List",
                            "archetype": ARCHETYPE_QUICK,
                            "icon": "mdi:lock-outline",
                            "is_private": True,
                            "owner_user_id": actor.user_id,
                            "settings": {PERSONAL_QUICK_KEY: True},
                        }
                    )
                    self._notify([private["id"]])
            return {"shared": shared["id"] if shared else None, "private": private["id"] if private else None}

    def _clean_plan_settings(
        self, incoming: Mapping[str, Any], current: Mapping[str, Any] | None, actor: Actor, is_private: bool
    ) -> dict[str, Any]:
        current = dict(current or {})
        merged = {**current}
        for key, value in incoming.items():
            if key == PERSONAL_QUICK_KEY:
                continue  # set by TaskDragon only
            if key in _ADMIN_SETTINGS and value != current.get(key) and actor.user_id is not None and not actor.is_admin:
                raise PlannerError("unauthorized", "Only administrators can change list routing and Mealie links")
            if key == "role":
                if value is not None and value not in SHARED_ROLES:
                    raise PlannerError("invalid", "Unknown routing role")
            elif key in _SETTINGS_TEXT:
                value = str(value).strip()[:MAX_NAME] or None if value is not None else None
            elif key == "trip_date":
                parsed = parse_date(value)
                value = parsed.isoformat() if parsed else None
            elif key == "cost_mode":
                if value is not None and value not in COST_MODES:
                    raise PlannerError("invalid", "Unknown cost accounting mode")
            elif key == "currency":
                value = str(value).strip()[:8] or None if value is not None else None
            elif key == "default_warning_days":
                value = _int_or_none(value, minimum=0)
                if value is not None and value > 365:
                    raise PlannerError("invalid", "Warning days can be at most 365")
            elif key == "notify_service":
                value = str(value).strip() or None if value is not None else None
                if value is not None and not _NOTIFY_RE.match(value):
                    raise PlannerError("invalid", "Notify services look like notify.mobile_app_phone")
            else:
                continue  # unknown keys are dropped rather than stored
            merged[key] = value
        if is_private:
            merged.pop("role", None)  # routing never targets someone's private list
        return {k: v for k, v in merged.items() if v is not None}

    @staticmethod
    def _clean_shared_with(raw: Any, owner: str | None) -> list[str]:
        if raw in (None, ""):
            return []
        if not isinstance(raw, (list, tuple)):
            raise PlannerError("invalid", "shared_with must be a list of user ids")
        users = [str(user).strip()[:64] for user in raw if str(user).strip() and str(user).strip() != owner]
        return list(dict.fromkeys(users))[:MAX_SHARED_WITH]

    async def create_plan(self, data: Mapping[str, Any], actor: Actor = SYSTEM) -> dict[str, Any]:
        name = _clean_name(data.get("name"), "A plan needs a name")
        archetype = data.get("archetype")
        if archetype not in ARCHETYPES:
            raise PlannerError("invalid", "Unknown plan type")
        is_private = bool(data.get("is_private"))
        if is_private and actor.user_id is None:
            raise PlannerError("invalid", "Private plans belong to a signed-in user")
        plan = await self.db.create_plan(
            {
                "name": name,
                "archetype": archetype,
                "icon": _clean_icon(data.get("icon")),
                "color": _clean_color(data.get("color")),
                "is_template": False,
                "settings": self._clean_plan_settings(dict(data.get("settings") or {}), None, actor, is_private),
                "owner_user_id": actor.user_id,
                "is_private": is_private,
                "shared_with": self._clean_shared_with(data.get("shared_with"), actor.user_id) if is_private else [],
            }
        )
        self._notify([plan["id"]])
        return plan

    async def update_plan(self, plan_id: str, changes: Mapping[str, Any], actor: Actor = SYSTEM) -> dict[str, Any]:
        plan = await self._require_plan(plan_id)
        if not self.can_access(plan, actor):
            raise _not_found()
        allowed: dict[str, Any] = {}
        if "name" in changes:
            allowed["name"] = _clean_name(changes["name"], "A plan needs a name")
        if "icon" in changes:
            allowed["icon"] = _clean_icon(changes["icon"])
        if "color" in changes:
            allowed["color"] = _clean_color(changes["color"])
        if "archived" in changes and bool(changes["archived"]) != plan["archived"]:
            if not self.can_manage(plan, actor):
                raise PlannerError("unauthorized", "Only an administrator (or the owner of a private list) can archive it")
            allowed["archived"] = bool(changes["archived"])
        is_private = plan["is_private"]
        if "is_private" in changes and bool(changes["is_private"]) != plan["is_private"]:
            is_private = bool(changes["is_private"])
            if actor.user_id is None:
                raise PlannerError("invalid", "Private plans belong to a signed-in user")
            if is_private:
                # Hiding a household list from everyone else is an admin decision unless you created it.
                if not (actor.is_admin or plan.get("owner_user_id") == actor.user_id):
                    raise PlannerError("unauthorized", "Only an administrator or the list's creator can make it private")
                if (plan.get("settings") or {}).get("role"):
                    raise PlannerError("invalid", "Clear this list's routing role before making it private")
                allowed["owner_user_id"] = actor.user_id
            else:
                if plan.get("owner_user_id") != actor.user_id:
                    raise PlannerError("unauthorized", "Only the owner can share a private list with the household")
                allowed["shared_with"] = []
            allowed["is_private"] = is_private
        if "shared_with" in changes and is_private and "shared_with" not in allowed:
            if plan.get("owner_user_id") != actor.user_id and actor.user_id is not None:
                raise PlannerError("unauthorized", "Only the owner can change who a private list is shared with")
            allowed["shared_with"] = self._clean_shared_with(changes["shared_with"], plan.get("owner_user_id"))
        if "settings" in changes:
            allowed["settings"] = self._clean_plan_settings(
                dict(changes["settings"] or {}), plan.get("settings"), actor, is_private
            )
        elif is_private and (plan.get("settings") or {}).get("role"):
            allowed["settings"] = self._clean_plan_settings({}, plan.get("settings"), actor, True)
        updated = await self.db.update_plan(plan_id, allowed)
        assert updated is not None
        self._notify([plan_id])
        return updated

    async def delete_plan(self, plan_id: str, actor: Actor = SYSTEM) -> None:
        plan = await self._require_plan(plan_id)
        if not self.can_access(plan, actor):
            raise _not_found()
        if not self.can_manage(plan, actor):
            raise PlannerError("unauthorized", "Only an administrator (or the owner of a private list) can delete it")
        await self.db.delete_plan(plan_id)
        await self._resolve_blocking()
        self._notify([plan_id])

    async def clone_plan(
        self, template_id: str, name: str | None = None, start_date: str | None = None, actor: Actor = SYSTEM
    ) -> dict[str, Any]:
        """Duplicate a plan: its sections and every item that isn't part of a trip."""
        template = await self._require_plan(template_id)
        if not self.can_access(template, actor):
            raise _not_found()
        title = _clean_name((name or "").strip() or f"{template['name']} – {self.today().strftime('%b %d')}", "")
        tasks = [task for task in await self.db.list_tasks(template_id) if not task["trip_id"]]
        uid_map = {task["uid"]: new_id() for task in tasks}
        parents = {task["uid"]: task["parent_uid"] for task in tasks}
        sections = await self.db.list_sections([template_id])
        private = template["is_private"] and actor.user_id is not None

        def depth(uid: str) -> int:
            level, seen = 0, set()
            while parents.get(uid) and uid not in seen:
                seen.add(uid)
                uid = parents[uid]
                level += 1
            return level

        due = parse_date(start_date)
        settings = {k: v for k, v in (template.get("settings") or {}).items() if k not in ("role", "mealie_list_id", PERSONAL_QUICK_KEY)}
        async with self.db.transaction():
            plan = await self.db.tx_create_plan(
                {
                    "name": title,
                    "archetype": template["archetype"],
                    "icon": template.get("icon"),
                    "color": template.get("color"),
                    "is_template": False,
                    "template_id": template_id,
                    "settings": settings,
                    "owner_user_id": actor.user_id or template.get("owner_user_id"),
                    "is_private": private or (template["is_private"] and actor.user_id is None),
                    "shared_with": template.get("shared_with") if template["is_private"] and actor.user_id is None else [],
                }
            )
            section_map = {}
            for section in sections:
                created = await self.db.tx_create_section(plan["id"], section["name"], section["position"])
                section_map[section["id"]] = created["id"]
            for task in sorted(tasks, key=lambda t: (depth(t["uid"]), t["position"])):
                await self.db.tx_create_task(
                    {
                        "uid": uid_map[task["uid"]],
                        "plan_id": plan["id"],
                        "parent_uid": uid_map.get(task["parent_uid"]) if task["parent_uid"] else None,
                        "section_id": section_map.get(task["section_id"]),
                        "summary": task["summary"],
                        "description": task["description"],
                        "priority": task["priority"],
                        "category": task["category"],
                        "quantity": task["quantity"],
                        "context_tags": task["context_tags"],
                        "assigned_to": task["assigned_to"],
                        "is_repeatable": task["is_repeatable"],
                        "position": task["position"],
                        "due_date": due.isoformat() if due else None,
                        "source": SOURCE_MANUAL,
                    }
                )
        if template["archetype"] == ARCHETYPE_HOARD and self.hoard is not None:
            await self.hoard.clone_sections(template_id, plan["id"])
        self._notify([plan["id"]])
        return plan

    async def reset_plan(self, plan_id: str) -> int:
        """"Reset All": un-check every item (packing lists after unpacking)."""
        await self._require_plan(plan_id)
        tasks = await self.db.list_tasks(plan_id)
        updates = {
            task["uid"]: {"status": STATUS_NEEDS_ACTION, "completed_at": None, "completed_by": None}
            for task in tasks
            if task["status"] == STATUS_COMPLETED
        }
        await self.db.update_tasks(updates)
        await self._resolve_blocking()
        self._notify([plan_id])
        return len(updates)

    # ------------------------------------------------------------------
    # Board
    # ------------------------------------------------------------------
    async def get_board(self, plan_id: str | None = None, actor: Actor = SYSTEM) -> dict[str, Any]:
        """Everything the card renders, limited to what ``actor`` may see."""
        quick = await self.quick_lists(actor)
        all_plans = await self.db.list_plans(include_archived=True)
        plans = [plan for plan in all_plans if self.can_access(plan, actor)]
        accessible = {plan["id"] for plan in plans}
        active_ids = [plan["id"] for plan in plans if not plan["archived"]]
        if plan_id:
            if plan_id not in accessible:
                raise _not_found()
            active_ids = [plan_id]
        tasks = await self.db.list_tasks(plan_ids=active_ids)
        edges = await self.db.list_dependencies()
        statuses = {task["uid"]: task["status"] for task in tasks}
        summaries = {task["uid"]: task["summary"] for task in tasks}
        # Blockers may live in other plans; ones the actor can't see are named generically.
        missing = {b for t, b in edges if t in statuses and b not in statuses}
        for task in await self.db.get_tasks(list(missing)):
            statuses[task["uid"]] = task["status"]
            summaries[task["uid"]] = task["summary"] if task["plan_id"] in accessible else "Private task"
        blockers = dependencies.blockers_by_task(edges)
        last_done = await self.db.last_completions([task["uid"] for task in tasks])
        rules = {rule["task_uid"]: rule for rule in await self.db.list_snooze_rules()}
        today = self.today()
        for task in tasks:
            uid = task["uid"]
            task["blocked_by"] = sorted(blockers.get(uid, ()))
            task["open_blockers"] = [
                {"uid": b, "summary": summaries.get(b, "")}
                for b in task["blocked_by"]
                if b in statuses and statuses[b] != STATUS_COMPLETED
            ]
            task["last_done"] = last_done.get(uid)
            task["recurrence_label"] = recurrence.describe(
                task["recurrence_mode"], task["recurrence_rule"], task["recurrence_interval_days"]
            )
            due = parse_date(task["due_date"])
            if (
                task["recurrence_mode"] != RECURRENCE_NONE
                and task["status"] != STATUS_COMPLETED
                and due is not None
                and due < today
            ):
                task["streak"] = 0
            rule = rules.get(uid)
            if rule:
                task["snooze_rule"] = {
                    "rule_type": rule["rule_type"],
                    "config": rule["config"],
                    "label": describe_rule(rule["rule_type"], rule["config"]),
                }
            for internal in ("sync_hash", "synced_at", "status_before_snooze", "status_before_block", "external_id", "reminded_for"):
                task.pop(internal, None)
        visible = set(active_ids)
        trips = await self.db.list_trips(active_ids)
        packed: dict[str, list[int]] = {}
        for task in tasks:
            if task["trip_id"] and not task["parent_uid"]:
                counts = packed.setdefault(task["trip_id"], [0, 0])
                counts[1] += 1
                counts[0] += task["status"] == STATUS_COMPLETED
        for trip in trips:
            trip["packed"], trip["total"] = packed.get(trip["id"], [0, 0])
        for plan in plans:
            plan["can_manage"] = self.can_manage(plan, actor)
            plan["is_owner"] = actor.user_id is not None and plan.get("owner_user_id") == actor.user_id
            if plan["archetype"] == ARCHETYPE_PACKING and plan["id"] in visible:
                plan["repeatable_count"] = len(_unique_by_name(await self.db.repeatable_items(plan["id"])))
        return {
            "plans": plans,
            "tasks": tasks,
            "sections": await self.db.list_sections(active_ids),
            "trips": trips,
            "pantry": [item for item in await self.db.list_pantry() if item["plan_id"] in visible],
            "maintenance": await self.maintenance.summary([p["id"] for p in plans if p["id"] in visible and p["archetype"] == ARCHETYPE_MAINTENANCE])
            if self.maintenance is not None
            else {},
            "bom": [item for item in await self.db.list_bom() if item["plan_id"] in visible],
            "quick": quick,
            "prefs": await self.get_prefs(actor),
            "user": {"id": actor.user_id, "name": actor.user_name, "is_admin": actor.is_admin or actor.user_id is None},
            "today": today.isoformat(),
            "now": utc_now_iso(),
            "rollover_hour": self.rollover_hour,
        }

    async def task_history(self, uid: str, limit: int = 20) -> list[dict[str, Any]]:
        return await self.db.completion_history(uid, min(max(int(limit), 1), 200))

    # ------------------------------------------------------------------
    # Per-user preferences
    # ------------------------------------------------------------------
    async def get_prefs(self, actor: Actor) -> dict[str, Any]:
        prefs: dict[str, Any] = {key: [] for key in (*PREF_KEYS, PREF_MAINT_VIEWS)}
        if actor.user_id:
            stored = await self.db.get_prefs(actor.user_id)
            prefs.update({key: value for key, value in stored.items() if key in prefs})
        return prefs

    async def set_prefs(self, actor: Actor, changes: Mapping[str, Any]) -> dict[str, Any]:
        if not actor.user_id:
            raise PlannerError("invalid", "Preferences belong to a signed-in user")
        clean: dict[str, Any] = {}
        for key, value in changes.items():
            if key == PREF_MAINT_VIEWS:
                clean[key] = _clean_saved_views(value)
                continue
            if key not in PREF_KEYS:
                raise PlannerError("invalid", "Unknown preference")
            if not isinstance(value, (list, tuple)) or len(value) > MAX_LIST:
                raise PlannerError("invalid", "Preferences are lists of up to 500 entries")
            clean[key] = list(dict.fromkeys(str(item)[:PREF_VALUE_MAX] for item in value if str(item)))
        await self.db.set_prefs(actor.user_id, clean)
        return await self.get_prefs(actor)

    # ------------------------------------------------------------------
    # Undo (payloads stay on the server; clients hold opaque tokens)
    # ------------------------------------------------------------------
    def stash_undo(self, kind: str, payload: Any, actor: Actor) -> str:
        now = self.now()
        for token in [t for t, entry in self._undo.items() if entry["expires"] <= now]:
            self._undo.pop(token, None)
        while len(self._undo) >= MAX_UNDO_ENTRIES:
            self._undo.pop(next(iter(self._undo)))
        token = new_id()
        self._undo[token] = {
            "kind": kind,
            "payload": payload,
            "user_id": actor.user_id,
            "expires": now + timedelta(seconds=UNDO_TTL_SECONDS),
        }
        return token

    def clear_undo(self) -> None:
        """Forget every pending undo (after a restore their payloads describe another database)."""
        self._undo.clear()

    async def undo(self, token: str, actor: Actor) -> dict[str, Any]:
        entry = self._undo.get(token)
        if entry is None or entry["expires"] <= self.now() or entry["user_id"] != actor.user_id:
            raise PlannerError("undo_expired", "There is nothing to undo")
        self._undo.pop(token, None)
        kind, payload = entry["kind"], entry["payload"]
        plans_map = await self._plans_map()

        def allowed(plan_id: str | None) -> bool:
            return self.can_access(plans_map.get(plan_id or ""), actor)

        if kind == "tasks":
            snapshot = {**payload, "tasks": [t for t in payload.get("tasks") or [] if allowed(t.get("plan_id"))]}
            return {"restored": await self.restore(snapshot)}
        if kind == "pantry":
            if not allowed(payload.get("plan_id")):
                raise _not_found()
            await self.db.restore_pantry_item(payload)
            self._notify([payload["plan_id"]])
            return {"restored": [payload["id"]]}
        if kind == "trip":
            trip = payload["trip"]
            if not trip or not allowed(trip.get("plan_id")):
                raise _not_found()
            await self.db.restore_trip(trip)
            restored = await self.restore(payload["tasks"])
            self._notify([trip["plan_id"]])
            return {"restored": restored, "trip_id": trip["id"]}
        handler = self.undo_handlers.get(kind)
        if handler is not None:
            return await handler(payload, actor)
        if kind == "section":
            section = payload["section"]
            if not allowed(section.get("plan_id")):
                raise _not_found()
            await self.db.restore_section(section, payload["task_uids"])
            self._notify([section["plan_id"]])
            return {"restored": [section["id"]]}
        raise PlannerError("undo_expired", "There is nothing to undo")

    # ------------------------------------------------------------------
    # Quick-list sections
    # ------------------------------------------------------------------
    async def save_section(self, data: Mapping[str, Any]) -> dict[str, Any]:
        name = _clean_name(data.get("name"), "A section needs a name")
        if data.get("id"):
            section = await self.db.get_section(data["id"])
            if section is None:
                raise _not_found()
            updated = await self.db.update_section(section["id"], {"name": name})
            self._notify([section["plan_id"]])
            assert updated is not None
            return updated
        plan = await self._require_plan(data.get("plan_id"))
        if plan["archetype"] != ARCHETYPE_QUICK:
            raise PlannerError("invalid", "Sections belong to quick lists")
        section = await self.db.create_section(plan["id"], name)
        self._notify([plan["id"]])
        return section

    async def delete_section(self, section_id: str) -> dict[str, Any]:
        section = await self.db.get_section(section_id)
        if section is None:
            raise _not_found()
        task_uids = await self.db.delete_section(section_id)
        self._notify([section["plan_id"]])
        return {"section": section, "task_uids": task_uids}

    async def reorder_sections(self, plan_id: str, section_ids: Sequence[str]) -> list[dict[str, Any]]:
        await self._require_plan(plan_id)
        await self.db.reorder_sections(plan_id, section_ids)
        self._notify([plan_id])
        return await self.db.list_sections([plan_id])

    # ------------------------------------------------------------------
    # Packing trips
    # ------------------------------------------------------------------
    def _trip_status(self, start: date | None, current: str | None = None) -> str:
        if current == TRIP_ARCHIVED:
            return TRIP_ARCHIVED
        return TRIP_UPCOMING if start is not None and start > self.today() else TRIP_ACTIVE

    @staticmethod
    def _trip_dates(start_raw: Any, end_raw: Any) -> tuple[date | None, date | None]:
        start, end = parse_date(start_raw), parse_date(end_raw)
        if start_raw and start is None or end_raw and end is None:
            raise PlannerError("invalid", "Trip dates must look like 2026-11-14")
        if start and end and end < start:
            raise PlannerError("invalid", "A trip can't end before it starts")
        return start, end or start

    async def create_trip(
        self,
        plan_id: str,
        name: str,
        start_date: Any = None,
        end_date: Any = None,
        actor: Actor = SYSTEM,
    ) -> dict[str, Any]:
        """Create a trip and pre-fill it with fresh copies of every repeatable item."""
        plan = await self._require_plan(plan_id)
        if plan["archetype"] != ARCHETYPE_PACKING:
            raise PlannerError("invalid", "Trips belong to packing plans")
        title = _clean_name(name, "A trip needs a name")
        start, end = self._trip_dates(start_date, end_date)
        templates = _unique_by_name(await self.db.repeatable_items(plan_id))
        templates.sort(key=lambda t: ((t["category"] or "~").lower(), t["position"]))
        async with self.db.transaction():
            trip = await self.db.tx_create_trip(
                {
                    "plan_id": plan_id,
                    "name": title,
                    "start_date": start.isoformat() if start else None,
                    "end_date": end.isoformat() if end else None,
                    "status": self._trip_status(start),
                    "created_by": actor.label,
                }
            )
            for position, item in enumerate(templates, start=1):
                await self.db.tx_create_task(
                    {
                        "plan_id": plan_id,
                        "trip_id": trip["id"],
                        "summary": item["summary"],
                        "description": item["description"],
                        "category": item["category"],
                        "quantity": item["quantity"],
                        "priority": item["priority"],
                        "is_repeatable": True,
                        "position": position,
                        "created_by": actor.label,
                        "source": SOURCE_MANUAL,
                    }
                )
        self._notify([plan_id])
        return {"trip": trip, "added": len(templates)}

    async def update_trip(self, trip_id: str, changes: Mapping[str, Any]) -> dict[str, Any]:
        trip = await self.db.get_trip(trip_id)
        if trip is None:
            raise _not_found()
        allowed: dict[str, Any] = {}
        if "name" in changes:
            allowed["name"] = _clean_name(changes["name"], "A trip needs a name")
        start_raw = changes.get("start_date", trip["start_date"])
        end_raw = changes.get("end_date", trip["end_date"])
        if "start_date" in changes or "end_date" in changes:
            start, end = self._trip_dates(start_raw, end_raw)
            allowed["start_date"] = start.isoformat() if start else None
            allowed["end_date"] = end.isoformat() if end else None
        status = trip["status"]
        if "status" in changes:
            if changes["status"] not in TRIP_STATUSES:
                raise PlannerError("invalid", "Unknown trip status")
            status = changes["status"]
        start = parse_date(allowed.get("start_date", trip["start_date"]))
        allowed["status"] = TRIP_ARCHIVED if status == TRIP_ARCHIVED else self._trip_status(start)
        updated = await self.db.update_trip(trip_id, allowed)
        self._notify([trip["plan_id"]])
        assert updated is not None
        return updated

    async def delete_trip(self, trip_id: str) -> dict[str, Any]:
        trip = await self.db.get_trip(trip_id)
        if trip is None:
            raise _not_found()
        payload = await self.db.delete_trip(trip_id)
        await self._resolve_blocking()
        self._notify([trip["plan_id"]])
        return payload

    async def reset_trip(self, trip_id: str) -> int:
        """Un-check every item of one trip (e.g. to reuse a list after unpacking)."""
        trip = await self.db.get_trip(trip_id)
        if trip is None:
            raise _not_found()
        updates = {
            task["uid"]: {"status": STATUS_NEEDS_ACTION, "completed_at": None, "completed_by": None}
            for task in await self.db.list_tasks(trip_id=trip_id)
            if task["status"] == STATUS_COMPLETED
        }
        await self.db.update_tasks(updates)
        self._notify([trip["plan_id"]])
        return len(updates)

    async def set_repeatable(self, uid: str, repeatable: bool) -> list[str]:
        """Flag an item as always-pack. Copies of the same item in other trips follow, so one
        switch decides whether it lands in future trips."""
        task = await self._require_task(uid)
        key = name_key(task["summary"])
        updates = {
            other["uid"]: {"is_repeatable": bool(repeatable)}
            for other in await self.db.list_tasks(task["plan_id"], top_level_only=True)
            if name_key(other["summary"]) == key and other["is_repeatable"] != bool(repeatable)
        }
        if task["parent_uid"] is None:
            updates.setdefault(uid, {"is_repeatable": bool(repeatable)})
        await self.db.update_tasks(updates, touch=False)
        self._notify([task["plan_id"]])
        return sorted(updates)

    async def process_trips(self) -> int:
        """Upcoming trips become active on their start date."""
        trips = await self.db.trips_to_activate(self.today().isoformat())
        for trip in trips:
            await self.db.update_trip(trip["id"], {"status": TRIP_ACTIVE})
        self._notify(trip["plan_id"] for trip in trips)
        return len(trips)

    async def default_trip_id(self, plan_id: str) -> str | None:
        """Where an item moved into a packing plan goes: the soonest trip that isn't archived."""
        trips = [t for t in await self.db.list_trips([plan_id]) if t["status"] != TRIP_ARCHIVED]
        trips.sort(key=lambda t: (t["start_date"] or "9999", t["position"]))
        return trips[0]["id"] if trips else None

    # ------------------------------------------------------------------
    # Task input normalization
    # ------------------------------------------------------------------
    def _normalize(self, data: Mapping[str, Any], plan: Mapping[str, Any] | None) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for key in _TEXT_FIELDS:
            if key in data:
                value = data[key]
                out[key] = str(value).strip() if value not in (None, "") else None
                if out[key] and len(out[key]) > _TEXT_LIMITS[key]:
                    raise PlannerError("invalid", f"{key.replace('_', ' ').capitalize()} is too long")
        if "summary" in out and not out["summary"]:
            raise PlannerError("invalid", "A task needs a summary")
        if out.get("link_url"):
            out["link_url"] = _safe_link(out["link_url"])
        for key in ("section_id", "trip_id"):
            if key in data:
                out[key] = str(data[key]) if data[key] else None
        if "is_repeatable" in data:
            out["is_repeatable"] = bool(data["is_repeatable"])
        if "status" in data:
            if data["status"] not in STATUSES:
                raise PlannerError("invalid", f"Unknown status {data['status']}")
            out["status"] = data["status"]
        if "priority" in data:
            out["priority"] = data["priority"] if data["priority"] in PRIORITIES else "none"
        if "time_of_day_bucket" in data:
            out["time_of_day_bucket"] = data["time_of_day_bucket"] if data["time_of_day_bucket"] in BUCKETS else BUCKET_ANYTIME
        if "due_datetime" in data:
            due = parse_datetime(data["due_datetime"], self.tz)
            out["due_datetime"] = to_utc_iso(due) if due else None
            if due:
                local = due.astimezone(self.tz)
                out["due_date"] = local.date().isoformat()
                if "time_of_day_bucket" not in data or data.get("time_of_day_bucket") == BUCKET_ANYTIME:
                    out["time_of_day_bucket"] = bucket_for_hour(local.hour)
            elif "due_date" not in data:
                out["due_date"] = None
        if "due_date" in data and not out.get("due_datetime"):
            parsed = parse_date(data["due_date"])
            out["due_date"] = parsed.isoformat() if parsed else None
            if "due_datetime" not in data:
                out["due_datetime"] = None
        if "recurrence_mode" in data:
            mode = data["recurrence_mode"] or RECURRENCE_NONE
            if mode not in RECURRENCE_MODES:
                raise PlannerError("invalid", f"Unknown recurrence mode {mode}")
            out["recurrence_mode"] = mode
        if "recurrence_rule" in data:
            rule = data["recurrence_rule"]
            if rule:
                try:
                    out["recurrence_rule"] = recurrence.validate_rrule(str(rule))
                except (ValueError, TypeError) as err:
                    raise PlannerError("invalid", f"Invalid recurrence rule: {err}") from err
            else:
                out["recurrence_rule"] = None
        for key in ("recurrence_interval_days", "estimated_minutes"):
            if key in data:
                out[key] = _int_or_none(data[key], minimum=1)
        if "context_tags" in data:
            out["context_tags"] = [str(tag).strip()[:MAX_NAME] for tag in data["context_tags"] or [] if str(tag).strip()][:50]
        if "assigned_to" in data:
            raw = data["assigned_to"]
            if isinstance(raw, str):
                raw = [raw]
            out["assigned_to"] = list(dict.fromkeys(str(p) for p in raw or [] if p and p != POOL))
        if "kanban_column" in data:
            out["kanban_column"] = data["kanban_column"] if data["kanban_column"] in KANBAN_COLUMNS else None
        for key in ("shift_aware", "hide_when_blocked"):
            if key in data:
                out[key] = bool(data[key])
        if "parent_uid" in data:
            out["parent_uid"] = data["parent_uid"] or None
        if "expires_at" in data:
            expires = parse_datetime(data["expires_at"], self.tz)
            out["expires_at"] = to_utc_iso(expires) if expires else None
        if "sensor_entity_id" in data:
            out["sensor_entity_id"] = (str(data["sensor_entity_id"]).strip() or None) if data["sensor_entity_id"] else None
        if "sensor_mode" in data:
            out["sensor_mode"] = data["sensor_mode"] if data["sensor_mode"] in SENSOR_MODES else None
        for key in ("sensor_threshold", "sensor_baseline"):
            if key in data:
                out[key] = _float_or_none(data[key])
        if "source" in data and data["source"]:
            out["source"] = str(data["source"])
        if "extra" in data and isinstance(data["extra"], Mapping):
            out["extra"] = dict(data["extra"])
        try:
            if "remind_target" in data:
                out["remind_target"] = reminders.clean_target(data["remind_target"])
            if "remind_time" in data:
                out["remind_time"] = reminders.clean_time(data["remind_time"])
        except ValueError as err:
            raise PlannerError("invalid", str(err)) from err
        return out

    def _check_reminder(self, fields: dict[str, Any], current: Mapping[str, Any] | None, actor: Actor) -> None:
        """Vet a new reminder target, and start a changed reminder fresh.

        A target only has to pass the check when it changes, so a task whose phone
        has since been removed can still be edited. When the target, time or due
        date changes, the reminder may go out again for the current occurrence,
        unless its time has already gone by.
        """
        target = fields.get("remind_target")
        if target and target != (current or {}).get("remind_target"):
            if self.reminder_allowed is not None and not self.reminder_allowed(target, actor):
                raise PlannerError("invalid", "Pick a phone from the list (other notify services need an administrator)")
        keys = ("remind_target", "remind_time", "due_date", "due_datetime", "time_of_day_bucket")
        if current is not None and not any(k in fields and fields[k] != current.get(k) for k in keys):
            return
        merged = {**(current or {}), **fields}
        if not merged.get("remind_target"):
            return
        fields["reminded_for"] = merged.get("due_date") if reminders.already_past(merged, self.now(), self.tz) else None

    async def due_reminders(self) -> list[dict[str, Any]]:
        """Tasks whose reminder should go out now. Late ones are marked handled here without being returned."""
        now = self.now()
        candidates = await self.db.reminder_candidates(now.astimezone(self.tz).date().isoformat())
        due: list[dict[str, Any]] = []
        stale: dict[str, dict[str, Any]] = {}
        for task in candidates:
            state = reminders.reminder_state(task, now, self.tz)
            if state == reminders.SEND:
                due.append(task)
            elif state == reminders.STALE:
                stale[task["uid"]] = {"reminded_for": task["due_date"]}
        if stale:
            await self.db.update_tasks(stale, touch=False)
        for task in due:
            task["recurrence_label"] = recurrence.describe(task["recurrence_mode"], task["recurrence_rule"], task["recurrence_interval_days"])
        return due

    async def mark_reminded(self, uid: str, due_date: str | None) -> None:
        await self.db.update_tasks({uid: {"reminded_for": due_date}}, touch=False)

    # ------------------------------------------------------------------
    # Task CRUD
    # ------------------------------------------------------------------
    async def save_task(self, data: Mapping[str, Any], actor: Actor = SYSTEM) -> dict[str, Any]:
        """Create (no ``uid``) or update a task. Supports ``blocked_by`` (list of uids)."""
        if data.get("uid") and await self.db.get_task(data["uid"]) is not None:
            return await self._update_task(data["uid"], data, actor)
        return await self._create_task(data, actor)

    async def _create_task(self, data: Mapping[str, Any], actor: Actor) -> dict[str, Any]:
        parent = None
        if data.get("parent_uid"):
            parent = await self._require_task(data["parent_uid"])
        plan = await self._require_plan(parent["plan_id"] if parent else data.get("plan_id"))
        if plan["archetype"] == ARCHETYPE_HOARD:
            raise PlannerError("invalid", "Add wishlist items in the Wishlist view")
        if plan["archetype"] == ARCHETYPE_MAINTENANCE:
            # Maintenance plans hold objects and their tasks, not plain to-dos.
            if self.maintenance is None or parent is not None:
                raise PlannerError("invalid", "Add maintenance tasks to an object in the Maintenance view")
            fields = self._normalize(data, plan)
            if not fields.get("summary"):
                raise PlannerError("invalid", "A task needs a summary")
            return await self.maintenance.create_from_task_fields(plan, fields, actor)
        if plan["archetype"] == ARCHETYPE_SHOPPING and parent is None and data.get("dedupe", True) and not data.get("uid"):
            return (
                await self.add_shopping_item(
                    plan["id"],
                    str(data.get("summary") or ""),
                    actor,
                    category=data.get("category"),
                    quantity=data.get("quantity"),
                    extra_fields={k: v for k, v in data.items() if k not in ("summary", "category", "quantity", "plan_id")},
                )
            )["task"]
        fields = self._normalize(data, plan)
        if not fields.get("summary"):
            raise PlannerError("invalid", "A task needs a summary")
        requested_status = fields.pop("status", STATUS_NEEDS_ACTION)
        fields["plan_id"] = plan["id"]
        fields["status"] = (
            requested_status if requested_status in (STATUS_NEEDS_ACTION, STATUS_IN_PROCESS, STATUS_BLOCKED) else STATUS_NEEDS_ACTION
        )
        fields.setdefault("source", SOURCE_MANUAL)
        fields["created_by"] = actor.label
        if data.get("uid"):
            fields["uid"] = data["uid"]
        if parent is not None:
            fields["section_id"] = None
            fields["trip_id"] = None
        await self._check_containers(fields, plan["id"])
        if plan["archetype"] == ARCHETYPE_PACKING and parent is None and "is_repeatable" not in fields:
            # Master-list items are always packed; a name that is repeatable elsewhere stays repeatable.
            key = name_key(fields["summary"])
            fields["is_repeatable"] = not fields.get("trip_id") or any(
                name_key(t["summary"]) == key and t["is_repeatable"]
                for t in await self.db.list_tasks(plan["id"], top_level_only=True)
            )
        if plan["archetype"] == ARCHETYPE_PROJECTS and parent is None:
            fields.setdefault("kanban_column", KANBAN_IN_PROGRESS if fields["status"] == STATUS_IN_PROCESS else KANBAN_BACKLOG)
            if not fields.get("kanban_column"):
                fields["kanban_column"] = KANBAN_BACKLOG
        if plan["archetype"] == ARCHETYPE_SHOPPING and not fields.get("category"):
            fields["category"] = await self._category_for(fields["summary"], plan)
        self._apply_initial_due(fields)
        self._check_reminder(fields, None, actor)
        blocked_by = list(data.get("blocked_by") or [])
        async with self.db.transaction():
            task = await self.db.tx_create_task(fields)
            if blocked_by:
                await self._tx_set_blockers(task["uid"], blocked_by)
        if requested_status == STATUS_COMPLETED:
            await self.set_completed(task["uid"], True, actor)
        await self._resolve_blocking()
        self._notify([plan["id"]])
        return await self._require_task(task["uid"])

    def _apply_initial_due(self, fields: dict[str, Any], existing: Mapping[str, Any] | None = None) -> None:
        mode = fields.get("recurrence_mode", (existing or {}).get("recurrence_mode", RECURRENCE_NONE))
        if mode == RECURRENCE_NONE:
            return
        due = fields["due_date"] if "due_date" in fields else (existing or {}).get("due_date")
        if due:
            return
        rule = fields.get("recurrence_rule", (existing or {}).get("recurrence_rule"))
        interval = fields.get("recurrence_interval_days", (existing or {}).get("recurrence_interval_days"))
        first = recurrence.initial_due_date(mode=mode, rule=rule, interval_days=interval, anchor=None, today=self.today())
        if first:
            fields["due_date"] = first.isoformat()
            extra = dict(fields.get("extra") or (existing or {}).get("extra") or {})
            extra.setdefault("recurrence_anchor", first.isoformat())
            fields["extra"] = extra

    async def _update_task(self, uid: str, data: Mapping[str, Any], actor: Actor) -> dict[str, Any]:
        task = await self._require_task(uid)
        plans = await self._plans_map()
        target_plan_id = data.get("plan_id") or task["plan_id"]
        if target_plan_id not in plans:
            raise PlannerError("plan_not_found", f"Plan {target_plan_id} not found")
        plan = plans[target_plan_id]
        if plan["archetype"] == ARCHETYPE_HOARD and target_plan_id != task["plan_id"]:
            raise PlannerError("invalid", "Tasks can't move into a wishlist; add the item in the Wishlist view")
        if plan["archetype"] == ARCHETYPE_MAINTENANCE and target_plan_id != task["plan_id"]:
            if self.maintenance is None or task["parent_uid"]:
                raise PlannerError("invalid", "Only top-level tasks can move into a maintenance plan")
            merged = {**{k: task.get(k) for k in ("summary", "description", "priority", "due_date", "due_datetime", "recurrence_mode", "recurrence_rule", "recurrence_interval_days", "assigned_to")}, **self._normalize(data, plan)}
            created = await self.maintenance.create_from_task_fields(plan, merged, actor)
            await self.delete_tasks([uid])
            return created
        fields = self._normalize(data, plan)
        requested_status = fields.pop("status", None)
        affected = {task["plan_id"], target_plan_id}

        if "kanban_column" in fields and fields["kanban_column"] and requested_status is None:
            requested_status = _status_for_column(fields["kanban_column"], task["status"])
        if requested_status == STATUS_IN_PROCESS and plan["archetype"] == ARCHETYPE_PROJECTS:
            fields.setdefault("kanban_column", KANBAN_IN_PROGRESS)
        if "recurrence_mode" in fields or "recurrence_rule" in fields or "recurrence_interval_days" in fields:
            self._apply_initial_due(fields, task)
        self._check_reminder(fields, task, actor)
        if plan["archetype"] == ARCHETYPE_SHOPPING and fields.get("category") and fields["category"] != task["category"]:
            await self.db.set_history_category(plan["id"], name_key(fields.get("summary") or task["summary"]), fields["category"])

        moving = target_plan_id != task["plan_id"]
        if moving:
            fields["plan_id"] = target_plan_id
            if plan["archetype"] == ARCHETYPE_PROJECTS and not task["kanban_column"]:
                fields.setdefault("kanban_column", KANBAN_BACKLOG)
            # Sections and trips belong to one plan; a moved task starts fresh in the new one.
            fields.setdefault("section_id", None)
            if "trip_id" not in fields:
                fields["trip_id"] = (
                    await self.default_trip_id(target_plan_id)
                    if plan["archetype"] == ARCHETYPE_PACKING and not task["parent_uid"]
                    else None
                )
            if plan["archetype"] == ARCHETYPE_SHOPPING and not fields.get("category"):
                fields["category"] = await self._category_for(fields.get("summary") or task["summary"], plan)
        if task["parent_uid"] and "parent_uid" not in fields:
            fields.pop("section_id", None)
            fields.pop("trip_id", None)
        await self._check_containers(fields, target_plan_id)
        if "parent_uid" in fields and fields["parent_uid"]:
            if fields["parent_uid"] == uid or fields["parent_uid"] in {d["uid"] for d in await self.db.descendants(uid)}:
                raise PlannerError("invalid", "A task cannot be its own subtask")
        if requested_status in (STATUS_IN_PROCESS, STATUS_NEEDS_ACTION, STATUS_BLOCKED) and task["status"] not in (
            STATUS_COMPLETED,
            STATUS_SNOOZED,
        ):
            fields["status"] = requested_status

        async with self.db.transaction():
            if fields:
                await self.db.tx_update_task(uid, fields)
            if moving:
                for child in await self.db.descendants(uid):
                    await self.db.tx_update_task(
                        child["uid"], {"plan_id": target_plan_id, "section_id": None, "trip_id": None}
                    )
            if "blocked_by" in data:
                await self._tx_set_blockers(uid, list(data.get("blocked_by") or []))

        if requested_status == STATUS_COMPLETED and task["status"] != STATUS_COMPLETED:
            await self.set_completed(uid, True, actor)
        elif requested_status in (STATUS_NEEDS_ACTION, STATUS_IN_PROCESS) and task["status"] == STATUS_COMPLETED:
            await self.set_completed(uid, False, actor)
            if requested_status == STATUS_IN_PROCESS:
                await self.db.update_task(uid, {"status": STATUS_IN_PROCESS})
        elif requested_status in (STATUS_NEEDS_ACTION, STATUS_IN_PROCESS) and task["status"] == STATUS_SNOOZED:
            await self.unsnooze(uid, reason="manual")
        elif requested_status == STATUS_SNOOZED and task["status"] != STATUS_SNOOZED:
            until = fields.get("snoozed_until") or data.get("snoozed_until")
            if until:
                await self.snooze_until(uid, until, actor)
        await self._resolve_blocking()
        self._notify(affected)
        return await self._require_task(uid)

    async def _check_containers(self, fields: Mapping[str, Any], plan_id: str) -> None:
        """A task's section and trip must belong to the task's own plan."""
        if fields.get("section_id"):
            section = await self.db.get_section(fields["section_id"])
            if section is None or section["plan_id"] != plan_id:
                raise PlannerError("invalid", "That section is not part of this list")
        if fields.get("trip_id"):
            trip = await self.db.get_trip(fields["trip_id"])
            if trip is None or trip["plan_id"] != plan_id:
                raise PlannerError("invalid", "That trip is not part of this packing plan")

    async def transfer_task(
        self, uid: str, plan_id: str, changes: Mapping[str, Any] | None = None, actor: Actor = SYSTEM
    ) -> dict[str, Any]:
        """Promote a quick-list item into a structured plan, optionally making it recurring."""
        await self._require_task(uid)
        target = await self._require_plan(plan_id)
        if target["archetype"] == ARCHETYPE_PANTRY:
            raise PlannerError("invalid", "Pantry lists hold stock items, not tasks")
        payload = {k: v for k, v in (changes or {}).items() if k not in ("uid", "plan_id")}
        return await self._update_task(uid, {**payload, "uid": uid, "plan_id": plan_id}, actor)

    async def _tx_set_blockers(self, uid: str, blocker_uids: Sequence[str]) -> None:
        edges = [edge for edge in await self.db.list_dependencies() if edge[0] != uid]
        clean: list[str] = []
        for blocker in dict.fromkeys(blocker_uids):
            if not blocker or blocker == uid:
                continue
            if await self.db.get_task(blocker) is None:
                raise PlannerError("task_not_found", f"Blocking task {blocker} not found")
            if dependencies.would_create_cycle(edges, uid, blocker):
                raise PlannerError("dependency_cycle", "That dependency would create a cycle")
            edges.append((uid, blocker))
            clean.append(blocker)
        await self.db.tx_set_blockers(uid, clean)

    async def add_dependency(self, uid: str, blocker_uid: str) -> dict[str, Any]:
        task = await self._require_task(uid)
        blockers = await self.db.blockers_of(uid)
        async with self.db.transaction():
            await self._tx_set_blockers(uid, [*blockers, blocker_uid])
        await self._resolve_blocking()
        self._notify([task["plan_id"]])
        return await self._require_task(uid)

    async def remove_dependency(self, uid: str, blocker_uid: str) -> dict[str, Any]:
        task = await self._require_task(uid)
        await self.db.remove_dependency(uid, blocker_uid)
        await self._resolve_blocking()
        self._notify([task["plan_id"]])
        return await self._require_task(uid)

    async def delete_tasks(self, uids: Sequence[str]) -> dict[str, Any]:
        tasks = await self.db.get_tasks(list(uids))
        snapshot = await self.db.delete_tasks([task["uid"] for task in tasks])
        await self._resolve_blocking()
        self._notify(task["plan_id"] for task in tasks)
        return snapshot

    async def restore(self, snapshot: Mapping[str, Any]) -> list[str]:
        restored = await self.db.restore_snapshot(dict(snapshot))
        await self._resolve_blocking()
        self._notify(task.get("plan_id") for task in snapshot.get("tasks") or [])
        return restored

    async def clear_completed(self, plan_id: str) -> dict[str, Any]:
        """Delete completed one-off items (recurring ones are just "done for today")."""
        await self._require_plan(plan_id)
        tasks = await self.db.list_tasks(plan_id, statuses=[STATUS_COMPLETED], top_level_only=True)
        uids = [task["uid"] for task in tasks if task["recurrence_mode"] == RECURRENCE_NONE and not task["sensor_entity_id"]]
        return await self.delete_tasks(uids) if uids else {"tasks": [], "dependencies": [], "snooze_rules": []}

    async def move_task(
        self,
        uid: str,
        previous_uid: str | None = None,
        *,
        plan_id: str | None = None,
        parent_uid: Any = _UNSET,
        kanban_column: str | None = None,
        bucket: str | None = None,
        assign_to: str | None = None,
        category: str | None = None,
        section_id: Any = _UNSET,
        trip_id: Any = _UNSET,
        actor: Actor = SYSTEM,
    ) -> dict[str, Any]:
        """Reorder and/or re-home a task (drag and drop)."""
        task = await self._require_task(uid)
        changes: dict[str, Any] = {}
        if plan_id and plan_id != task["plan_id"]:
            changes["plan_id"] = plan_id
        if parent_uid is not _UNSET:
            changes["parent_uid"] = parent_uid
        if section_id is not _UNSET and (section_id or None) != task["section_id"]:
            changes["section_id"] = section_id or None
        if trip_id is not _UNSET and (trip_id or None) != task["trip_id"]:
            changes["trip_id"] = trip_id or None
        if kanban_column:
            changes["kanban_column"] = kanban_column
        if bucket:
            changes["time_of_day_bucket"] = bucket
        if assign_to is not None:
            changes["assigned_to"] = [] if assign_to in ("", POOL) else [assign_to]
        if category:
            changes["category"] = category
        if changes:
            task = await self._update_task(uid, {"uid": uid, **changes}, actor)
        siblings = [s["uid"] for s in await self.db.siblings(task["plan_id"], task["parent_uid"]) if s["uid"] != uid]
        if previous_uid and previous_uid in siblings:
            siblings.insert(siblings.index(previous_uid) + 1, uid)
        elif previous_uid:
            siblings.append(uid)
        else:
            siblings.insert(0, uid)
        await self.db.set_sibling_order(siblings)
        self._notify([task["plan_id"]])
        return await self._require_task(uid)

    async def claim_task(self, uid: str, person: str | None, actor: Actor = SYSTEM) -> dict[str, Any]:
        if not person:
            raise PlannerError("no_person", "Your user is not linked to a person entity")
        task = await self._require_task(uid)
        await self.db.update_task(uid, {"assigned_to": [person]})
        self._notify([task["plan_id"]])
        return await self._require_task(uid)

    async def bulk(self, uids: Sequence[str], action: str, value: Any = None, actor: Actor = SYSTEM) -> dict[str, Any]:
        result: dict[str, Any] = {"count": 0}
        if action == "delete":
            result["snapshot"] = await self.delete_tasks(uids)
            result["count"] = len(result["snapshot"]["tasks"])
            return result
        for uid in uids:
            if await self.db.get_task(uid) is None:
                continue
            if action == "complete":
                await self.set_completed(uid, True, actor)
            elif action == "uncomplete":
                await self.set_completed(uid, False, actor)
            elif action == "assign":
                await self._update_task(uid, {"assigned_to": [] if value in (None, "", POOL) else [value]}, actor)
            elif action == "move":
                await self._update_task(uid, {"plan_id": value}, actor)
            elif action == "priority":
                await self._update_task(uid, {"priority": value}, actor)
            elif action == "snooze":
                await self.snooze_until(uid, value, actor)
            elif action == "tag":
                task = await self._require_task(uid)
                await self._update_task(uid, {"context_tags": list(dict.fromkeys([*task["context_tags"], value]))}, actor)
            else:
                raise PlannerError("invalid", f"Unknown bulk action {action}")
            result["count"] += 1
        return result

    # ------------------------------------------------------------------
    # Completion
    # ------------------------------------------------------------------
    async def set_completed(self, uid: str, completed: bool, actor: Actor = SYSTEM) -> dict[str, Any]:
        """Complete or re-open a task, running the full pipeline. Returns details for the UI."""
        task = await self._require_task(uid)
        if completed:
            return await self._complete(task, actor)
        return await self._uncomplete(task)

    async def _complete(self, task: dict[str, Any], actor: Actor) -> dict[str, Any]:
        if task["status"] == STATUS_COMPLETED:
            return {"task": task, "unblocked": [], "next_due": task["due_date"]}
        plans = await self._plans_map()
        plan = plans.get(task["plan_id"], {})
        now_iso = to_utc_iso(self.now())
        today = self.today()
        current_due = parse_date(task["due_date"])
        extra = dict(task.get("extra") or {})
        undo: dict[str, Any] = {
            "completed_at": now_iso,
            "prev_status": task["status"],
            "prev_due_date": task["due_date"],
            "prev_due_datetime": task["due_datetime"],
            "prev_streak": task["streak"],
            "prev_kanban": task["kanban_column"],
            "children": [],
        }
        changes: dict[str, Any] = {
            "status": STATUS_COMPLETED,
            "completed_at": now_iso,
            "completed_by": actor.label,
            "snoozed_until": None,
            "status_before_snooze": None,
            "status_before_block": None,
        }
        if plan.get("archetype") == ARCHETYPE_PROJECTS and task["parent_uid"] is None:
            changes["kanban_column"] = KANBAN_DONE
        next_due: date | None = None
        if task["recurrence_mode"] != RECURRENCE_NONE:
            changes["streak"] = 1 if (current_due is not None and current_due < today) else int(task["streak"] or 0) + 1
            anchor = parse_date(extra.get("recurrence_anchor")) or current_due
            try:
                next_due = recurrence.next_due_date(
                    mode=task["recurrence_mode"],
                    rule=task["recurrence_rule"],
                    interval_days=task["recurrence_interval_days"],
                    current_due=current_due,
                    anchor=anchor,
                    completed_on=today,
                    today=today,
                )
            except ValueError as err:
                _LOGGER.warning("Bad recurrence on %s: %s", task["uid"], err)
            if next_due is not None:
                changes["due_date"] = next_due.isoformat()
                local_due = self._local_due(task)
                changes["due_datetime"] = (
                    to_utc_iso(datetime.combine(next_due, local_due.timetz().replace(tzinfo=None), self.tz))
                    if local_due
                    else None
                )

        async with self.db.transaction():
            undo["log_id"] = await self.db.tx_log_completion(
                task,
                person_entity_id=actor.person,
                user_id=actor.user_id,
                user_name=actor.user_name,
                completed_at=now_iso,
            )
            for child in await self.db.descendants(task["uid"]):
                if child["status"] != STATUS_COMPLETED:
                    undo["children"].append({"uid": child["uid"], "status": child["status"]})
                    await self.db.tx_update_task(
                        child["uid"], {"status": STATUS_COMPLETED, "completed_at": now_iso, "completed_by": actor.label}
                    )
            extra["undo"] = undo
            changes["extra"] = extra
            await self.db.tx_update_task(task["uid"], changes)
            await self.db.tx_delete_snooze_rules(task["uid"])

        acquired_plans = await self.db.set_bom_acquired_for_task(task["uid"], True)
        changes_made = await self._resolve_blocking()
        unblocked = [change.uid for change in changes_made if change.unblocked]
        updated = await self._require_task(task["uid"])
        self._fire(
            EVENT_TASK_COMPLETED,
            self._event_payload(
                plan,
                {
                    "uid": task["uid"],
                    "summary": task["summary"],
                    "plan_id": task["plan_id"],
                    "person": actor.person,
                    "user_name": actor.user_name,
                    "next_due": next_due.isoformat() if next_due else None,
                    "unblocked": unblocked,
                },
                "summary",
            ),
        )
        if task["source"] == SOURCE_MEALIE_COOK and self.on_cook_completed is not None:
            result = self.on_cook_completed(updated)
            if hasattr(result, "__await__"):
                await result
        if task["source"] == SOURCE_PANTRY and task["source_ref"]:
            ref = str(task["source_ref"])
            item = await self.db.get_pantry_item(ref.removeprefix(PANTRY_SHOPPING_PREFIX))
            # A finished batch task restocks the item; so does buying a staple that was pushed as itself.
            restocks = not ref.startswith(PANTRY_SHOPPING_PREFIX) or (item is not None and not item["ingredients"])
            if item is not None and restocks and item["stock_state"] != STOCK_IN:
                await self.db.save_pantry_item({"id": item["id"], "stock_state": STOCK_IN, "last_restocked_at": now_iso})
                acquired_plans.append(item["plan_id"])
        for hook in self.completion_hooks:
            result = hook(updated, actor)
            if hasattr(result, "__await__"):
                await result
        self._notify({task["plan_id"], *acquired_plans})
        return {"task": updated, "unblocked": unblocked, "next_due": next_due.isoformat() if next_due else None}

    async def _uncomplete(self, task: dict[str, Any]) -> dict[str, Any]:
        if task["status"] != STATUS_COMPLETED:
            return {"task": task, "unblocked": [], "next_due": task["due_date"]}
        plans = await self._plans_map()
        plan = plans.get(task["plan_id"], {})
        extra = dict(task.get("extra") or {})
        undo = extra.pop("undo", None)
        changes: dict[str, Any] = {"completed_at": None, "completed_by": None, "extra": extra}
        prev_status = STATUS_NEEDS_ACTION
        children_to_restore: list[dict[str, Any]] = []
        log_to_delete = None
        if undo and undo.get("completed_at") == task["completed_at"]:
            changes["due_date"] = undo.get("prev_due_date")
            changes["due_datetime"] = undo.get("prev_due_datetime")
            changes["streak"] = int(undo.get("prev_streak") or 0)
            if undo.get("prev_status") in (STATUS_IN_PROCESS, STATUS_NEEDS_ACTION):
                prev_status = undo["prev_status"]
            if plan.get("archetype") == ARCHETYPE_PROJECTS and task["parent_uid"] is None:
                changes["kanban_column"] = undo.get("prev_kanban") or KANBAN_READY
            children_to_restore = list(undo.get("children") or [])
            log_to_delete = undo.get("log_id")
        elif plan.get("archetype") == ARCHETYPE_PROJECTS and task["parent_uid"] is None:
            changes["kanban_column"] = KANBAN_READY
        if changes.get("kanban_column") == KANBAN_DONE:
            changes["kanban_column"] = KANBAN_READY
        changes["status"] = prev_status
        async with self.db.transaction():
            await self.db.tx_update_task(task["uid"], changes)
            for child in children_to_restore:
                await self.db.tx_update_task(
                    child["uid"],
                    {"status": child.get("status") or STATUS_NEEDS_ACTION, "completed_at": None, "completed_by": None},
                )
            if log_to_delete:
                await self.db.tx_delete_log(int(log_to_delete))
        acquired_plans = await self.db.set_bom_acquired_for_task(task["uid"], False)
        await self._resolve_blocking()
        self._notify({task["plan_id"], *acquired_plans})
        return {"task": await self._require_task(task["uid"]), "unblocked": [], "next_due": changes.get("due_date")}

    async def _resolve_blocking(self) -> list[dependencies.StatusChange]:
        """Re-evaluate every dependency edge and persist blocked/unblocked transitions."""
        edges = await self.db.list_dependencies()
        involved = {uid for edge in edges for uid in edge}
        tasks = {task["uid"]: task for task in await self.db.get_tasks(list(involved))}
        # Tasks whose blockers were deleted have no edges left but must still be released.
        for task in await self.db.dependency_blocked_tasks():
            tasks.setdefault(task["uid"], task)
        changes = dependencies.resolve_blocking(tasks, edges)
        if not changes:
            return []
        updates: dict[str, dict[str, Any]] = {}
        for change in changes:
            update: dict[str, Any] = {"status": change.status, "status_before_block": change.status_before_block}
            if change.kanban_column is not None and tasks[change.uid].get("kanban_column") is not None:
                update["kanban_column"] = change.kanban_column
            updates[change.uid] = update
        await self.db.update_tasks(updates)
        self._notify(tasks[change.uid]["plan_id"] for change in changes)
        return changes

    async def process_rollover(self) -> int:
        """Re-open recurring tasks whose next due date has arrived; reset broken streaks."""
        today_iso = self.today().isoformat()
        plans = await self._plans_map()
        updates: dict[str, dict[str, Any]] = {}
        affected: set[str] = set()
        for task in await self.db.due_recurring_completed(today_iso):
            extra = dict(task.get("extra") or {})
            extra.pop("undo", None)
            change: dict[str, Any] = {
                "status": STATUS_NEEDS_ACTION,
                "completed_at": None,
                "completed_by": None,
                "extra": extra,
            }
            if plans.get(task["plan_id"], {}).get("archetype") == ARCHETYPE_PROJECTS and task["kanban_column"]:
                change["kanban_column"] = KANBAN_READY
            if task["due_date"] < today_iso and task["streak"]:
                change["streak"] = 0  # the occurrence was missed while it sat completed
            updates[task["uid"]] = change
            for child in await self.db.descendants(task["uid"]):
                updates[child["uid"]] = {"status": STATUS_NEEDS_ACTION, "completed_at": None, "completed_by": None}
            affected.add(task["plan_id"])
        for task in await self.db.overdue_recurring_with_streak(today_iso):
            updates.setdefault(task["uid"], {})["streak"] = 0
            affected.add(task["plan_id"])
        if not updates:
            return 0
        await self.db.update_tasks(updates)
        await self._resolve_blocking()
        self._notify(affected)
        return len(updates)

    # ------------------------------------------------------------------
    # Snoozing
    # ------------------------------------------------------------------
    async def snooze_until(self, uid: str, until: str | datetime, actor: Actor = SYSTEM) -> dict[str, Any]:
        moment = parse_datetime(until, self.tz) if not isinstance(until, datetime) else until
        if moment is None:
            raise PlannerError("invalid", "Invalid snooze time")
        return await self._snooze(uid, SNOOZE_TIME, {"until": to_utc_iso(moment)}, None, snoozed_until=to_utc_iso(moment))

    async def snooze_context(
        self, uid: str, rule_type: str, config: Mapping[str, Any] | None, actor: Actor = SYSTEM
    ) -> dict[str, Any]:
        config = dict(config or {})
        if rule_type == SNOOZE_TIME:
            return await self.snooze_until(uid, config.get("until"), actor)
        if rule_type == SNOOZE_PERSON_HOME:
            config.setdefault("person", actor.person)
            if not config.get("person"):
                raise PlannerError("no_person", "Your user is not linked to a person entity")
        if rule_type == SNOOZE_ALL_HOME and not config.get("people"):
            config["people"] = list(self._household() if self._household else [])
            if len(config["people"]) < 1:
                raise PlannerError("invalid", "No household people are configured")
        if rule_type == SNOOZE_WEEKEND_DRY and not config.get("weather_entity"):
            weather = self._weather_entity() if self._weather_entity else None
            if weather:
                config["weather_entity"] = weather
        try:
            clean = validate_rule(rule_type, config)
        except ValueError as err:
            raise PlannerError("invalid", str(err)) from err
        return await self._snooze(uid, rule_type, clean, clean.get("person"), snoozed_until=None)

    async def _snooze(
        self, uid: str, rule_type: str, config: dict[str, Any], person: str | None, *, snoozed_until: str | None
    ) -> dict[str, Any]:
        task = await self._require_task(uid)
        if task["status"] == STATUS_COMPLETED:
            raise PlannerError("invalid", "Completed tasks cannot be snoozed")
        previous = task["status"] if task["status"] != STATUS_SNOOZED else task.get("status_before_snooze")
        async with self.db.transaction():
            await self.db.tx_update_task(
                uid,
                {
                    "status": STATUS_SNOOZED,
                    "status_before_snooze": previous or STATUS_NEEDS_ACTION,
                    "snoozed_until": snoozed_until,
                },
            )
            await self.db.tx_replace_snooze_rule(
                {
                    "id": new_id(),
                    "task_uid": uid,
                    "rule_type": rule_type,
                    "config": config,
                    "person_entity_id": person,
                    "armed_at": to_utc_iso(self.now()),
                }
            )
        self._notify([task["plan_id"]])
        return await self._require_task(uid)

    async def unsnooze(self, uid: str, reason: str = "manual") -> dict[str, Any] | None:
        task = await self.db.get_task(uid)
        if task is None:
            return None
        if task["status"] != STATUS_SNOOZED:
            await self.db.update_task(uid, {"snoozed_until": None})
            return task
        status = task.get("status_before_snooze") or STATUS_NEEDS_ACTION
        if status in (STATUS_SNOOZED, STATUS_COMPLETED):
            status = STATUS_NEEDS_ACTION
        async with self.db.transaction():
            await self.db.tx_update_task(uid, {"status": status, "status_before_snooze": None, "snoozed_until": None})
            await self.db.tx_delete_snooze_rules(uid)
        await self._resolve_blocking()
        self._fire(
            EVENT_TASK_UNSNOOZED,
            self._event_payload(
                await self.db.get_plan(task["plan_id"]),
                {"uid": uid, "summary": task["summary"], "plan_id": task["plan_id"], "reason": reason, "assigned_to": task["assigned_to"]},
                "summary",
            ),
        )
        self._notify([task["plan_id"]])
        return await self.db.get_task(uid)

    async def wake_due_snoozes(self) -> list[str]:
        """Wake every time-snoozed task whose time has come."""
        woken = []
        for task in await self.db.snoozed_until_before(to_utc_iso(self.now())):
            await self.unsnooze(task["uid"], reason="time")
            woken.append(task["uid"])
        return woken

    # ------------------------------------------------------------------
    # Shopping
    # ------------------------------------------------------------------
    async def _category_for(self, name: str, plan: Mapping[str, Any]) -> str:
        key = name_key(name)
        learned = await self.db.history_category(key, plan["id"])
        if learned:
            return learned
        default = (plan.get("settings") or {}).get("default_category")
        if default:
            return str(default)
        return categorize_parsed(parse_item(name))

    async def add_shopping_item(
        self,
        plan_id: str,
        text: str,
        actor: Actor = SYSTEM,
        *,
        category: str | None = None,
        quantity: str | None = None,
        source: str | None = None,
        source_ref: str | None = None,
        extra_fields: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Add an item to a shopping plan, merging with an existing entry for the same thing."""
        plan = await self._require_plan(plan_id)
        parsed = parse_item(text)
        name = parsed.name
        if not name:
            raise PlannerError("invalid", "Nothing to add")
        qty_text = (str(quantity).strip() if quantity else None) or (parsed.raw_quantity if parsed.quantity else None)
        key = name_key(name)
        existing = [
            task
            for task in await self.db.list_tasks(plan_id, top_level_only=True)
            if name_key(task["summary"]) == key
        ]
        open_match = next((t for t in existing if t["status"] != STATUS_COMPLETED), None)
        done_match = next((t for t in existing if t["status"] == STATUS_COMPLETED), None)
        cat = category or (open_match or done_match or {}).get("category") or await self._category_for(name, plan)
        merged = False
        async with self.db.transaction():
            if open_match is not None:
                combined = combine_quantity_text(open_match["quantity"], qty_text) if qty_text else open_match["quantity"]
                changes: dict[str, Any] = {}
                if combined != open_match["quantity"]:
                    changes["quantity"] = combined
                if category and category != open_match["category"]:
                    changes["category"] = category
                if changes:
                    await self.db.tx_update_task(open_match["uid"], changes)
                uid = open_match["uid"]
                merged = True
            elif done_match is not None:
                # Re-adding something already bought re-opens it instead of duplicating.
                await self.db.tx_update_task(
                    done_match["uid"],
                    {
                        "status": STATUS_NEEDS_ACTION,
                        "completed_at": None,
                        "completed_by": None,
                        "quantity": qty_text,
                        "category": cat,
                        "summary": name,
                    },
                )
                uid = done_match["uid"]
            else:
                fields: dict[str, Any] = {
                    "plan_id": plan_id,
                    "summary": name,
                    "quantity": qty_text,
                    "category": cat,
                    "created_by": actor.label,
                    "source": source or SOURCE_MANUAL,
                    "source_ref": source_ref,
                }
                if extra_fields:
                    normalized = self._normalize({k: v for k, v in extra_fields.items() if k not in ("dedupe", "uid", "blocked_by")}, plan)
                    normalized.pop("status", None)
                    fields.update({k: v for k, v in normalized.items() if k not in fields or fields[k] is None})
                created = await self.db.tx_create_task(fields)
                uid = created["uid"]
            await self.db.tx_bump_item_history(plan_id, key, name, cat)
        self._notify([plan_id])
        return {"task": await self._require_task(uid), "merged": merged}

    async def item_history(self, plan_id: str, limit: int = 40) -> list[dict[str, Any]]:
        on_list = {
            name_key(task["summary"])
            for task in await self.db.list_tasks(plan_id, top_level_only=True)
            if task["status"] != STATUS_COMPLETED
        }
        return [row for row in await self.db.item_history(plan_id, limit + len(on_list)) if row["name_key"] not in on_list][:limit]

    # ------------------------------------------------------------------
    # Pantry
    # ------------------------------------------------------------------
    async def save_pantry_item(self, data: Mapping[str, Any]) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if data.get("id"):
            payload["id"] = data["id"]
            existing = await self.db.get_pantry_item(data["id"])
            if existing is None:
                raise PlannerError("not_found", "Pantry item not found")
            plan_id = existing["plan_id"]
        else:
            plan = await self._require_plan(data.get("plan_id"))
            if plan["archetype"] != ARCHETYPE_PANTRY:
                raise PlannerError("invalid", "Pantry items belong in a pantry plan")
            plan_id = plan["id"]
            payload["plan_id"] = plan_id
            if not str(data.get("name") or "").strip():
                raise PlannerError("invalid", "A pantry item needs a name")
        for key in ("name", "category", "quantity", "mealie_recipe_slug", "notes"):
            if key in data:
                payload[key] = str(data[key]).strip() if data[key] not in (None, "") else None
        if "low_action" in data:
            payload["low_action"] = data["low_action"] if data["low_action"] in LOW_ACTIONS else LOW_ACTION_ASK
        if "is_batch" in data:
            payload["is_batch"] = bool(data["is_batch"])
        if "ingredients" in data:
            payload["ingredients"] = _clean_ingredients(data["ingredients"])
        if "stock_state" in data and data["stock_state"] in STOCK_STATES and "id" not in payload:
            payload["stock_state"] = data["stock_state"]
        item = await self.db.save_pantry_item(payload)
        self._notify([plan_id])
        return item

    async def delete_pantry_item(self, item_id: str) -> dict[str, Any] | None:
        item = await self.db.delete_pantry_item(item_id)
        if item:
            self._notify([item["plan_id"]])
        return item

    async def set_pantry_state(
        self, item_id: str, state: str, action: str | None = None, actor: Actor = SYSTEM
    ) -> dict[str, Any]:
        """Change stock state; on Low/Out run (or ask for) the item's low-stock action."""
        if state not in STOCK_STATES:
            raise PlannerError("invalid", f"Unknown stock state {state}")
        item = await self.db.get_pantry_item(item_id)
        if item is None:
            raise PlannerError("not_found", "Pantry item not found")
        previous = item["stock_state"]
        now_iso = utc_now_iso()
        changes: dict[str, Any] = {"id": item_id, "stock_state": state}
        if state == STOCK_IN:
            changes["last_restocked_at"] = now_iso
        elif previous == STOCK_IN:
            changes["last_low_at"] = now_iso
        item = await self.db.save_pantry_item(changes)
        result: dict[str, Any] = {"item": item, "action_needed": False, "action": None, "created": []}
        affected = {item["plan_id"]}

        if state == STOCK_IN:
            # Restocked: close any open "make a batch" chore for this item.
            for task in await self.db.list_tasks(source=SOURCE_PANTRY):
                if task["source_ref"] == item_id and task["status"] != STATUS_COMPLETED:
                    await self._complete(task, actor)
                    affected.add(task["plan_id"])
        elif previous == STOCK_IN or action:
            chosen = action or item["low_action"]
            self._fire(
                EVENT_PANTRY_LOW,
                self._event_payload(
                    await self.db.get_plan(item["plan_id"]),
                    {"item_id": item_id, "name": item["name"], "state": state, "action": chosen},
                    "name",
                ),
            )
            if chosen == LOW_ACTION_ASK:
                result["action_needed"] = True
            elif chosen == LOW_ACTION_SHOPPING:
                result["action"] = chosen
                result["created"] = await self._pantry_to_shopping(item, actor)
            elif chosen == LOW_ACTION_BATCH:
                result["action"] = chosen
                task = await self._pantry_batch_task(item, actor)
                if task:
                    result["created"] = [{"type": "task", "uid": task["uid"], "plan_id": task["plan_id"], "summary": task["summary"]}]
            elif chosen == LOW_ACTION_NONE:
                result["action"] = chosen
        for created in result["created"]:
            affected.add(created["plan_id"])
        self._notify(affected)
        return result

    async def _pantry_to_shopping(self, item: Mapping[str, Any], actor: Actor) -> list[dict[str, Any]]:
        plan_id = (await self.db.get_plan(item["plan_id"]) or {}).get("settings", {}).get("shopping_plan_id")
        plan = await self.db.get_plan(plan_id) if plan_id else None
        plan = plan or await self.grocery_plan()
        if plan is None:
            raise PlannerError("no_plan", "No shopping list exists to push to")
        lines = [line.get("text") or line.get("name") for line in item.get("ingredients") or []] or [
            f"{item['quantity']} {item['name']}" if item.get("quantity") else item["name"]
        ]
        created = []
        for line in lines:
            if not line:
                continue
            res = await self.add_shopping_item(
                plan["id"], str(line), actor, source=SOURCE_PANTRY, source_ref=f"{PANTRY_SHOPPING_PREFIX}{item['id']}"
            )
            created.append(
                {"type": "shopping", "uid": res["task"]["uid"], "plan_id": plan["id"], "summary": res["task"]["summary"], "merged": res["merged"]}
            )
        return created

    async def _pantry_batch_task(self, item: Mapping[str, Any], actor: Actor) -> dict[str, Any] | None:
        settings = (await self.db.get_plan(item["plan_id"]) or {}).get("settings", {})
        plan = await self.db.get_plan(settings["chore_plan_id"]) if settings.get("chore_plan_id") else None
        plan = plan or await self.chores_plan()
        if plan is None:
            raise PlannerError("no_plan", "No chores plan exists for the batch task")
        for task in await self.db.list_tasks(source=SOURCE_PANTRY):
            if task["source_ref"] == item["id"] and task["status"] != STATUS_COMPLETED:
                return task
        link = self._recipe_url(item["mealie_recipe_slug"]) if self._recipe_url and item.get("mealie_recipe_slug") else None
        lines = item.get("ingredients") or []
        description_parts = []
        if link:
            description_parts.append(f"[Open the recipe in Mealie]({link})")
        if lines:
            description_parts.append("**Ingredients**\n" + "\n".join(
                f"- {line.get('text') or line.get('name')}" for line in lines
            ))
        return await self._create_task(
            {
                "plan_id": plan["id"],
                "summary": f"Make a new batch of {item['name']}",
                "description": "\n\n".join(description_parts) or None,
                "link_url": link,
                "source": SOURCE_PANTRY,
                "source_ref": item["id"],
                "estimated_minutes": 15,
                "context_tags": ["Indoor"],
                "due_date": self.today().isoformat(),
            },
            actor,
        )

    # ------------------------------------------------------------------
    # Bill of materials
    # ------------------------------------------------------------------
    async def save_bom_item(self, data: Mapping[str, Any]) -> dict[str, Any]:
        payload: dict[str, Any] = {}
        if data.get("id"):
            existing = await self.db.get_bom_item(data["id"])
            if existing is None:
                raise PlannerError("not_found", "BOM item not found")
            payload["id"] = data["id"]
            plan_id = existing["plan_id"]
        else:
            plan = await self._require_plan(data.get("plan_id"))
            if plan["archetype"] != ARCHETYPE_PROJECTS:
                raise PlannerError("invalid", "Bills of materials belong to project plans")
            plan_id = payload["plan_id"] = plan["id"]
            if not str(data.get("name") or "").strip():
                raise PlannerError("invalid", "A BOM item needs a name")
        for key in ("name", "quantity", "category", "notes"):
            if key in data:
                payload[key] = str(data[key]).strip() if data[key] not in (None, "") else None
        if payload.get("category") is None and "category" in payload:
            payload["category"] = AISLE_HARDWARE
        if "acquired" in data:
            payload["acquired"] = bool(data["acquired"])
        item = await self.db.save_bom_item(payload)
        self._notify([plan_id])
        return item

    async def delete_bom_item(self, item_id: str) -> None:
        item = await self.db.get_bom_item(item_id)
        if item:
            await self.db.delete_bom_item(item_id)
            self._notify([item["plan_id"]])

    async def push_bom(self, plan_id: str, item_ids: Sequence[str] | None = None, actor: Actor = SYSTEM) -> list[dict[str, Any]]:
        """Push un-acquired BOM lines to the hardware shopping list."""
        await self._require_plan(plan_id)
        target = await self.hardware_plan()
        if target is None:
            raise PlannerError("no_plan", "Create a shopping list first")
        pushed = []
        for item in await self.db.list_bom(plan_id):
            if item_ids and item["id"] not in item_ids:
                continue
            if item["acquired"]:
                continue
            if item["pushed_task_uid"]:
                existing = await self.db.get_task(item["pushed_task_uid"])
                if existing is not None and existing["status"] != STATUS_COMPLETED:
                    continue
            res = await self.add_shopping_item(
                target["id"],
                item["name"],
                actor,
                category=item["category"] or AISLE_HARDWARE,
                quantity=item["quantity"],
                source=SOURCE_BOM,
                source_ref=item["id"],
            )
            await self.db.save_bom_item({"id": item["id"], "pushed_task_uid": res["task"]["uid"]})
            pushed.append({"type": "shopping", "uid": res["task"]["uid"], "plan_id": target["id"], "summary": res["task"]["summary"], "merged": res["merged"]})
        self._notify([plan_id, target["id"]])
        return pushed

    # ------------------------------------------------------------------
    # Brain dump execution
    # ------------------------------------------------------------------
    async def apply_actions(self, actions: Sequence[Mapping[str, Any]], actor: Actor = SYSTEM) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for action in list(actions)[:50]:
            try:
                if action.get("plan_id"):
                    # Actions can come from an LLM or a client; never let them reach a plan the actor can't see.
                    await self.authorize(actor, plans=[str(action["plan_id"])])
                if action.get("type") == "shopping":
                    plan_id = action.get("plan_id") or (await self.grocery_plan() or {}).get("id")
                    if not plan_id:
                        raise PlannerError("no_plan", "No shopping list exists")
                    res = await self.add_shopping_item(
                        plan_id,
                        str(action.get("name") or ""),
                        actor,
                        category=action.get("category"),
                        quantity=action.get("quantity"),
                        source=SOURCE_BRAIN_DUMP,
                    )
                    results.append(
                        {"type": "shopping", "uid": res["task"]["uid"], "plan_id": plan_id, "summary": res["task"]["summary"], "merged": res["merged"], "ok": True}
                    )
                elif action.get("type") == "task":
                    plan_id = action.get("plan_id") or (await self.chores_plan() or {}).get("id")
                    if not plan_id:
                        raise PlannerError("no_plan", "No plan exists for tasks")
                    payload: dict[str, Any] = {
                        "plan_id": plan_id,
                        "summary": action.get("summary"),
                        "time_of_day_bucket": action.get("time_of_day_bucket") or BUCKET_ANYTIME,
                        "context_tags": action.get("context_tags") or [],
                        "assigned_to": action.get("assigned_to") or [],
                        "priority": action.get("priority") or "none",
                        "estimated_minutes": action.get("estimated_minutes"),
                        "source": SOURCE_BRAIN_DUMP,
                    }
                    due_date = parse_date(action.get("due_date"))
                    if action.get("due_time"):
                        clock = re.match(r"^\s*(\d{1,2}):(\d{2})", str(action["due_time"]))
                        if clock is None or int(clock.group(1)) > 23 or int(clock.group(2)) > 59:
                            raise PlannerError("invalid", "Times look like 14:30")
                        hour, minute = int(clock.group(1)), int(clock.group(2))
                        payload["due_datetime"] = datetime.combine(due_date or self.today(), time(hour, minute), self.tz).isoformat()
                    elif due_date:
                        payload["due_date"] = due_date.isoformat()
                    task = await self._create_task(payload, actor)
                    results.append({"type": "task", "uid": task["uid"], "plan_id": plan_id, "summary": task["summary"], "ok": True})
            except PlannerError as err:
                results.append({"type": action.get("type"), "ok": False, "error": err.message, "summary": action.get("summary") or action.get("name")})
        return results

    # ------------------------------------------------------------------
    # Generated tasks (Mealie prep, cook, leftovers)
    # ------------------------------------------------------------------
    async def upsert_generated_task(self, source: str, source_ref: str, fields: Mapping[str, Any]) -> dict[str, Any] | None:
        """Create or refresh a generated task; completed ones are left alone."""
        existing = await self.db.find_task_by_source(source, source_ref)
        if existing is not None:
            if existing["status"] == STATUS_COMPLETED:
                return existing
            plan = await self.db.get_plan(existing["plan_id"])
            normalized = self._normalize(fields, plan)
            normalized.pop("status", None)
            changes = {k: v for k, v in normalized.items() if existing.get(k) != v and k != "plan_id"}
            if changes:
                await self.db.update_task(existing["uid"], changes)
                self._notify([existing["plan_id"]])
            return await self.db.get_task(existing["uid"])
        if not fields.get("plan_id"):
            return None
        return await self._create_task({**fields, "source": source, "source_ref": source_ref}, SYSTEM)

    async def remove_generated_tasks(self, source: str, keep: Callable[[str], bool]) -> int:
        """Delete open generated tasks whose origin no longer exists (e.g. a meal was removed)."""
        stale = [
            task["uid"]
            for task in await self.db.list_tasks(source=source)
            if task["status"] != STATUS_COMPLETED and not keep(str(task["source_ref"] or ""))
        ]
        if stale:
            await self.delete_tasks(stale)
        return len(stale)

    async def expire_leftovers(self) -> int:
        """Flag leftover trackers past their expiry as urgent."""
        now_iso = to_utc_iso(self.now())
        count = 0
        for task in await self.db.list_tasks(source=SOURCE_LEFTOVER):
            extra = dict(task.get("extra") or {})
            if task["status"] == STATUS_COMPLETED or extra.get("expired") or not task["expires_at"]:
                continue
            if task["expires_at"] <= now_iso:
                extra["expired"] = True
                await self.db.update_task(task["uid"], {"priority": "urgent", "extra": extra})
                self._notify([task["plan_id"]])
                count += 1
        return count

    # ------------------------------------------------------------------
    # Shift-aware assignment & sensor-driven maintenance
    # ------------------------------------------------------------------
    async def shift_aware_candidates(self) -> list[dict[str, Any]]:
        today_iso = self.today().isoformat()
        # Private lists belong to one person; household balancing leaves them alone.
        plans = {plan["id"]: plan for plan in await self.db.list_plans() if not plan["is_private"]}
        return [
            task
            for task in await self.db.list_tasks(plan_ids=list(plans))
            if task["shift_aware"]
            and task["status"] not in (STATUS_COMPLETED, STATUS_SNOOZED)
            and not plans[task["plan_id"]]["is_template"]
            and (task["due_date"] is None or task["due_date"] <= today_iso)
        ]

    async def open_load_by_person(self) -> dict[str, int]:
        """Minutes of open, due-today work already assigned to each person (non shift-aware)."""
        today_iso = self.today().isoformat()
        load: dict[str, int] = {}
        for task in await self.db.list_tasks(statuses=[STATUS_NEEDS_ACTION, STATUS_IN_PROCESS]):
            if task["shift_aware"] or (task["due_date"] and task["due_date"] > today_iso) or not task["due_date"]:
                continue
            for person in task["assigned_to"]:
                load[person] = load.get(person, 0) + int(task["estimated_minutes"] or 15)
        return load

    async def apply_assignments(self, assignments: Mapping[str, str]) -> int:
        tasks = {task["uid"]: task for task in await self.db.get_tasks(list(assignments))}
        updates: dict[str, dict[str, Any]] = {}
        for uid, person in assignments.items():
            task = tasks.get(uid)
            if task is None or task["assigned_to"] == [person]:
                continue
            extra = dict(task.get("extra") or {})
            extra["auto_assigned"] = {"person": person, "on": self.today().isoformat()}
            updates[uid] = {"assigned_to": [person], "extra": extra}
        await self.db.update_tasks(updates)
        self._notify(tasks[uid]["plan_id"] for uid in updates)
        return len(updates)



_VIEW_KEYS = ("filter", "user", "priority", "sort", "group")


def _clean_saved_views(raw: Any) -> list[dict[str, str]]:
    """Saved maintenance dashboard views: a name plus a few short filter values."""
    if not isinstance(raw, (list, tuple)) or len(raw) > 30:
        raise PlannerError("invalid", "Save at most 30 views")
    views = []
    for entry in raw:
        if not isinstance(entry, Mapping) or not str(entry.get("name") or "").strip():
            raise PlannerError("invalid", "A saved view needs a name")
        view = {"name": str(entry["name"]).strip()[:60]}
        for key in _VIEW_KEYS:
            if entry.get(key) not in (None, ""):
                view[key] = str(entry[key])[:64]
        views.append(view)
    return views


def _not_found() -> PlannerError:
    return PlannerError("not_found", "Not found (or not shared with you)")


def _clean_name(value: Any, message: str) -> str:
    name = " ".join(str(value or "").split())
    if not name:
        raise PlannerError("invalid", message or "A name is required")
    if len(name) > MAX_NAME:
        raise PlannerError("invalid", f"Names can be at most {MAX_NAME} characters")
    return name


def _clean_icon(value: Any) -> str | None:
    if value in (None, ""):
        return None
    icon = str(value).strip()
    if not _ICON_RE.match(icon):
        raise PlannerError("invalid", "Icons look like mdi:broom")
    return icon


def _clean_color(value: Any) -> str | None:
    if value in (None, ""):
        return None
    color = str(value).strip()
    if not _COLOR_RE.match(color):
        raise PlannerError("invalid", "Colors look like #3f51b5")
    return color


def _safe_link(value: str) -> str:
    """Only plain web links are stored, so a link can never run script in the dashboard."""
    parts = urlsplit(value.strip())
    if parts.scheme.lower() not in LINK_SCHEMES or not parts.netloc:
        raise PlannerError("invalid", "Links must start with http:// or https://")
    return value.strip()


def _unique_by_name(tasks: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """First task per normalized name (callers pass newest first)."""
    seen: dict[str, dict[str, Any]] = {}
    for task in tasks:
        seen.setdefault(name_key(task["summary"]), task)
    return list(seen.values())


def _status_for_column(column: str, current: str) -> str | None:
    if column == KANBAN_DONE:
        return STATUS_COMPLETED
    if column == KANBAN_IN_PROGRESS:
        return STATUS_IN_PROCESS
    if column in (KANBAN_READY, KANBAN_BACKLOG):
        if current == STATUS_BLOCKED:
            return None
        return STATUS_NEEDS_ACTION
    return None


def _int_or_none(value: Any, minimum: int | None = None) -> int | None:
    if value in (None, ""):
        return None
    try:
        number = int(float(value))
    except (TypeError, ValueError):
        return None
    if minimum is not None and number < minimum:
        return None
    return number


def _float_or_none(value: Any) -> float | None:
    if value in (None, "", "unknown", "unavailable"):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _clean_ingredients(raw: Any) -> list[dict[str, Any]]:
    """Accept a list of strings or dicts and return ``{name, quantity, text}`` dicts."""
    items: list[dict[str, Any]] = []
    if isinstance(raw, str):
        raw = [line for line in raw.splitlines()]
    for entry in raw or []:
        if isinstance(entry, Mapping):
            name = str(entry.get("name") or entry.get("text") or "").strip()
            if not name:
                continue
            quantity = str(entry.get("quantity") or "").strip() or None
            text = str(entry.get("text") or "").strip() or " ".join(p for p in (quantity, name) if p)
            items.append({"name": name, "quantity": quantity, "text": text})
        else:
            text = str(entry).strip().lstrip("-* ").strip()
            if not text:
                continue
            parsed = parse_item(text)
            items.append({"name": parsed.name or text, "quantity": parsed.raw_quantity, "text": text})
    return items
