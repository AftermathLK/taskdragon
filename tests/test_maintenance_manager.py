"""Maintenance manager on a real SQLite database: objects → tasks → parts/documents/events."""

from __future__ import annotations

import io
import sqlite3
from datetime import timedelta

import pytest
from conftest import plan_by_name

from taskdragon.database import SCHEMA_V1, SCHEMA_V2, TaskDragonDB
from taskdragon.maintenance_manager import MaintenanceManager
from taskdragon.planner import SYSTEM, Actor, PlannerError

ALEX = Actor(user_id="u-alex", user_name="Alex", person="person.alex", is_admin=True)
SAM = Actor(user_id="u-sam", user_name="Sam", person="person.sam")


@pytest.fixture
async def maint(planner):
    states: dict[str, tuple[str, dict]] = {}
    manager = MaintenanceManager(planner.db, planner, state_reader=states.get, area_names=lambda: {"utility": "Utility Room"})
    await manager.async_load()
    manager.test_states = states  # type: ignore[attr-defined]
    return manager


async def _plan(planner) -> dict:
    return await plan_by_name(planner, "Home Maintenance")


def _set(maint, entity_id: str, state: str, attrs: dict | None = None):
    old = maint.test_states.get(entity_id)
    maint.test_states[entity_id] = (state, attrs or {})
    return maint.handle_state(entity_id, old[0] if old else None, state, old[1] if old else {}, attrs or {})


async def test_numbering_codes_and_board(planner, maint) -> None:
    plan = await _plan(planner)
    water = await maint.save_object({"plan_id": plan["id"], "name": "Water Filter", "area_id": "utility"}, ALEX)
    furnace = await maint.save_object({"plan_id": plan["id"], "name": "Furnace", "manufacturer_model": "Carrier 59SC5", "installed_date": "2019-05-01"}, ALEX)
    first = await maint.save_task({"object_id": furnace["id"], "name": "Replace Filter", "category": "Replacement", "interval_value": 3, "interval_unit": "months"}, ALEX)
    second = await maint.save_task({"object_id": furnace["id"], "name": "Annual Service", "schedule_mode": "planned", "interval_value": 1, "interval_unit": "years", "next_due": "2026-11-01"}, ALEX)
    assert (water["number"], furnace["number"], first["number"], second["number"]) == (1, 2, 1, 2)
    assert first["next_due"] == "2027-01-27" and second["anchor_date"] == "2026-11-01"
    board = await maint.board(plan["id"], ALEX)
    codes = {t["code"]: t for t in board["tasks"]}
    assert set(codes) == {"#2.1", "#2.2"}
    assert codes["#2.2"]["status"] == "due_soon" and codes["#2.2"]["countdown"] == "5 days"
    assert codes["#2.1"]["status"] == "ok" and codes["#2.1"]["interval_label"] == "3 Months"
    assert board["summary"] == {"objects": 2, "tasks": 2, "overdue": 0, "due_soon": 1, "triggered": 0, "ok": 1}
    objects = {o["code"]: o for o in board["objects"]}
    assert objects["#1"]["area_name"] == "Utility Room" and objects["#2"]["status"] == "due_soon"
    with pytest.raises(PlannerError):
        await maint.save_task({"object_id": furnace["id"], "name": "Bad", "schedule_mode": "rolling"}, ALEX)  # no interval
    with pytest.raises(PlannerError):
        await maint.save_object({"plan_id": (await plan_by_name(planner, "Groceries"))["id"], "name": "x"}, ALEX)


