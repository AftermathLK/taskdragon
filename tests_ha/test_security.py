"""Security against a real Home Assistant core: per-user privacy, admin-only commands,
credential handling, diagnostics redaction and cross-plan (IDOR) guards."""

from __future__ import annotations

import json
from unittest.mock import patch

import aiohttp
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.util import dt as dt_util

from custom_components.taskdragon.const import DOMAIN
from custom_components.taskdragon.diagnostics import async_get_config_entry_diagnostics
from custom_components.taskdragon.mealie_client import MealieClient, MealieError

OPTIONS = {"people": [{"entity_id": "person.alex", "calendar": None, "keywords": "Shift"}], "rollover_hour": 0}
SECRET_TOKEN = "TOP-SECRET-TOKEN-0123456789"
SECRET_HOST = "10.20.30.40"


class WS:
    """A WebSocket client that collects subscription events while waiting for replies."""

    def __init__(self, client) -> None:
        self.client = client
        self.events: list[dict] = []
        self._ids = iter(range(1, 100000))

    async def call(self, message: dict) -> dict:
        msg_id = next(self._ids)
        await self.client.send_json({"id": msg_id, **message})
        while True:
            reply = await self.client.receive_json()
            if reply.get("type") == "event":
                self.events.append(reply)
            elif reply.get("id") == msg_id:
                return reply

    async def flush(self) -> None:
        """Round-trip a ping so every event already sent has been read."""
        await self.call({"type": "ping"})


@pytest.fixture
async def entry(hass: HomeAssistant) -> MockConfigEntry:
    hass.states.async_set("person.alex", "home", {"friendly_name": "Alex"})
    config_entry = MockConfigEntry(domain=DOMAIN, title="TaskDragon", version=1, minor_version=2, data={}, options=OPTIONS)
    config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(config_entry.entry_id)
    await hass.async_block_till_done()
    yield config_entry
    await hass.config_entries.async_unload(config_entry.entry_id)
    await hass.async_block_till_done()


@pytest.fixture
async def clients(hass: HomeAssistant, entry, hass_ws_client, hass_access_token, hass_read_only_access_token):
    admin = WS(await hass_ws_client(hass, hass_access_token))
    member = WS(await hass_ws_client(hass, hass_read_only_access_token))
    return admin, member


def _plan(board: dict, name: str) -> dict:
    return next(p for p in board["plans"] if p["name"] == name)


