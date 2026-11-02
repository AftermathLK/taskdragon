"""WebSocket commands for the wishlist, gift & price tracker (``taskdragon/hoard_*``, ``taskdragon/scan_price_check``).

Every command goes through :func:`.websocket_api._command`, so it is
authenticated and errors come back as codes. Plan ids are authorized by the
guard; item, section, link and deal ids are checked by :class:`~.hoard.HoardManager`
itself, which also applies the anti-spoiler rules (a gift hidden from the
signed-in user answers ``not_found`` exactly like a missing one). Tracker
settings can be read by everyone and changed by administrators only.
"""

from __future__ import annotations

import voluptuous as vol

from .const import BARCODE_SYMBOLOGIES, HOARD_SECTION_KINDS, HOARD_STATUSES, MAX_NAME, PRIORITIES
from .planner import PlannerError
from .websocket_api import ID, NAME, OPT_ID, OPT_NAME, _command, _text

MONEY = vol.Any(None, "", vol.All(vol.Coerce(float), vol.Range(min=0, max=9_999_999)))
URL = vol.All(str, vol.Length(min=1, max=2048))
OPT_TEXT = vol.Any(None, _text(MAX_NAME))
SELECTOR = vol.Any(None, _text(300))
PERSON = vol.Any(None, _text(255))
DAYS = vol.Any(None, "", vol.All(vol.Coerce(int), vol.Range(min=0, max=180)))

SECTION_SCHEMA = vol.Schema(
    {
        vol.Optional("id"): ID,
        vol.Optional("plan_id"): ID,
        vol.Optional("name"): NAME,
        vol.Optional("kind"): vol.In(HOARD_SECTION_KINDS),
        vol.Optional("icon"): vol.Any(None, _text(64)),
        vol.Optional("budget"): MONEY,
        vol.Optional("event_date"): vol.Any(None, _text(40)),
        vol.Optional("repeats_yearly"): bool,
        vol.Optional("recipient_name"): OPT_NAME,
        vol.Optional("gift_for_person_id"): PERSON,
        vol.Optional("stealth_mode"): bool,
        vol.Optional("position"): vol.All(vol.Coerce(int), vol.Range(min=0, max=100000)),
        vol.Optional("parent_id"): OPT_ID,
    }
)
ITEM_SCHEMA = vol.Schema(
    {
        vol.Optional("id"): ID,
        vol.Optional("plan_id"): ID,
        vol.Optional("section_id"): OPT_ID,
        vol.Optional("title"): _text(200),
        vol.Optional("spec_notes"): vol.Any(None, _text(2000)),
        vol.Optional("priority"): vol.In(PRIORITIES),
        vol.Optional("target_price"): MONEY,
        vol.Optional("status"): vol.In(HOARD_STATUSES),
        vol.Optional("barcode"): vol.Any(None, _text(64)),
        vol.Optional("brand"): OPT_TEXT,
        vol.Optional("model"): OPT_TEXT,
        vol.Optional("image_url"): vol.Any(None, "", URL),
        vol.Optional("recipient_name"): OPT_TEXT,
        vol.Optional("gift_for_person_id"): PERSON,
        vol.Optional("stealth_mode"): bool,
        vol.Optional("hiding_spot"): vol.Any(None, _text(500)),
        vol.Optional("watch_keyword_deals"): bool,
        vol.Optional("deal_query"): vol.Any(None, _text(120)),
        vol.Optional("deal_max_price"): MONEY,
        vol.Optional("paid_price"): MONEY,
        vol.Optional("purchase_date"): vol.Any(None, _text(40)),
        vol.Optional("purchase_store"): OPT_TEXT,
        vol.Optional("protection_days"): DAYS,
        vol.Optional("impulse_cooldown"): bool,
    }
)
OFFER_SCHEMA = vol.Schema({vol.Required("url"): URL, vol.Optional("retailer_name"): OPT_TEXT}, extra=vol.REMOVE_EXTRA)


def _hoard(coordinator):
    return coordinator.hoard


@_command({vol.Required("type"): "taskdragon/hoard_board", vol.Required("plan_id"): ID}, guard=lambda m: {"plans": [m["plan_id"]]})
async def ws_board(hass, connection, msg, coordinator, actor):
    board = await _hoard(coordinator).board(msg["plan_id"], actor)
    board["people"] = [{k: p.get(k) for k in ("entity_id", "name", "picture")} for p in coordinator.people_info()]
    return board