async def test_completion_parts_restock_and_undo(planner, maint, clock) -> None:
    plan = await _plan(planner)
    furnace = await maint.save_object({"plan_id": plan["id"], "name": "Furnace"}, ALEX)
    part = await maint.save_part({"plan_id": plan["id"], "object_id": furnace["id"], "part_name": "16x25x4 Air Filter", "current_stock": 2, "reorder_threshold": 1, "restock_quantity": 2, "unit_cost": 12.5}, ALEX)
    task = await maint.save_task(
        {"object_id": furnace["id"], "name": "Replace Filter", "category": "Replacement", "interval_value": 3, "interval_unit": "months", "parts": [{"part_id": part["id"], "quantity": 1}], "rotation": ["person.alex", "person.sam"], "assigned_to": "person.alex"},
        ALEX,
    )
    result = await maint.complete(task["id"], ALEX, cost=10, duration_minutes=15, notes="MERV 11", feedback="just_right")
    event = result["event"]
    assert event["code"] == "#1.1-1" and event["parts_cost"] == 12.5 and event["total_cost"] == 22.5
    assert result["next_due"] == "2027-01-27"
    after = await maint._task(task["id"])
    assert after["assigned_to"] == "person.sam"  # rotation
    restocked = await maint._part(part["id"])
    assert restocked["current_stock"] == 1 and restocked["pending_ref"]
    shopping = await planner.db.get_task(restocked["pending_ref"])
    hardware = await plan_by_name(planner, "Hardware")
    assert shopping["plan_id"] == hardware["id"] and shopping["source"] == "maint_part" and shopping["quantity"] == "2"

    # A second completion doesn't push a duplicate while the first is still on the list.
    clock.now += timedelta(days=80)
    await maint.complete(task["id"], SAM)
    assert (await maint._part(part["id"]))["pending_ref"] == restocked["pending_ref"]
    # Buying it adds the stock back and (in purchase mode) books the cost.
    await planner.update_plan(plan["id"], {"settings": {"cost_mode": "purchase"}})
    await planner.set_completed(shopping["uid"], True, ALEX)
    assert (await maint._part(part["id"]))["current_stock"] == 2 and (await maint._part(part["id"]))["pending_ref"] is None
    spend = await maint.spend(plan["id"], 2027)
    assert spend["mode"] == "purchase" and spend["total"] == 25.0  # the restock, bought in January
    assert spend["by_year"] == {"2026": 10.0, "2027": 25.0}  # $10 labour in October

    # Undo the second completion.
    second = await maint.complete(task["id"], SAM)
    token = planner.stash_undo("maint_completion", second["undo"], SAM)
    await planner.undo(token, SAM)
    restored = await maint._task(task["id"])
    assert restored["event_seq"] == 2 and restored["next_due"] == (await maint._task(task["id"]))["next_due"]
    assert (await maint._part(part["id"]))["current_stock"] == 2
    history = await maint.history(task_id=task["id"])
    assert [e["code"] for e in history] == ["#1.1-2", "#1.1-1"]


async def test_skip_versus_missed_and_planned_anchor(planner, maint, clock) -> None:
    plan = await _plan(planner)
    obj = await maint.save_object({"plan_id": plan["id"], "name": "Smoke Detectors"}, ALEX)
    weekly = await maint.save_task({"object_id": obj["id"], "name": "Test", "schedule_mode": "planned", "interval_value": 1, "interval_unit": "weeks", "next_due": "2026-10-20"}, ALEX)
    assert (await maint.board(plan["id"]))["tasks"][0]["status"] == "overdue"
    result = await maint.skip(weekly["id"], ALEX)
    assert result["kind"] == "missed"
    assert (await maint._task(weekly["id"]))["next_due"] == "2026-11-03"  # still on Tuesdays
    early = await maint.skip(weekly["id"], ALEX)
    assert early["kind"] == "skipped" and (await maint._task(weekly["id"]))["next_due"] == "2026-11-10"
    clock.set_local(2026, 11, 11, 9, 0)  # a Wednesday, a day late
    await maint.complete(weekly["id"], ALEX)
    assert (await maint._task(weekly["id"]))["next_due"] == "2026-11-17"
    once = await maint.save_task({"object_id": obj["id"], "name": "Install CO detector", "schedule_mode": "once", "next_due": "2026-11-20"}, ALEX)
    await maint.complete(once["id"], ALEX)
    view = next(t for t in (await maint.board(plan["id"]))["tasks"] if t["id"] == once["id"])
    assert view["next_due"] is None and view["countdown"] == "Done" and view["status"] == "ok"


