"""Portable backups: export, bridge maps, verified restore (replace / merge), snapshots and schedule."""

from __future__ import annotations

import hashlib
import json
import os
import zipfile
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from conftest import TZ, plan_by_name

from taskdragon.backup_manager import BackupError, BackupManager, parse_name
from taskdragon.const import PREF_KEYS
from taskdragon.database import MDOCS, TaskDragonDB
from taskdragon.maintenance_manager import MaintenanceManager
from taskdragon.planner import Actor, Planner

ALEX = Actor(user_id="u-alex", user_name="Alex", person="person.alex", is_admin=True)
SAM = Actor(user_id="u-sam", user_name="Sam", person="person.sam")
GONE = Actor(user_id="u-gone", user_name="Riley")
USERS = [
    {"id": "u-alex", "name": "Alex Doe", "is_admin": True, "is_active": True, "system_generated": False},
    {"id": "u-sam", "name": "Sam", "is_admin": False, "is_active": True, "system_generated": False},
    {"id": "u-system", "name": "Supervisor", "is_admin": True, "is_active": True, "system_generated": True},
]
PEOPLE = [
    {"entity_id": "person.alex", "name": "Alex Doe", "user_id": "u-alex", "calendar": "calendar.alex_work"},
    {"entity_id": "person.sam", "name": "Sam", "user_id": "u-sam", "calendar": None},
]
PDF = b"%PDF-1.4\n% furnace manual\n" + b"x" * 2000


class Now:
    def __init__(self) -> None:
        self.value = datetime(2026, 10, 29, 3, 15, 0, tzinfo=ZoneInfo("America/Chicago"))

    def __call__(self) -> datetime:
        return self.value


def _manager(db, tmp_path, name: str, now: Now) -> BackupManager:
    async def users():
        return USERS

    return BackupManager(
        db=db,
        docs_dir=str(tmp_path / name / "docs"),
        backup_dir=str(tmp_path / name / "backups"),
        app_version="1.3.2",
        users=users,
        people=lambda: PEOPLE,
        options=lambda: {"weather_entity": "weather.home", "maintenance_notify_service": "notify.mobile_app_alex", "conversation_agent": None},
        local_now=now,
    )


async def _populate(planner, tmp_path) -> dict:
    maint = MaintenanceManager(planner.db, planner)
    chores = await plan_by_name(planner, "Daily Chores")
    task = await planner.save_task(
        {"plan_id": chores["id"], "summary": "Water the ferns", "sensor_entity_id": "sensor.fern_moisture", "sensor_mode": "binary", "assigned_to": ["person.guest"]}, ALEX
    )
    await planner.set_completed(task["uid"], True, GONE)
    secret = await planner.create_plan({"name": "Sam's gifts", "archetype": "quick_list", "is_private": True}, SAM)
    await planner.save_task({"plan_id": secret["id"], "summary": "Watch for Alex"}, SAM)
    home = await plan_by_name(planner, "Home Maintenance")
    softener = await maint.save_object(
        {"plan_id": home["id"], "name": "Water Softener", "object_type": "water_softener", "area_id": "utility", "zone_entity_id": "zone.home", "config": {"volume_entity": "sensor.water_total"}},
        ALEX,
    )
    furnace = await maint.save_object({"plan_id": home["id"], "name": "Furnace"}, ALEX)
    await maint.save_task(
        {"object_id": furnace["id"], "name": "Replace filter", "interval_value": 3, "interval_unit": "months", "nfc_tag_id": "tag-furnace", "triggers": [{"type": "runtime", "entity_id": "binary_sensor.furnace_running", "target_hours": 300}]},
        ALEX,
    )
    part = await maint.save_part({"plan_id": home["id"], "object_id": furnace["id"], "part_name": "Filter 16x25x4", "current_stock": 2}, ALEX)
    docs = tmp_path / "src" / "docs"
    docs.mkdir(parents=True)
    sha = hashlib.sha256(PDF).hexdigest()
    (docs / sha).write_bytes(PDF)
    await maint.add_document({"object_id": furnace["id"], "kind": "file", "sha256": sha, "filename": "manual.pdf", "content_type": "application/pdf", "size": len(PDF), "title": "Manual"}, ALEX)
    await maint.add_document({"object_id": softener["id"], "kind": "file", "sha256": "f" * 64, "filename": "lost.pdf", "content_type": "application/pdf", "size": 1}, ALEX)
    await planner.db.save_barcode({"barcode": "0036000291452", "target_type": "maintenance_part", "target_id": part["id"], "default_delta_qty": 1})
    await planner.set_prefs(SAM, {PREF_KEYS[0]: ["x"]})
    return {"task": task, "secret": secret, "part": part, "sha": sha, "softener": softener}