@_command({vol.Required("type"): "taskdragon/hoard_save_section", vol.Required("section"): SECTION_SCHEMA}, guard=lambda m: {"plans": [m["section"].get("plan_id")]})
async def ws_save_section(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).save_section(msg["section"], actor)


@_command({vol.Required("type"): "taskdragon/hoard_delete_section", vol.Required("section_id"): ID, vol.Optional("move_to"): OPT_ID})
async def ws_delete_section(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).delete_section(msg["section_id"], actor, move_to=msg.get("move_to"))


@_command({vol.Required("type"): "taskdragon/hoard_save_item", vol.Required("item"): ITEM_SCHEMA}, guard=lambda m: {"plans": [m["item"].get("plan_id")]})
async def ws_save_item(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).save_item(msg["item"], actor)


@_command({vol.Required("type"): "taskdragon/hoard_delete_item", vol.Required("item_id"): ID})
async def ws_delete_item(hass, connection, msg, coordinator, actor):
    payload = await _hoard(coordinator).delete_item(msg["item_id"], actor)
    return {"undo": coordinator.planner.stash_undo("hoard_item", payload, actor)}


@_command({vol.Required("type"): "taskdragon/hoard_set_status", vol.Required("item_id"): ID, vol.Required("status"): vol.In(HOARD_STATUSES)})
async def ws_set_status(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).set_status(msg["item_id"], msg["status"], actor)


@_command(
    {
        vol.Required("type"): "taskdragon/hoard_mark_purchased",
        vol.Required("item_id"): ID,
        vol.Optional("paid_price"): MONEY,
        vol.Optional("purchase_date"): vol.Any(None, _text(40)),
        vol.Optional("store"): OPT_TEXT,
        vol.Optional("protection_days"): DAYS,
    }
)
async def ws_mark_purchased(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).mark_purchased(
        msg["item_id"],
        actor,
        paid_price=msg.get("paid_price"),
        purchase_date=msg.get("purchase_date"),
        store=msg.get("store"),
        protection_days=msg.get("protection_days"),
    )


@_command(
    {
        vol.Required("type"): "taskdragon/hoard_record_price",
        vol.Required("item_id"): ID,
        vol.Required("price"): vol.All(vol.Coerce(float), vol.Range(min=0.01, max=9_999_999)),
        vol.Optional("store"): OPT_TEXT,
        vol.Optional("source"): vol.In(("in_store", "manual")),
    }
)
async def ws_record_price(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).record_price(msg["item_id"], actor, price=msg["price"], store=msg.get("store"), source=msg.get("source", "in_store"))


@_command({vol.Required("type"): "taskdragon/hoard_history", vol.Required("item_id"): ID, vol.Optional("days"): vol.All(vol.Coerce(int), vol.Range(min=1, max=400))})
async def ws_history(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).history(msg["item_id"], actor, msg.get("days", 365))


@_command(
    {
        vol.Required("type"): "taskdragon/hoard_add_url",
        vol.Required("item_id"): ID,
        vol.Required("url"): URL,
        vol.Optional("retailer_name"): OPT_TEXT,
        vol.Optional("css_selector"): SELECTOR,
    }
)
async def ws_add_url(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).add_url(msg["item_id"], actor, url=msg["url"], retailer=msg.get("retailer_name"), css_selector=msg.get("css_selector"))


@_command(
    {
        vol.Required("type"): "taskdragon/hoard_update_url",
        vol.Required("url_id"): ID,
        vol.Optional("retailer_name"): OPT_TEXT,
        vol.Optional("css_selector"): SELECTOR,
    }
)
async def ws_update_url(hass, connection, msg, coordinator, actor):
    changes = {k: msg[k] for k in ("retailer_name", "css_selector") if k in msg}
    return await _hoard(coordinator).update_url(msg["url_id"], actor, changes)


@_command({vol.Required("type"): "taskdragon/hoard_delete_url", vol.Required("url_id"): ID})
async def ws_delete_url(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).delete_url(msg["url_id"], actor)


@_command({vol.Required("type"): "taskdragon/hoard_check_now", vol.Required("item_id"): ID})
async def ws_check_now(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).check_now(msg["item_id"], actor)


@_command({vol.Required("type"): "taskdragon/hoard_check_deals", vol.Required("item_id"): ID})
async def ws_check_deals(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).check_deals_now(msg["item_id"], actor)