async def test_nfc_binding_proof_of_presence(planner, maint) -> None:
    plan = await _plan(planner)
    obj = await maint.save_object({"plan_id": plan["id"], "name": "Furnace"}, ALEX)
    task = await maint.save_task({"object_id": obj["id"], "name": "Replace Filter", "interval_value": 3, "interval_unit": "months", "require_nfc": True}, ALEX)
    with pytest.raises(PlannerError) as err:
        await maint.complete(task["id"], ALEX)
    assert err.value.code == "nfc_required"
    maint.start_nfc_binding(task["id"], ALEX)
    assert (await maint.handle_tag("04-AB-CD", ALEX)) == {"result": "bound", "task_id": task["id"]}
    result = await maint.handle_tag("04-AB-CD", SAM)
    assert result["result"] == "completed" and result["completed"][0]["code"] == "#1.1-1"
    [event] = await maint.history(task_id=task["id"])
    assert event["method"] == "nfc" and event["notes"] == "Completed via NFC tag" and event["person_entity_id"] == "person.sam"
    assert (await maint.handle_tag("unknown", ALEX))["result"] == "unknown"


async def test_sensor_triggers_and_transitions(planner, maint, clock) -> None:
    plan = await _plan(planner)
    obj = await maint.save_object({"plan_id": plan["id"], "name": "Whole House Water Filter"}, ALEX)
    maint.test_states["sensor.water_total"] = ("5000", {"unit_of_measurement": "gal"})
    counter = await maint.save_task(
        {"object_id": obj["id"], "name": "Replace Cartridge", "schedule_mode": "none", "triggers": [{"type": "counter", "entity_id": "sensor.water_total", "delta": 1000}]},
        ALEX,
    )
    leak = await maint.save_task(
        {"object_id": obj["id"], "name": "Check for leaks", "schedule_mode": "none", "triggers": [{"type": "problem", "entity_id": "binary_sensor.leak", "auto_complete": True}]},
        ALEX,
    )
    assert maint.watched_entities() == {"sensor.water_total", "binary_sensor.leak"}
    assert await maint.tick() == []
    _set(maint, "sensor.water_total", "5950", {"unit_of_measurement": "gal"})
    view = next(t for t in (await maint.board(plan["id"]))["tasks"] if t["id"] == counter["id"])
    assert view["status"] == "due_soon" and view["countdown"] == "950 / 1,000 gal"
    _set(maint, "sensor.water_total", "6010", {"unit_of_measurement": "gal"})
    transitions = await maint.tick()
    assert [(t["code"], t["status"]) for t in transitions] == [("#1.1", "triggered")]
    assert await maint.tick() == []  # notified once

    signals = _set(maint, "binary_sensor.leak", "on")
    await maint.process_signals(signals)
    assert next(t for t in (await maint.board(plan["id"]))["tasks"] if t["id"] == leak["id"])["status"] == "triggered"
    await maint.process_signals(_set(maint, "binary_sensor.leak", "off"))
    [event] = await maint.history(task_id=leak["id"])
    assert event["method"] == "auto_recovery"

    await maint.complete(counter["id"], ALEX)
    view = next(t for t in (await maint.board(plan["id"]))["tasks"] if t["id"] == counter["id"])
    assert view["status"] == "ok" and view["countdown"] == "0 / 1,000 gal"


async def test_threshold_trigger_waits_then_latches(planner, maint, clock) -> None:
    plan = await _plan(planner)
    obj = await maint.save_object({"plan_id": plan["id"], "name": "Front Door Lock"}, ALEX)
    maint.test_states["sensor.lock_battery"] = ("40", {"unit_of_measurement": "%"})
    task = await maint.save_task(
        {"object_id": obj["id"], "name": "Replace Battery", "schedule_mode": "none", "triggers": [{"type": "threshold", "entity_id": "sensor.lock_battery", "below": 15, "for_minutes": 60}]},
        ALEX,
    )
    _set(maint, "sensor.lock_battery", "12", {"unit_of_measurement": "%"})
    clock.now += timedelta(minutes=30)
    assert await maint.tick() == []
    clock.now += timedelta(minutes=31)
    assert [t["task_id"] for t in await maint.tick()] == [task["id"]]
    # Restart: state survives in SQLite.
    reloaded = MaintenanceManager(planner.db, planner, state_reader=maint.test_states.get)
    await reloaded.async_load()
    assert next(t for t in (await reloaded.board(plan["id"]))["tasks"])["status"] == "triggered"


