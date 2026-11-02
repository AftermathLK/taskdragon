"""Quick lists, private plans, promotion, packing trips, undo tokens and security guards."""

from __future__ import annotations

import ast
import sqlite3
from pathlib import Path

import pytest
from conftest import PACKAGE_DIR, plan_by_name

from taskdragon.database import SCHEMA_V1, TaskDragonDB
from taskdragon.mealie_client import InvalidMealieUrl, MealieError, validate_base_url, validate_slug
from taskdragon.planner import SYSTEM, Actor, PlannerError

ALEX = Actor(user_id="u-alex", user_name="Alex", person="person.alex", is_admin=True)
SAM = Actor(user_id="u-sam", user_name="Sam", person="person.sam")
KID = Actor(user_id="u-kid", user_name="Kid")


# ---------------------------------------------------------------------------
# Quick lists & sections
# ---------------------------------------------------------------------------
async def test_board_has_shared_and_private_quick_lists(planner) -> None:
    board = await planner.get_board(actor=SAM)
    quick = board["quick"]
    shared = next(p for p in board["plans"] if p["id"] == quick["shared"])
    private = next(p for p in board["plans"] if p["id"] == quick["private"])
    assert shared["archetype"] == private["archetype"] == "quick_list"
    assert private["is_private"] and private["owner_user_id"] == "u-sam" and private["is_owner"]
    # Loading again doesn't create a second private list.
    again = await planner.get_board(actor=SAM)
    assert again["quick"]["private"] == quick["private"]
    assert sum(p["is_private"] for p in again["plans"]) == 1
    assert [s["name"] for s in board["sections"] if s["plan_id"] == quick["shared"]][:2] == ["Calls to Make", "House Stuff"]


async def test_sections_crud_and_delete_moves_tasks_to_inbox(planner) -> None:
    quick = (await planner.quick_lists(SAM))["shared"]
    section = await planner.save_section({"plan_id": quick, "name": "Errands"})
    task = await planner.save_task({"plan_id": quick, "summary": "Call plumber", "section_id": section["id"]}, SAM)
    assert task["section_id"] == section["id"]
    renamed = await planner.save_section({"id": section["id"], "name": "Errands & calls"})
    assert renamed["name"] == "Errands & calls"

    payload = await planner.delete_section(section["id"])
    assert payload["task_uids"] == [task["uid"]]
    assert (await planner.db.get_task(task["uid"]))["section_id"] is None
    token = planner.stash_undo("section", payload, SAM)
    await planner.undo(token, SAM)
    assert (await planner.db.get_task(task["uid"]))["section_id"] == section["id"]

    chores = await plan_by_name(planner, "Daily Chores")
    with pytest.raises(PlannerError):
        await planner.save_section({"plan_id": chores["id"], "name": "Nope"})  # sections are quick-list only
    with pytest.raises(PlannerError):
        await planner.save_task({"plan_id": chores["id"], "summary": "x", "section_id": section["id"]}, SAM)


async def test_reorder_sections(planner) -> None:
    quick = (await planner.quick_lists(SAM))["shared"]
    sections = await planner.db.list_sections([quick])
    reordered = await planner.reorder_sections(quick, [s["id"] for s in reversed(sections)])
    assert [s["name"] for s in reordered] == ["Quick Ideas", "Weekend", "House Stuff", "Calls to Make"]


