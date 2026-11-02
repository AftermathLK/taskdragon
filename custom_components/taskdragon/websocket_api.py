"""Custom WebSocket API for the TaskDragon card and panel.

Every command answers with the affected record(s); clients also hold an
``taskdragon/subscribe`` subscription that pushes ``{"plan_ids": [...]}`` whenever
data they may see changes, so every open dashboard refreshes instantly. (The bus
event ``taskdragon_updated`` is fired too, for automations — but non-admin users
may not subscribe to arbitrary bus events, hence the dedicated subscription.)

Security model:

* Home Assistant authenticates every WebSocket connection; each command resolves
  ``connection.user`` into an :class:`~.planner.Actor` and refuses to run without
  one.
* A per-command *guard* names every plan, task, section, trip, pantry or BOM id
  in the message; :meth:`~.planner.Planner.authorize` checks them all against the
  user before the handler runs. Private plans answer ``not_found`` to everyone
  except their owner and the users they are shared with.
* Commands that change household-wide configuration use
  ``websocket_api.require_admin``.
* Schemas cap every string and list, and undo payloads stay server-side behind
  single-use tokens bound to the user, so clients can never inject records.
"""

from __future__ import annotations

import functools
import logging
import sqlite3
from collections.abc import Awaitable, Callable
from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from .backup_manager import BackupError
from .brain_dump import BrainDumpContext, async_parse
from .const import (
    ARCHETYPES,
    BUCKETS,
    COLOR_PATTERN,
    CONF_WEATHER_ENTITY,
    CONTEXT_TAGS,
    DOMAIN,
    ICON_PATTERN,
    KANBAN_COLUMNS,
    LOW_ACTIONS,
    MAX_LIST,
    MAX_NAME,
    MAX_SUMMARY,
    MAX_TEXT,
    PACKING_GROUPS,
    PREF_KEYS,
    PREF_MAINT_VIEWS,
    PRIORITIES,
    SIGNAL_UPDATED,
    SNOOZE_RULE_TYPES,
    STOCK_STATES,
    TRIP_STATUSES,
    VERSION,
)
from .coordinator import TaskDragonCoordinator
from .mealie_client import MealieError
from .planner import Actor, PlannerError

_LOGGER = logging.getLogger(__name__)

Handler = Callable[
    [HomeAssistant, websocket_api.ActiveConnection, dict[str, Any], TaskDragonCoordinator, Actor], Awaitable[Any]
]
Guard = Callable[[dict[str, Any]], dict[str, list[str | None]]]