async def test_water_softener_learns_salt_and_drives_refill(planner, maint, clock) -> None:
    plan = await _plan(planner)
    salt_bag = await maint.save_part({"plan_id": plan["id"], "part_name": "40lb Solar Salt Bag", "current_stock": 6, "reorder_threshold": 1}, ALEX)
    softener = await maint.save_object(
        {
            "plan_id": plan["id"],
            "name": "Water Softener",
            "object_type": "water_softener",
            "config": {"volume_entity": "sensor.droplet_water", "flow_entity": "sensor.droplet_flow", "scale": "levels", "max_level": 8, "warning_level": 2, "regen_min_flow": 1, "regen_min_minutes": 10},
        },
        ALEX,
    )
    [refill] = (await maint.board(plan["id"]))["tasks"]
    assert refill["name"] == "Refill Water Softener Salt" and refill["triggers"][0]["type"] == "salt_level"
    await maint.save_task({"id": refill["id"], "parts": [{"part_id": salt_bag["id"], "quantity": 2}]}, ALEX)
    _set(maint, "sensor.droplet_water", "100000", {"unit_of_measurement": "gal"})

    await maint.salt_fill(softener["id"], ALEX)  # completes the refill task and logs "filled to top"
    assert (await maint._part(salt_bag["id"]))["current_stock"] == 4
    # Calibrate: 4,000 gallons to drop to level 6, 4,000 more to level 4.
    for day, (reading, level) in enumerate(((104000, 6), (108000, 4)), start=1):
        clock.now += timedelta(days=7)
        _set(maint, "sensor.droplet_water", str(reading), {"unit_of_measurement": "gal"})
        await maint.salt_log(softener["id"], "level", level=level, actor=ALEX)
    obj = await maint._object(softener["id"])
    summary = maint.salt_summary(obj)
    assert summary["segments"] == 2 and summary["level"] == pytest.approx(4)
    assert summary["per_unit"] == pytest.approx(2000, rel=0.35)

    # Daily use ~570 gal; another 3,000 gallons later the estimate is ~level 2.5.
    maint._softener[softener["id"]]["daily"] = {str((clock.now - timedelta(days=d)).astimezone(planner.tz).date()): 570.0 for d in range(1, 15)}
    _set(maint, "sensor.droplet_water", "111000", {"unit_of_measurement": "gal"})
    view = next(t for t in (await maint.board(plan["id"]))["tasks"] if t["id"] == refill["id"])
    assert view["status"] == "due_soon" and "gal / ~" in view["countdown"]
    _set(maint, "sensor.droplet_water", "113500", {"unit_of_measurement": "gal"})
    board = await maint.board(plan["id"])
    assert next(t for t in board["tasks"] if t["id"] == refill["id"])["status"] == "triggered"
    gauge = next(o for o in board["objects"] if o["id"] == softener["id"])["salt"]
    assert gauge["below_warning"] and gauge["label"].startswith("Level ")

    # Overnight regeneration: deducted from the water the salt learned from.
    clock.set_local(2026, 11, 20, 2, 10)
    _set(maint, "sensor.droplet_flow", "1.6")
    clock.set_local(2026, 11, 20, 2, 32)
    _set(maint, "sensor.droplet_water", "113560", {"unit_of_measurement": "gal"})
    signals = _set(maint, "sensor.droplet_flow", "0")
    assert signals and signals[0][0] == "regeneration" and signals[0][2]["volume"] == 60
    await maint.process_signals(signals)
    assert maint.effective_volume(softener["id"]) == pytest.approx(13500)
    kinds = [e["kind"] for e in await maint.history(object_id=softener["id"])]
    assert kinds.count("regeneration") == 1 and kinds.count("salt") == 2 and "completed" in kinds


async def test_learning_recommends_and_applies_interval(planner, maint, clock) -> None:
    plan = await _plan(planner)
    obj = await maint.save_object({"plan_id": plan["id"], "name": "Fridge"}, ALEX)
    task = await maint.save_task({"object_id": obj["id"], "name": "Replace Water Filter", "interval_value": 3, "interval_unit": "months"}, ALEX)
    await maint.complete(task["id"], ALEX)
    for _ in range(4):
        clock.now += timedelta(days=91)
        await maint.complete(task["id"], ALEX, feedback="too_early")
    rec = next(t for t in (await maint.board(plan["id"]))["tasks"] if t["id"] == task["id"])["recommendation"]
    assert rec["suggest"] and rec["interval_days"] > 91 and rec["samples"] == 4
    updated = await maint.apply_recommendation(task["id"], ALEX)
    assert (updated["interval_value"], updated["interval_unit"]) == (rec["value"], rec["unit"])