async def test_promote_quick_item_to_recurring_chore(planner) -> None:
    quick = (await planner.quick_lists(SAM))["shared"]
    section = (await planner.db.list_sections([quick]))[0]
    item = await planner.save_task({"plan_id": quick, "summary": "Water the ferns", "section_id": section["id"]}, SAM)
    child = await planner.save_task({"parent_uid": item["uid"], "summary": "Get the mister"}, SAM)
    chores = await plan_by_name(planner, "Daily Chores")
    moved = await planner.transfer_task(
        item["uid"], chores["id"], {"recurrence_mode": "calendar", "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA"}, SAM
    )
    assert moved["plan_id"] == chores["id"] and moved["section_id"] is None
    assert moved["recurrence_mode"] == "calendar" and moved["due_date"] == "2026-10-31"  # next Saturday
    assert (await planner.db.get_task(child["uid"]))["plan_id"] == chores["id"]

    groceries = await plan_by_name(planner, "Groceries")
    milk = await planner.save_task({"plan_id": quick, "summary": "milk"}, SAM)
    shopped = await planner.transfer_task(milk["uid"], groceries["id"], None, SAM)
    assert shopped["category"] == "Dairy"
    pantry = await plan_by_name(planner, "Pantry & Spices")
    with pytest.raises(PlannerError):
        await planner.transfer_task(milk["uid"], pantry["id"], None, SAM)


# ---------------------------------------------------------------------------
# Privacy & authorization
# ---------------------------------------------------------------------------
async def test_private_plans_are_invisible_to_other_users(planner) -> None:
    sam_private = (await planner.quick_lists(SAM))["private"]
    secret = await planner.save_task({"plan_id": sam_private, "summary": "Buy Alex a birthday gift"}, SAM)

    alex_board = await planner.get_board(actor=ALEX)
    assert sam_private not in {p["id"] for p in alex_board["plans"]}
    assert secret["uid"] not in {t["uid"] for t in alex_board["tasks"]}
    # Admins get no back door through the API either.
    for kwargs in ({"tasks": [secret["uid"]]}, {"plans": [sam_private]}):
        with pytest.raises(PlannerError) as err:
            await planner.authorize(ALEX, **kwargs)
        assert err.value.code == "not_found"
    with pytest.raises(PlannerError):
        await planner.get_board(sam_private, ALEX)
    # Unknown ids look exactly like forbidden ones.
    with pytest.raises(PlannerError) as err:
        await planner.authorize(ALEX, tasks=["does-not-exist"])
    assert err.value.code == "not_found"

    await planner.authorize(SAM, tasks=[secret["uid"]], plans=[sam_private])
    await planner.authorize(SYSTEM, tasks=[secret["uid"]])  # automations / internal timers


async def test_sharing_a_private_list(planner) -> None:
    plan = await planner.create_plan({"name": "Surprise party", "archetype": "quick_list", "is_private": True}, SAM)
    assert plan["owner_user_id"] == "u-sam"
    with pytest.raises(PlannerError):
        await planner.authorize(KID, plans=[plan["id"]])
    shared = await planner.update_plan(plan["id"], {"shared_with": ["u-kid", "u-sam"]}, SAM)
    assert shared["shared_with"] == ["u-kid"]  # the owner is implied
    await planner.authorize(KID, plans=[plan["id"]])
    with pytest.raises(PlannerError) as err:
        await planner.update_plan(plan["id"], {"shared_with": []}, KID)
    assert err.value.code == "unauthorized"
    with pytest.raises(PlannerError):
        await planner.delete_plan(plan["id"], KID)  # shared-with users can't delete it
    public = await planner.update_plan(plan["id"], {"is_private": False}, SAM)
    assert public["is_private"] is False and public["shared_with"] == []
    await planner.authorize(ALEX, plans=[plan["id"]])


