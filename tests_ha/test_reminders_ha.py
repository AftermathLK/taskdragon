"""1.5 phone reminders and wishlist categories against a real Home Assistant core."""

from __future__ import annotations

from datetime import timedelta

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from homeassistant.core import Context, HomeAssistant
from homeassistant.util import dt as dt_util

from custom_components.taskdragon.const import DOMAIN

OPTIONS = {"people": [{"entity_id": "person.alex"}, {"entity_id": "person.sam"}], "rollover_hour": 0}


class WS:
    def __init__(self, client) -> None:
        self.client = client
        self._ids = iter(range(1, 100000))

    async def call(self, message: dict) -> dict:
        msg_id = next(self._ids)
        await self.client.send_json({"id": msg_id, **message})
        while True:
            reply = await self.client.receive_json()
            if reply.get("id") == msg_id and reply.get("type") != "event":
                return reply

    async def ok(self, message: dict):
        reply = await self.call(message)
        assert reply["success"], reply
        return reply["result"]

    async def error(self, message: dict) -> str:
        reply = await self.call(message)
        assert not reply["success"], reply
        return reply["error"]["code"]


@pytest.fixture
async def entry(hass: HomeAssistant, hass_admin_user, hass_read_only_user) -> MockConfigEntry:
    hass.states.async_set("person.alex", "home", {"friendly_name": "Alex", "user_id": hass_admin_user.id})
    hass.states.async_set("person.sam", "home", {"friendly_name": "Sam", "user_id": hass_read_only_user.id})
    config_entry = MockConfigEntry(domain=DOMAIN, title="TaskDragon", version=1, minor_version=2, data={}, options=OPTIONS)
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    yield config_entry
    await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()


@pytest.fixture
async def clients(hass: HomeAssistant, entry, hass_ws_client, hass_access_token, hass_read_only_access_token):
    return WS(await hass_ws_client(hass, hass_access_token)), WS(await hass_ws_client(hass, hass_read_only_access_token))


@pytest.fixture
def phones(hass: HomeAssistant, hass_admin_user, hass_read_only_user) -> dict[str, list[dict]]:
    """Two companion-app phones (one each) and a non-phone notify service."""
    sent: dict[str, list[dict]] = {"alex": [], "sam": [], "telegram": []}
    for service, key in (("mobile_app_pixel_8", "alex"), ("mobile_app_sams_iphone", "sam"), ("family_telegram", "telegram")):
        hass.services.async_register("notify", service, lambda call, key=key: sent[key].append(dict(call.data)))
    MockConfigEntry(domain="mobile_app", title="Pixel 8", data={"device_name": "Pixel 8", "user_id": hass_admin_user.id}).add_to_hass(hass)
    MockConfigEntry(domain="mobile_app", title="Sams iPhone", data={"device_name": "Sams iPhone", "user_id": hass_read_only_user.id}).add_to_hass(hass)
    MockConfigEntry(domain="mobile_app", title="Old tablet", data={"device_name": "Old tablet", "user_id": hass_admin_user.id}).add_to_hass(hass)  # no push service
    return sent


async def _tick(hass: HomeAssistant, freezer, minutes: int) -> None:
    """Move the clock and run the minute tick.

    Its timer runs on the loop's real clock, so fire a minute ahead; it runs as a
    background task, so wait for those too.
    """
    freezer.tick(timedelta(minutes=minutes))
    async_fire_time_changed(hass, dt_util.utcnow() + timedelta(seconds=61))
    await hass.async_block_till_done(wait_background_tasks=True)