@_command({vol.Required("type"): "taskdragon/hoard_deal_action", vol.Required("deal_id"): ID, vol.Required("action"): vol.In(("dismiss", "promote"))})
async def ws_deal_action(hass, connection, msg, coordinator, actor):
    return await _hoard(coordinator).deal_action(msg["deal_id"], msg["action"], actor)


@_command(
    {
        vol.Required("type"): "taskdragon/scan_price_check",
        vol.Required("barcode"): vol.All(str, vol.Length(min=1, max=256)),
        vol.Optional("format"): vol.In(BARCODE_SYMBOLOGIES),
        vol.Optional("plan_id"): OPT_ID,
    },
    guard=lambda m: {"plans": [m.get("plan_id")]},
)
async def ws_scan_price_check(hass, connection, msg, coordinator, actor):
    result = await _hoard(coordinator).scan_price_check(msg["barcode"], actor, symbology=msg.get("format"), plan_id=msg.get("plan_id"))
    result["people"] = [{k: p.get(k) for k in ("entity_id", "name")} for p in coordinator.people_info()]
    return result


@_command(
    {
        vol.Required("type"): "taskdragon/hoard_add_from_scan",
        vol.Optional("plan_id"): ID,
        vol.Optional("item_id"): ID,
        vol.Optional("barcode"): vol.Any(None, _text(64)),
        vol.Optional("title"): vol.Any(None, _text(200)),
        vol.Optional("brand"): OPT_TEXT,
        vol.Optional("model"): OPT_TEXT,
        vol.Optional("image_url"): vol.Any(None, "", URL),
        vol.Optional("section_id"): OPT_ID,
        vol.Optional("offers"): vol.All([OFFER_SCHEMA], vol.Length(max=25)),
        vol.Optional("shelf_price"): MONEY,
        vol.Optional("store"): OPT_TEXT,
        vol.Optional("target_price"): MONEY,
        vol.Optional("gift_for_person_id"): PERSON,
        vol.Optional("recipient_name"): OPT_TEXT,
        vol.Optional("stealth_mode"): bool,
        vol.Optional("bought"): bool,
        vol.Optional("protection_days"): DAYS,
    },
    guard=lambda m: {"plans": [m.get("plan_id")]},
)
async def ws_add_from_scan(hass, connection, msg, coordinator, actor):
    if not msg.get("item_id") and not (msg.get("title") or "").strip():
        raise PlannerError("invalid", "Give the product a name")
    data = {k: v for k, v in msg.items() if k not in ("id", "type")}
    return await _hoard(coordinator).add_from_scan(data, actor)


@_command(
    {
        vol.Required("type"): "taskdragon/hoard_settings",
        vol.Optional("settings"): vol.Schema(
            {
                vol.Optional("tracking"): bool,
                vol.Optional("check_hours"): vol.All(vol.Coerce(int), vol.Range(min=1, max=168)),
                vol.Optional("deal_radar"): bool,
                vol.Optional("deal_hours"): vol.All(vol.Coerce(int), vol.Range(min=1, max=168)),
                vol.Optional("upc_lookup"): bool,
                vol.Optional("impulse_threshold"): vol.All(vol.Coerce(float), vol.Range(min=0, max=9_999_999)),
                vol.Optional("impulse_days"): vol.All(vol.Coerce(int), vol.Range(min=1, max=60)),
                vol.Optional("protection_days"): vol.All(vol.Coerce(int), vol.Range(min=1, max=180)),
            }
        ),
    }
)
async def ws_settings(hass, connection, msg, coordinator, actor):
    if "settings" in msg:
        if not actor.is_admin:
            raise PlannerError("unauthorized", "Only administrators can change the price tracker settings")
        return await _hoard(coordinator).save_settings(msg["settings"])
    return await _hoard(coordinator).settings()


COMMANDS = (
    ws_board,
    ws_save_section,
    ws_delete_section,
    ws_save_item,
    ws_delete_item,
    ws_set_status,
    ws_mark_purchased,
    ws_record_price,
    ws_history,
    ws_add_url,
    ws_update_url,
    ws_delete_url,
    ws_check_now,
    ws_check_deals,
    ws_deal_action,
    ws_scan_price_check,
    ws_add_from_scan,
    ws_settings,
)
__all__ = ["COMMANDS"]