async def test_plan_permissions_and_validation(planner) -> None:
    groceries = await plan_by_name(planner, "Groceries")
    with pytest.raises(PlannerError) as err:
        await planner.update_plan(groceries["id"], {"settings": {"mealie_list_id": "L1"}}, SAM)
    assert err.value.code == "unauthorized"
    with pytest.raises(PlannerError):
        await planner.update_plan(groceries["id"], {"settings": {"role": "chores"}}, SAM)
    # Sending the current value back unchanged is fine for non-admins.
    await planner.update_plan(groceries["id"], {"name": "Grocery run", "settings": {"role": "groceries"}}, SAM)
    await planner.update_plan(groceries["id"], {"settings": {"mealie_list_id": "L1"}}, ALEX)
    with pytest.raises(PlannerError):
        await planner.delete_plan(groceries["id"], SAM)
    with pytest.raises(PlannerError):
        await planner.update_plan(groceries["id"], {"archived": True}, SAM)
    with pytest.raises(PlannerError):
        await planner.update_plan(groceries["id"], {"is_private": True}, SAM)  # not admin, not creator

    for bad in ({"icon": "javascript:alert(1)"}, {"color": "red;background:url(x)"}, {"name": "x" * 200}):
        with pytest.raises(PlannerError):
            await planner.create_plan({"name": "Garden", "archetype": "projects_diy", **bad}, SAM)
    created = await planner.create_plan(
        {"name": "Garden", "archetype": "projects_diy", "icon": "mdi:flower", "settings": {"role": "chores"}}, ALEX
    )
    private = await planner.create_plan(
        {"name": "Mine", "archetype": "daily_chores", "is_private": True, "settings": {"role": "chores"}}, ALEX
    )
    assert created["settings"]["role"] == "chores" and "role" not in private["settings"]
    assert private["is_private"] and private["owner_user_id"] == "u-alex"
    with pytest.raises(PlannerError):
        await planner.create_plan({"name": "Ghost", "archetype": "quick_list", "is_private": True}, SYSTEM)


async def test_private_plans_skip_routing_balancing_and_redact_events(planner) -> None:
    private = await planner.create_plan({"name": "My chores", "archetype": "daily_chores", "is_private": True}, SAM)
    task = await planner.save_task(
        {"plan_id": private["id"], "summary": "Therapy appointment", "shift_aware": True, "due_date": "2026-10-27"}, SAM
    )
    assert (await planner.chores_plan())["id"] != private["id"]
    assert task["uid"] not in {t["uid"] for t in await planner.shift_aware_candidates()}
    planner.test_events.clear()
    await planner.set_completed(task["uid"], True, SAM)
    event, data = planner.test_events[-1]
    assert event == "taskdragon_task_completed" and data["private"] is True and data["summary"] is None


async def test_brain_dump_actions_cannot_target_hidden_plans(planner) -> None:
    sam_private = (await planner.quick_lists(SAM))["private"]
    results = await planner.apply_actions([{"type": "task", "summary": "Sneaky", "plan_id": sam_private}], ALEX)
    assert results[0]["ok"] is False
    assert await planner.db.list_tasks(sam_private) == []


async def test_blockers_in_hidden_plans_are_named_generically(planner) -> None:
    sam_private = (await planner.quick_lists(SAM))["private"]
    secret = await planner.save_task({"plan_id": sam_private, "summary": "Order the ring"}, SAM)
    chores = await plan_by_name(planner, "Daily Chores")
    shared = await planner.save_task({"plan_id": chores["id"], "summary": "Plan dinner", "blocked_by": [secret["uid"]]}, SAM)
    board = await planner.get_board(actor=ALEX)
    row = next(t for t in board["tasks"] if t["uid"] == shared["uid"])
    assert row["open_blockers"] == [{"uid": secret["uid"], "summary": "Private task"}]


async def test_links_must_be_http(planner) -> None:
    chores = await plan_by_name(planner, "Daily Chores")
    for bad in ("javascript:alert(document.cookie)", "data:text/html,<script>alert(1)</script>", "//evil.example", "ftp://x"):
        with pytest.raises(PlannerError):
            await planner.save_task({"plan_id": chores["id"], "summary": "x", "link_url": bad}, SAM)
    ok = await planner.save_task({"plan_id": chores["id"], "summary": "x", "link_url": "https://mealie.local/r/chili"}, SAM)
    assert ok["link_url"] == "https://mealie.local/r/chili"
    with pytest.raises(PlannerError):
        await planner.save_task({"plan_id": chores["id"], "summary": "y" * 600}, SAM)