def _zip(path: str) -> tuple[dict, dict, zipfile.ZipFile]:
    archive = zipfile.ZipFile(path)
    return json.loads(archive.read("manifest_bridge.json")), json.loads(archive.read("database_dump.json")), archive


async def _fresh(tmp_path, name: str, clock) -> Planner:
    db = TaskDragonDB(str(tmp_path / name / "taskdragon.db"))
    await db.async_open()
    planner = Planner(db, tz=TZ, clock=clock)
    await planner.seed_defaults()
    return planner


def _rows(dump: dict, skip=("meta",)) -> dict:
    return {name: table["rows"] for name, table in dump["tables"].items() if name not in skip}


async def test_snapshot_holds_everything_with_checksums_and_bridge(planner, tmp_path) -> None:
    data = await _populate(planner, tmp_path)
    now = Now()
    backups = _manager(planner.db, tmp_path, "src", now)
    info = await backups.create_snapshot()
    assert info["name"] == "taskdragon_portable_backup_20261029_031500.zip" and info["documents"] == 1 and info["missing_documents"] == 1
    manifest, dump, archive = _zip(os.path.join(backups.backup_dir, info["name"]))
    with archive:
        names = set(archive.namelist())
        assert names == {"manifest_bridge.json", "database_dump.json", "taskdragon.db", "documents/" + data["sha"]}
        for member in ("database_dump.json", "taskdragon.db"):
            raw = archive.read(member)
            assert manifest["files"][member] == {"sha256": hashlib.sha256(raw).hexdigest(), "size": len(raw)}
        assert archive.read("documents/" + data["sha"]) == PDF
    assert manifest["schema_version"] == "1.0.0-portable" and manifest["source_platform"] == "home_assistant_custom_component"
    assert manifest["documents"][0]["filenames"] == ["manual.pdf"] and manifest["missing_documents"] == ["f" * 64]
    assert dump["format"] == "taskdragon-database-dump" and dump["db_schema_version"] == 6
    expected = {"plans", "tasks", "task_dependencies", "completion_logs", "pantry_items", "snooze_rules", "trips", "sections", "barcode_mappings", "maint_objects", "maint_tasks", "maint_parts", "maint_documents", "maint_events", "salt_observations", "meta", "user_prefs"}
    assert expected <= set(dump["tables"]) and manifest["counts"]["barcode_mappings"] == 1
    assert "settings" in dump["tables"]["plans"]["json_columns"]
    # Parents come before children, so a standalone importer can load them in order.
    order = list(dump["tables"])
    assert order.index("plans") < order.index("tasks") < order.index("task_dependencies")

    users = {u["display_name"]: u for u in manifest["users_bridge_map"]}
    assert set(users) == {"Alex Doe", "Sam", "Riley", "Guest"}
    assert users["Alex Doe"]["role"] == "admin" and users["Alex Doe"]["work_calendar_ref"] == "calendar.alex_work"
    assert users["Alex Doe"]["short_initials"] == "AD" and users["Alex Doe"]["person_entity_id"] == "person.alex"
    assert users["Riley"]["status"] == "removed" and users["Guest"]["status"] == "person_only"
    again = await backups.create_snapshot()
    manifest2, _dump2, archive2 = _zip(os.path.join(backups.backup_dir, again["name"]))
    archive2.close()
    assert again["name"].endswith("_031500_2.zip")
    assert [u["portable_user_uuid"] for u in manifest2["users_bridge_map"]] == [u["portable_user_uuid"] for u in manifest["users_bridge_map"]]

    bindings = {(b["binding_type"], b["ha_entity_id"] or b["ha_ref"]): b for b in manifest["hardware_bindings_bridge"]}
    for key in [
        ("sensor", "sensor.fern_moisture"),
        ("sensor", "binary_sensor.furnace_running"),
        ("sensor", "sensor.water_total"),
        ("zone", "zone.home"),
        ("area", "utility"),
        ("nfc_tag", "tag-furnace"),
        ("weather", "weather.home"),
        ("notify_service", "notify.mobile_app_alex"),
        ("calendar", "calendar.alex_work"),
    ]:
        assert key in bindings, key
    filter_trigger = bindings[("sensor", "binary_sensor.furnace_running")]
    assert filter_trigger["mqtt_topic_fallback"] == f"taskdragon/bindings/{filter_trigger['binding_id']}/state"
    assert filter_trigger["used_by"][0]["table"] == "maint_tasks" and len(filter_trigger["webhook_id"]) > 30
    assert bindings[("nfc_tag", "tag-furnace")]["ha_entity_id"] is None
    stable = {b["binding_id"] for b in manifest2["hardware_bindings_bridge"]}
    assert {b["binding_id"] for b in manifest["hardware_bindings_bridge"]} == stable