async def test_templates_fleet_documents_and_pdf(planner, maint) -> None:
    plan = await _plan(planner)
    furnace = await maint.apply_template(plan["id"], "furnace", ALEX)
    vehicle = await maint.apply_template(plan["id"], "vehicle", ALEX)
    board = await maint.board(plan["id"])
    furnace_tasks = [t for t in board["tasks"] if t["object_id"] == furnace["id"]]
    assert [t["name"] for t in furnace_tasks] == ["Replace Filter", "Annual Service"]
    assert furnace_tasks[0]["parts"] and board["parts"][0]["part_name"] == "16x25x4 Air Filter"
    oil = next(t for t in board["tasks"] if t["object_id"] == vehicle["id"] and t["name"] == "Oil Change")
    assert oil["triggers"] == [] and "counter trigger" in oil["notes"]

    states = [
        ("sensor.front_door_battery", "62", {"device_class": "battery", "unit_of_measurement": "%", "friendly_name": "Front Door Battery", "battery_type": "AA"}),
        ("binary_sensor.leak_battery", "off", {"device_class": "battery", "friendly_name": "Leak Sensor Battery"}),
    ]
    first = await maint.battery_fleet(plan["id"], states, ALEX)
    again = await maint.battery_fleet(plan["id"], states, ALEX)
    assert first["created"] == 2 and again["created"] == 0 and first["object_id"] == again["object_id"]
    assert any(p["part_name"] == "AA Battery" for p in (await maint.board(plan["id"]))["parts"])

    link = await maint.add_document({"object_id": furnace["id"], "kind": "link", "url": "https://example.com/manual.pdf", "category": "manual"}, ALEX)
    with pytest.raises(PlannerError):
        await maint.add_document({"object_id": furnace["id"], "kind": "link", "url": "javascript:alert(1)"}, ALEX)
    task = furnace_tasks[0]
    await maint.save_task({"id": task["id"], "manual_doc_id": link["id"], "manual_page": 14}, ALEX)
    await maint.complete(task["id"], ALEX, cost=5, duration_minutes=10, notes="Swapped (MERV 11)")
    pdf = await maint.service_record_pdf(furnace["id"], people={"person.alex": "Alex"})
    pypdf = pytest.importorskip("pypdf")
    text = pypdf.PdfReader(io.BytesIO(pdf)).pages[0].extract_text()
    assert "Service record" in text and "Replace Filter #1.1-1" in text and "1 entries" in text and "Alex" in text


async def test_service_record_counts_parts_once(planner, maint) -> None:
    from taskdragon.database import MEVENTS

    plan = await _plan(planner)
    obj = await maint.save_object({"plan_id": plan["id"], "name": "Furnace"}, ALEX)
    part = await maint.save_part({"plan_id": plan["id"], "object_id": obj["id"], "part_name": "Filter", "current_stock": 5, "unit_cost": 10}, ALEX)
    task = await maint.save_task({"object_id": obj["id"], "name": "Replace Filter", "interval_value": 3, "interval_unit": "months", "parts": [{"part_id": part["id"], "quantity": 1}]}, ALEX)
    await maint.complete(task["id"], ALEX, cost=5)
    await maint.db.insert_row(
        MEVENTS,
        {"plan_id": plan["id"], "object_id": obj["id"], "kind": "purchase", "method": "restock", "occurred_at": maint.now().isoformat(), "cost": 20, "data": {"part_name": "Filter", "quantity": 2}},
    )
    pypdf = pytest.importorskip("pypdf")

    def footer(pdf: bytes) -> str:
        return pypdf.PdfReader(io.BytesIO(pdf)).pages[0].extract_text()

    # Consumption (default): labor 5 + the filter used 10; the purchase itself isn't counted again.
    assert "Total cost: 15.00 $" in footer(await maint.service_record_pdf(obj["id"]))
    await planner.update_plan(plan["id"], {"settings": {**plan["settings"], "cost_mode": "purchase"}}, ALEX)
    # Purchase: labor 5 + the 20 spent buying filters; using one costs nothing extra.
    assert "Total cost: 25.00 $" in footer(await maint.service_record_pdf(obj["id"]))