# ---------------------------------------------------------------------------
# Undo tokens & prefs
# ---------------------------------------------------------------------------
async def test_undo_tokens_are_single_use_per_user_and_expire(planner, clock) -> None:
    chores = await plan_by_name(planner, "Daily Chores")
    task = await planner.save_task({"plan_id": chores["id"], "summary": "Dust"}, SAM)
    token = planner.stash_undo("tasks", await planner.delete_tasks([task["uid"]]), SAM)
    with pytest.raises(PlannerError):
        await planner.undo(token, ALEX)  # someone else's token
    assert (await planner.undo(token, SAM))["restored"] == [task["uid"]]
    with pytest.raises(PlannerError):
        await planner.undo(token, SAM)  # single use

    token = planner.stash_undo("tasks", await planner.delete_tasks([task["uid"]]), SAM)
    clock.set_local(2026, 10, 27, 9, 30)
    with pytest.raises(PlannerError):
        await planner.undo(token, SAM)


async def test_prefs_are_per_user_and_validated(planner) -> None:
    await planner.set_prefs(SAM, {"hidden_tabs": ["family", "family", "plan:x"], "collapsed": ["sec:1"]})
    assert (await planner.get_prefs(SAM))["hidden_tabs"] == ["family", "plan:x"]
    assert (await planner.get_prefs(ALEX))["hidden_tabs"] == []
    with pytest.raises(PlannerError):
        await planner.set_prefs(SAM, {"evil": ["x"]})
    with pytest.raises(PlannerError):
        await planner.set_prefs(SYSTEM, {"hidden_tabs": []})
    board = await planner.get_board(actor=SAM)
    assert board["prefs"]["collapsed"] == ["sec:1"] and board["user"] == {"id": "u-sam", "name": "Sam", "is_admin": False}


# ---------------------------------------------------------------------------
# Packing trips
# ---------------------------------------------------------------------------
async def test_new_trip_inherits_unique_repeatable_items(planner) -> None:
    packing = await plan_by_name(planner, "Trip Packing")
    charger = await planner.save_task({"plan_id": packing["id"], "summary": "Phone charger", "category": "Tech"}, SAM)
    assert charger["is_repeatable"] is True and charger["trip_id"] is None  # master list = always pack
    await planner.save_task({"plan_id": packing["id"], "summary": "Toothbrush", "category": "Toiletries"}, SAM)

    first = await planner.create_trip(packing["id"], "Up North Cabin", "2026-11-14", "2026-11-16", SAM)
    assert first["added"] == 2 and first["trip"]["status"] == "upcoming"
    items = await planner.db.list_tasks(trip_id=first["trip"]["id"])
    assert sorted(t["summary"] for t in items) == ["Phone charger", "Toothbrush"]
    assert all(t["status"] == "needs_action" and t["is_repeatable"] for t in items)

    # A one-off for this trip only, and a new always-pack item added on the fly.
    await planner.save_task({"plan_id": packing["id"], "trip_id": first["trip"]["id"], "summary": "Snowshoes"}, SAM)
    swimsuit = await planner.save_task(
        {"plan_id": packing["id"], "trip_id": first["trip"]["id"], "summary": "Swimsuit", "category": "Clothes"}, SAM
    )
    assert swimsuit["is_repeatable"] is False
    await planner.set_repeatable(swimsuit["uid"], True)
    toothbrush_copy = next(t for t in items if t["summary"] == "Toothbrush")
    await planner.set_completed(toothbrush_copy["uid"], True, SAM)

    second = await planner.create_trip(packing["id"], "Summer Roadtrip", "2027-07-01", None, SAM)
    names = sorted(t["summary"] for t in await planner.db.list_tasks(trip_id=second["trip"]["id"]))
    assert names == ["Phone charger", "Swimsuit", "Toothbrush"]  # no duplicates, no Snowshoes
    assert second["trip"]["end_date"] == "2027-07-01"
    assert {t["status"] for t in await planner.db.list_tasks(trip_id=second["trip"]["id"])} == {"needs_action"}

    # Turning repeat off anywhere turns it off for that item everywhere.
    await planner.set_repeatable(charger["uid"], False)
    third = await planner.create_trip(packing["id"], "Weekend", None, None, SAM)
    assert sorted(t["summary"] for t in await planner.db.list_tasks(trip_id=third["trip"]["id"])) == ["Swimsuit", "Toothbrush"]
    assert third["trip"]["status"] == "active"

    board = await planner.get_board(actor=SAM)
    trip = next(t for t in board["trips"] if t["id"] == first["trip"]["id"])
    assert (trip["packed"], trip["total"]) == (1, 4)
    assert next(p for p in board["plans"] if p["id"] == packing["id"])["repeatable_count"] == 2