async def test_reminders_reach_the_right_phone_with_buttons(hass: HomeAssistant, entry, clients, phones, hass_admin_user, hass_read_only_user, freezer) -> None:
    freezer.move_to("2026-11-02T16:00:00+00:00")
    admin, member = clients
    board = await admin.ok({"type": "taskdragon/get_board"})
    targets = {t["id"]: t for t in board["notify_targets"]}
    assert targets["notify.mobile_app_pixel_8"] == {"id": "notify.mobile_app_pixel_8", "name": "Pixel 8", "people": ["person.alex"], "kind": "phone"}
    assert targets["notify.family_telegram"]["kind"] == "service" and "notify.mobile_app_old_tablet" not in targets
    member_targets = [t["id"] for t in (await member.ok({"type": "taskdragon/get_board"}))["notify_targets"]]
    assert member_targets == ["notify.mobile_app_pixel_8", "notify.mobile_app_sams_iphone"], "members only get phones"

    chores = next(p for p in board["plans"] if p["name"] == "Daily Chores")
    today = dt_util.now().date().isoformat()
    remind_at = (dt_util.now() + timedelta(minutes=5)).strftime("%H:%M")
    assert await member.error({"type": "taskdragon/save_task", "task": {"plan_id": chores["id"], "summary": "x", "remind_target": "notify.family_telegram"}}) == "invalid"
    task = await admin.ok(
        {"type": "taskdragon/save_task", "task": {"plan_id": chores["id"], "summary": "Make shakes", "due_date": today, "assigned_to": ["person.alex"], "remind_target": "assigned", "remind_time": remind_at}}
    )
    # (WebSocket calls happen before the clock jumps an hour: the test client's connection doesn't survive it.)
    private = await admin.ok({"type": "taskdragon/save_plan", "plan": {"name": "Surprise party", "archetype": "quick_list", "is_private": True}})
    secret = await admin.ok({"type": "taskdragon/save_task", "task": {"plan_id": private["id"], "summary": "Order cake"}})
    await _tick(hass, freezer, 4)
    assert phones["alex"] == []
    await _tick(hass, freezer, 2)
    assert len(phones["alex"]) == 1 and phones["sam"] == [], "assigned to Alex: only Alex's phone"
    sent = phones["alex"][0]
    assert sent["title"] == "Make shakes" and sent["message"].startswith("Due today")
    assert [a["action"] for a in sent["data"]["actions"]] == [f"TASKDRAGON_DONE_{task['uid']}", f"TASKDRAGON_SNOOZE_{task['uid']}"]
    assert sent["data"]["url"] == f"/taskdragon?task={task['uid']}"
    await _tick(hass, freezer, 1)
    assert len(phones["alex"]) == 1, "once per occurrence"

    # Snooze on the phone: back in an hour, and reminded again then.
    hass.bus.async_fire("mobile_app_notification_action", {"action": f"TASKDRAGON_SNOOZE_{task['uid']}"}, context=Context(user_id=hass_admin_user.id))
    await hass.async_block_till_done()
    db = entry.runtime_data.db
    assert (await db.get_task(task["uid"]))["status"] == "snoozed"
    await _tick(hass, freezer, 61)
    assert len(phones["alex"]) == 2
    # Done on the phone completes it as that user.
    hass.bus.async_fire("mobile_app_notification_action", {"action": f"TASKDRAGON_DONE_{task['uid']}"}, context=Context(user_id=hass_admin_user.id))
    await hass.async_block_till_done()
    done = await db.get_task(task["uid"])
    assert done["status"] == "completed" and done["completed_by"]

    # Nobody else's buttons work on a private list.
    hass.bus.async_fire("mobile_app_notification_action", {"action": f"TASKDRAGON_DONE_{secret['uid']}"}, context=Context(user_id=hass_read_only_user.id))
    await hass.async_block_till_done()
    assert (await db.get_task(secret["uid"]))["status"] == "needs_action"


async def test_unassigned_private_reminders_stay_with_the_owner(hass: HomeAssistant, entry, clients, phones, freezer) -> None:
    freezer.move_to("2026-11-02T16:00:00+00:00")
    admin, _member = clients
    board = await admin.ok({"type": "taskdragon/get_board"})
    chores = next(p for p in board["plans"] if p["name"] == "Daily Chores")
    private = await admin.ok({"type": "taskdragon/save_plan", "plan": {"name": "Surprise party", "archetype": "quick_list", "is_private": True}})
    today = dt_util.now().date().isoformat()
    remind_at = (dt_util.now() + timedelta(minutes=2)).strftime("%H:%M")
    await admin.ok({"type": "taskdragon/save_task", "task": {"plan_id": chores["id"], "summary": "Anyone: trash", "due_date": today, "remind_target": "assigned", "remind_time": remind_at}})
    await admin.ok({"type": "taskdragon/save_task", "task": {"plan_id": private["id"], "summary": "Order cake", "due_date": today, "remind_target": "assigned", "remind_time": remind_at}})
    await admin.ok({"type": "taskdragon/save_task", "task": {"plan_id": chores["id"], "summary": "Group chat", "due_date": today, "remind_target": "notify.family_telegram", "remind_time": remind_at}})
    await _tick(hass, freezer, 3)
    assert sorted(m["title"] for m in phones["alex"]) == ["Anyone: trash", "Order cake"]
    assert [m["title"] for m in phones["sam"]] == ["Anyone: trash"], "an unassigned task goes to the household, a private one only to its owner"
    assert [m["title"] for m in phones["telegram"]] == ["Group chat"]


async def test_wishlist_categories_over_websocket(hass: HomeAssistant, entry, clients) -> None:
    admin, member = clients
    board = await admin.ok({"type": "taskdragon/get_board"})
    plan = next(p for p in board["plans"] if p["archetype"] == "wishlist_hoard")
    hoard = await admin.ok({"type": "taskdragon/hoard_board", "plan_id": plan["id"]})
    xmas = next(s for s in hoard["sections"] if s["name"] == "Christmas")
    sams = await admin.ok({"type": "taskdragon/hoard_save_section", "section": {"plan_id": plan["id"], "name": "Sam", "parent_id": xmas["id"], "gift_for_person_id": "person.sam", "budget": 100}})
    ellie = await admin.ok({"type": "taskdragon/hoard_save_section", "section": {"plan_id": plan["id"], "name": "Ellie", "parent_id": xmas["id"]}})
    await admin.ok({"type": "taskdragon/hoard_save_item", "item": {"plan_id": plan["id"], "title": "Bike", "section_id": sams["id"]}})
    await admin.ok({"type": "taskdragon/hoard_save_item", "item": {"plan_id": plan["id"], "title": "Doll", "section_id": ellie["id"]}})
    seen = await member.ok({"type": "taskdragon/hoard_board", "plan_id": plan["id"]})
    assert [s["name"] for s in seen["sections"] if s.get("parent_id") == xmas["id"]] == ["Ellie"]
    assert [i["title"] for i in seen["items"]] == ["Doll"] and seen["hidden"] == [{"section_id": xmas["id"], "buyer": hoard["me"] and seen["hidden"][0]["buyer"], "count": 1}]
    assert await member.error({"type": "taskdragon/hoard_delete_section", "section_id": sams["id"]}) == "not_found"