def _command(schema: dict[Any, Any], *, guard: Guard | None = None, admin: bool = False) -> Callable[[Handler], Any]:
    """Register a handler: authenticate, authorize, translate errors, send the result."""

    def decorator(func: Handler) -> Any:
        @functools.wraps(func)
        async def handler(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
            coordinator: TaskDragonCoordinator | None = hass.data.get(DOMAIN)
            if coordinator is None:
                connection.send_error(msg["id"], "not_loaded", "TaskDragon is not set up")
                return
            if connection.user is None:
                connection.send_error(msg["id"], "unauthorized", "Sign in first")
                return
            try:
                actor = await coordinator.actor_for_user_id(connection.user.id)
                if guard is not None:
                    await coordinator.planner.authorize(actor, **guard(msg))
                result = await func(hass, connection, msg, coordinator, actor)
            except PlannerError as err:
                connection.send_error(msg["id"], err.code, err.message)
                return
            except MealieError as err:
                connection.send_error(msg["id"], "mealie_error", str(err))
                return
            except BackupError as err:
                connection.send_error(msg["id"], "backup_error", str(err))
                return
            connection.send_result(msg["id"], result)

        wrapped = websocket_api.async_response(handler)
        if admin:
            wrapped = websocket_api.require_admin(wrapped)
        return websocket_api.websocket_command(schema)(wrapped)

    return decorator


def _text(max_length: int) -> vol.All:
    return vol.All(str, vol.Length(max=max_length))


ID = vol.All(str, vol.Length(min=1, max=64))
IDS = vol.All([ID], vol.Length(max=MAX_LIST))
OPT_ID = vol.Any(None, ID)
NAME = vol.All(str, vol.Length(min=1, max=MAX_NAME))
OPT_NAME = vol.Any(None, _text(MAX_NAME))
SUMMARY = _text(MAX_SUMMARY)
LONG_TEXT = vol.Any(None, _text(MAX_TEXT))
DATE = vol.Any(None, _text(40))

TASK_FIELDS: dict[Any, Any] = {
    vol.Optional("summary"): SUMMARY,
    vol.Optional("description"): LONG_TEXT,
    vol.Optional("status"): _text(20),
    vol.Optional("priority"): vol.In(PRIORITIES),
    vol.Optional("due_date"): DATE,
    vol.Optional("due_datetime"): DATE,
    vol.Optional("time_of_day_bucket"): vol.In(BUCKETS),
    vol.Optional("recurrence_mode"): vol.Any(None, _text(20)),
    vol.Optional("recurrence_rule"): vol.Any(None, _text(400)),
    vol.Optional("recurrence_interval_days"): vol.Any(None, vol.All(vol.Coerce(int), vol.Range(min=1, max=3650))),
    vol.Optional("estimated_minutes"): vol.Any(None, vol.All(vol.Coerce(int), vol.Range(min=1, max=10000))),
    vol.Optional("context_tags"): vol.All([_text(MAX_NAME)], vol.Length(max=50)),
    vol.Optional("assigned_to"): vol.Any(None, _text(255), vol.All([_text(255)], vol.Length(max=50))),
    vol.Optional("kanban_column"): vol.Any(None, vol.In(KANBAN_COLUMNS)),
    vol.Optional("category"): OPT_NAME,
    vol.Optional("quantity"): OPT_NAME,
    vol.Optional("shift_aware"): bool,
    vol.Optional("hide_when_blocked"): bool,
    vol.Optional("is_repeatable"): bool,
    vol.Optional("link_url"): vol.Any(None, _text(2048)),
    vol.Optional("expires_at"): DATE,
    vol.Optional("sensor_entity_id"): vol.Any(None, _text(255)),
    vol.Optional("sensor_mode"): vol.Any(None, _text(20)),
    vol.Optional("sensor_threshold"): vol.Any(None, vol.Coerce(float)),
    vol.Optional("blocked_by"): IDS,
    vol.Optional("remind_target"): vol.Any(None, _text(140)),
    vol.Optional("remind_time"): vol.Any(None, _text(12)),
}
TASK_SCHEMA = vol.Schema(
    {
        vol.Optional("uid"): ID,
        vol.Optional("plan_id"): ID,
        vol.Optional("parent_uid"): OPT_ID,
        vol.Optional("section_id"): OPT_ID,
        vol.Optional("trip_id"): OPT_ID,
        vol.Optional("dedupe"): bool,
        **TASK_FIELDS,
    },
    extra=vol.REMOVE_EXTRA,
)
TRANSFER_CHANGES = vol.Schema(TASK_FIELDS, extra=vol.REMOVE_EXTRA)
PLAN_SETTINGS = vol.Schema(
    {
        vol.Optional(key): OPT_NAME
        for key in ("role", "default_category", "mealie_list_id", "shopping_plan_id", "chore_plan_id")
    },
    extra=vol.REMOVE_EXTRA,
)


def _task_guard(msg: dict[str, Any]) -> dict[str, list[str | None]]:
    task = msg["task"]
    return {
        "tasks": [task.get("uid"), task.get("parent_uid"), *(task.get("blocked_by") or [])],
        "plans": [task.get("plan_id")],
        "sections": [task.get("section_id")],
        "trips": [task.get("trip_id")],
    }


@callback
def async_register(hass: HomeAssistant) -> None:
    for command in (
        ws_get_board,
        ws_subscribe,
        ws_set_prefs,
        ws_save_task,
        ws_delete_tasks,
        ws_undo,
        ws_set_completed,
        ws_move_task,
        ws_transfer_task,
        ws_claim_task,
        ws_bulk_action,
        ws_clear_completed,
        ws_snooze,
        ws_snooze_context,
        ws_unsnooze,
        ws_brain_dump,
        ws_apply_actions,
        ws_add_shopping_item,
        ws_item_history,
        ws_delete_history_item,
        ws_task_history,
        ws_save_plan,
        ws_delete_plan,
        ws_delete_private_plan,
        ws_clone_plan,
        ws_reset_plan,
        ws_save_section,
        ws_delete_section,
        ws_reorder_sections,
        ws_save_trip,
        ws_delete_trip,
        ws_reset_trip,
        ws_set_repeatable,
        ws_add_dependency,
        ws_remove_dependency,
        ws_save_pantry_item,
        ws_delete_pantry_item,
        ws_trigger_pantry_low,
        ws_pantry_fetch_recipe,
        ws_save_bom_item,
        ws_delete_bom_item,
        ws_push_bom,
        ws_mealie_sync,
        ws_mealie_lists,
        ws_mealie_get_recipes,
        ws_mealie_get_recipe_detail,
        ws_mealie_recipe_preview,
        ws_mealie_add_recipe_to_groceries,
        ws_mealie_plan_meal,
        ws_mealie_import_settings,
        ws_run_shift_balance,
    ):
        websocket_api.async_register_command(hass, command)
    # These modules import this one's helpers, so they load here.
    from .backup_ws import COMMANDS as BACKUP_COMMANDS
    from .barcode_ws import COMMANDS as BARCODE_COMMANDS
    from .hoard_ws import COMMANDS as HOARD_COMMANDS
    from .maintenance_ws import COMMANDS as MAINTENANCE_COMMANDS

    for command in (*MAINTENANCE_COMMANDS, *BARCODE_COMMANDS, *BACKUP_COMMANDS, *HOARD_COMMANDS):
        websocket_api.async_register_command(hass, command)


# ----------------------------------------------------------------------
# Board, subscription & preferences
# ----------------------------------------------------------------------
@_command({vol.Required("type"): "taskdragon/get_board", vol.Optional("plan_id"): ID}, guard=lambda m: {"plans": [m.get("plan_id")]})
async def ws_get_board(hass, connection, msg, coordinator, actor):
    board = await coordinator.planner.get_board(msg.get("plan_id"), actor)
    board["people"] = coordinator.people_for(actor)
    board["me"] = coordinator.person_for_user(actor.user_id)
    board["notify_targets"] = coordinator.notify_targets(actor)
    # Status only: the Mealie URL and token never leave the server.
    board["mealie"] = {k: coordinator.mealie_status.get(k) for k in ("enabled", "ok", "last_sync", "error")}
    board["options"] = {
        "weather_entity": coordinator.options.get(CONF_WEATHER_ENTITY),
        "llm": bool(coordinator.conversation_agent()),
        "context_tags": list(CONTEXT_TAGS),
        "archetypes": list(ARCHETYPES),
        "packing_groups": list(PACKING_GROUPS),
    }
    board["version"] = VERSION
    return board


@websocket_api.websocket_command({vol.Required("type"): "taskdragon/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    if connection.user is None:
        connection.send_error(msg["id"], "unauthorized", "Sign in first")
        return
    user_id = connection.user.id

    async def deliver(plan_ids: set[str]) -> None:
        coordinator: TaskDragonCoordinator | None = hass.data.get(DOMAIN)
        if coordinator is None or coordinator.closing:
            return
        try:
            actor = await coordinator.actor_for_user_id(user_id)
            visible = await coordinator.planner.accessible_plan_ids(plan_ids, actor)
        except (RuntimeError, ValueError, sqlite3.Error):
            return  # shutting down
        if visible:
            connection.send_message(websocket_api.event_message(msg["id"], {"plan_ids": sorted(visible)}))

    @callback
    def forward(plan_ids: set[str]) -> None:
        coordinator: TaskDragonCoordinator | None = hass.data.get(DOMAIN)
        if coordinator is not None:
            coordinator.spawn(deliver(set(plan_ids)), "taskdragon_ws_forward")

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_UPDATED, forward)
    connection.send_result(msg["id"])


@_command(
    {
        vol.Required("type"): "taskdragon/set_prefs",
        vol.Required("prefs"): {
            **{vol.Optional(key): vol.All([_text(200)], vol.Length(max=MAX_LIST)) for key in PREF_KEYS},
            vol.Optional(PREF_MAINT_VIEWS): vol.All([dict], vol.Length(max=30)),
        },
    }
)
async def ws_set_prefs(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.set_prefs(actor, msg["prefs"])


# ----------------------------------------------------------------------
# Tasks
# ----------------------------------------------------------------------
@_command({vol.Required("type"): "taskdragon/save_task", vol.Required("task"): TASK_SCHEMA}, guard=_task_guard)
async def ws_save_task(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.save_task(msg["task"], actor)


@_command({vol.Required("type"): "taskdragon/delete_tasks", vol.Required("uids"): IDS}, guard=lambda m: {"tasks": m["uids"]})
async def ws_delete_tasks(hass, connection, msg, coordinator, actor):
    snapshot = await coordinator.planner.delete_tasks(msg["uids"])
    return {"count": len(snapshot["tasks"]), "undo": coordinator.planner.stash_undo("tasks", snapshot, actor)}


@_command({vol.Required("type"): "taskdragon/undo", vol.Required("token"): ID})
async def ws_undo(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.undo(msg["token"], actor)


@_command(
    {vol.Required("type"): "taskdragon/set_completed", vol.Required("uid"): ID, vol.Required("completed"): bool},
    guard=lambda m: {"tasks": [m["uid"]]},
)
async def ws_set_completed(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.set_completed(msg["uid"], msg["completed"], actor)


@_command(
    {
        vol.Required("type"): "taskdragon/move_task",
        vol.Required("uid"): ID,
        vol.Optional("previous_uid"): OPT_ID,
        vol.Optional("plan_id"): ID,
        vol.Optional("parent_uid"): OPT_ID,
        vol.Optional("section_id"): OPT_ID,
        vol.Optional("trip_id"): OPT_ID,
        vol.Optional("kanban_column"): vol.In(KANBAN_COLUMNS),
        vol.Optional("bucket"): vol.In(BUCKETS),
        vol.Optional("assign_to"): vol.Any(None, _text(255)),
        vol.Optional("category"): NAME,
    },
    guard=lambda m: {
        "tasks": [m["uid"], m.get("previous_uid"), m.get("parent_uid")],
        "plans": [m.get("plan_id")],
        "sections": [m.get("section_id")],
        "trips": [m.get("trip_id")],
    },
)
async def ws_move_task(hass, connection, msg, coordinator, actor):
    kwargs: dict[str, Any] = {
        key: msg[key] for key in ("plan_id", "kanban_column", "bucket", "assign_to", "category") if key in msg
    }
    for key in ("parent_uid", "section_id", "trip_id"):
        if key in msg:
            kwargs[key] = msg[key]
    return await coordinator.planner.move_task(msg["uid"], msg.get("previous_uid"), actor=actor, **kwargs)


@_command(
    {
        vol.Required("type"): "taskdragon/transfer_task",
        vol.Required("uid"): ID,
        vol.Required("plan_id"): ID,
        vol.Optional("changes", default={}): TRANSFER_CHANGES,
    },
    guard=lambda m: {"tasks": [m["uid"], *(m["changes"].get("blocked_by") or [])], "plans": [m["plan_id"]]},
)
async def ws_transfer_task(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.transfer_task(msg["uid"], msg["plan_id"], msg["changes"], actor)


@_command({vol.Required("type"): "taskdragon/claim_task", vol.Required("uid"): ID}, guard=lambda m: {"tasks": [m["uid"]]})
async def ws_claim_task(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.claim_task(msg["uid"], actor.person, actor)


@_command(
    {
        vol.Required("type"): "taskdragon/bulk_action",
        vol.Required("uids"): IDS,
        vol.Required("action"): vol.In(("complete", "uncomplete", "delete", "assign", "move", "priority", "snooze", "tag")),
        vol.Optional("value"): vol.Any(None, _text(255)),
    },
    guard=lambda m: {"tasks": m["uids"], "plans": [m.get("value")] if m["action"] == "move" else []},
)
async def ws_bulk_action(hass, connection, msg, coordinator, actor):
    result = await coordinator.planner.bulk(msg["uids"], msg["action"], msg.get("value"), actor)
    if "snapshot" in result:
        result["undo"] = coordinator.planner.stash_undo("tasks", result.pop("snapshot"), actor)
    return result


@_command({vol.Required("type"): "taskdragon/clear_completed", vol.Required("plan_id"): ID}, guard=lambda m: {"plans": [m["plan_id"]]})
async def ws_clear_completed(hass, connection, msg, coordinator, actor):
    snapshot = await coordinator.planner.clear_completed(msg["plan_id"])
    return {"count": len(snapshot["tasks"]), "undo": coordinator.planner.stash_undo("tasks", snapshot, actor)}


@_command(
    {vol.Required("type"): "taskdragon/snooze", vol.Required("uid"): ID, vol.Required("until"): _text(40)},
    guard=lambda m: {"tasks": [m["uid"]]},
)
async def ws_snooze(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.snooze_until(msg["uid"], msg["until"], actor)


@_command(
    {
        vol.Required("type"): "taskdragon/snooze_context",
        vol.Required("uid"): ID,
        vol.Required("rule_type"): vol.In(SNOOZE_RULE_TYPES),
        vol.Optional("config", default={}): vol.Schema(
            {
                vol.Optional("person"): _text(255),
                vol.Optional("people"): vol.All([_text(255)], vol.Length(max=20)),
                vol.Optional("entity_id"): _text(255),
                vol.Optional("state"): _text(255),
                vol.Optional("above"): vol.Coerce(float),
                vol.Optional("below"): vol.Coerce(float),
                vol.Optional("until"): _text(40),
                vol.Optional("weather_entity"): _text(255),
            }
        ),
    },
    guard=lambda m: {"tasks": [m["uid"]]},
)
async def ws_snooze_context(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.snooze_context(msg["uid"], msg["rule_type"], msg["config"], actor)


@_command({vol.Required("type"): "taskdragon/unsnooze", vol.Required("uid"): ID}, guard=lambda m: {"tasks": [m["uid"]]})
async def ws_unsnooze(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.unsnooze(msg["uid"], reason="manual")


@_command(
    {vol.Required("type"): "taskdragon/task_history", vol.Required("uid"): ID, vol.Optional("limit", default=20): vol.All(int, vol.Range(min=1, max=200))},
    guard=lambda m: {"tasks": [m["uid"]]},
)
async def ws_task_history(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.task_history(msg["uid"], msg["limit"])


@_command(
    {vol.Required("type"): "taskdragon/add_dependency", vol.Required("uid"): ID, vol.Required("blocked_by_uid"): ID},
    guard=lambda m: {"tasks": [m["uid"], m["blocked_by_uid"]]},
)
async def ws_add_dependency(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.add_dependency(msg["uid"], msg["blocked_by_uid"])


@_command(
    {vol.Required("type"): "taskdragon/remove_dependency", vol.Required("uid"): ID, vol.Required("blocked_by_uid"): ID},
    guard=lambda m: {"tasks": [m["uid"]]},
)
async def ws_remove_dependency(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.remove_dependency(msg["uid"], msg["blocked_by_uid"])


# ----------------------------------------------------------------------
# Brain dump
# ----------------------------------------------------------------------
async def run_brain_dump(
    coordinator: TaskDragonCoordinator, text: str, actor: Actor, *, dry_run: bool = False, agent_id: str | None = None
) -> dict[str, Any]:
    """Shared by the WebSocket command and the ``taskdragon.parse_brain_dump`` service.

    The parser (and any LLM prompt) only ever sees plans the actor may access.
    Each user gets a limited number per ten minutes, because every one may call an LLM.
    """
    if not coordinator.brain_limiter.allow(actor.user_id):
        raise PlannerError("rate_limited", f"That's a lot of brain dumps — try again in {coordinator.brain_limiter.retry_after(actor.user_id)} seconds")
    ctx = BrainDumpContext(
        now=coordinator.planner.now_local(),
        plans=await coordinator.planner.accessible_plans(actor),
        people=coordinator.people_info(),
        speaker=actor.person,
    )
    actions, engine = await async_parse(coordinator.hass, text, ctx, agent_id or coordinator.conversation_agent())
    results = [] if dry_run else await coordinator.planner.apply_actions(actions, actor)
    return {"engine": engine, "actions": actions, "results": results}


@_command(
    {vol.Required("type"): "taskdragon/brain_dump", vol.Required("text"): _text(4000), vol.Optional("dry_run", default=False): bool}
)
async def ws_brain_dump(hass, connection, msg, coordinator, actor):
    return await run_brain_dump(coordinator, msg["text"], actor, dry_run=msg["dry_run"])


@_command({vol.Required("type"): "taskdragon/apply_actions", vol.Required("actions"): vol.All([dict], vol.Length(max=50))})
async def ws_apply_actions(hass, connection, msg, coordinator, actor):
    # apply_actions authorizes every action's plan itself.
    return {"results": await coordinator.planner.apply_actions(msg["actions"], actor)}


# ----------------------------------------------------------------------
# Shopping
# ----------------------------------------------------------------------
@_command(
    {
        vol.Required("type"): "taskdragon/add_shopping_item",
        vol.Required("plan_id"): ID,
        vol.Required("text"): SUMMARY,
        vol.Optional("category"): OPT_NAME,
        vol.Optional("quantity"): OPT_NAME,
    },
    guard=lambda m: {"plans": [m["plan_id"]]},
)
async def ws_add_shopping_item(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.add_shopping_item(
        msg["plan_id"], msg["text"], actor, category=msg.get("category"), quantity=msg.get("quantity")
    )


@_command(
    {vol.Required("type"): "taskdragon/item_history", vol.Required("plan_id"): ID, vol.Optional("limit", default=40): vol.All(int, vol.Range(min=1, max=200))},
    guard=lambda m: {"plans": [m["plan_id"]]},
)
async def ws_item_history(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.item_history(msg["plan_id"], msg["limit"])


@_command(
    {vol.Required("type"): "taskdragon/delete_history_item", vol.Required("plan_id"): ID, vol.Required("name_key"): _text(MAX_SUMMARY)},
    guard=lambda m: {"plans": [m["plan_id"]]},
)
async def ws_delete_history_item(hass, connection, msg, coordinator, actor):
    await coordinator.db.delete_history_item(msg["plan_id"], msg["name_key"])
    return {"ok": True}


# ----------------------------------------------------------------------
# Plans (categories)
# ----------------------------------------------------------------------
async def _household_users(hass: HomeAssistant, user_ids: list[str]) -> list[str]:
    """Keep only ids of real, active Home Assistant users."""
    valid = []
    for user_id in user_ids:
        user = await hass.auth.async_get_user(user_id)
        if user is not None and user.is_active and not user.system_generated:
            valid.append(user_id)
    return valid


@_command(
    {
        vol.Required("type"): "taskdragon/save_plan",
        vol.Required("plan"): vol.Schema(
            {
                vol.Optional("id"): ID,
                vol.Optional("name"): NAME,
                vol.Optional("archetype"): vol.In(ARCHETYPES),
                vol.Optional("icon"): vol.Any(None, "", vol.Match(ICON_PATTERN)),
                vol.Optional("color"): vol.Any(None, "", vol.Match(COLOR_PATTERN)),
                vol.Optional("archived"): bool,
                vol.Optional("is_private"): bool,
                vol.Optional("shared_with"): vol.All([ID], vol.Length(max=20)),
                vol.Optional("settings"): PLAN_SETTINGS,
            }
        ),
    },
    guard=lambda m: {"plans": [m["plan"].get("id")]},
)
async def ws_save_plan(hass, connection, msg, coordinator, actor):
    plan = dict(msg["plan"])
    if "shared_with" in plan:
        plan["shared_with"] = await _household_users(hass, plan["shared_with"])
    if plan.get("id"):
        return await coordinator.planner.update_plan(plan["id"], plan, actor)
    return await coordinator.planner.create_plan(plan, actor)


@_command({vol.Required("type"): "taskdragon/delete_plan", vol.Required("plan_id"): ID}, guard=lambda m: {"plans": [m["plan_id"]]}, admin=True)
async def ws_delete_plan(hass, connection, msg, coordinator, actor):
    await coordinator.planner.delete_plan(msg["plan_id"], actor)
    return {"ok": True}


@_command({vol.Required("type"): "taskdragon/delete_private_plan", vol.Required("plan_id"): ID}, guard=lambda m: {"plans": [m["plan_id"]]})
async def ws_delete_private_plan(hass, connection, msg, coordinator, actor):
    """Owners delete their own private lists without being administrators."""
    plan = await coordinator.db.get_plan(msg["plan_id"])
    if plan is None or not plan["is_private"] or plan.get("owner_user_id") != actor.user_id:
        raise PlannerError("unauthorized", "Only the owner can delete a private list")
    await coordinator.planner.delete_plan(msg["plan_id"], actor)
    return {"ok": True}


@_command(
    {
        vol.Required("type"): "taskdragon/clone_plan",
        vol.Required("plan_id"): ID,
        vol.Optional("name"): OPT_NAME,
        vol.Optional("start_date"): DATE,
    },
    guard=lambda m: {"plans": [m["plan_id"]]},
)
async def ws_clone_plan(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.clone_plan(msg["plan_id"], msg.get("name"), msg.get("start_date"), actor)


@_command({vol.Required("type"): "taskdragon/reset_plan", vol.Required("plan_id"): ID}, guard=lambda m: {"plans": [m["plan_id"]]})
async def ws_reset_plan(hass, connection, msg, coordinator, actor):
    return {"reset": await coordinator.planner.reset_plan(msg["plan_id"])}


# ----------------------------------------------------------------------
# Quick-list sections
# ----------------------------------------------------------------------
@_command(
    {
        vol.Required("type"): "taskdragon/save_section",
        vol.Required("section"): vol.Schema({vol.Optional("id"): ID, vol.Optional("plan_id"): ID, vol.Required("name"): NAME}),
    },
    guard=lambda m: {"sections": [m["section"].get("id")], "plans": [m["section"].get("plan_id")]},
)
async def ws_save_section(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.save_section(msg["section"])


@_command({vol.Required("type"): "taskdragon/delete_section", vol.Required("section_id"): ID}, guard=lambda m: {"sections": [m["section_id"]]})
async def ws_delete_section(hass, connection, msg, coordinator, actor):
    payload = await coordinator.planner.delete_section(msg["section_id"])
    return {"moved": len(payload["task_uids"]), "undo": coordinator.planner.stash_undo("section", payload, actor)}


@_command(
    {vol.Required("type"): "taskdragon/reorder_sections", vol.Required("plan_id"): ID, vol.Required("section_ids"): IDS},
    guard=lambda m: {"plans": [m["plan_id"]], "sections": m["section_ids"]},
)
async def ws_reorder_sections(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.reorder_sections(msg["plan_id"], msg["section_ids"])


# ----------------------------------------------------------------------
# Packing trips
# ----------------------------------------------------------------------
@_command(
    {
        vol.Required("type"): "taskdragon/save_trip",
        vol.Required("trip"): vol.Schema(
            {
                vol.Optional("id"): ID,
                vol.Optional("plan_id"): ID,
                vol.Optional("name"): NAME,
                vol.Optional("start_date"): DATE,
                vol.Optional("end_date"): DATE,
                vol.Optional("status"): vol.In(TRIP_STATUSES),
            }
        ),
    },
    guard=lambda m: {"trips": [m["trip"].get("id")], "plans": [m["trip"].get("plan_id")]},
)
async def ws_save_trip(hass, connection, msg, coordinator, actor):
    trip = msg["trip"]
    if trip.get("id"):
        return {"trip": await coordinator.planner.update_trip(trip["id"], trip), "added": 0}
    if not trip.get("plan_id") or not trip.get("name"):
        raise PlannerError("invalid", "A new trip needs a packing plan and a name")
    return await coordinator.planner.create_trip(trip["plan_id"], trip["name"], trip.get("start_date"), trip.get("end_date"), actor)


@_command({vol.Required("type"): "taskdragon/delete_trip", vol.Required("trip_id"): ID}, guard=lambda m: {"trips": [m["trip_id"]]})
async def ws_delete_trip(hass, connection, msg, coordinator, actor):
    payload = await coordinator.planner.delete_trip(msg["trip_id"])
    return {"undo": coordinator.planner.stash_undo("trip", payload, actor)}


@_command({vol.Required("type"): "taskdragon/reset_trip", vol.Required("trip_id"): ID}, guard=lambda m: {"trips": [m["trip_id"]]})
async def ws_reset_trip(hass, connection, msg, coordinator, actor):
    return {"reset": await coordinator.planner.reset_trip(msg["trip_id"])}


@_command(
    {vol.Required("type"): "taskdragon/set_repeatable", vol.Required("uid"): ID, vol.Required("repeatable"): bool},
    guard=lambda m: {"tasks": [m["uid"]]},
)
async def ws_set_repeatable(hass, connection, msg, coordinator, actor):
    return {"updated": await coordinator.planner.set_repeatable(msg["uid"], msg["repeatable"])}


# ----------------------------------------------------------------------
# Pantry
# ----------------------------------------------------------------------
@_command(
    {
        vol.Required("type"): "taskdragon/save_pantry_item",
        vol.Required("item"): vol.Schema(
            {
                vol.Optional("id"): ID,
                vol.Optional("plan_id"): ID,
                vol.Optional("name"): NAME,
                vol.Optional("category"): OPT_NAME,
                vol.Optional("quantity"): OPT_NAME,
                vol.Optional("stock_state"): vol.In(STOCK_STATES),
                vol.Optional("is_batch"): bool,
                vol.Optional("mealie_recipe_slug"): OPT_NAME,
                vol.Optional("ingredients"): vol.Any(_text(MAX_TEXT), vol.All(list, vol.Length(max=200))),
                vol.Optional("low_action"): vol.In(LOW_ACTIONS),
                vol.Optional("notes"): vol.Any(None, _text(2000)),
            }
        ),
    },
    guard=lambda m: {"pantry": [m["item"].get("id")], "plans": [m["item"].get("plan_id")]},
)
async def ws_save_pantry_item(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.save_pantry_item(msg["item"])


@_command({vol.Required("type"): "taskdragon/delete_pantry_item", vol.Required("item_id"): ID}, guard=lambda m: {"pantry": [m["item_id"]]})
async def ws_delete_pantry_item(hass, connection, msg, coordinator, actor):
    item = await coordinator.planner.delete_pantry_item(msg["item_id"])
    return {"undo": coordinator.planner.stash_undo("pantry", item, actor) if item else None}


@_command(
    {
        vol.Required("type"): "taskdragon/trigger_pantry_low",
        vol.Required("item_id"): ID,
        vol.Required("state"): vol.In(STOCK_STATES),
        vol.Optional("action"): vol.Any(None, vol.In(LOW_ACTIONS)),
    },
    guard=lambda m: {"pantry": [m["item_id"]]},
)
async def ws_trigger_pantry_low(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.set_pantry_state(msg["item_id"], msg["state"], msg.get("action"), actor)


@_command({vol.Required("type"): "taskdragon/pantry_fetch_recipe", vol.Required("item_id"): ID}, guard=lambda m: {"pantry": [m["item_id"]]})
async def ws_pantry_fetch_recipe(hass, connection, msg, coordinator, actor):
    item = await coordinator.db.get_pantry_item(msg["item_id"])
    if item is None:
        raise PlannerError("not_found", "Pantry item not found")
    if not item.get("mealie_recipe_slug"):
        raise PlannerError("invalid", "Link a Mealie recipe slug first")
    if coordinator.mealie is None:
        raise PlannerError("mealie_disabled", "Mealie is not configured")
    lines = await coordinator.async_fetch_recipe_ingredients(item["mealie_recipe_slug"])
    return await coordinator.planner.save_pantry_item({"id": item["id"], "ingredients": lines, "is_batch": True})


# ----------------------------------------------------------------------
# Bill of materials
# ----------------------------------------------------------------------
@_command(
    {
        vol.Required("type"): "taskdragon/save_bom_item",
        vol.Required("item"): vol.Schema(
            {
                vol.Optional("id"): ID,
                vol.Optional("plan_id"): ID,
                vol.Optional("name"): NAME,
                vol.Optional("quantity"): OPT_NAME,
                vol.Optional("category"): OPT_NAME,
                vol.Optional("notes"): vol.Any(None, _text(2000)),
                vol.Optional("acquired"): bool,
            }
        ),
    },
    guard=lambda m: {"bom": [m["item"].get("id")], "plans": [m["item"].get("plan_id")]},
)
async def ws_save_bom_item(hass, connection, msg, coordinator, actor):
    return await coordinator.planner.save_bom_item(msg["item"])


@_command({vol.Required("type"): "taskdragon/delete_bom_item", vol.Required("item_id"): ID}, guard=lambda m: {"bom": [m["item_id"]]})
async def ws_delete_bom_item(hass, connection, msg, coordinator, actor):
    await coordinator.planner.delete_bom_item(msg["item_id"])
    return {"ok": True}


@_command(
    {vol.Required("type"): "taskdragon/push_bom", vol.Required("plan_id"): ID, vol.Optional("item_ids"): IDS},
    guard=lambda m: {"plans": [m["plan_id"]], "bom": m.get("item_ids") or []},
)
async def ws_push_bom(hass, connection, msg, coordinator, actor):
    return {"pushed": await coordinator.planner.push_bom(msg["plan_id"], msg.get("item_ids"), actor)}


# ----------------------------------------------------------------------
# Integrations
# ----------------------------------------------------------------------
@_command({vol.Required("type"): "taskdragon/mealie_sync"})
async def ws_mealie_sync(hass, connection, msg, coordinator, actor):
    status = await coordinator.async_sync_mealie()
    return {k: status.get(k) for k in ("enabled", "ok", "last_sync", "error")}


@_command({vol.Required("type"): "taskdragon/mealie_lists"}, admin=True)
async def ws_mealie_lists(hass, connection, msg, coordinator, actor):
    return await coordinator.async_mealie_lists()


# ----------------------------------------------------------------------
# Mealie recipe browser
# ----------------------------------------------------------------------
SLUG = vol.All(str, vol.Length(min=1, max=200))
MEAL_TYPE = vol.In(("breakfast", "lunch", "dinner", "side", "snack", "dessert", "drink"))


@_command({vol.Required("type"): "taskdragon/mealie_get_recipes", vol.Optional("refresh", default=False): bool})
async def ws_mealie_get_recipes(hass, connection, msg, coordinator, actor):
    return await coordinator.recipes.recipes(refresh=msg["refresh"])


@_command(
    {vol.Required("type"): "taskdragon/mealie_get_recipe_detail", vol.Required("recipe_slug"): SLUG, vol.Optional("skip_seasonings"): vol.Any(None, bool)}
)
async def ws_mealie_get_recipe_detail(hass, connection, msg, coordinator, actor):
    """The whole recipe for the cooking view; images come through the authenticated proxy."""
    return await coordinator.recipes.detail(msg["recipe_slug"], actor, skip_seasonings=msg.get("skip_seasonings"))


@_command(
    {vol.Required("type"): "taskdragon/mealie_recipe_preview", vol.Required("recipe_slug"): SLUG, vol.Optional("skip_seasonings"): vol.Any(None, bool)}
)
async def ws_mealie_recipe_preview(hass, connection, msg, coordinator, actor):
    return await coordinator.recipes.preview(msg["recipe_slug"], actor, skip_seasonings=msg.get("skip_seasonings"))


@_command(
    {
        vol.Required("type"): "taskdragon/mealie_add_recipe_to_groceries",
        vol.Required("recipe_slug"): SLUG,
        vol.Optional("plan_id"): OPT_ID,
        vol.Optional("ingredients"): vol.Any(None, vol.All([vol.All(int, vol.Range(min=0, max=999))], vol.Length(max=200))),
        vol.Optional("skip_seasonings"): vol.Any(None, bool),
        vol.Optional("date"): DATE,
        vol.Optional("entry_type", default="dinner"): MEAL_TYPE,
        vol.Optional("scale", default=1.0): vol.All(vol.Coerce(float), vol.Range(min=0.125, max=20)),
    },
    guard=lambda m: {"plans": [m.get("plan_id")]},
)
async def ws_mealie_add_recipe_to_groceries(hass, connection, msg, coordinator, actor):
    return await coordinator.recipes.add_to_groceries(
        msg["recipe_slug"],
        actor,
        plan_id=msg.get("plan_id"),
        indices=msg.get("ingredients"),
        skip_seasonings=msg.get("skip_seasonings"),
        day=msg.get("date") or None,
        entry_type=msg["entry_type"],
        scale=msg["scale"],
    )


@_command(
    {
        vol.Required("type"): "taskdragon/mealie_plan_meal",
        vol.Required("recipe_slug"): SLUG,
        vol.Required("date"): _text(40),
        vol.Optional("entry_type", default="dinner"): MEAL_TYPE,
        vol.Optional("add_ingredients", default=False): bool,
        vol.Optional("plan_id"): OPT_ID,
        vol.Optional("skip_seasonings"): vol.Any(None, bool),
    },
    guard=lambda m: {"plans": [m.get("plan_id")]},
)
async def ws_mealie_plan_meal(hass, connection, msg, coordinator, actor):
    return await coordinator.recipes.plan_meal(
        msg["recipe_slug"],
        msg["date"],
        actor,
        entry_type=msg["entry_type"],
        add_ingredients=msg["add_ingredients"],
        plan_id=msg.get("plan_id"),
        skip_seasonings=msg.get("skip_seasonings"),
    )


@_command(
    {
        vol.Required("type"): "taskdragon/mealie_import_settings",
        vol.Optional("settings"): vol.Schema(
            {
                vol.Optional("skip_seasonings"): bool,
                vol.Optional("seasonings"): vol.All([_text(200)], vol.Length(max=1000)),
            }
        ),
    }
)
async def ws_mealie_import_settings(hass, connection, msg, coordinator, actor):
    """Read (or, as an administrator, change) the household's recipe import filter."""
    if "settings" in msg:
        if not actor.is_admin:
            raise PlannerError("unauthorized", "Only administrators can change the household's recipe import filter")
        return await coordinator.recipes.save_settings(msg["settings"])
    return await coordinator.recipes.settings()


@_command({vol.Required("type"): "taskdragon/run_shift_balance"}, admin=True)
async def ws_run_shift_balance(hass, connection, msg, coordinator, actor):
    return await coordinator.async_run_shift_balance()