async def test_full_replace_rebuilds_another_installation(planner, clock, tmp_path) -> None:
    data = await _populate(planner, tmp_path)
    source = _manager(planner.db, tmp_path, "src", Now())
    snap = await source.create_snapshot()
    original = await planner.db.export_portable()

    target = await _fresh(tmp_path, "dst", clock)
    try:
        await target.save_task({"plan_id": (await plan_by_name(target, "Quick List"))["id"], "summary": "Only on the new box"})
        restored_events = []

        async def on_restored():
            restored_events.append(True)

        backups = _manager(target.db, tmp_path, "dst", Now())
        backups._on_restored = on_restored  # noqa: SLF001 - the coordinator wires this
        report = await backups.restore_file(os.path.join(source.backup_dir, snap["name"]), "replace")
        assert report["mode"] == "replace" and report["format"] == "zip" and restored_events == [True]
        assert report["documents"] == {"restored": 1, "present": 0, "missing": 1}
        assert report["tables"]["tasks"]["inserted"] == len(original["tables"]["tasks"]["rows"])
        assert parse_name(report["safety_snapshot"])["kind"] == "pre_restore"
        assert (tmp_path / "dst" / "docs" / data["sha"]).read_bytes() == PDF
        assert _rows(await target.db.export_portable()) == _rows(original)
        assert await target.db.get_barcode("0036000291452") is not None

        # The safety snapshot holds the replaced data: restoring it brings the old task back.
        await backups.restore_snapshot(report["safety_snapshot"], "replace")
        assert [t["summary"] for t in await target.db.list_tasks() if t["summary"] == "Only on the new box"]
    finally:
        await target.db.async_close()


async def test_merge_only_adds_missing_rows(planner, clock, tmp_path) -> None:
    data = await _populate(planner, tmp_path)
    backups = _manager(planner.db, tmp_path, "src", Now())
    snap = await backups.create_snapshot()
    await planner.delete_tasks([data["task"]["uid"]])
    quick = await plan_by_name(planner, "Quick List")
    newer = await planner.save_task({"plan_id": quick["id"], "summary": "Added after the backup"})
    logs_before = len(await planner.db.completion_history(data["task"]["uid"]))

    report = await backups.restore_snapshot(snap["name"], "merge")
    assert report["source"] == snap["name"] and report["totals"]["deleted"] == 0
    assert await planner.db.get_task(data["task"]["uid"]) is not None
    assert await planner.db.get_task(newer["uid"]) is not None
    # Log rows are matched on content, so the restored completion is not doubled.
    assert len(await planner.db.completion_history(data["task"]["uid"])) == max(logs_before, 1)
    assert report["tables"]["plans"]["inserted"] == 0 and report["tables"]["plans"]["skipped"] > 0
    second = await backups.restore_snapshot(snap["name"], "merge")
    assert second["totals"]["inserted"] == 0


async def test_damaged_or_foreign_backups_change_nothing(planner, tmp_path) -> None:
    await _populate(planner, tmp_path)
    backups = _manager(planner.db, tmp_path, "src", Now())
    snap = await backups.create_snapshot()
    path = os.path.join(backups.backup_dir, snap["name"])
    before = _rows(await planner.db.export_portable())

    def rewrite(target: str, change) -> None:
        with zipfile.ZipFile(path) as src, zipfile.ZipFile(target, "w") as out:
            for item in src.infolist():
                content = change(item.filename, src.read(item.filename))
                if content is not None:
                    out.writestr(item.filename, content)

    tampered = str(tmp_path / "tampered.zip")
    rewrite(tampered, lambda name, raw: raw.replace(b"Water the ferns", b"Water the FERNS") if name == "database_dump.json" else raw)
    with pytest.raises(BackupError, match="SHA-256"):
        await backups.restore_file(tampered, "replace")

    future = str(tmp_path / "future.zip")
    rewrite(future, lambda name, raw: raw.replace(b'"1.0.0-portable"', b'"2.0.0-portable"') if name == "manifest_bridge.json" else raw)
    with pytest.raises(BackupError, match="cannot read"):
        await backups.restore_file(future, "merge")

    no_doc = str(tmp_path / "nodoc.zip")
    rewrite(no_doc, lambda name, raw: None if name.startswith("documents/") else raw)
    with pytest.raises(BackupError, match="missing"):
        await backups.restore_file(no_doc, "merge")

    newer = tmp_path / "newer.json"
    newer.write_text(json.dumps({"format": "taskdragon-database-dump", "db_schema_version": 99, "tables": {}}))
    with pytest.raises(BackupError, match="newer"):
        await backups.restore_file(str(newer), "replace")
    junk = tmp_path / "junk.bin"
    junk.write_bytes(b"\x00\x01 not a backup")
    with pytest.raises(BackupError):
        await backups.restore_file(str(junk), "replace")
    with pytest.raises(BackupError):
        await backups.restore_file(path, "wipe")
    bad_value = tmp_path / "bad.json"
    bad_value.write_text(json.dumps({"format": "taskdragon-database-dump", "db_schema_version": 4, "tables": {"plans": {"rows": [{"id": "p", "name": {"nested": 1}}]}}}))
    with pytest.raises(BackupError, match="Unsupported value"):
        await backups.restore_file(str(bad_value), "merge")
    assert _rows(await planner.db.export_portable()) == before