async def test_private_lists_are_filtered_on_the_server(hass: HomeAssistant, entry, clients) -> None:
    admin, member = clients
    a_board = (await admin.call({"type": "taskdragon/get_board"}))["result"]
    m_board = (await member.call({"type": "taskdragon/get_board"}))["result"]
    a_private, m_private = a_board["quick"]["private"], m_board["quick"]["private"]
    assert a_private and m_private and a_private != m_private
    assert a_board["quick"]["shared"] == m_board["quick"]["shared"]
    assert (a_board["user"]["is_admin"], m_board["user"]["is_admin"]) == (True, False)

    assert (await member.call({"type": "taskdragon/subscribe"}))["success"]
    secret = (await admin.call({"type": "taskdragon/save_task", "task": {"plan_id": a_private, "summary": "Engagement ring"}}))["result"]
    await hass.async_block_till_done()
    await member.flush()
    assert member.events == []  # no live update leaks for someone else's private list

    m_board = (await member.call({"type": "taskdragon/get_board"}))["result"]
    assert a_private not in {p["id"] for p in m_board["plans"]}
    assert "Engagement ring" not in json.dumps(m_board)

    mine = (await member.call({"type": "taskdragon/save_task", "task": {"plan_id": m_board["quick"]["shared"], "summary": "Mine"}}))["result"]
    attempts = [
        {"type": "taskdragon/set_completed", "uid": secret["uid"], "completed": True},
        {"type": "taskdragon/save_task", "task": {"uid": secret["uid"], "summary": "renamed"}},
        {"type": "taskdragon/save_task", "task": {"plan_id": a_private, "summary": "planted"}},
        {"type": "taskdragon/delete_tasks", "uids": [secret["uid"]]},
        {"type": "taskdragon/task_history", "uid": secret["uid"]},
        {"type": "taskdragon/get_board", "plan_id": a_private},
        {"type": "taskdragon/transfer_task", "uid": mine["uid"], "plan_id": a_private},
        {"type": "taskdragon/move_task", "uid": mine["uid"], "plan_id": a_private},
        {"type": "taskdragon/bulk_action", "uids": [mine["uid"]], "action": "move", "value": a_private},
        {"type": "taskdragon/save_section", "section": {"plan_id": a_private, "name": "x"}},
        {"type": "taskdragon/add_dependency", "uid": mine["uid"], "blocked_by_uid": secret["uid"]},
        {"type": "taskdragon/save_plan", "plan": {"id": a_private, "name": "mine now"}},
        {"type": "taskdragon/clear_completed", "plan_id": a_private},
    ]
    for message in attempts:
        reply = await member.call(message)
        assert reply["success"] is False and reply["error"]["code"] == "not_found", message
    applied = (await member.call({"type": "taskdragon/apply_actions", "actions": [{"type": "task", "summary": "x", "plan_id": a_private}]}))["result"]
    assert applied["results"][0]["ok"] is False

    stored = await entry.runtime_data.db.get_task(secret["uid"])
    assert stored["summary"] == "Engagement ring" and stored["status"] == "needs_action"
    assert await entry.runtime_data.db.list_tasks(a_private) == [stored]

    # Household lists stay shared and live.
    await admin.call({"type": "taskdragon/save_task", "task": {"plan_id": a_board["quick"]["shared"], "summary": "Call plumber"}})
    await hass.async_block_till_done()
    await member.flush()
    assert any(a_board["quick"]["shared"] in event["event"]["plan_ids"] for event in member.events)


async def test_sharing_a_private_list_with_a_household_member(hass: HomeAssistant, entry, clients, hass_read_only_user) -> None:
    admin, member = clients
    created = (await admin.call({"type": "taskdragon/save_plan", "plan": {"name": "Surprise party", "archetype": "quick_list", "is_private": True}}))["result"]
    assert created["is_private"] and created["owner_user_id"]
    reply = await member.call({"type": "taskdragon/get_board", "plan_id": created["id"]})
    assert reply["error"]["code"] == "not_found"
    shared = (await admin.call({"type": "taskdragon/save_plan", "plan": {"id": created["id"], "shared_with": [hass_read_only_user.id, "no-such-user"]}}))["result"]
    assert shared["shared_with"] == [hass_read_only_user.id]  # unknown users are dropped
    board = (await member.call({"type": "taskdragon/get_board", "plan_id": created["id"]}))["result"]
    assert [p["id"] for p in board["plans"] if p["id"] == created["id"]] == [created["id"]]
    # Shared-with users can use the list but not manage it.
    reply = await member.call({"type": "taskdragon/delete_private_plan", "plan_id": created["id"]})
    assert reply["error"]["code"] == "unauthorized"
    # Private lists never get a todo entity (entity state is readable by every user).
    assert not any("surprise" in state.entity_id for state in hass.states.async_all("todo"))