async def test_delete_object_undo_and_privacy(planner, maint) -> None:
    plan = await _plan(planner)
    obj = await maint.save_object({"plan_id": plan["id"], "name": "Dryer"}, ALEX)
    task = await maint.save_task({"object_id": obj["id"], "name": "Clean Vent", "interval_value": 1, "interval_unit": "years"}, ALEX)
    await maint.complete(task["id"], ALEX)
    payload = await maint.delete_object(obj["id"])
    assert await maint.db.row(__import__("taskdragon.database", fromlist=["MTASKS"]).MTASKS, task["id"]) is None
    token = planner.stash_undo("maint_object", payload, ALEX)
    await planner.undo(token, ALEX)
    assert len(await maint.history(task_id=task["id"])) == 1

    private = await planner.create_plan({"name": "My garage", "archetype": "home_maintenance", "is_private": True}, SAM)
    mower = await maint.save_object({"plan_id": private["id"], "name": "Mower"}, SAM)
    blade = await maint.save_task({"object_id": mower["id"], "name": "Sharpen", "interval_value": 1, "interval_unit": "years"}, SAM)
    for kwargs in ({"mobjects": [mower["id"]]}, {"mtasks": [blade["id"]]}):
        with pytest.raises(PlannerError):
            await planner.authorize(ALEX, **kwargs)
    await planner.authorize(SAM, mtasks=[blade["id"]])
    with pytest.raises(PlannerError):
        await maint.board(private["id"], ALEX)
    planner.test_events.clear()
    await maint.complete(blade["id"], SAM)
    event, data = planner.test_events[-1]
    assert event == "taskdragon_maintenance_completed" and data["private"] and data["name"] is None


async def test_plain_tasks_and_promotions_become_maintenance_tasks(planner, maint) -> None:
    plan = await _plan(planner)
    created = await planner.save_task({"plan_id": plan["id"], "summary": "Replace sump pump check valve", "due_date": "2026-11-01"}, ALEX)
    assert created["maintenance"] and created["summary"] == "Replace sump pump check valve"
    quick = (await planner.quick_lists(ALEX))["shared"]
    item = await planner.save_task({"plan_id": quick, "summary": "Clean dryer vent"}, ALEX)
    moved = await planner.transfer_task(item["uid"], plan["id"], {"recurrence_mode": "rolling", "recurrence_interval_days": 365}, ALEX)
    assert moved["maintenance"] and await planner.db.get_task(item["uid"]) is None
    board = await maint.board(plan["id"])
    general = next(o for o in board["objects"] if o["name"] == "General")
    tasks = {t["name"]: t for t in board["tasks"] if t["object_id"] == general["id"]}
    assert tasks["Replace sump pump check valve"]["schedule_mode"] == "once" and tasks["Replace sump pump check valve"]["category"] == "Replacement"
    assert (tasks["Clean dryer vent"]["interval_value"], tasks["Clean dryer vent"]["interval_unit"]) == (1, "years")
    summary = (await planner.get_board(actor=ALEX))["maintenance"][plan["id"]]
    assert summary["tasks"] == 2 and summary["due_soon"] == 1