async def test_trip_lifecycle(planner, clock) -> None:
    packing = await plan_by_name(planner, "Trip Packing")
    await planner.save_task({"plan_id": packing["id"], "summary": "Jacket"}, SAM)
    created = await planner.create_trip(packing["id"], "Cabin", "2026-10-29", "2026-10-31", SAM)
    trip_id = created["trip"]["id"]
    with pytest.raises(PlannerError):
        await planner.create_trip(packing["id"], "Backwards", "2026-11-05", "2026-11-01", SAM)
    with pytest.raises(PlannerError):
        await planner.create_trip((await plan_by_name(planner, "Daily Chores"))["id"], "Nope", None, None, SAM)

    assert await planner.process_trips() == 0
    clock.set_local(2026, 10, 29, 8, 0)
    assert await planner.process_trips() == 1
    assert (await planner.db.get_trip(trip_id))["status"] == "active"

    [jacket] = await planner.db.list_tasks(trip_id=trip_id)
    await planner.set_completed(jacket["uid"], True, SAM)
    assert await planner.reset_trip(trip_id) == 1
    archived = await planner.update_trip(trip_id, {"status": "archived", "name": "Cabin (done)"})
    assert archived["status"] == "archived" and archived["name"] == "Cabin (done)"
    reopened = await planner.update_trip(trip_id, {"status": "active"})
    assert reopened["status"] == "active"

    payload = await planner.delete_trip(trip_id)
    assert await planner.db.get_trip(trip_id) is None and await planner.db.list_tasks(trip_id=trip_id) == []
    token = planner.stash_undo("trip", payload, SAM)
    restored = await planner.undo(token, SAM)
    assert restored["trip_id"] == trip_id and len(await planner.db.list_tasks(trip_id=trip_id)) == 1


async def test_items_moved_into_packing_land_in_the_next_trip(planner) -> None:
    packing = await plan_by_name(planner, "Trip Packing")
    later = await planner.create_trip(packing["id"], "Later", "2027-01-10", None, SAM)
    sooner = await planner.create_trip(packing["id"], "Sooner", "2026-12-01", None, SAM)
    quick = (await planner.quick_lists(SAM))["shared"]
    item = await planner.save_task({"plan_id": quick, "summary": "Sunscreen"}, SAM)
    moved = await planner.transfer_task(item["uid"], packing["id"], None, SAM)
    assert moved["trip_id"] == sooner["trip"]["id"] != later["trip"]["id"]
    with pytest.raises(PlannerError):
        await planner.save_task({"uid": moved["uid"], "trip_id": "nope"}, SAM)