async def test_admin_only_commands(hass: HomeAssistant, entry, clients) -> None:
    admin, member = clients
    board = (await member.call({"type": "taskdragon/get_board"}))["result"]
    groceries = _plan(board, "Groceries")
    for message in (
        {"type": "taskdragon/delete_plan", "plan_id": groceries["id"]},
        {"type": "taskdragon/mealie_lists"},
        {"type": "taskdragon/run_shift_balance"},
        {"type": "taskdragon/save_plan", "plan": {"id": groceries["id"], "settings": {"mealie_list_id": "L1"}}},
        {"type": "taskdragon/save_plan", "plan": {"id": groceries["id"], "settings": {"role": "chores"}}},
        {"type": "taskdragon/save_plan", "plan": {"id": groceries["id"], "archived": True}},
        {"type": "taskdragon/save_plan", "plan": {"id": groceries["id"], "is_private": True}},
    ):
        reply = await member.call(message)
        assert reply["success"] is False and reply["error"]["code"] == "unauthorized", message
    # Everyday edits of household lists are fine for everyone.
    assert (await member.call({"type": "taskdragon/save_plan", "plan": {"id": groceries["id"], "name": "Grocery run"}}))["success"]

    # A member owns and deletes their own private category without being an admin.
    mine = (await member.call({"type": "taskdragon/save_plan", "plan": {"name": "My garden", "archetype": "projects_diy", "is_private": True}}))["result"]
    assert (await member.call({"type": "taskdragon/delete_plan", "plan_id": mine["id"]}))["error"]["code"] == "unauthorized"
    other = (await member.call({"type": "taskdragon/save_plan", "plan": {"name": "Spare", "archetype": "quick_list", "is_private": True}}))["result"]
    # Administrators get no back door into someone's private list.
    assert (await admin.call({"type": "taskdragon/delete_plan", "plan_id": other["id"]}))["error"]["code"] == "not_found"
    assert (await member.call({"type": "taskdragon/delete_private_plan", "plan_id": mine["id"]}))["success"]
    assert (await member.call({"type": "taskdragon/delete_private_plan", "plan_id": groceries["id"]}))["error"]["code"] == "unauthorized"
    assert (await admin.call({"type": "taskdragon/delete_plan", "plan_id": groceries["id"]}))["success"]


async def test_input_validation(hass: HomeAssistant, entry, clients) -> None:
    admin, _member = clients
    board = (await admin.call({"type": "taskdragon/get_board"}))["result"]
    chores = _plan(board, "Daily Chores")
    too_long = await admin.call({"type": "taskdragon/save_task", "task": {"plan_id": chores["id"], "summary": "x" * 501}})
    assert too_long["success"] is False
    bad_link = await admin.call({"type": "taskdragon/save_task", "task": {"plan_id": chores["id"], "summary": "x", "link_url": "javascript:alert(1)"}})
    assert bad_link["error"]["code"] == "invalid"
    bad_icon = await admin.call({"type": "taskdragon/save_plan", "plan": {"name": "x", "archetype": "quick_list", "icon": "x\" onload=\"alert(1)"}})
    assert bad_icon["success"] is False
    bad_prefs = await admin.call({"type": "taskdragon/set_prefs", "prefs": {"hidden_tabs": ["x"] * 501}})
    assert bad_prefs["success"] is False
    ok = await admin.call({"type": "taskdragon/set_prefs", "prefs": {"hidden_tabs": ["family"], "collapsed": ["sec:1"]}})
    assert ok["result"]["hidden_tabs"] == ["family"]


async def test_undo_tokens_belong_to_their_user(hass: HomeAssistant, entry, clients) -> None:
    admin, member = clients
    board = (await admin.call({"type": "taskdragon/get_board"}))["result"]
    chores = _plan(board, "Daily Chores")
    task = (await admin.call({"type": "taskdragon/save_task", "task": {"plan_id": chores["id"], "summary": "Dust"}}))["result"]
    deleted = (await admin.call({"type": "taskdragon/delete_tasks", "uids": [task["uid"]]}))["result"]
    assert (await member.call({"type": "taskdragon/undo", "token": deleted["undo"]}))["error"]["code"] == "undo_expired"
    assert (await admin.call({"type": "taskdragon/undo", "token": deleted["undo"]}))["result"]["restored"] == [task["uid"]]
    # The old raw-snapshot restore command no longer exists.
    assert (await admin.call({"type": "taskdragon/restore", "snapshot": {"tasks": []}}))["error"]["code"] == "unknown_command"


