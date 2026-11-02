"""Background coordinator: timers, state listeners, Mealie sync and household context.

Responsibilities:

* Owns the database and :class:`~.planner.Planner`, wiring its callbacks to
  Home Assistant (state reads, bus events, dispatcher broadcasts).
* Every minute: recurring-task rollover, time-based snoozes, leftover creation
  and expiry.
* Daily at the configured time: PRN / shift-aware chore assignment.
* Weekend mornings: "this weekend if it's not raining" snoozes.
* ``async_track_state_change_event`` listeners for context snoozes ("next time
  I'm home", "both of us home", custom entity states) and the maintenance
  subsystem's sensor triggers and softener meters (:mod:`.maintenance_runtime`).
* Two-way Mealie shopping-list sync and meal-plan prep timelines.
* The wishlist & price tracker (:mod:`.hoard`): store-link price checks and
  deal radar every few hours, price alerts (persistent notification, the
  plan's notify service and the ``taskdragon_price_alert`` event).
* Phone reminders for tasks (:mod:`.reminders`): sent from the minute tick to
  companion-app devices, with Done / Snooze buttons answered through the
  ``mobile_app_notification_action`` event.

The Mealie URL and token come from ``ConfigEntry.data`` and stay inside this
object and the client; nothing derived from them except recipe links is ever
handed to the WebSocket API.
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections import defaultdict
from collections.abc import Mapping
from datetime import date, datetime, time, timedelta
from typing import Any

from homeassistant.components import persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_change_event,
    async_track_time_change,
    async_track_time_interval,
)
from homeassistant.util import dt as dt_util
from homeassistant.util import slugify

from .backup_manager import BackupManager
from .barcode_manager import BarcodeManager
from .const import (
    AISLES,
    BACKUP_DIRNAME,
    ARCHETYPE_HOARD,
    ARCHETYPE_SHOPPING,
    CONF_BREAKFAST_TIME,
    CONF_CONVERSATION_AGENT,
    CONF_CREATE_COOK_TASKS,
    CONF_DINNER_TIME,
    CONF_ENABLE_LEFTOVERS,
    CONF_LEFTOVER_DAYS,
    CONF_LEFTOVER_TIME,
    CONF_LUNCH_TIME,
    CONF_MAINT_NOTIFY,
    CONF_MEALIE_LOOKAHEAD_DAYS,
    CONF_MEALIE_SYNC_MINUTES,
    CONF_MEALIE_TOKEN,
    CONF_MEALIE_URL,
    CONF_MEALIE_VERIFY_SSL,
    CONF_PEOPLE,
    CONF_PERSON_ENTITY,
    CONF_PREP_RULES,
    CONF_ROLLOVER_HOUR,
    CONF_SHIFT_CHECK_TIME,
    CONF_SHIFT_KEYWORDS,
    CONF_WEATHER_ENTITY,
    CONF_WEEKEND_CHECK_TIME,
    CONF_WORK_CALENDAR,
    DB_FILENAME,
    DEFAULT_BREAKFAST_TIME,
    DEFAULT_DINNER_TIME,
    DEFAULT_LEFTOVER_DAYS,
    DEFAULT_LEFTOVER_TIME,
    DEFAULT_LUNCH_TIME,
    DEFAULT_MEALIE_LOOKAHEAD_DAYS,
    DEFAULT_MEALIE_SYNC_MINUTES,
    DEFAULT_PREP_RULES,
    DEFAULT_ROLLOVER_HOUR,
    DEFAULT_SHIFT_CHECK_TIME,
    DEFAULT_SHIFT_KEYWORDS,
    DEFAULT_WEEKEND_CHECK_TIME,
    EVENT_PRICE_ALERT,
    EVENT_UPDATED,
    HOARD_KEY_FILENAME,
    PANEL_URL_PATH,
    SIGNAL_PLAN_ADDED,
    SIGNAL_PLAN_REMOVED,
    SIGNAL_UPDATED,
    SNOOZE_ALL_HOME,
    SNOOZE_ENTITY_STATE,
    SNOOZE_PERSON_HOME,
    SNOOZE_WEEKEND_DRY,
    SOURCE_LEFTOVER,
    SOURCE_MEALIE_COOK,
    SOURCE_MEALIE_PREP,
    SOURCE_MEALIE_SHOPPING,
    STATUS_COMPLETED,
    VERSION,
)
from .database import TaskDragonDB
from .hoard import HoardManager, SecretBox, alert_message
from .kitchen import build_prep_steps, ingredient_lines, leftover_summary, parse_configured_rules
from .maintenance_runtime import MaintenanceRuntime
from .mealie_client import InvalidMealieUrl, MealieAuthError, MealieClient, MealieError, item_hash, item_text
from .openfoodfacts import OpenFoodFactsClient
from .planner import SYSTEM, Actor, Planner, PlannerError
from .price_tracker import GuardedFetcher, ProductLookup
from .ratelimit import RateLimiter
from .reminders import REMIND_ASSIGNED, SNOOZE_MINUTES, notification_data, parse_action, reminder_text
from .recipe_browser import RecipeBrowser
from .shift_balance import Chore, PersonAvailability, balance_chores, parse_keywords, shifts_for_day
from .snooze import (
    HOME,
    StateView,
    caught_up_on_startup,
    entity_condition_reached,
    everyone_home,
    person_arrived,
    weekend_dry_should_wake,
)
from .timeutil import parse_date, parse_datetime, parse_time, to_utc_iso, utc_now_iso
from .units import categorize_parsed, name_key, parse_item

_LOGGER = logging.getLogger(__name__)

MEALIE_ACTOR = Actor(user_name="Mealie")
MEALIE_PUSH_DELAY = 3.0
HOARD_TICK = timedelta(minutes=10)
HOARD_FIRST_TICK_SECONDS = 120
HOARD_SECRETS_FILE = "hoard.key"  # name inside portable backups (secrets/hoard.key)
BRAIN_DUMP_LIMIT = 30  # per user ...
BRAIN_DUMP_WINDOW = 600  # ... per ten minutes


class TaskDragonCoordinator:
    """Glue between Home Assistant and the planner."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.options: dict[str, Any] = dict(entry.options)
        self.tz = dt_util.get_default_time_zone()
        self.db = TaskDragonDB(hass.config.path(".storage", DB_FILENAME))
        self.planner = Planner(
            self.db,
            tz=self.tz,
            rollover_hour=int(self.options.get(CONF_ROLLOVER_HOUR, DEFAULT_ROLLOVER_HOUR)),
            notify=self._notify,
            fire_event=self._fire_event,
            state_reader=self._read_state,
            recipe_url=self.recipe_url,
            household=self.household,
            weather_entity=lambda: self.options.get(CONF_WEATHER_ENTITY) or None,
            clock=dt_util.utcnow,
        )
        self.planner.on_cook_completed = self._on_cook_completed
        self.planner.reminder_allowed = self.reminder_target_allowed
        self.maintenance = MaintenanceRuntime(hass, self)
        self.mealie: MealieClient | None = None
        self.mealie_status: dict[str, Any] = {"enabled": False}
        self.recipes = RecipeBrowser(
            mealie=lambda: self.mealie,
            planner=self.planner,
            db=self.db,
            today=lambda: dt_util.now().date(),
            on_mealplan_changed=self._mealplan_changed,
        )
        self._off: OpenFoodFactsClient | None = None
        self.barcodes = BarcodeManager(db=self.db, planner=self.planner, lookup=self._product_lookup)
        self.fetcher = GuardedFetcher()
        self.hoard = HoardManager(
            self.db,
            self.planner,
            box=SecretBox(hass.config.path(".storage", HOARD_KEY_FILENAME)),
            fetcher=self.fetcher,
            products=ProductLookup(self.fetcher),
            food_lookup=self._product_lookup,
            run_blocking=hass.async_add_executor_job,
            person_user=self._person_user,
            on_alert=self._price_alert,
            spawn=self.spawn,
        )
        self.planner.hoard = self.hoard
        self.planner.undo_handlers["hoard_item"] = self.hoard.undo_delete
        self.backups = BackupManager(
            db=self.db,
            docs_dir=self.maintenance.docs_dir,
            backup_dir=hass.config.path("backups", BACKUP_DIRNAME),
            app_version=VERSION,
            users=self._backup_users,
            people=self.people_info,
            options=self._backup_options,
            local_now=dt_util.now,
            run_blocking=hass.async_add_executor_job,
            before_restore=self._before_restore,
            on_restored=self.async_after_restore,
            secrets_provider=self._backup_secrets,
            restore_secrets=self._restore_secrets,
        )
        self.brain_limiter = RateLimiter(BRAIN_DUMP_LIMIT, BRAIN_DUMP_WINDOW)
        self._unsubs: list[CALLBACK_TYPE] = []
        self._state_unsub: CALLBACK_TYPE | None = None
        self._pending_plans: set[str] = set()
        self._flush_handle: asyncio.Handle | None = None
        self._push_unsub: CALLBACK_TYPE | None = None
        self._mealie_lock = asyncio.Lock()
        self._rules: list[dict[str, Any]] = []
        self._known_plans: set[str] = set()
        self._tasks: set[asyncio.Task] = set()
        self._shutting_down = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def async_setup(self) -> None:
        await self.db.async_open()
        await self.planner.seed_defaults()
        await self.planner.ensure_defaults()
        await self.maintenance.async_start()
        await self.maintenance.manager.trust_existing_actions()
        await self.hass.async_add_executor_job(self.hoard.box.load)
        await self._ensure_hoard_plan()
        self._known_plans = await self._entity_plan_ids()

        url = (self.entry.data.get(CONF_MEALIE_URL) or "").strip()
        token = (self.entry.data.get(CONF_MEALIE_TOKEN) or "").strip()
        if url and token:
            session = async_get_clientsession(self.hass, verify_ssl=bool(self.entry.data.get(CONF_MEALIE_VERIFY_SSL, True)))
            try:
                self.mealie = MealieClient(session, url, token)
            except InvalidMealieUrl:
                _LOGGER.error("The stored Mealie URL is not a valid http(s) URL; reconfigure Mealie in TaskDragon's options")
            else:
                self.mealie_status = {"enabled": True, "ok": None, "last_sync": None, "error": None}

        self._unsubs.append(async_track_time_change(self.hass, self._minute_tick, second=0))
        self._unsubs.append(self.hass.bus.async_listen("mobile_app_notification_action", self._on_notification_action))
        shift_at = parse_time(self.options.get(CONF_SHIFT_CHECK_TIME), parse_time(DEFAULT_SHIFT_CHECK_TIME, time(5)))
        self._unsubs.append(
            async_track_time_change(
                self.hass, self._shift_tick, hour=shift_at.hour, minute=shift_at.minute, second=shift_at.second
            )
        )
        weekend_at = parse_time(self.options.get(CONF_WEEKEND_CHECK_TIME), parse_time(DEFAULT_WEEKEND_CHECK_TIME, time(7)))
        self._unsubs.append(
            async_track_time_change(
                self.hass, self._weekend_tick, hour=weekend_at.hour, minute=weekend_at.minute, second=weekend_at.second
            )
        )
        if self.mealie is not None:
            minutes = max(1, int(self.options.get(CONF_MEALIE_SYNC_MINUTES, DEFAULT_MEALIE_SYNC_MINUTES)))
            self._unsubs.append(async_track_time_interval(self.hass, self._mealie_tick, timedelta(minutes=minutes)))
        self._unsubs.append(async_track_time_interval(self.hass, self._hoard_tick, HOARD_TICK))
        self._unsubs.append(async_call_later(self.hass, HOARD_FIRST_TICK_SECONDS, self._hoard_tick))

        # Catch up on anything that happened while Home Assistant was down.
        await self.planner.process_rollover()
        await self.planner.wake_due_snoozes()
        await self.planner.process_trips()
        await self.async_refresh_listeners()
        await self._startup_catch_up()
        if self.mealie is not None:
            self.entry.async_create_background_task(self.hass, self.async_sync_mealie(), "taskdragon_mealie_initial_sync")

    async def async_shutdown(self) -> None:
        self._shutting_down = True
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        if self._state_unsub:
            self._state_unsub()
            self._state_unsub = None
        if self._push_unsub:
            self._push_unsub()
            self._push_unsub = None
        if self._flush_handle:
            self._flush_handle.cancel()
            self._flush_handle = None
        # Let in-flight listener/propagation work finish before the database goes away.
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        if self._push_unsub:
            self._push_unsub()
            self._push_unsub = None
        try:
            await self.maintenance.async_stop()
        except RuntimeError:
            pass  # the database never opened
        await self.fetcher.close()
        async with self._mealie_lock:
            await self.db.async_close()

    @callback
    def _spawn(self, coro: Any, name: str) -> None:
        """Run tracked background work that shutdown waits for."""
        if self._shutting_down:
            coro.close()
            return
        task = self.entry.async_create_task(self.hass, coro, name)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    @callback
    def spawn(self, coro: Any, name: str) -> None:
        """Public entry point for other modules' tracked background work."""
        self._spawn(coro, name)

    # ------------------------------------------------------------------
    # Household context
    # ------------------------------------------------------------------
    def people_config(self) -> list[dict[str, Any]]:
        return [p for p in self.options.get(CONF_PEOPLE) or [] if p.get(CONF_PERSON_ENTITY)]

    def household(self) -> list[str]:
        configured = [p[CONF_PERSON_ENTITY] for p in self.people_config()]
        if configured:
            return configured
        return sorted(state.entity_id for state in self.hass.states.async_all("person"))

    def people_info(self) -> list[dict[str, Any]]:
        config = {p[CONF_PERSON_ENTITY]: p for p in self.people_config()}
        people = []
        for entity_id in self.household():
            state = self.hass.states.get(entity_id)
            attrs = state.attributes if state else {}
            people.append(
                {
                    "entity_id": entity_id,
                    "name": attrs.get("friendly_name") or entity_id.split(".", 1)[-1].replace("_", " ").title(),
                    "picture": attrs.get("entity_picture"),
                    "user_id": attrs.get("user_id"),
                    "state": state.state if state else None,
                    "calendar": (config.get(entity_id) or {}).get(CONF_WORK_CALENDAR),
                }
            )
        return people

    def people_for(self, actor: Actor) -> list[dict[str, Any]]:
        """People for the card: work calendars only for administrators (user ids are needed to share lists)."""
        people = self.people_info()
        if actor.user_id is None or actor.is_admin:
            return people
        return [{k: v for k, v in p.items() if k != "calendar"} for p in people]

    def person_for_user(self, user_id: str | None) -> str | None:
        if not user_id:
            return None
        for state in self.hass.states.async_all("person"):
            if state.attributes.get("user_id") == user_id:
                return state.entity_id
        return None

    async def actor_for_user_id(self, user_id: str | None) -> Actor:
        if not user_id:
            return SYSTEM
        user = await self.hass.auth.async_get_user(user_id)
        return Actor(
            user_id=user_id,
            user_name=user.name if user else None,
            person=self.person_for_user(user_id),
            is_admin=bool(user and user.is_admin),
        )

    # ------------------------------------------------------------------
    # Phone reminders
    # ------------------------------------------------------------------
    def phones(self) -> list[dict[str, Any]]:
        """Companion-app devices that can receive notifications, with the people they belong to.

        A phone belongs to the person linked to the user who registered it, and to
        any person that uses one of its device trackers.
        """
        registry = er.async_get(self.hass)
        by_entry: dict[str, set[str]] = defaultdict(set)
        users: dict[str, str] = {}
        for state in self.hass.states.async_all("person"):
            if state.attributes.get("user_id"):
                users[state.attributes["user_id"]] = state.entity_id
            for tracker in state.attributes.get("device_trackers") or []:
                entry = registry.async_get(tracker)
                if entry is not None and entry.config_entry_id:
                    by_entry[entry.config_entry_id].add(state.entity_id)
        phones: dict[str, dict[str, Any]] = {}
        for entry in self.hass.config_entries.async_entries("mobile_app"):
            name = str(entry.data.get("device_name") or entry.title or "").strip()
            service = "mobile_app_" + slugify(name) if name else ""
            if not service or not self.hass.services.has_service("notify", service):
                continue  # not registered for push notifications
            people = set(by_entry.get(entry.entry_id, ()))
            if users.get(entry.data.get("user_id")):
                people.add(users[entry.data["user_id"]])
            phone = phones.setdefault(f"notify.{service}", {"id": f"notify.{service}", "name": name, "people": set()})
            phone["people"] |= people
        return sorted(({**p, "people": sorted(p["people"])} for p in phones.values()), key=lambda p: p["name"].lower())

    def notify_targets(self, actor: Actor) -> list[dict[str, Any]]:
        """Where a task reminder can go: phones for everyone, other notify services for administrators too."""
        targets = [{**phone, "kind": "phone"} for phone in self.phones()]
        if actor.user_id is None or actor.is_admin:
            taken = {t["id"] for t in targets}
            for name in sorted(self.hass.services.async_services().get("notify", {})):
                # send_message needs a notify entity, which a reminder doesn't pick.
                if name != "send_message" and f"notify.{name}" not in taken:
                    targets.append({"id": f"notify.{name}", "name": name.replace("_", " "), "people": [], "kind": "service"})
        return targets

    def reminder_target_allowed(self, target: str, actor: Actor) -> bool:
        return target == REMIND_ASSIGNED or any(t["id"] == target for t in self.notify_targets(actor))

    def _reminder_services(self, task: Mapping[str, Any], plan: Mapping[str, Any]) -> list[str]:
        target = task.get("remind_target")
        if target != REMIND_ASSIGNED:
            return [target] if target else []
        people = set(task.get("assigned_to") or []) or set(self.household())
        if plan.get("is_private"):
            # A private plan's reminders only reach the people it is shared with.
            allowed = {plan.get("owner_user_id"), *(plan.get("shared_with") or [])} - {None}
            people = {p for p in people if self._person_user(p) in allowed}
        return [phone["id"] for phone in self.phones() if people & set(phone["people"])]

    async def _send_reminders(self) -> None:
        for task in await self.planner.due_reminders():
            # Marked first: a failing notify service must not repeat the reminder every minute.
            await self.planner.mark_reminded(task["uid"], task["due_date"])
            plan = await self.db.get_plan(task["plan_id"])
            if plan is None:
                continue
            services = self._reminder_services(task, plan)
            if not services:
                _LOGGER.debug("No phone to send the reminder for task %s to", task["uid"])
                continue
            title, message = reminder_text(task, plan["name"], self.tz)
            data = notification_data(task["uid"], f"/{PANEL_URL_PATH}?task={task['uid']}")
            for service in services:
                domain, _, name = service.partition(".")
                try:
                    await self.hass.services.async_call(domain, name, {"title": title, "message": message, "data": data}, blocking=False)
                except Exception as err:  # noqa: BLE001 - one missing phone must not stop the other reminders
                    _LOGGER.warning("Could not send the reminder for task %s through %s: %s", task["uid"], service, err)

    @callback
    def _on_notification_action(self, event: Event) -> None:
        parsed = parse_action(event.data.get("action"))
        if parsed is not None:
            self._spawn(self._notification_action(*parsed, event.context.user_id), "taskdragon_reminder_action")

    async def _notification_action(self, kind: str, uid: str, user_id: str | None) -> None:
        """Done / Snooze tapped on a reminder: act as the user whose phone it was."""
        actor = await self.actor_for_user_id(user_id)
        task = await self.db.get_task(uid)
        plan = await self.db.get_plan(task["plan_id"]) if task else None
        if task is None or plan is None or not self.planner.can_access(plan, actor):
            _LOGGER.debug("Ignoring a reminder button for task %s, which is gone or not shared with that user", uid)
            return
        try:
            if kind == "done":
                if task["status"] != STATUS_COMPLETED:
                    await self.planner.set_completed(uid, True, actor)
            else:
                await self.planner.snooze_until(uid, dt_util.utcnow() + timedelta(minutes=SNOOZE_MINUTES), actor)
                # Remind again once it wakes up.
                await self.planner.mark_reminded(uid, None)
        except PlannerError as err:
            _LOGGER.info("Reminder button for task %s failed: %s", uid, err)

    def recipe_url(self, slug: str | None) -> str | None:
        return self.mealie.recipe_url(slug) if self.mealie and slug else None

    # ------------------------------------------------------------------
    # Barcodes & backups
    # ------------------------------------------------------------------
    async def _product_lookup(self, code: str) -> dict[str, Any] | None:
        if self._off is None:
            self._off = OpenFoodFactsClient(async_get_clientsession(self.hass))
        return await self._off.lookup(code)

    def _person_user(self, entity_id: str) -> str | None:
        state = self.hass.states.get(entity_id)
        return state.attributes.get("user_id") if state else None

    async def _ensure_hoard_plan(self) -> None:
        """Existing installations get a Wishlist & Gifts plan once (new ones get it with the starter plans)."""
        if await self.db.get_meta("hoard_plan_seeded"):
            return
        plans = await self.db.list_plans(include_archived=True)
        if not any(plan["archetype"] == ARCHETYPE_HOARD for plan in plans):
            await self.planner.create_plan({"name": "Wishlist & Gifts", "archetype": ARCHETYPE_HOARD, "icon": "mdi:treasure-chest-outline"})
        await self.db.set_meta("hoard_plan_seeded", True)

    async def _hoard_tick(self, _now: Any = None) -> None:
        if self.backups.restoring or self._shutting_down:
            return
        self._spawn(self._run_hoard_tick(), "taskdragon_hoard_tick")

    async def _run_hoard_tick(self) -> None:
        try:
            result = await self.hoard.tick()
            if result["checked"] or result["deals"]:
                _LOGGER.debug("Wishlist: checked %s store links, found %s new deals", result["checked"], result["deals"])
        except Exception:  # noqa: BLE001 - a failing price round must not stop the next one
            _LOGGER.exception("TaskDragon wishlist price check failed")

    async def _price_alert(self, alert: dict[str, Any]) -> None:
        """Deliver a price alert: bus event, persistent notification and the plan's notify service.

        Secret gifts are announced without their title, price or store, because
        all three channels can be seen by other members of the household.
        """
        plan = await self.db.get_plan(alert["plan_id"])
        if plan is None:
            return
        settings = plan.get("settings") or {}
        currency = settings.get("currency") or "$"
        secret = bool(alert.get("secret")) or bool(plan.get("is_private"))
        message = alert_message({**alert, "secret": secret}, currency)
        event = {k: alert.get(k) for k in ("kind", "item_id", "plan_id", "title", "price", "retailer", "url", "target_price", "paid_price", "savings", "days_left")}
        if secret:
            event.update({"secret": True, "title": None, "price": None, "retailer": None, "url": None, "target_price": None, "paid_price": None, "savings": None})
        self.hass.bus.async_fire(EVENT_PRICE_ALERT, event)
        link = f"/{PANEL_URL_PATH}?hoard_plan={alert['plan_id']}&hoard_item={alert['item_id']}"
        title = "TaskDragon price protection" if alert["kind"] == "protection" else "TaskDragon price alert"
        persistent_notification.async_create(
            self.hass, f"{message}\n\n[Open in TaskDragon]({link})", title=title, notification_id=f"taskdragon_price_{alert['item_id']}"
        )
        service = settings.get("notify_service")
        if service:
            domain, _, name = service.partition(".")
            data: dict[str, Any] = {"url": link, "clickAction": link, "tag": f"taskdragon-price-{alert['item_id']}"}
            if alert["kind"] == "protection":
                data["priority"] = "high"
                data["ttl"] = 0
            try:
                await self.hass.services.async_call(domain, name, {"title": title, "message": message, "data": data}, blocking=False)
            except Exception as err:  # noqa: BLE001 - a missing notify service must not break price checks
                _LOGGER.warning("Could not send the price alert through %s: %s", service, err)

    async def _backup_users(self) -> list[dict[str, Any]]:
        return [
            {"id": user.id, "name": user.name, "is_admin": user.is_admin, "is_active": user.is_active, "system_generated": user.system_generated}
            for user in await self.hass.auth.async_get_users()
        ]

    def _backup_options(self) -> dict[str, Any]:
        return {
            "weather_entity": self.options.get(CONF_WEATHER_ENTITY),
            "maintenance_notify_service": self.options.get(CONF_MAINT_NOTIFY),
            "conversation_agent": self.options.get(CONF_CONVERSATION_AGENT),
        }

    async def _before_restore(self) -> None:
        """Write pending sensor counters now so nothing stale lands on top of the restored rows."""
        await self.maintenance.manager.async_flush()

    async def _backup_secrets(self) -> dict[str, bytes]:
        return {HOARD_SECRETS_FILE: self.hoard.box.key} if self.hoard.box.ready else {}

    async def _restore_secrets(self, keys: dict[str, bytes]) -> None:
        """Hiding spots restored from another installation are re-encrypted under this one's key."""
        old = keys.get(HOARD_SECRETS_FILE)
        if old:
            rotated = await self.hoard.rekey([old])
            if rotated:
                _LOGGER.info("Re-encrypted %s restored hiding-spot notes", rotated)

    async def async_after_restore(self) -> list[str]:
        """Reload everything that caches database state, then tell every open card to refresh."""
        warnings: list[str] = []
        paused = await self.maintenance.manager.pause_restored_actions()
        if paused:
            warnings.append(
                f"{paused} on-complete device action{'s are' if paused != 1 else ' is'} paused until an administrator opens "
                "the task and saves it again (actions in a backup file aren't trusted automatically)"
            )
        self.planner.clear_undo()
        await self.maintenance.manager.async_load()
        plan_ids = {plan["id"] for plan in await self.db.list_plans(include_archived=True)} | set(self._known_plans)
        self._notify(plan_ids)
        return warnings

    def conversation_agent(self) -> str | None:
        return self.options.get(CONF_CONVERSATION_AGENT) or None

    @callback
    def _read_state(self, entity_id: str) -> str | None:
        state = self.hass.states.get(entity_id)
        return state.state if state else None

    # ------------------------------------------------------------------
    # Broadcasting
    # ------------------------------------------------------------------
    @callback
    def _notify(self, plan_ids: set[str]) -> None:
        if self._shutting_down:
            return
        self._pending_plans |= set(plan_ids)
        if self._flush_handle is None:
            # Coalesce the several notifications one operation emits into one broadcast.
            self._flush_handle = self.hass.loop.call_soon(self._flush)

    @callback
    def _flush(self) -> None:
        self._flush_handle = None
        if self._shutting_down:
            return
        plan_ids, self._pending_plans = self._pending_plans, set()
        async_dispatcher_send(self.hass, SIGNAL_UPDATED, plan_ids)
        self.hass.bus.async_fire(EVENT_UPDATED, {"plan_ids": sorted(plan_ids)})
        self._spawn(self._after_change(plan_ids), "taskdragon_after_change")

    @property
    def closing(self) -> bool:
        return self._shutting_down

    @staticmethod
    def gets_entity(plan: dict[str, Any]) -> bool:
        """Whether a plan gets a native ``todo.*`` entity. Entity state is readable by every
        Home Assistant user, so private plans and wishlists (secret gifts) never get one."""
        return not plan["is_private"] and plan["archetype"] != ARCHETYPE_HOARD

    async def _entity_plan_ids(self) -> set[str]:
        return {plan["id"] for plan in await self.db.list_plans(include_archived=True) if self.gets_entity(plan)}

    async def _after_change(self, plan_ids: set[str]) -> None:
        """Keep entities, listeners and the Mealie push in step with data changes."""
        if self._shutting_down:
            return
        plans = {plan["id"]: plan for plan in await self.db.list_plans(include_archived=True)}
        current = {plan_id for plan_id, plan in plans.items() if self.gets_entity(plan)}
        for plan_id in current - self._known_plans:
            async_dispatcher_send(self.hass, SIGNAL_PLAN_ADDED, plans[plan_id])
        for plan_id in self._known_plans - current:
            async_dispatcher_send(self.hass, SIGNAL_PLAN_REMOVED, plan_id)
        self._known_plans = current
        await self.async_refresh_listeners()
        if self.mealie is not None and any(
            (plans.get(pid) or {}).get("settings", {}).get("mealie_list_id") for pid in plan_ids
        ):
            self._schedule_mealie_push()

    @callback
    def _fire_event(self, event_type: str, data: dict[str, Any]) -> None:
        self.hass.bus.async_fire(event_type, data)

    # ------------------------------------------------------------------
    # Timers
    # ------------------------------------------------------------------
    async def _minute_tick(self, now: datetime) -> None:
        if self.backups.restoring:
            return
        self._spawn(self.backups.daily_tick(), "taskdragon_daily_backup")
        try:
            await self.planner.process_rollover()
            await self.planner.wake_due_snoozes()
            await self.planner.expire_leftovers()
            await self.planner.process_trips()
            await self.maintenance.tick()
            await self._check_leftovers()
        except Exception:  # noqa: BLE001 - a failing tick must not stop future ticks
            _LOGGER.exception("TaskDragon minute tick failed")
        try:
            await self._send_reminders()
        except Exception:  # noqa: BLE001 - a failing reminder round must not stop the next one
            _LOGGER.exception("TaskDragon reminders failed")

    async def _shift_tick(self, now: datetime) -> None:
        try:
            await self.async_run_shift_balance()
        except Exception:  # noqa: BLE001
            _LOGGER.exception("TaskDragon shift balancing failed")

    async def _weekend_tick(self, now: datetime) -> None:
        try:
            await self.async_check_weekend_snoozes()
        except Exception:  # noqa: BLE001
            _LOGGER.exception("TaskDragon weekend snooze check failed")

    async def _mealie_tick(self, now: datetime) -> None:
        await self.async_sync_mealie()

    # ------------------------------------------------------------------
    # PRN / shift-aware assignment
    # ------------------------------------------------------------------
    async def async_run_shift_balance(self) -> dict[str, Any]:
        candidates = await self.planner.shift_aware_candidates()
        people_cfg = {p[CONF_PERSON_ENTITY]: p for p in self.people_config()}
        household = self.household()
        if not candidates or not household:
            return {"assignments": {}, "people": []}
        day = self.planner.today()
        day_start = datetime.combine(day, time(), self.tz)
        availability: list[PersonAvailability] = []
        for entity_id in household:
            cfg = people_cfg.get(entity_id) or {}
            calendar = cfg.get(CONF_WORK_CALENDAR)
            shifts = []
            if calendar:
                keywords = parse_keywords(cfg.get(CONF_SHIFT_KEYWORDS, DEFAULT_SHIFT_KEYWORDS))
                events = await self._calendar_events(calendar, day_start - timedelta(hours=14), day_start + timedelta(days=1))
                shifts = shifts_for_day(events, keywords, day, self.tz)
            availability.append(PersonAvailability(entity_id, shifts))
        chores = [Chore(task["uid"], task["estimated_minutes"], tuple(task["assigned_to"])) for task in candidates]
        assignments = balance_chores(chores, availability, await self.planner.open_load_by_person())
        changed = await self.planner.apply_assignments(assignments)
        _LOGGER.debug("Shift balancing assigned %s chores (%s changed)", len(assignments), changed)
        return {
            "assignments": assignments,
            "changed": changed,
            "people": [
                {
                    "entity_id": person.entity_id,
                    "working": person.working,
                    "shift_end": person.shift_end.isoformat() if person.shift_end else None,
                }
                for person in availability
            ],
        }

    async def _calendar_events(self, entity_id: str, start: datetime, end: datetime) -> list[dict[str, Any]]:
        if self.hass.states.get(entity_id) is None:
            _LOGGER.warning("Work calendar %s does not exist", entity_id)
            return []
        try:
            response = await self.hass.services.async_call(
                "calendar",
                "get_events",
                {"entity_id": entity_id, "start_date_time": start.isoformat(), "end_date_time": end.isoformat()},
                blocking=True,
                return_response=True,
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Could not read calendar %s: %s", entity_id, err)
            return []
        return list(((response or {}).get(entity_id) or {}).get("events") or [])

    # ------------------------------------------------------------------
    # Context snoozes & maintenance sensors
    # ------------------------------------------------------------------
    async def async_refresh_listeners(self) -> None:
        if self._shutting_down:
            return
        self._rules = await self.db.list_snooze_rules()
        entities: set[str] = set(self.maintenance.watched_entities())
        for rule in self._rules:
            entities.update(self._rule_entities(rule))
        if self._state_unsub is not None:
            self._state_unsub()
            self._state_unsub = None
        if entities:
            self._state_unsub = async_track_state_change_event(self.hass, sorted(entities), self._on_state_event)

    def _rule_entities(self, rule: dict[str, Any]) -> list[str]:
        config = rule["config"]
        if rule["rule_type"] == SNOOZE_PERSON_HOME and config.get("person"):
            return [config["person"]]
        if rule["rule_type"] == SNOOZE_ALL_HOME:
            return list(config.get("people") or self.household())
        if rule["rule_type"] == SNOOZE_ENTITY_STATE and config.get("entity_id"):
            return [config["entity_id"]]
        return []

    @callback
    def _on_state_event(self, event: Event) -> None:
        entity_id = event.data["entity_id"]
        old = event.data.get("old_state")
        new = event.data.get("new_state")
        old_state = old.state if old else None
        new_state = new.state if new else None
        # Maintenance also cares about attribute-only changes (e.g. a thermostat's hvac_action).
        self.maintenance.handle_state(entity_id, old, new)
        if old_state == new_state:
            return
        to_wake: list[tuple[str, str]] = []
        for rule in self._rules:
            config = rule["config"]
            kind = rule["rule_type"]
            if kind == SNOOZE_PERSON_HOME and config.get("person") == entity_id:
                if person_arrived(old_state, new_state):
                    to_wake.append((rule["task_uid"], "arrived_home"))
            elif kind == SNOOZE_ALL_HOME:
                people = list(config.get("people") or self.household())
                if entity_id in people and new_state == HOME and old_state != HOME:
                    states = {person: self._read_state(person) for person in people}
                    if everyone_home(states, people):
                        to_wake.append((rule["task_uid"], "everyone_home"))
            elif kind == SNOOZE_ENTITY_STATE and config.get("entity_id") == entity_id:
                if entity_condition_reached(old_state, new_state, config):
                    to_wake.append((rule["task_uid"], "entity_state"))
        if to_wake:
            self._spawn(self._handle_state_change(to_wake), "taskdragon_state_change")

    async def _handle_state_change(self, to_wake: list[tuple[str, str]]) -> None:
        for uid, reason in to_wake:
            await self.planner.unsnooze(uid, reason=reason)

    async def _startup_catch_up(self) -> None:
        views: dict[str, StateView] = {}
        for rule in self._rules:
            for entity_id in self._rule_entities(rule):
                state = self.hass.states.get(entity_id)
                if state is not None:
                    views[entity_id] = StateView(state.state, state.last_changed)
        for rule in list(self._rules):
            armed = parse_datetime(rule["armed_at"])
            if armed is None:
                continue
            people = list(rule["config"].get("people") or self.household())
            if caught_up_on_startup(rule["rule_type"], armed, views, rule["config"], people):
                await self.planner.unsnooze(rule["task_uid"], reason="caught_up")

    async def async_check_weekend_snoozes(self) -> int:
        today = self.planner.today()
        rules = [rule for rule in await self.db.list_snooze_rules() if rule["rule_type"] == SNOOZE_WEEKEND_DRY]
        if not rules or today.weekday() < 5:
            return 0
        woken = 0
        conditions: dict[str | None, str | None] = {}
        for rule in rules:
            weather = rule["config"].get("weather_entity") or self.options.get(CONF_WEATHER_ENTITY)
            if weather not in conditions:
                conditions[weather] = await self._forecast_condition(weather, today) if weather else None
            if weekend_dry_should_wake(today, conditions[weather]):
                await self.planner.unsnooze(rule["task_uid"], reason="dry_weekend")
                woken += 1
        return woken

    async def _forecast_condition(self, entity_id: str, day: date) -> str | None:
        for forecast_type in ("daily", "twice_daily"):
            try:
                response = await self.hass.services.async_call(
                    "weather",
                    "get_forecasts",
                    {"entity_id": entity_id, "type": forecast_type},
                    blocking=True,
                    return_response=True,
                )
            except Exception:  # noqa: BLE001 - entity may not support this forecast type
                continue
            forecast = ((response or {}).get(entity_id) or {}).get("forecast") or []
            for entry in forecast:
                moment = parse_datetime(entry.get("datetime"))
                if moment is not None and moment.astimezone(self.tz).date() == day and entry.get("condition"):
                    return str(entry["condition"])
            if forecast and forecast[0].get("condition"):
                return str(forecast[0]["condition"])
        return self._read_state(entity_id)

    # ------------------------------------------------------------------
    # Mealie
    # ------------------------------------------------------------------
    @callback
    def _schedule_mealie_push(self) -> None:
        if self._push_unsub is not None:
            self._push_unsub()
            self._push_unsub = None
        if self._shutting_down:
            return

        @callback
        def _fire(_now: datetime) -> None:
            self._push_unsub = None
            self.entry.async_create_background_task(
                self.hass, self.async_sync_mealie(meal_plans=False), "taskdragon_mealie_push"
            )

        self._push_unsub = async_call_later(self.hass, MEALIE_PUSH_DELAY, _fire)

    async def async_sync_mealie(self, meal_plans: bool = True) -> dict[str, Any]:
        if self.mealie is None:
            return {"enabled": False}
        async with self._mealie_lock:
            if self._shutting_down:
                return self.mealie_status
            try:
                if self.mealie_status.get("ok") is None:
                    await self.mealie.async_get_self()
                await self._sync_shopping_lists()
                if meal_plans:
                    await self._sync_meal_plans()
                self.mealie_status.update({"ok": True, "last_sync": utc_now_iso(), "error": None})
            except MealieAuthError as err:
                _LOGGER.error("Mealie authentication failed: %s", err)
                self.mealie_status.update({"ok": False, "error": str(err)})
            except MealieError as err:
                _LOGGER.warning("Mealie sync failed: %s", err)
                self.mealie_status.update({"ok": False, "error": str(err)})
        return self.mealie_status

    @callback
    def _mealplan_changed(self) -> None:
        """A meal was planned from the recipe browser: pick up its prep and cook tasks now."""
        if self.mealie is not None and not self._shutting_down:
            self.entry.async_create_background_task(self.hass, self.async_sync_mealie(), "taskdragon_mealie_mealplan")

    async def async_mealie_lists(self) -> list[dict[str, Any]]:
        if self.mealie is None:
            return []
        return [
            {"id": str(item.get("id")), "name": item.get("name")}
            for item in await self.mealie.async_get_shopping_lists()
        ]

    async def async_fetch_recipe_ingredients(self, slug: str) -> list[dict[str, Any]]:
        if self.mealie is None:
            return []
        return ingredient_lines(await self.mealie.async_get_recipe(slug))

    async def _sync_shopping_lists(self) -> None:
        assert self.mealie is not None
        for plan in await self.db.list_plans():
            list_id = (plan.get("settings") or {}).get("mealie_list_id")
            if plan["archetype"] == ARCHETYPE_SHOPPING and list_id:
                await self._sync_shopping_list(plan, str(list_id))

    async def _sync_shopping_list(self, plan: dict[str, Any], list_id: str) -> None:
        """Two-way, last-writer-wins sync between one shopping plan and one Mealie list."""
        assert self.mealie is not None
        plan_id = plan["id"]
        remote_list = await self.mealie.async_get_shopping_list(list_id)
        remote = {str(item["id"]): item for item in remote_list.get("listItems") or [] if item.get("id")}
        changed = False

        for external_id in await self.db.tombstones(plan_id):
            if external_id in remote:
                await self.mealie.async_delete_item(external_id)
                remote.pop(external_id)
            await self.db.clear_tombstone(external_id)

        local = await self.db.list_tasks(plan_id, top_level_only=True)
        for task in [t for t in local if t["external_id"]]:
            item = remote.pop(task["external_id"], None)
            local_text = _local_text(task)
            local_checked = task["status"] == STATUS_COMPLETED
            local_changed = not task["synced_at"] or task["updated_at"] > task["synced_at"]
            if item is None:
                if local_changed and not local_checked:
                    # Deleted remotely but edited here since: push it again as a new item.
                    await self.db.update_task(task["uid"], {"external_id": None, "sync_hash": None}, touch=False)
                else:
                    await self.db.delete_tasks([task["uid"]], tombstone=False)
                changed = True
                continue
            remote_text = item_text(item)
            remote_checked = bool(item.get("checked"))
            remote_hash = item_hash(remote_text, remote_checked)
            local_hash = item_hash(local_text, local_checked)
            remote_changed = remote_hash != task["sync_hash"]
            if remote_hash == local_hash:
                if task["sync_hash"] != remote_hash or local_changed:
                    await self._mark_synced(task["uid"], task["external_id"], remote_hash)
                continue
            if remote_changed and (not local_changed or _remote_is_newer(item, task)):
                await self._apply_remote(task, remote_text, remote_checked)
                await self._mark_synced(task["uid"], task["external_id"], remote_hash)
                changed = True
            elif local_changed:
                await self.mealie.async_update_item(
                    item, text=local_text if local_text != remote_text else None, checked=local_checked
                )
                await self._mark_synced(task["uid"], task["external_id"], local_hash)

        local = await self.db.list_tasks(plan_id, top_level_only=True)
        unmapped = {name_key(t["summary"]): t for t in local if not t["external_id"] and t["status"] != STATUS_COMPLETED}
        for external_id, item in remote.items():
            text = item_text(item)
            remote_checked = bool(item.get("checked"))
            parsed = parse_item(text)
            if not parsed.name:
                continue
            match = unmapped.pop(name_key(parsed.name), None)
            if match is not None:
                await self._mark_synced(match["uid"], external_id, item_hash(_local_text(match), remote_checked))
                if remote_checked:
                    await self.planner.set_completed(match["uid"], True, MEALIE_ACTOR)
                    await self._mark_synced(match["uid"], external_id, item_hash(_local_text(match), True))
                continue
            label = item.get("label") if isinstance(item.get("label"), dict) else None
            category = _label_category(label) or categorize_parsed(parsed)
            task = await self.planner.save_task(
                {
                    "plan_id": plan_id,
                    "summary": parsed.name,
                    "quantity": parsed.raw_quantity if parsed.quantity else None,
                    "category": category,
                    "dedupe": False,
                    "source": SOURCE_MEALIE_SHOPPING,
                },
                MEALIE_ACTOR,
            )
            if remote_checked:
                await self.planner.set_completed(task["uid"], True, MEALIE_ACTOR)
            await self._mark_synced(task["uid"], external_id, item_hash(text, remote_checked))
            changed = True

        for task in unmapped.values():
            text = _local_text(task)
            created = await self.mealie.async_create_item(list_id, text, checked=False)
            if created.get("id"):
                await self._mark_synced(task["uid"], str(created["id"]), item_hash(item_text(created) or text, False))
        if changed:
            self._notify({plan_id})

    async def _mark_synced(self, uid: str, external_id: str, sync_hash: str) -> None:
        await self.db.update_task(
            uid, {"external_id": external_id, "sync_hash": sync_hash, "synced_at": utc_now_iso()}, touch=False
        )

    async def _apply_remote(self, task: dict[str, Any], text: str, checked: bool) -> None:
        if text != _local_text(task):
            parsed = parse_item(text)
            await self.db.update_task(
                task["uid"],
                {"summary": parsed.name or text, "quantity": parsed.raw_quantity if parsed.quantity else None},
                touch=False,
            )
        if checked != (task["status"] == STATUS_COMPLETED):
            await self.planner.set_completed(task["uid"], checked, MEALIE_ACTOR)

    async def _sync_meal_plans(self) -> None:
        """Generate prep / cook tasks for upcoming Mealie meals and remember meals for leftovers."""
        assert self.mealie is not None
        today = self.planner.today()
        lookahead = int(self.options.get(CONF_MEALIE_LOOKAHEAD_DAYS, DEFAULT_MEALIE_LOOKAHEAD_DAYS))
        entries = await self.mealie.async_get_mealplans(today - timedelta(days=1), today + timedelta(days=lookahead))
        prep_plan = await self.planner.chores_plan()
        configured = parse_configured_rules(self.options.get(CONF_PREP_RULES, DEFAULT_PREP_RULES))
        meal_times = {
            "breakfast": parse_time(self.options.get(CONF_BREAKFAST_TIME), parse_time(DEFAULT_BREAKFAST_TIME, time(8))),
            "lunch": parse_time(self.options.get(CONF_LUNCH_TIME), parse_time(DEFAULT_LUNCH_TIME, time(12))),
            "dinner": parse_time(self.options.get(CONF_DINNER_TIME), parse_time(DEFAULT_DINNER_TIME, time(18))),
        }
        create_cook = bool(self.options.get(CONF_CREATE_COOK_TASKS, True))
        now = dt_util.utcnow()
        fetched_ids: set[str] = set()
        keep_prep: set[str] = set()
        keep_cook: set[str] = set()
        future_ids: set[str] = set()
        meals: list[dict[str, Any]] = []
        recipes: dict[str, dict[str, Any]] = {}

        for entry in entries:
            entry_id = str(entry.get("id") or "")
            meal_day = parse_date(entry.get("date"))
            if not entry_id or meal_day is None:
                continue
            stub = entry.get("recipe") if isinstance(entry.get("recipe"), dict) else {}
            slug = stub.get("slug")
            name = stub.get("name") or entry.get("title") or ""
            if not name:
                continue
            entry_type = str(entry.get("entryType") or "dinner").lower()
            meal_at = datetime.combine(meal_day, meal_times.get(entry_type, meal_times["dinner"]), self.tz)
            fetched_ids.add(entry_id)
            meals.append(
                {"id": entry_id, "date": meal_day.isoformat(), "entry_type": entry_type, "name": name, "slug": slug, "meal_at": to_utc_iso(meal_at)}
            )
            if meal_at <= now or prep_plan is None:
                continue
            future_ids.add(entry_id)
            recipe = stub
            if slug:
                if slug not in recipes:
                    try:
                        recipes[slug] = await self.mealie.async_get_recipe(slug)
                    except MealieError as err:
                        _LOGGER.warning("Could not load Mealie recipe %s: %s", slug, err)
                        recipes[slug] = stub
                recipe = recipes[slug] or stub
            recipe = {**recipe, "name": recipe.get("name") or name}
            link = self.recipe_url(slug)
            when = f"{entry_type} on {meal_at.strftime('%A')} at {meal_at.strftime('%I:%M %p').lstrip('0')}"
            for step in build_prep_steps(recipe, meal_at, configured):
                ref = f"{entry_id}:{step.key}"
                keep_prep.add(ref)
                await self.planner.upsert_generated_task(
                    SOURCE_MEALIE_PREP,
                    ref,
                    {
                        "plan_id": prep_plan["id"],
                        "summary": step.summary,
                        "description": f"Prep for **{name}** ({when}).",
                        "due_datetime": step.due.isoformat(),
                        "link_url": link,
                        "context_tags": ["Indoor"],
                        "estimated_minutes": 15,
                        "priority": "high",
                    },
                )
            if create_cook and entry_type in ("dinner", "lunch", "breakfast"):
                keep_cook.add(entry_id)
                total_minutes = _recipe_minutes(recipe)
                start = meal_at - timedelta(minutes=total_minutes) if total_minutes else meal_at - timedelta(minutes=45)
                await self.planner.upsert_generated_task(
                    SOURCE_MEALIE_COOK,
                    entry_id,
                    {
                        "plan_id": prep_plan["id"],
                        "summary": f"Cook {name}",
                        "description": f"{entry_type.title()} on {meal_at.strftime('%A')}.",
                        "due_datetime": start.isoformat(),
                        "link_url": link,
                        "context_tags": ["Indoor"],
                        "estimated_minutes": total_minutes or 45,
                    },
                )

        # Drop open generated tasks for meals that were removed or rescheduled away.
        await self.planner.remove_generated_tasks(
            SOURCE_MEALIE_PREP,
            lambda ref: ref in keep_prep or (ref.split(":", 1)[0] in fetched_ids and ref.split(":", 1)[0] not in future_ids),
        )
        await self.planner.remove_generated_tasks(
            SOURCE_MEALIE_COOK, lambda ref: ref in keep_cook or (ref in fetched_ids and ref not in future_ids)
        )

        stored = {meal["id"]: meal for meal in await self.db.get_meta("mealie_meals", [])}
        cutoff = (today - timedelta(days=3)).isoformat()
        for meal in meals:
            stored[meal["id"]] = meal
        await self.db.set_meta("mealie_meals", [meal for meal in stored.values() if meal["date"] >= cutoff])

    # ------------------------------------------------------------------
    # Leftovers
    # ------------------------------------------------------------------
    async def _check_leftovers(self) -> None:
        if not self.options.get(CONF_ENABLE_LEFTOVERS, True):
            return
        meals = await self.db.get_meta("mealie_meals", [])
        if not meals:
            return
        done = list(await self.db.get_meta("leftovers_done", []))
        leftover_time = parse_time(self.options.get(CONF_LEFTOVER_TIME), parse_time(DEFAULT_LEFTOVER_TIME, time(20)))
        now = dt_util.utcnow()
        changed = False
        for meal in meals:
            if meal.get("entry_type") != "dinner" or meal["id"] in done:
                continue
            meal_day = parse_date(meal.get("date"))
            if meal_day is None:
                continue
            due_at = datetime.combine(meal_day, leftover_time, self.tz)
            if now < due_at:
                continue
            if now - due_at < timedelta(hours=24):
                await self._create_leftover(meal, meal_day)
            done.append(meal["id"])
            changed = True
        if changed:
            await self.db.set_meta("leftovers_done", done[-100:])

    async def _create_leftover(self, meal: dict[str, Any], cooked_on: date) -> None:
        plan = await self.planner.chores_plan()
        if plan is None:
            return
        leftover_time = parse_time(self.options.get(CONF_LEFTOVER_TIME), parse_time(DEFAULT_LEFTOVER_TIME, time(20)))
        days = int(self.options.get(CONF_LEFTOVER_DAYS, DEFAULT_LEFTOVER_DAYS))
        expires = datetime.combine(cooked_on, leftover_time, self.tz) + timedelta(days=days)
        await self.planner.upsert_generated_task(
            SOURCE_LEFTOVER,
            f"leftover:{meal['id']}",
            {
                "plan_id": plan["id"],
                "summary": leftover_summary(meal["name"], cooked_on),
                "due_date": expires.date().isoformat(),
                "expires_at": expires.isoformat(),
                "time_of_day_bucket": "evening",
                "context_tags": ["Indoor"],
                "estimated_minutes": 5,
                "link_url": self.recipe_url(meal.get("slug")),
            },
        )

    async def _on_cook_completed(self, task: dict[str, Any]) -> None:
        if not self.options.get(CONF_ENABLE_LEFTOVERS, True):
            return
        meal_id = str(task.get("source_ref") or "")
        meals = {meal["id"]: meal for meal in await self.db.get_meta("mealie_meals", [])}
        meal = meals.get(meal_id) or {
            "id": meal_id,
            "name": str(task["summary"]).removeprefix("Cook ").strip(),
            "slug": None,
            "entry_type": "dinner",
        }
        await self._create_leftover(meal, self.planner.today())
        done = list(await self.db.get_meta("leftovers_done", []))
        if meal_id not in done:
            done.append(meal_id)
            await self.db.set_meta("leftovers_done", done[-100:])


def _local_text(task: dict[str, Any]) -> str:
    quantity = (task.get("quantity") or "").split(" / ")[0].strip()
    return f"{quantity} {task['summary']}".strip() if quantity else str(task["summary"])


def _remote_is_newer(item: dict[str, Any], task: dict[str, Any]) -> bool:
    stamp = parse_datetime(item.get("updateAt") or item.get("updatedAt") or item.get("update_at"))
    local = parse_datetime(task.get("updated_at"))
    if stamp is None or local is None:
        return True
    return stamp >= local


def _label_category(label: dict[str, Any] | None) -> str | None:
    if not label:
        return None
    name = str(label.get("name") or "").strip().lower()
    for aisle in AISLES:
        if aisle.lower() == name or aisle.split("/")[0].lower() == name:
            return aisle
    return None


def _recipe_minutes(recipe: dict[str, Any]) -> int | None:
    """Parse Mealie's free-text total time ("1 hour 30 minutes", "PT1H30M", "45 min")."""
    raw = str(recipe.get("totalTime") or recipe.get("performTime") or "").strip().lower()
    if not raw:
        return None
    iso = re.fullmatch(r"p(?:t)?(?:(\d+)h)?(?:(\d+)m)?", raw)
    if iso and (iso.group(1) or iso.group(2)):
        return int(iso.group(1) or 0) * 60 + int(iso.group(2) or 0)
    hours = re.search(r"(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b", raw)
    minutes = re.search(r"(\d+)\s*(?:m|min|mins|minute|minutes)\b", raw)
    total = (float(hours.group(1)) * 60 if hours else 0) + (int(minutes.group(1)) if minutes else 0)
    if not total and raw.isdigit():
        total = int(raw)
    return int(total) or None