async def test_migration_moves_old_maintenance_tasks(tmp_path) -> None:
    path = tmp_path / "v2.db"
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA_V1)
    for statement in SCHEMA_V2.split(";"):
        if statement.strip():
            conn.execute(statement)
    now = "2026-01-01T00:00:00.000000+00:00"
    conn.execute("INSERT INTO plans (id, name, archetype, settings, created_at, updated_at) VALUES ('mp', 'Home Maintenance', 'home_maintenance', '{}', ?, ?)", (now, now))
    rows = [
        ("t1", None, "Replace furnace filter", "rolling", 90, None, "2026-11-01", "sensor.furnace_runtime", "delta", 300.0, 1200.0),
        ("t2", None, "Test smoke detectors", "calendar", None, "FREQ=MONTHLY;BYMONTHDAY=1", "2026-11-01", None, None, None, None),
        ("t3", "t1", "Buy filter", "none", None, None, None, None, None, None, None),
    ]
    for uid, parent, summary, mode, days, rule, due, sensor, sensor_mode, threshold, baseline in rows:
        conn.execute(
            "INSERT INTO tasks (uid, plan_id, parent_uid, summary, recurrence_mode, recurrence_interval_days, recurrence_rule, due_date, "
            "sensor_entity_id, sensor_mode, sensor_threshold, sensor_baseline, assigned_to, created_at, updated_at) "
            "VALUES (?, 'mp', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[\"person.alex\"]', ?, ?)",
            (uid, parent, summary, mode, days, rule, due, sensor, sensor_mode, threshold, baseline, now, now),
        )
    conn.execute("INSERT INTO completion_logs (task_uid, plan_id, summary, person_entity_id, user_name, completed_at) VALUES ('t1', 'mp', 'x', 'person.sam', 'Sam', '2026-08-01T12:00:00+00:00')")
    conn.execute("PRAGMA user_version = 2")
    conn.commit()
    conn.close()

    db = TaskDragonDB(str(path))
    await db.async_open()
    try:
        from taskdragon.database import MEVENTS, MOBJECTS, MTASKS

        assert await db.schema_version() == 6
        [obj] = await db.rows(MOBJECTS)
        assert obj["name"] == "General"
        tasks = {t["name"]: t for t in await db.rows(MTASKS)}
        filt = tasks["Replace furnace filter"]
        assert (filt["schedule_mode"], filt["interval_value"], filt["interval_unit"]) == ("rolling", 3, "months")
        assert filt["triggers"][0]["type"] == "counter" and filt["trigger_state"]["t1"]["baseline"] == 1200.0
        assert filt["category"] == "Replacement" and filt["assigned_to"] == "person.alex" and "- [ ] Buy filter" in filt["notes"]
        assert filt["event_seq"] == 1 and filt["last_done"] == "2026-08-01T12:00:00+00:00"
        smoke = tasks["Test smoke detectors"]
        assert (smoke["schedule_mode"], smoke["interval_value"], smoke["interval_unit"], smoke["anchor_date"]) == ("planned", 1, "months", "2026-11-01")
        [event] = await db.rows(MEVENTS)
        assert event["method"] == "migrated" and event["user_name"] == "Sam"
        assert await db.list_tasks("mp") == []
    finally:
        await db.async_close()


async def test_validation_rejects_bad_input(planner, maint) -> None:
    plan = await _plan(planner)
    obj = await maint.save_object({"plan_id": plan["id"], "name": "Car"}, ALEX)
    bad = [
        {"object_id": obj["id"], "name": "x", "interval_value": 1, "interval_unit": "fortnights"},
        {"object_id": obj["id"], "name": "x", "schedule_mode": "none", "triggers": [{"type": "counter", "entity_id": "sensor.odo"}]},
        {"object_id": obj["id"], "name": "x", "schedule_mode": "none", "triggers": [{"type": "threshold", "entity_id": "not an entity", "below": 3}]},
        {"object_id": obj["id"], "name": "x", "interval_value": 1, "interval_unit": "days", "schedule_time": "25:00"},
        {"object_id": obj["id"], "name": "x" * 200, "interval_value": 1, "interval_unit": "days"},
    ]
    for data in bad:
        with pytest.raises(PlannerError):
            await maint.save_task(data, ALEX)
    with pytest.raises(PlannerError) as err:
        await maint.save_task({"object_id": obj["id"], "name": "Reset", "interval_value": 1, "interval_unit": "days", "on_complete_action": {"service": "button.press", "entity_id": "button.filter_reset"}}, SAM)
    assert err.value.code == "unauthorized"
    ok = await maint.save_task({"object_id": obj["id"], "name": "Reset", "interval_value": 1, "interval_unit": "days", "on_complete_action": {"service": "button.press", "entity_id": "button.filter_reset"}}, ALEX)
    assert ok["on_complete_action"] == {"service": "button.press", "entity_id": ["button.filter_reset"], "data": {}}
    with pytest.raises(PlannerError):
        await maint.save_object({"id": obj["id"], "parent_object_id": obj["id"]}, ALEX)
    with pytest.raises(PlannerError):
        await maint.save_part({"plan_id": plan["id"], "part_name": "Oil", "reorder_url": "file:///etc/passwd"}, ALEX)
    await planner.update_plan(plan["id"], {"settings": {"notify_service": "notify.mobile_app_phone"}}, ALEX)
    with pytest.raises(PlannerError):
        await planner.update_plan(plan["id"], {"settings": {"notify_service": "notify.other"}}, SAM)
    with pytest.raises(PlannerError):
        await planner.update_plan(plan["id"], {"settings": {"notify_service": "script.unlock_door"}}, ALEX)
    assert SYSTEM.user_id is None