async def test_todo_entities_only_touch_their_own_plan(hass: HomeAssistant, entry, clients) -> None:
    coordinator = entry.runtime_data
    chores = await coordinator.planner.chores_plan()
    other = await coordinator.planner.save_task({"plan_id": chores["id"], "summary": "Not a grocery"})
    entity = hass.data["todo"].get_entity("todo.taskdragon_groceries")
    with pytest.raises(ServiceValidationError):
        await entity.async_delete_todo_items([other["uid"]])
    with pytest.raises(ServiceValidationError):
        await entity.async_move_todo_item(other["uid"])
    assert await coordinator.db.get_task(other["uid"]) is not None

    admin, _member = clients
    reply = await admin.call({"type": "todo/item/move", "entity_id": "todo.taskdragon_groceries", "uid": other["uid"]})
    assert reply["success"] is False


class QuietMealie:
    """Stand-in Mealie client: no network, records nothing secret."""

    def __init__(self, session, base_url: str, token: str) -> None:
        self.base_url = base_url

    async def async_get_self(self):
        return {"groupSlug": "home"}

    def recipe_url(self, slug):
        return None

    async def async_get_shopping_lists(self):
        return [{"id": "L1", "name": "Groceries"}]

    async def async_get_mealplans(self, start, end):
        return []


async def test_legacy_mealie_options_migrate_and_secrets_stay_on_the_server(hass: HomeAssistant, hass_ws_client) -> None:
    hass.states.async_set("person.alex", "home", {"friendly_name": "Alex"})
    with (
        patch("custom_components.taskdragon.coordinator.MealieClient", QuietMealie),
        patch("custom_components.taskdragon.coordinator.async_get_clientsession"),
    ):
        entry = MockConfigEntry(
            domain=DOMAIN,
            version=1,
            minor_version=1,
            data={},
            options={**OPTIONS, "mealie_url": f"http://{SECRET_HOST}:9000", "mealie_token": SECRET_TOKEN, "mealie_verify_ssl": False},
        )
        entry.add_to_hass(hass)
        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()

        assert entry.minor_version == 2
        assert entry.data == {"mealie_url": f"http://{SECRET_HOST}:9000", "mealie_api_token": SECRET_TOKEN, "mealie_verify_ssl": False}
        assert not {"mealie_url", "mealie_token", "mealie_api_token", "mealie_verify_ssl"} & set(entry.options)
        assert entry.runtime_data.mealie is not None

        client = WS(await hass_ws_client(hass))
        board = (await client.call({"type": "taskdragon/get_board"}))["result"]
        sync = (await client.call({"type": "taskdragon/mealie_sync"}))["result"]
        lists = (await client.call({"type": "taskdragon/mealie_lists"}))["result"]
        for payload in (board, sync, lists):
            dumped = json.dumps(payload)
            assert SECRET_TOKEN not in dumped and SECRET_HOST not in dumped
        assert board["mealie"]["enabled"] is True and sync["ok"] is True
        for state in hass.states.async_all("todo"):
            assert SECRET_TOKEN not in json.dumps(state.as_dict(), default=str)

        diagnostics = await async_get_config_entry_diagnostics(hass, entry)
        dumped = json.dumps(diagnostics, default=str)
        assert SECRET_TOKEN not in dumped and SECRET_HOST not in dumped
        assert diagnostics["entry"]["data"]["mealie_api_token"] == "**REDACTED**"
        assert diagnostics["entry"]["data"]["mealie_url"] == "**REDACTED**"
        assert diagnostics["database"]["schema_version"] == 6
        private = [plan for plan in diagnostics["plans"] if plan["is_private"]]
        assert private and all(plan["name"] == "**REDACTED**" for plan in private)

        await hass.config_entries.async_unload(entry.entry_id)
        await hass.async_block_till_done()