# ---------------------------------------------------------------------------
# Database migration and SQL hygiene
# ---------------------------------------------------------------------------
async def test_v1_database_migrates_packing_plans_to_trips(tmp_path) -> None:
    path = tmp_path / "old.db"
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA_V1)
    now = "2026-01-01T00:00:00.000000+00:00"
    conn.execute(
        "INSERT INTO plans (id, name, archetype, is_template, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("tpl", "Weekend Trip", "packing_trips", 1, "{}", now, now),
    )
    conn.execute(
        "INSERT INTO plans (id, name, archetype, is_template, template_id, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        ("clone", "Lake cabin", "packing_trips", 0, "tpl", '{"trip_date": "2026-11-06"}', now, now),
    )
    for uid, plan in (("t1", "tpl"), ("t2", "clone")):
        conn.execute(
            "INSERT INTO tasks (uid, plan_id, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (uid, plan, "Toothbrush", now, now),
        )
    conn.execute("PRAGMA user_version = 1")
    conn.commit()
    conn.close()

    db = TaskDragonDB(str(path))
    await db.async_open()
    try:
        assert await db.schema_version() == 6
        template = await db.get_plan("tpl")
        assert template["name"] == "Trip Packing" and template["is_template"] is False
        assert (await db.get_task("t1"))["is_repeatable"] is True
        [trip] = await db.list_trips(["clone"])
        assert trip["name"] == "Lake cabin" and trip["start_date"] == "2026-11-06"
        assert (await db.get_task("t2"))["trip_id"] == trip["id"]
        assert (await db.get_plan("clone"))["is_private"] is False
    finally:
        await db.async_close()


def test_sql_is_never_built_with_fstrings_or_percent_formatting() -> None:
    sql_words = ("SELECT ", "INSERT ", "UPDATE ", "DELETE ", "PRAGMA ", " WHERE ", "ALTER ")
    offenders = []
    for path in sorted(Path(PACKAGE_DIR).glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.JoinedStr):
                text = "".join(v.value for v in node.values if isinstance(v, ast.Constant) and isinstance(v.value, str))
                if any(word in text.upper() for word in sql_words):
                    offenders.append(f"{path.name}:{node.lineno}")
            if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod) and isinstance(node.left, ast.Constant):
                if isinstance(node.left.value, str) and any(word in node.left.value.upper() for word in sql_words):
                    offenders.append(f"{path.name}:{node.lineno}")
    assert offenders == []


async def test_unknown_identifiers_are_refused(db) -> None:
    from taskdragon.database import TASKS, _ident

    assert _ident("summary") == "summary"
    with pytest.raises(ValueError):
        _ident("summary = 1; DROP TABLE tasks; --")
    with pytest.raises(ValueError):
        await db._next_position(TASKS, {"plan_id) OR 1=1 --": "x"})


async def test_hostile_text_is_stored_verbatim_not_executed(planner) -> None:
    chores = await plan_by_name(planner, "Daily Chores")
    evil = "'); DROP TABLE tasks; -- <img src=x onerror=alert(1)>"
    task = await planner.save_task({"plan_id": chores["id"], "summary": evil}, SAM)
    assert (await planner.db.get_task(task["uid"]))["summary"] == evil
    assert len(await planner.db.list_tasks()) >= 1


# ---------------------------------------------------------------------------
# Mealie URL validation
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("http://mealie.local:9000/", "http://mealie.local:9000"),
        ("HTTPS://192.168.1.20/mealie/", "https://192.168.1.20/mealie"),
        ("http://[fd00::5]:9925", "http://[fd00::5]:9925"),
    ],
)
def test_valid_mealie_urls(raw, expected) -> None:
    assert validate_base_url(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "ftp://mealie.local",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "mealie.local:9000",
        "http://user:pass@mealie.local",
        "http://mealie.local/?next=http://evil",
        "http://mealie.local/#frag",
        "http://169.254.169.254/latest/meta-data",
        "http://0.0.0.0:9000",
        "http://mealie.local:99999",
        "",
    ],
)
def test_invalid_mealie_urls(raw) -> None:
    with pytest.raises(InvalidMealieUrl):
        validate_base_url(raw)


def test_recipe_slugs_cannot_escape_the_recipe_path() -> None:
    assert validate_slug("taco-seasoning") == "taco-seasoning"
    for bad in ("../users/self", "a/b", "x?y=1", "", " "):
        with pytest.raises(MealieError):
            validate_slug(bad)