async def test_json_dump_and_database_file_fallback(planner, tmp_path) -> None:
    data = await _populate(planner, tmp_path)
    backups = _manager(planner.db, tmp_path, "src", Now())
    snap = await backups.create_snapshot()
    path = os.path.join(backups.backup_dir, snap["name"])
    with zipfile.ZipFile(path) as archive:
        dump = json.loads(archive.read("database_dump.json"))
        (tmp_path / "database_dump.json").write_bytes(archive.read("database_dump.json"))
        db_only = str(tmp_path / "dbonly.zip")
        with zipfile.ZipFile(db_only, "w") as out:
            for name in ("manifest_bridge.json", "taskdragon.db", "documents/" + data["sha"]):
                out.writestr(name, archive.read(name))

    await planner.delete_tasks([data["task"]["uid"]])
    report = await backups.restore_file(str(tmp_path / "database_dump.json"), "replace")
    assert report["format"] == "json" and "Documents" in report["warnings"][0]
    assert await planner.db.get_task(data["task"]["uid"]) is not None

    await planner.delete_tasks([data["task"]["uid"]])
    report = await backups.restore_file(db_only, "merge")
    assert any("taskdragon.db" in w for w in report["warnings"])
    assert await planner.db.get_task(data["task"]["uid"]) is not None

    # Unknown tables and columns are reported and skipped; rows orphaned by a missing parent are dropped.
    dump["tables"]["future_table"] = {"rows": [{"id": 1}]}
    dump["tables"]["tasks"]["rows"][0]["shiny_new_column"] = 1
    dump["tables"]["tasks"]["rows"].append({**dump["tables"]["tasks"]["rows"][0], "uid": "orphan", "plan_id": "no-such-plan"})
    (tmp_path / "edited.json").write_text(json.dumps(dump))
    report = await backups.restore_file(str(tmp_path / "edited.json"), "replace")
    assert any("future_table" in w for w in report["warnings"]) and any("shiny_new_column" in w for w in report["warnings"])
    assert report["tables"]["tasks"]["removed"] == 1 and await planner.db.get_task("orphan") is None


async def test_retention_names_and_daily_schedule(planner, tmp_path) -> None:
    now = Now()
    backups = _manager(planner.db, tmp_path, "src", now)
    await backups.save_settings({"retention": 2})
    for minute in (1, 2, 3):
        now.value = now.value.replace(minute=minute)
        await backups.create_snapshot()
    names = [s["name"] for s in await backups.list_snapshots()]
    assert names == ["taskdragon_portable_backup_20261029_030300.zip", "taskdragon_portable_backup_20261029_030200.zip"]
    for bad in ("../taskdragon.db", "taskdragon_portable_backup_20261029_030300.zip/../../x", "secrets.yaml", "taskdragon_portable_backup_20991301_000000.zip"):
        with pytest.raises(BackupError):
            backups.snapshot_path(bad)
    await backups.delete_snapshot(names[1])
    assert [s["name"] for s in await backups.list_snapshots()] == names[:1]
    with pytest.raises(BackupError):
        await backups.save_settings({"time": "25:00"})

    await backups.save_settings({"retention": 14, "time": "03:15"})
    now.value = datetime(2026, 10, 30, 3, 14, tzinfo=now.value.tzinfo)
    assert await backups.daily_tick() is None
    now.value = now.value.replace(minute=15)
    first = await backups.daily_tick()
    assert first["name"] == "taskdragon_portable_backup_20261030_031500.zip"
    assert await backups.daily_tick() is None  # once a day
    await backups.save_settings({"enabled": False})
    now.value = datetime(2026, 10, 31, 3, 15, tzinfo=now.value.tzinfo)
    assert await backups.daily_tick() is None
    assert (await backups.settings()) == {"enabled": False, "retention": 14, "time": "03:15"}
    assert await planner.db.row(MDOCS, "missing") is None