async def test_mealie_client_refuses_redirects_and_hides_details(hass: HomeAssistant, aioclient_mock) -> None:
    base = f"http://{SECRET_HOST}:9000"
    client = MealieClient(async_get_clientsession(hass), base, SECRET_TOKEN)

    aioclient_mock.get(f"{base}/api/users/self", status=302, headers={"Location": "http://evil.example/steal"})
    with pytest.raises(MealieError) as err:
        await client.async_get_self()
    assert "redirect" in str(err.value)
    assert len(aioclient_mock.mock_calls) == 1  # the redirect was not followed
    _method, url, _data, headers = aioclient_mock.mock_calls[0]
    assert str(url).startswith(base) and headers["Authorization"] == f"Bearer {SECRET_TOKEN}"

    aioclient_mock.clear_requests()
    aioclient_mock.get(f"{base}/api/users/self", exc=aiohttp.ClientConnectionError(f"Cannot connect to host {SECRET_HOST}:9000"))
    with pytest.raises(MealieError) as err:
        await client.async_get_self()
    assert SECRET_HOST not in str(err.value) and SECRET_TOKEN not in str(err.value)

    aioclient_mock.clear_requests()
    aioclient_mock.get(f"{base}/api/users/self", status=500, text=f"Traceback ... token={SECRET_TOKEN}")
    with pytest.raises(MealieError) as err:
        await client.async_get_self()
    assert str(err.value) == "Mealie returned HTTP 500"

    aioclient_mock.clear_requests()
    with pytest.raises(MealieError):
        await client.async_get_recipe("../users/self")
    assert aioclient_mock.mock_calls == []  # rejected before any request


async def test_mealie_recipe_list_pages_and_image_checks(hass: HomeAssistant, aioclient_mock) -> None:
    base = f"http://{SECRET_HOST}:9000"
    client = MealieClient(async_get_clientsession(hass), base, SECRET_TOKEN)
    recipe_id = "0d2b6f1a-1111-4222-8333-444455556666"

    aioclient_mock.get(f"{base}/api/recipes", params={"page": "1", "perPage": "1000", "orderBy": "name", "orderDirection": "asc"}, json={"items": [{"slug": "a"}], "total_pages": 2})
    aioclient_mock.get(f"{base}/api/recipes", params={"page": "2", "perPage": "1000", "orderBy": "name", "orderDirection": "asc"}, json={"items": [{"slug": "b"}], "total_pages": 2})
    assert [r["slug"] for r in await client.async_list_recipes()] == ["a", "b"]

    image_url = f"{base}/api/media/recipes/{recipe_id}/images/min-original.webp"
    aioclient_mock.clear_requests()
    aioclient_mock.get(image_url, content=b"RIFFxxxxWEBP", headers={"Content-Type": "image/webp"})
    data, content_type = await client.async_get_recipe_image(recipe_id)
    assert data == b"RIFFxxxxWEBP" and content_type == "image/webp"
    assert aioclient_mock.mock_calls[0][3]["Authorization"] == f"Bearer {SECRET_TOKEN}"

    aioclient_mock.clear_requests()
    aioclient_mock.get(image_url, text="<script>alert(1)</script>", headers={"Content-Type": "text/html"})
    with pytest.raises(MealieError, match="did not return an image"):
        await client.async_get_recipe_image(recipe_id)

    aioclient_mock.clear_requests()
    aioclient_mock.get(image_url, content=b"x" * (3 * 1024 * 1024 + 1), headers={"Content-Type": "image/jpeg"})
    with pytest.raises(MealieError, match="too large"):
        await client.async_get_recipe_image(recipe_id)

    aioclient_mock.clear_requests()
    aioclient_mock.get(image_url, status=302, headers={"Location": "http://evil.example/steal"})
    with pytest.raises(MealieError):
        await client.async_get_recipe_image(recipe_id)
    assert len(aioclient_mock.mock_calls) == 1

    aioclient_mock.clear_requests()
    for bad in ("../users/self", "x/../../etc", ""):
        with pytest.raises(MealieError):
            await client.async_get_recipe_image(bad)
    with pytest.raises(MealieError):
        await client.async_get_recipe_image(recipe_id, size="../../secret")
    with pytest.raises(MealieError):
        await client.async_create_mealplan(dt_util.now().date(), recipe_id, "brunch")
    assert aioclient_mock.mock_calls == []  # all rejected before any request
