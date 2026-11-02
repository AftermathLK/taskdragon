"""Async SQLite persistence for TaskDragon (aiosqlite).

The database lives at ``<config>/.storage/taskdragon.db``. Schema versions are
tracked with ``PRAGMA user_version`` and applied by :data:`MIGRATIONS` in order.

All write methods run inside :meth:`TaskDragonDB._tx`, which serializes writers
with an asyncio lock and wraps the statements in a single transaction. Private
``_``-prefixed helpers never take the lock so they can be composed inside one.

Every value reaches SQLite as a ``?`` parameter. The only text spliced into SQL
is table/column identifiers, and those pass :func:`_ident`, which accepts only
names declared in this module's schema. No f-strings build SQL here.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
import sqlite3
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable, Iterable, Mapping, Sequence
from contextlib import asynccontextmanager
from typing import Any

import aiosqlite

from .timeutil import utc_now_iso

_LOGGER = logging.getLogger(__name__)

SCHEMA_V1 = """
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    archetype TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    is_template INTEGER NOT NULL DEFAULT 0,
    template_id TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    uid TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    parent_uid TEXT REFERENCES tasks(uid) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'needs_action',
    priority TEXT NOT NULL DEFAULT 'none',
    due_date TEXT,
    due_datetime TEXT,
    time_of_day_bucket TEXT NOT NULL DEFAULT 'anytime',
    recurrence_mode TEXT NOT NULL DEFAULT 'none',
    recurrence_rule TEXT,
    recurrence_interval_days INTEGER,
    estimated_minutes INTEGER,
    context_tags TEXT NOT NULL DEFAULT '[]',
    created_by TEXT,
    assigned_to TEXT NOT NULL DEFAULT '[]',
    completed_by TEXT,
    completed_at TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    kanban_column TEXT,
    category TEXT,
    quantity TEXT,
    shift_aware INTEGER NOT NULL DEFAULT 0,
    hide_when_blocked INTEGER NOT NULL DEFAULT 0,
    snoozed_until TEXT,
    status_before_snooze TEXT,
    status_before_block TEXT,
    expires_at TEXT,
    link_url TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    source_ref TEXT,
    sensor_entity_id TEXT,
    sensor_mode TEXT,
    sensor_threshold REAL,
    sensor_baseline REAL,
    streak INTEGER NOT NULL DEFAULT 0,
    external_id TEXT,
    sync_hash TEXT,
    synced_at TEXT,
    extra TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_plan ON tasks(plan_id, parent_uid, position);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source, source_ref);
CREATE INDEX IF NOT EXISTS idx_tasks_external ON tasks(external_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS task_dependencies (
    task_uid TEXT NOT NULL REFERENCES tasks(uid) ON DELETE CASCADE,
    blocked_by_uid TEXT NOT NULL REFERENCES tasks(uid) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (task_uid, blocked_by_uid)
);
CREATE INDEX IF NOT EXISTS idx_deps_blocker ON task_dependencies(blocked_by_uid);

CREATE TABLE IF NOT EXISTS completion_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_uid TEXT NOT NULL,
    plan_id TEXT,
    summary TEXT,
    person_entity_id TEXT,
    user_id TEXT,
    user_name TEXT,
    completed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_task ON completion_logs(task_uid, completed_at);

CREATE TABLE IF NOT EXISTS pantry_items (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT,
    stock_state TEXT NOT NULL DEFAULT 'in_stock',
    quantity TEXT,
    is_batch INTEGER NOT NULL DEFAULT 0,
    mealie_recipe_slug TEXT,
    ingredients TEXT NOT NULL DEFAULT '[]',
    low_action TEXT NOT NULL DEFAULT 'ask',
    notes TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    last_restocked_at TEXT,
    last_low_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pantry_plan ON pantry_items(plan_id, position);

CREATE TABLE IF NOT EXISTS snooze_rules (
    id TEXT PRIMARY KEY,
    task_uid TEXT NOT NULL REFERENCES tasks(uid) ON DELETE CASCADE,
    rule_type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    person_entity_id TEXT,
    armed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snooze_task ON snooze_rules(task_uid);

CREATE TABLE IF NOT EXISTS bom_items (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity TEXT,
    category TEXT NOT NULL DEFAULT 'Hardware',
    notes TEXT,
    acquired INTEGER NOT NULL DEFAULT 0,
    pushed_task_uid TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_history (
    plan_id TEXT NOT NULL,
    name_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    category TEXT,
    times_added INTEGER NOT NULL DEFAULT 0,
    last_added_at TEXT NOT NULL,
    PRIMARY KEY (plan_id, name_key)
);

CREATE TABLE IF NOT EXISTS sync_tombstones (
    external_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    deleted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""

SCHEMA_V2 = """
ALTER TABLE plans ADD COLUMN owner_user_id TEXT;
ALTER TABLE plans ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN shared_with TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sections_plan ON sections(plan_id, position);

CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'upcoming',
    position INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trips_plan ON trips(plan_id, start_date);

ALTER TABLE tasks ADD COLUMN section_id TEXT REFERENCES sections(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN trip_id TEXT REFERENCES trips(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN is_repeatable INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_tasks_section ON tasks(section_id);
CREATE INDEX IF NOT EXISTS idx_tasks_trip ON tasks(trip_id);

CREATE TABLE IF NOT EXISTS user_prefs (
    user_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key)
);
"""


async def _migrate_v2_data(conn: aiosqlite.Connection) -> None:
    """Turn 1.0 packing plans into the trip model.

    Master checklists (templates) become each plan's "always pack" list, with
    every item flagged repeatable. Plans cloned from a template become a plan
    holding one trip that owns all of its items.
    """
    async with conn.execute("SELECT id, name, is_template, settings, created_at FROM plans WHERE archetype = 'packing_trips'") as cursor:
        plans = list(await cursor.fetchall())
    for plan_id, name, is_template, settings_raw, created_at in plans:
        if is_template:
            await conn.execute("UPDATE tasks SET is_repeatable = 1 WHERE plan_id = ?", (plan_id,))
            await conn.execute("UPDATE plans SET is_template = 0 WHERE id = ?", (plan_id,))
            if name == "Weekend Trip":
                await conn.execute("UPDATE plans SET name = 'Trip Packing' WHERE id = ?", (plan_id,))
            continue
        try:
            settings = json.loads(settings_raw or "{}")
        except ValueError:
            settings = {}
        trip_date = settings.get("trip_date") if isinstance(settings, dict) else None
        trip_id = new_id()
        now = utc_now_iso()
        await conn.execute(
            "INSERT INTO trips (id, plan_id, name, start_date, end_date, status, position, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?)",
            (trip_id, plan_id, name, trip_date, trip_date, created_at or now, now),
        )
        await conn.execute("UPDATE tasks SET trip_id = ? WHERE plan_id = ?", (trip_id, plan_id))


SCHEMA_V3 = """
CREATE TABLE IF NOT EXISTS maint_objects (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    name TEXT NOT NULL,
    manufacturer_model TEXT,
    object_type TEXT NOT NULL DEFAULT 'generic',
    icon TEXT,
    area_id TEXT,
    zone_entity_id TEXT,
    parent_object_id TEXT REFERENCES maint_objects(id) ON DELETE SET NULL,
    installed_date TEXT,
    warranty_expiry_date TEXT,
    warranty_reminder_days INTEGER NOT NULL DEFAULT 30,
    notes TEXT,
    config TEXT NOT NULL DEFAULT '{}',
    state TEXT NOT NULL DEFAULT '{}',
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mobjects_number ON maint_objects(plan_id, number);

CREATE TABLE IF NOT EXISTS maint_tasks (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    object_id TEXT NOT NULL REFERENCES maint_objects(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Service',
    priority TEXT NOT NULL DEFAULT 'none',
    notes TEXT,
    spec_note TEXT,
    schedule_mode TEXT NOT NULL DEFAULT 'rolling',
    interval_value INTEGER,
    interval_unit TEXT NOT NULL DEFAULT 'months',
    anchor_date TEXT,
    next_due TEXT,
    last_done TEXT,
    warning_days INTEGER NOT NULL DEFAULT 7,
    warning_percent INTEGER NOT NULL DEFAULT 10,
    schedule_time TEXT,
    active_months TEXT NOT NULL DEFAULT '[]',
    triggers TEXT NOT NULL DEFAULT '[]',
    trigger_logic TEXT NOT NULL DEFAULT 'or',
    trigger_state TEXT NOT NULL DEFAULT '{}',
    assigned_to TEXT,
    rotation TEXT NOT NULL DEFAULT '[]',
    nfc_tag_id TEXT,
    require_nfc INTEGER NOT NULL DEFAULT 0,
    on_complete_action TEXT,
    manual_doc_id TEXT,
    manual_page INTEGER,
    last_status TEXT,
    learning TEXT NOT NULL DEFAULT '{}',
    event_seq INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mtasks_number ON maint_tasks(object_id, number);
CREATE INDEX IF NOT EXISTS idx_mtasks_plan ON maint_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_mtasks_nfc ON maint_tasks(nfc_tag_id);

CREATE TABLE IF NOT EXISTS maint_events (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    object_id TEXT REFERENCES maint_objects(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES maint_tasks(id) ON DELETE CASCADE,
    number INTEGER,
    kind TEXT NOT NULL,
    method TEXT,
    occurred_at TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT,
    person_entity_id TEXT,
    cost REAL,
    parts_cost REAL,
    duration_minutes INTEGER,
    notes TEXT,
    feedback TEXT,
    interval_days REAL,
    photo_doc_id TEXT,
    data TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mevents_object ON maint_events(object_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_mevents_task ON maint_events(task_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_mevents_plan ON maint_events(plan_id, occurred_at);

CREATE TABLE IF NOT EXISTS maint_parts (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    object_id TEXT REFERENCES maint_objects(id) ON DELETE SET NULL,
    part_name TEXT NOT NULL,
    mpn_gtin TEXT,
    storage_location TEXT,
    current_stock REAL NOT NULL DEFAULT 0,
    reorder_threshold REAL NOT NULL DEFAULT 0,
    restock_quantity REAL NOT NULL DEFAULT 1,
    unit_cost REAL,
    reorder_url TEXT,
    restock_action TEXT NOT NULL DEFAULT 'shopping',
    pending_ref TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mparts_plan ON maint_parts(plan_id);

CREATE TABLE IF NOT EXISTS maint_task_parts (
    task_id TEXT NOT NULL REFERENCES maint_tasks(id) ON DELETE CASCADE,
    part_id TEXT NOT NULL REFERENCES maint_parts(id) ON DELETE CASCADE,
    quantity REAL NOT NULL DEFAULT 1,
    PRIMARY KEY (task_id, part_id)
);

CREATE TABLE IF NOT EXISTS maint_documents (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    object_id TEXT NOT NULL REFERENCES maint_objects(id) ON DELETE CASCADE,
    task_id TEXT,
    event_id TEXT,
    category TEXT NOT NULL DEFAULT 'other',
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    url TEXT,
    sha256 TEXT,
    filename TEXT,
    content_type TEXT,
    size INTEGER,
    created_by TEXT,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mdocs_object ON maint_documents(object_id);
CREATE INDEX IF NOT EXISTS idx_mdocs_sha ON maint_documents(sha256);

CREATE TABLE IF NOT EXISTS salt_observations (
    id TEXT PRIMARY KEY,
    object_id TEXT NOT NULL REFERENCES maint_objects(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    level REAL,
    fraction REAL,
    bags REAL,
    volume REAL NOT NULL,
    source TEXT,
    user_name TEXT,
    observed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_salt_object ON salt_observations(object_id, observed_at);
"""


SCHEMA_V4 = """
CREATE TABLE IF NOT EXISTS barcode_mappings (
    barcode TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    default_delta_qty INTEGER NOT NULL DEFAULT 1,
    symbology TEXT,
    product_name TEXT,
    brand TEXT,
    created_by TEXT,
    scan_count INTEGER NOT NULL DEFAULT 0,
    last_scanned_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_barcode_target ON barcode_mappings(target_type, target_id);
"""


SCHEMA_V5 = """
CREATE TABLE IF NOT EXISTS hoard_sections (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'want',
    name TEXT NOT NULL,
    icon TEXT,
    budget REAL,
    event_date TEXT,
    repeats_yearly INTEGER NOT NULL DEFAULT 0,
    recipient_name TEXT,
    gift_for_person_id TEXT,
    stealth_mode INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_by_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hoard_sections_plan ON hoard_sections(plan_id, position);
CREATE TABLE IF NOT EXISTS hoard_items (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    section_id TEXT REFERENCES hoard_sections(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    spec_notes TEXT,
    priority TEXT NOT NULL DEFAULT 'none',
    target_price REAL,
    status TEXT NOT NULL DEFAULT 'idea',
    barcode TEXT,
    brand TEXT,
    model TEXT,
    image_url TEXT,
    recipient_name TEXT,
    gift_for_person_id TEXT,
    stealth_mode INTEGER NOT NULL DEFAULT 0,
    hiding_spot TEXT,
    watch_keyword_deals INTEGER NOT NULL DEFAULT 0,
    deal_query TEXT,
    deal_max_price REAL,
    deals_checked_at TEXT,
    paid_price REAL,
    purchase_date TEXT,
    purchase_store TEXT,
    protection_days INTEGER,
    impulse_cooldown INTEGER NOT NULL DEFAULT 0,
    cooldown_until TEXT,
    alert_state TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_by_name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hoard_items_plan ON hoard_items(plan_id, section_id, position);
CREATE INDEX IF NOT EXISTS idx_hoard_items_barcode ON hoard_items(barcode);
CREATE TABLE IF NOT EXISTS tracked_item_urls (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES hoard_items(id) ON DELETE CASCADE,
    retailer_name TEXT NOT NULL,
    url TEXT NOT NULL,
    css_selector TEXT,
    last_price REAL,
    lowest_price REAL,
    highest_price REAL,
    currency TEXT,
    in_stock INTEGER,
    last_checked_at TEXT,
    last_error TEXT,
    extraction_method TEXT,
    failures INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tracked_urls_item ON tracked_item_urls(item_id);
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL REFERENCES hoard_items(id) ON DELETE CASCADE,
    url_id TEXT REFERENCES tracked_item_urls(id) ON DELETE SET NULL,
    source TEXT NOT NULL,
    store TEXT,
    price REAL NOT NULL,
    currency TEXT,
    in_stock INTEGER,
    checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history(item_id, checked_at);
CREATE TABLE IF NOT EXISTS hoard_deals (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES hoard_items(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    discussion_url TEXT,
    price REAL,
    posted_at TEXT,
    found_at TEXT NOT NULL,
    dismissed INTEGER NOT NULL DEFAULT 0,
    UNIQUE (item_id, url)
);
CREATE INDEX IF NOT EXISTS idx_hoard_deals_item ON hoard_deals(item_id, found_at);
"""


# 1.5: phone reminders on tasks, and wishlist categories (one level under an occasion section).
SCHEMA_V6 = """
ALTER TABLE tasks ADD COLUMN remind_target TEXT;
ALTER TABLE tasks ADD COLUMN remind_time TEXT;
ALTER TABLE tasks ADD COLUMN reminded_for TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_remind ON tasks(remind_target) WHERE remind_target IS NOT NULL;
ALTER TABLE hoard_sections ADD COLUMN parent_id TEXT REFERENCES hoard_sections(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_hoard_sections_parent ON hoard_sections(parent_id);
"""


async def _migrate_v3_data(conn: aiosqlite.Connection) -> None:
    """Move 1.1 "home maintenance" list items into the asset model.

    Each maintenance plan gets a "General" object holding its former tasks.
    Recurrence becomes an interval schedule (rolling stays rolling, calendar
    rules become anchored intervals), a delta sensor becomes a counter trigger,
    a binary sensor a problem trigger, checklists move into the notes and
    completion logs become activity history. The old rows are then removed.
    """
    from .maintenance import days_to_interval, guess_category, interval_from_rrule

    async with conn.execute("SELECT id FROM plans WHERE archetype = 'home_maintenance'") as cursor:
        plan_ids = [row[0] for row in await cursor.fetchall()]
    for plan_id in plan_ids:
        async with conn.execute("SELECT * FROM tasks WHERE plan_id = ? ORDER BY position, created_at", (plan_id,)) as cursor:
            rows = [dict(row) for row in await cursor.fetchall()]
        top = [row for row in rows if not row["parent_uid"]]
        if not top:
            continue
        now = utc_now_iso()
        object_id = new_id()
        await _raw_insert(
            conn,
            MOBJECTS,
            {"id": object_id, "plan_id": plan_id, "number": 1, "name": "General", "notes": "Tasks moved over from the earlier maintenance list.", "created_at": now, "updated_at": now},
        )
        for number, row in enumerate(top, start=1):
            children = [child["summary"] for child in rows if child["parent_uid"] == row["uid"]]
            notes = "\n\n".join(part for part in (row["description"], "\n".join(f"- [ ] {c}" for c in children) if children else None) if part)
            mode, value, unit, anchor = "once", None, "months", None
            if row["recurrence_mode"] == "rolling" and row["recurrence_interval_days"]:
                mode = "rolling"
                value, unit = days_to_interval(float(row["recurrence_interval_days"]))
            elif row["recurrence_mode"] == "calendar":
                parsed = interval_from_rrule(row["recurrence_rule"])
                if parsed:
                    mode, (value, unit), anchor = "planned", parsed, row["due_date"]
            triggers, trigger_state = [], {}
            if row["sensor_entity_id"]:
                if row["sensor_mode"] == "binary":
                    triggers = [{"id": "t1", "type": "problem", "entity_id": row["sensor_entity_id"], "auto_complete": False}]
                elif row["sensor_threshold"]:
                    triggers = [{"id": "t1", "type": "counter", "entity_id": row["sensor_entity_id"], "delta": row["sensor_threshold"]}]
                    if row["sensor_baseline"] is not None:
                        trigger_state = {"t1": {"baseline": row["sensor_baseline"], "offset": 0.0, "last": row["sensor_baseline"]}}
                if mode == "once":
                    mode = "none"
            async with conn.execute("SELECT * FROM completion_logs WHERE task_uid = ? ORDER BY completed_at", (row["uid"],)) as cursor:
                logs = [dict(log) for log in await cursor.fetchall()]
            last_done = row["completed_at"] or (logs[-1]["completed_at"] if logs else None)
            next_due = row["due_date"]
            if mode == "once" and row["status"] == "completed":
                next_due = None
            assigned = json.loads(row["assigned_to"] or "[]")
            task_id = new_id()
            await _raw_insert(
                conn,
                MTASKS,
                {
                    "id": task_id,
                    "plan_id": plan_id,
                    "object_id": object_id,
                    "number": number,
                    "name": row["summary"],
                    "category": guess_category(row["summary"]),
                    "priority": row["priority"] or "none",
                    "notes": notes or None,
                    "schedule_mode": mode,
                    "interval_value": value,
                    "interval_unit": unit,
                    "anchor_date": anchor,
                    "next_due": next_due,
                    "last_done": last_done,
                    "triggers": triggers,
                    "trigger_state": trigger_state,
                    "assigned_to": assigned[0] if assigned else None,
                    "event_seq": len(logs),
                    "created_at": row["created_at"],
                    "updated_at": now,
                },
            )
            for index, log in enumerate(logs, start=1):
                await _raw_insert(
                    conn,
                    MEVENTS,
                    {
                        "id": new_id(),
                        "plan_id": plan_id,
                        "object_id": object_id,
                        "task_id": task_id,
                        "number": index,
                        "kind": "completed",
                        "method": "migrated",
                        "occurred_at": log["completed_at"],
                        "user_id": log["user_id"],
                        "user_name": log["user_name"],
                        "person_entity_id": log["person_entity_id"],
                        "created_at": now,
                    },
                )
        await conn.execute("DELETE FROM tasks WHERE plan_id = ?", (plan_id,))


async def _raw_insert(conn: aiosqlite.Connection, table: _Table, data: dict[str, Any]) -> None:
    encoded = table.encode(data)
    columns = ", ".join(_ident(column) for column in encoded)
    await conn.execute(
        "INSERT INTO " + _ident(table.name) + " (" + columns + ") VALUES (" + _marks(len(encoded)) + ")",
        tuple(encoded.values()),
    )


Migration = tuple[str, Callable[[aiosqlite.Connection], Awaitable[None]] | None]
MIGRATIONS: tuple[Migration, ...] = (
    (SCHEMA_V1, None),
    (SCHEMA_V2, _migrate_v2_data),
    (SCHEMA_V3, _migrate_v3_data),
    (SCHEMA_V4, None),
    (SCHEMA_V5, None),
    (SCHEMA_V6, None),
)
# The first schema that portable backups (backup_manager.py) were written with.
PORTABLE_MIN_SCHEMA = 4


class _Table:
    """Column metadata for (de)serializing a table's rows."""

    def __init__(
        self,
        name: str,
        key: str,
        columns: Sequence[str],
        json_fields: Iterable[str] = (),
        bool_fields: Iterable[str] = (),
        json_defaults: dict[str, Any] | None = None,
    ) -> None:
        self.name = name
        self.key = key
        self.columns = tuple(columns)
        self.json_fields = frozenset(json_fields)
        self.bool_fields = frozenset(bool_fields)
        self.json_defaults = json_defaults or {}

    def encode(self, data: dict[str, Any]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for column in self.columns:
            if column not in data:
                continue
            value = data[column]
            if column in self.json_fields:
                value = json.dumps(value if value is not None else self.json_defaults.get(column))
            elif column in self.bool_fields:
                value = 1 if value else 0
            out[column] = value
        return out

    def decode(self, row: aiosqlite.Row | None) -> dict[str, Any] | None:
        if row is None:
            return None
        out = dict(row)
        for column in self.json_fields:
            raw = out.get(column)
            if raw is None or raw == "":
                out[column] = _copy_default(self.json_defaults.get(column))
                continue
            try:
                out[column] = json.loads(raw)
            except (TypeError, ValueError):
                out[column] = _copy_default(self.json_defaults.get(column))
        for column in self.bool_fields:
            out[column] = bool(out.get(column))
        return out


def _copy_default(value: Any) -> Any:
    if isinstance(value, (list, dict)):
        return type(value)(value)
    return value


PLANS = _Table(
    "plans",
    "id",
    (
        "id", "name", "archetype", "icon", "color", "position", "is_template",
        "template_id", "archived", "settings", "created_at", "updated_at",
        "owner_user_id", "is_private", "shared_with",
    ),
    json_fields=("settings", "shared_with"),
    bool_fields=("is_template", "archived", "is_private"),
    json_defaults={"settings": {}, "shared_with": []},
)

TASKS = _Table(
    "tasks",
    "uid",
    (
        "uid", "plan_id", "parent_uid", "summary", "description", "status", "priority",
        "due_date", "due_datetime", "time_of_day_bucket", "recurrence_mode",
        "recurrence_rule", "recurrence_interval_days", "estimated_minutes",
        "context_tags", "created_by", "assigned_to", "completed_by", "completed_at",
        "position", "kanban_column", "category", "quantity", "shift_aware",
        "hide_when_blocked", "snoozed_until", "status_before_snooze",
        "status_before_block", "expires_at", "link_url", "source", "source_ref",
        "sensor_entity_id", "sensor_mode", "sensor_threshold", "sensor_baseline",
        "streak", "external_id", "sync_hash", "synced_at", "extra", "created_at",
        "updated_at", "section_id", "trip_id", "is_repeatable", "remind_target", "remind_time",
        "reminded_for",
    ),
    json_fields=("context_tags", "assigned_to", "extra"),
    bool_fields=("shift_aware", "hide_when_blocked", "is_repeatable"),
    json_defaults={"context_tags": [], "assigned_to": [], "extra": {}},
)

SECTIONS = _Table("sections", "id", ("id", "plan_id", "name", "position", "created_at", "updated_at"))

TRIPS = _Table(
    "trips",
    "id",
    (
        "id", "plan_id", "name", "start_date", "end_date", "status", "position",
        "created_by", "created_at", "updated_at",
    ),
)

PANTRY = _Table(
    "pantry_items",
    "id",
    (
        "id", "plan_id", "name", "category", "stock_state", "quantity", "is_batch",
        "mealie_recipe_slug", "ingredients", "low_action", "notes", "position",
        "last_restocked_at", "last_low_at", "created_at", "updated_at",
    ),
    json_fields=("ingredients",),
    bool_fields=("is_batch",),
    json_defaults={"ingredients": []},
)

SNOOZE = _Table(
    "snooze_rules",
    "id",
    ("id", "task_uid", "rule_type", "config", "person_entity_id", "armed_at"),
    json_fields=("config",),
    json_defaults={"config": {}},
)

BOM = _Table(
    "bom_items",
    "id",
    (
        "id", "plan_id", "name", "quantity", "category", "notes", "acquired",
        "pushed_task_uid", "position", "created_at", "updated_at",
    ),
    bool_fields=("acquired",),
)


MOBJECTS = _Table(
    "maint_objects",
    "id",
    (
        "id", "plan_id", "number", "name", "manufacturer_model", "object_type", "icon", "area_id",
        "zone_entity_id", "parent_object_id", "installed_date", "warranty_expiry_date",
        "warranty_reminder_days", "notes", "config", "state", "archived", "created_at", "updated_at",
    ),
    json_fields=("config", "state"),
    bool_fields=("archived",),
    json_defaults={"config": {}, "state": {}},
)

MTASKS = _Table(
    "maint_tasks",
    "id",
    (
        "id", "plan_id", "object_id", "number", "name", "category", "priority", "notes", "spec_note",
        "schedule_mode", "interval_value", "interval_unit", "anchor_date", "next_due", "last_done",
        "warning_days", "warning_percent", "schedule_time", "active_months", "triggers", "trigger_logic",
        "trigger_state", "assigned_to", "rotation", "nfc_tag_id", "require_nfc", "on_complete_action",
        "manual_doc_id", "manual_page", "last_status", "learning", "event_seq", "archived",
        "created_at", "updated_at",
    ),
    json_fields=("active_months", "triggers", "trigger_state", "rotation", "on_complete_action", "learning"),
    bool_fields=("require_nfc", "archived"),
    json_defaults={"active_months": [], "triggers": [], "trigger_state": {}, "rotation": [], "on_complete_action": None, "learning": {}},
)

MEVENTS = _Table(
    "maint_events",
    "id",
    (
        "id", "plan_id", "object_id", "task_id", "number", "kind", "method", "occurred_at", "user_id",
        "user_name", "person_entity_id", "cost", "parts_cost", "duration_minutes", "notes", "feedback",
        "interval_days", "photo_doc_id", "data", "created_at",
    ),
    json_fields=("data",),
    json_defaults={"data": {}},
)

MPARTS = _Table(
    "maint_parts",
    "id",
    (
        "id", "plan_id", "object_id", "part_name", "mpn_gtin", "storage_location", "current_stock",
        "reorder_threshold", "restock_quantity", "unit_cost", "reorder_url", "restock_action",
        "pending_ref", "notes", "created_at", "updated_at",
    ),
)

MDOCS = _Table(
    "maint_documents",
    "id",
    (
        "id", "plan_id", "object_id", "task_id", "event_id", "category", "title", "kind", "url",
        "sha256", "filename", "content_type", "size", "created_by", "created_at",
    ),
)

SALTOBS = _Table(
    "salt_observations",
    "id",
    ("id", "object_id", "kind", "level", "fraction", "bags", "volume", "source", "user_name", "observed_at"),
)

MTASKPARTS = _Table("maint_task_parts", "task_id", ("task_id", "part_id", "quantity"))

BARCODES = _Table(
    "barcode_mappings",
    "barcode",
    (
        "barcode", "target_type", "target_id", "default_delta_qty", "symbology", "product_name", "brand",
        "created_by", "scan_count", "last_scanned_at", "created_at", "updated_at",
    ),
)

HSECTIONS = _Table(
    "hoard_sections",
    "id",
    (
        "id", "plan_id", "kind", "name", "icon", "budget", "event_date", "repeats_yearly", "recipient_name",
        "gift_for_person_id", "stealth_mode", "position", "created_by", "created_by_name", "created_at", "updated_at",
        "parent_id",
    ),
    bool_fields=("repeats_yearly", "stealth_mode"),
)

HITEMS = _Table(
    "hoard_items",
    "id",
    (
        "id", "plan_id", "section_id", "title", "spec_notes", "priority", "target_price", "status", "barcode",
        "brand", "model", "image_url", "recipient_name", "gift_for_person_id", "stealth_mode", "hiding_spot",
        "watch_keyword_deals", "deal_query", "deal_max_price", "deals_checked_at", "paid_price", "purchase_date",
        "purchase_store", "protection_days", "impulse_cooldown", "cooldown_until", "alert_state", "position",
        "created_by", "created_by_name", "created_at", "updated_at",
    ),
    json_fields=("alert_state",),
    bool_fields=("stealth_mode", "watch_keyword_deals", "impulse_cooldown"),
    json_defaults={"alert_state": {}},
)

HURLS = _Table(
    "tracked_item_urls",
    "id",
    (
        "id", "item_id", "retailer_name", "url", "css_selector", "last_price", "lowest_price", "highest_price",
        "currency", "in_stock", "last_checked_at", "last_error", "extraction_method", "failures", "created_at",
        "updated_at",
    ),
)

HPRICES = _Table(
    "price_history",
    "id",
    ("id", "item_id", "url_id", "source", "store", "price", "currency", "in_stock", "checked_at"),
)

HDEALS = _Table(
    "hoard_deals",
    "id",
    ("id", "item_id", "source", "title", "url", "discussion_url", "price", "posted_at", "found_at", "dismissed"),
    bool_fields=("dismissed",),
)

_TABLES = (PLANS, TASKS, PANTRY, SNOOZE, BOM, SECTIONS, TRIPS, MOBJECTS, MTASKS, MEVENTS, MPARTS, MDOCS, SALTOBS, MTASKPARTS, BARCODES, HSECTIONS, HITEMS, HURLS, HPRICES, HDEALS)
# Every identifier that may appear in generated SQL.
_IDENTIFIERS = frozenset(
    name for table in _TABLES for name in (table.name, table.key, *table.columns)
)

# Fields a caller may never set directly through update helpers.
_IMMUTABLE = frozenset({"uid", "id", "created_at"})


def new_id() -> str:
    """Return a new random identifier."""
    return uuid.uuid4().hex


def _ident(name: str) -> str:
    """Return ``name`` if it is a schema identifier; refuse anything else."""
    if name not in _IDENTIFIERS:
        raise ValueError("Refusing unknown SQL identifier " + repr(name))
    return name


def _marks(count: int) -> str:
    """``?, ?, ?`` for an ``IN (...)`` list of ``count`` parameters."""
    return ", ".join("?" for _ in range(int(count)))


class TaskDragonDB:
    """Async SQLite manager."""

    def __init__(self, path: str) -> None:
        self.path = path
        self._conn: aiosqlite.Connection | None = None
        self._lock: asyncio.Lock | None = None  # created inside the running loop

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    async def async_open(self) -> None:
        await asyncio.to_thread(os.makedirs, os.path.dirname(os.path.abspath(self.path)), exist_ok=True)
        self._lock = asyncio.Lock()
        self._conn = await aiosqlite.connect(self.path, isolation_level=None)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.execute("PRAGMA foreign_keys = ON")
        await self._conn.execute("PRAGMA journal_mode = WAL")
        await self._conn.execute("PRAGMA synchronous = NORMAL")
        await self._migrate()

    async def async_close(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None

    @property
    def conn(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise RuntimeError("database is not open")
        return self._conn

    async def _migrate(self) -> None:
        async with self.conn.execute("PRAGMA user_version") as cursor:
            row = await cursor.fetchone()
        version = int(row[0]) if row else 0
        for index, (script, data_step) in enumerate(MIGRATIONS, start=1):
            if index <= version:
                continue
            _LOGGER.info("Applying TaskDragon database migration %s", index)
            await self.conn.execute("BEGIN")
            try:
                for statement in _split_sql(script):
                    await self.conn.execute(statement)
                if data_step is not None:
                    await data_step(self.conn)
                # PRAGMA values cannot be bound as parameters; this is an int from the loop above.
                await self.conn.execute("PRAGMA user_version = " + str(int(index)))
                await self.conn.execute("COMMIT")
            except Exception:
                await self.conn.execute("ROLLBACK")
                raise

    @asynccontextmanager
    async def _tx(self) -> AsyncIterator[aiosqlite.Connection]:
        assert self._lock is not None
        async with self._lock:
            await self.conn.execute("BEGIN IMMEDIATE")
            try:
                yield self.conn
            except BaseException:
                await self.conn.execute("ROLLBACK")
                raise
            await self.conn.execute("COMMIT")

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[TaskDragonDB]:
        """Group several ``tx_*`` calls into one atomic transaction."""
        async with self._tx():
            yield self

    # ------------------------------------------------------------------
    # Generic helpers (no locking)
    # ------------------------------------------------------------------
    async def _fetchall(self, sql: str, params: Sequence[Any] = ()) -> list[aiosqlite.Row]:
        async with self.conn.execute(sql, params) as cursor:
            return list(await cursor.fetchall())

    async def _fetchone(self, sql: str, params: Sequence[Any] = ()) -> aiosqlite.Row | None:
        async with self.conn.execute(sql, params) as cursor:
            return await cursor.fetchone()

    async def _insert(self, table: _Table, data: dict[str, Any]) -> None:
        encoded = table.encode(data)
        columns = ", ".join(_ident(column) for column in encoded)
        await self.conn.execute(
            "INSERT INTO " + _ident(table.name) + " (" + columns + ") VALUES (" + _marks(len(encoded)) + ")",
            tuple(encoded.values()),
        )

    async def _update(self, table: _Table, key: str, changes: dict[str, Any]) -> None:
        encoded = table.encode({k: v for k, v in changes.items() if k not in _IMMUTABLE})
        if not encoded:
            return
        assignments = ", ".join(_ident(column) + " = ?" for column in encoded)
        await self.conn.execute(
            "UPDATE " + _ident(table.name) + " SET " + assignments + " WHERE " + _ident(table.key) + " = ?",
            (*encoded.values(), key),
        )

    async def _get(self, table: _Table, key: str) -> dict[str, Any] | None:
        row = await self._fetchone(
            "SELECT * FROM " + _ident(table.name) + " WHERE " + _ident(table.key) + " = ?", (key,)
        )
        return table.decode(row)

    async def _next_position(self, table: _Table, filters: dict[str, Any]) -> int:
        """One past the highest ``position`` among rows matching ``filters`` (``None`` = IS NULL)."""
        clauses: list[str] = []
        params: list[Any] = []
        for column, value in filters.items():
            if value is None:
                clauses.append(_ident(column) + " IS NULL")
            else:
                clauses.append(_ident(column) + " = ?")
                params.append(value)
        sql = "SELECT COALESCE(MAX(position), 0) FROM " + _ident(table.name)
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        row = await self._fetchone(sql, params)
        return int(row[0] if row else 0) + 1

    # ------------------------------------------------------------------
    # Meta key/value store
    # ------------------------------------------------------------------
    async def get_meta(self, key: str, default: Any = None) -> Any:
        row = await self._fetchone("SELECT value FROM meta WHERE key = ?", (key,))
        if row is None or row[0] is None:
            return default
        try:
            return json.loads(row[0])
        except ValueError:
            return default

    async def set_meta(self, key: str, value: Any) -> None:
        async with self._tx():
            await self.conn.execute(
                "INSERT INTO meta (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, json.dumps(value)),
            )

    # ------------------------------------------------------------------
    # Plans
    # ------------------------------------------------------------------
    async def list_plans(self, include_archived: bool = False) -> list[dict[str, Any]]:
        sql = "SELECT * FROM plans"
        if not include_archived:
            sql += " WHERE archived = 0"
        sql += " ORDER BY position, name"
        return [PLANS.decode(row) for row in await self._fetchall(sql)]

    async def get_plan(self, plan_id: str) -> dict[str, Any] | None:
        return await self._get(PLANS, plan_id)

    async def create_plan(self, data: dict[str, Any]) -> dict[str, Any]:
        async with self._tx():
            return await self.tx_create_plan(data)

    async def tx_create_plan(self, data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        record = {
            "id": data.get("id") or new_id(),
            "name": data["name"],
            "archetype": data["archetype"],
            "icon": data.get("icon"),
            "color": data.get("color"),
            "position": data.get("position") or await self._next_position(PLANS, {}),
            "is_template": data.get("is_template", False),
            "template_id": data.get("template_id"),
            "archived": data.get("archived", False),
            "settings": data.get("settings") or {},
            "owner_user_id": data.get("owner_user_id"),
            "is_private": data.get("is_private", False),
            "shared_with": list(data.get("shared_with") or []),
            "created_at": now,
            "updated_at": now,
        }
        await self._insert(PLANS, record)
        return record

    async def update_plan(self, plan_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        async with self._tx():
            await self._update(PLANS, plan_id, {**changes, "updated_at": utc_now_iso()})
        return await self.get_plan(plan_id)

    async def delete_plan(self, plan_id: str) -> None:
        async with self._tx():
            await self.conn.execute("DELETE FROM plans WHERE id = ?", (plan_id,))
            await self.conn.execute("DELETE FROM item_history WHERE plan_id = ?", (plan_id,))
            await self.conn.execute("DELETE FROM sync_tombstones WHERE plan_id = ?", (plan_id,))

    async def replace_plan_icon(self, old: str, new: str) -> list[str]:
        """Swap one icon for another on every plan that uses it; returns the plan ids changed."""
        rows = await self._fetchall("SELECT id FROM plans WHERE icon = ?", (old,))
        if rows:
            async with self._tx():
                await self.conn.execute("UPDATE plans SET icon = ?, updated_at = ? WHERE icon = ?", (new, utc_now_iso(), old))
        return [row[0] for row in rows]

    async def reorder_plans(self, ordered_ids: Sequence[str]) -> None:
        async with self._tx():
            for position, plan_id in enumerate(ordered_ids, start=1):
                await self.conn.execute("UPDATE plans SET position = ? WHERE id = ?", (position, plan_id))

    # ------------------------------------------------------------------
    # Quick-list sections
    # ------------------------------------------------------------------
    async def list_sections(self, plan_ids: Sequence[str] | None = None) -> list[dict[str, Any]]:
        if plan_ids is None:
            rows = await self._fetchall("SELECT * FROM sections ORDER BY plan_id, position, name")
        elif not plan_ids:
            return []
        else:
            rows = await self._fetchall(
                "SELECT * FROM sections WHERE plan_id IN (" + _marks(len(plan_ids)) + ") ORDER BY plan_id, position, name",
                tuple(plan_ids),
            )
        return [SECTIONS.decode(row) for row in rows]

    async def get_section(self, section_id: str) -> dict[str, Any] | None:
        return await self._get(SECTIONS, section_id)

    async def create_section(self, plan_id: str, name: str, position: int | None = None) -> dict[str, Any]:
        async with self._tx():
            return await self.tx_create_section(plan_id, name, position)

    async def tx_create_section(self, plan_id: str, name: str, position: int | None = None) -> dict[str, Any]:
        now = utc_now_iso()
        record = {
            "id": new_id(),
            "plan_id": plan_id,
            "name": name,
            "position": position or await self._next_position(SECTIONS, {"plan_id": plan_id}),
            "created_at": now,
            "updated_at": now,
        }
        await self._insert(SECTIONS, record)
        return record

    async def update_section(self, section_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        async with self._tx():
            await self._update(SECTIONS, section_id, {**changes, "updated_at": utc_now_iso()})
        return await self.get_section(section_id)

    async def delete_section(self, section_id: str) -> list[str]:
        """Delete a section; its tasks fall back to the list's inbox. Returns those task uids."""
        rows = await self._fetchall("SELECT uid FROM tasks WHERE section_id = ?", (section_id,))
        async with self._tx():
            await self.conn.execute("UPDATE tasks SET section_id = NULL WHERE section_id = ?", (section_id,))
            await self.conn.execute("DELETE FROM sections WHERE id = ?", (section_id,))
        return [row[0] for row in rows]

    async def restore_section(self, section: dict[str, Any], task_uids: Sequence[str]) -> None:
        async with self._tx():
            if await self._get(SECTIONS, section["id"]) is not None:
                return
            if await self._fetchone("SELECT 1 FROM plans WHERE id = ?", (section["plan_id"],)) is None:
                return
            await self._insert(SECTIONS, section)
            for uid in task_uids:
                await self.conn.execute(
                    "UPDATE tasks SET section_id = ? WHERE uid = ? AND plan_id = ? AND section_id IS NULL",
                    (section["id"], uid, section["plan_id"]),
                )

    async def reorder_sections(self, plan_id: str, ordered_ids: Sequence[str]) -> None:
        async with self._tx():
            for position, section_id in enumerate(ordered_ids, start=1):
                await self.conn.execute(
                    "UPDATE sections SET position = ? WHERE id = ? AND plan_id = ?", (position, section_id, plan_id)
                )

    # ------------------------------------------------------------------
    # Trips (packing)
    # ------------------------------------------------------------------
    async def list_trips(self, plan_ids: Sequence[str] | None = None) -> list[dict[str, Any]]:
        if plan_ids is None:
            rows = await self._fetchall("SELECT * FROM trips ORDER BY plan_id, start_date, position")
        elif not plan_ids:
            return []
        else:
            rows = await self._fetchall(
                "SELECT * FROM trips WHERE plan_id IN (" + _marks(len(plan_ids)) + ") ORDER BY plan_id, start_date, position",
                tuple(plan_ids),
            )
        return [TRIPS.decode(row) for row in rows]

    async def get_trip(self, trip_id: str) -> dict[str, Any] | None:
        return await self._get(TRIPS, trip_id)

    async def tx_create_trip(self, data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        record = {
            "id": data.get("id") or new_id(),
            "plan_id": data["plan_id"],
            "name": data["name"],
            "start_date": data.get("start_date"),
            "end_date": data.get("end_date"),
            "status": data.get("status") or "upcoming",
            "position": data.get("position") or await self._next_position(TRIPS, {"plan_id": data["plan_id"]}),
            "created_by": data.get("created_by"),
            "created_at": data.get("created_at") or now,
            "updated_at": now,
        }
        await self._insert(TRIPS, record)
        return record

    async def update_trip(self, trip_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        async with self._tx():
            await self._update(TRIPS, trip_id, {**changes, "updated_at": utc_now_iso()})
        return await self.get_trip(trip_id)

    async def delete_trip(self, trip_id: str) -> dict[str, Any]:
        """Delete a trip and its items. Returns ``{"trip", "tasks"}`` for undo."""
        trip = await self.get_trip(trip_id)
        uids = [row[0] for row in await self._fetchall("SELECT uid FROM tasks WHERE trip_id = ?", (trip_id,))]
        snapshot = await self.snapshot_tasks(uids)
        async with self._tx():
            await self.tx_delete_tasks(uids)
            await self.conn.execute("DELETE FROM trips WHERE id = ?", (trip_id,))
        return {"trip": trip, "tasks": snapshot}

    async def restore_trip(self, trip: dict[str, Any]) -> bool:
        async with self._tx():
            if await self._get(TRIPS, trip["id"]) is not None:
                return False
            if await self._fetchone("SELECT 1 FROM plans WHERE id = ?", (trip["plan_id"],)) is None:
                return False
            await self._insert(TRIPS, trip)
        return True

    async def trips_to_activate(self, today_iso: str) -> list[dict[str, Any]]:
        rows = await self._fetchall(
            "SELECT * FROM trips WHERE status = 'upcoming' AND start_date IS NOT NULL AND start_date <= ?",
            (today_iso,),
        )
        return [TRIPS.decode(row) for row in rows]

    async def repeatable_items(self, plan_id: str) -> list[dict[str, Any]]:
        """Every top-level item flagged repeatable in a packing plan, newest edit first."""
        rows = await self._fetchall(
            "SELECT * FROM tasks WHERE plan_id = ? AND is_repeatable = 1 AND parent_uid IS NULL "
            "ORDER BY updated_at DESC, created_at DESC",
            (plan_id,),
        )
        return [TASKS.decode(row) for row in rows]

    # ------------------------------------------------------------------
    # Per-user preferences
    # ------------------------------------------------------------------
    async def get_prefs(self, user_id: str) -> dict[str, Any]:
        rows = await self._fetchall("SELECT key, value FROM user_prefs WHERE user_id = ?", (user_id,))
        prefs: dict[str, Any] = {}
        for key, raw in rows:
            try:
                prefs[key] = json.loads(raw)
            except ValueError:
                continue
        return prefs

    async def set_prefs(self, user_id: str, changes: dict[str, Any]) -> None:
        async with self._tx():
            for key, value in changes.items():
                await self.conn.execute(
                    "INSERT INTO user_prefs (user_id, key, value) VALUES (?, ?, ?) "
                    "ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value",
                    (user_id, key, json.dumps(value)),
                )

    # ------------------------------------------------------------------
    # Generic row helpers (maintenance tables)
    # ------------------------------------------------------------------
    @staticmethod
    def _where(filters: dict[str, Any] | None) -> tuple[str, list[Any]] | None:
        clauses: list[str] = []
        params: list[Any] = []
        for column, value in (filters or {}).items():
            if isinstance(value, (list, tuple, set, frozenset)):
                if not value:
                    return None
                clauses.append(_ident(column) + " IN (" + _marks(len(value)) + ")")
                params.extend(value)
            elif value is None:
                clauses.append(_ident(column) + " IS NULL")
            else:
                clauses.append(_ident(column) + " = ?")
                params.append(value)
        return (" WHERE " + " AND ".join(clauses) if clauses else ""), params

    async def rows(
        self, table: _Table, filters: dict[str, Any] | None = None, order: Sequence[str] = (), limit: int | None = None
    ) -> list[dict[str, Any]]:
        """Rows matching ``filters`` (lists become IN, None becomes IS NULL), ordered by "column [DESC]"."""
        where = self._where(filters)
        if where is None:
            return []
        sql = "SELECT * FROM " + _ident(table.name) + where[0]
        params = list(where[1])
        if order:
            parts = []
            for spec in order:
                column, _, direction = spec.partition(" ")
                if direction.upper() not in ("", "ASC", "DESC"):
                    raise ValueError("bad sort direction")
                parts.append(_ident(column) + (" " + direction.upper() if direction else ""))
            sql += " ORDER BY " + ", ".join(parts)
        if limit is not None:
            sql += " LIMIT ?"
            params.append(int(limit))
        return [table.decode(row) for row in await self._fetchall(sql, params)]

    async def row(self, table: _Table, key: str) -> dict[str, Any] | None:
        return await self._get(table, key)

    async def insert_row(self, table: _Table, data: dict[str, Any]) -> dict[str, Any]:
        async with self._tx():
            return await self.tx_insert_row(table, data)

    async def tx_insert_row(self, table: _Table, data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        record = dict(data)
        if table.key == "id":
            record.setdefault("id", new_id())
        for stamp in ("created_at", "updated_at"):
            if stamp in table.columns:
                record.setdefault(stamp, now)
        await self._insert(table, record)
        if table.key == "id":
            row = await self._get(table, record["id"])
            assert row is not None
            return row
        return record

    async def update_row(self, table: _Table, key: str, changes: dict[str, Any], *, touch: bool = True) -> dict[str, Any] | None:
        async with self._tx():
            await self.tx_update_row(table, key, changes, touch=touch)
        return await self._get(table, key)

    async def tx_update_row(self, table: _Table, key: str, changes: dict[str, Any], *, touch: bool = True) -> None:
        payload = dict(changes)
        if touch and "updated_at" in table.columns:
            payload["updated_at"] = utc_now_iso()
        await self._update(table, key, payload)

    async def delete_row(self, table: _Table, key: str) -> None:
        async with self._tx():
            await self.conn.execute(
                "DELETE FROM " + _ident(table.name) + " WHERE " + _ident(table.key) + " = ?", (key,)
            )

    async def next_number(self, table: _Table, filters: dict[str, Any]) -> int:
        where = self._where(filters) or ("", [])
        row = await self._fetchone("SELECT COALESCE(MAX(number), 0) FROM " + _ident(table.name) + where[0], where[1])
        return int(row[0] if row else 0) + 1

    async def task_parts(self, task_ids: Sequence[str]) -> list[dict[str, Any]]:
        if not task_ids:
            return []
        rows = await self._fetchall(
            "SELECT * FROM maint_task_parts WHERE task_id IN (" + _marks(len(task_ids)) + ")", tuple(task_ids)
        )
        return [dict(row) for row in rows]

    async def set_task_parts(self, task_id: str, parts: Sequence[tuple[str, float]]) -> None:
        async with self._tx():
            await self.conn.execute("DELETE FROM maint_task_parts WHERE task_id = ?", (task_id,))
            for part_id, quantity in parts:
                await self.conn.execute(
                    "INSERT OR REPLACE INTO maint_task_parts (task_id, part_id, quantity) VALUES (?, ?, ?)",
                    (task_id, part_id, float(quantity)),
                )

    async def restore_rows(self, table: _Table, rows: Sequence[dict[str, Any]]) -> None:
        """Re-insert rows captured before a delete (undo); rows that exist again are skipped."""
        async with self._tx():
            for record in rows:
                if table.key == "id" and await self._get(table, record["id"]) is not None:
                    continue
                await self._insert(table, record)

    async def document_refs(self, sha256: str) -> int:
        row = await self._fetchone("SELECT COUNT(*) FROM maint_documents WHERE sha256 = ?", (sha256,))
        return int(row[0]) if row else 0

    async def all_document_hashes(self) -> set[str]:
        return {row[0] for row in await self._fetchall("SELECT DISTINCT sha256 FROM maint_documents WHERE sha256 IS NOT NULL")}

    async def schema_version(self) -> int:
        row = await self._fetchone("PRAGMA user_version")
        return int(row[0]) if row else 0

    async def counts(self) -> dict[str, Any]:
        """Row counts for diagnostics (no user content)."""
        queries = {
            "plans": "SELECT COUNT(*) FROM plans",
            "tasks": "SELECT COUNT(*) FROM tasks",
            "sections": "SELECT COUNT(*) FROM sections",
            "trips": "SELECT COUNT(*) FROM trips",
            "pantry_items": "SELECT COUNT(*) FROM pantry_items",
            "bom_items": "SELECT COUNT(*) FROM bom_items",
            "completion_logs": "SELECT COUNT(*) FROM completion_logs",
            "snooze_rules": "SELECT COUNT(*) FROM snooze_rules",
            "maint_objects": "SELECT COUNT(*) FROM maint_objects",
            "maint_tasks": "SELECT COUNT(*) FROM maint_tasks",
            "maint_events": "SELECT COUNT(*) FROM maint_events",
            "maint_parts": "SELECT COUNT(*) FROM maint_parts",
            "maint_documents": "SELECT COUNT(*) FROM maint_documents",
            "barcode_mappings": "SELECT COUNT(*) FROM barcode_mappings",
            "hoard_sections": "SELECT COUNT(*) FROM hoard_sections",
            "hoard_items": "SELECT COUNT(*) FROM hoard_items",
            "tracked_item_urls": "SELECT COUNT(*) FROM tracked_item_urls",
            "price_history": "SELECT COUNT(*) FROM price_history",
            "hoard_deals": "SELECT COUNT(*) FROM hoard_deals",
        }
        out: dict[str, Any] = {}
        for name, sql in queries.items():
            row = await self._fetchone(sql)
            out[name] = int(row[0]) if row else 0
        rows = await self._fetchall("SELECT status, COUNT(*) FROM tasks GROUP BY status")
        out["tasks_by_status"] = {row[0]: int(row[1]) for row in rows}
        return out

    # ------------------------------------------------------------------
    # Tasks
    # ------------------------------------------------------------------
    async def list_tasks(
        self,
        plan_id: str | None = None,
        *,
        plan_ids: Sequence[str] | None = None,
        statuses: Sequence[str] | None = None,
        source: str | None = None,
        top_level_only: bool = False,
        trip_id: str | None = None,
    ) -> list[dict[str, Any]]:
        clauses: list[str] = []
        params: list[Any] = []
        if plan_id is not None:
            clauses.append("plan_id = ?")
            params.append(plan_id)
        if plan_ids is not None:
            if not plan_ids:
                return []
            clauses.append("plan_id IN (" + _marks(len(plan_ids)) + ")")
            params.extend(plan_ids)
        if statuses:
            clauses.append("status IN (" + _marks(len(statuses)) + ")")
            params.extend(statuses)
        if source is not None:
            clauses.append("source = ?")
            params.append(source)
        if trip_id is not None:
            clauses.append("trip_id = ?")
            params.append(trip_id)
        if top_level_only:
            clauses.append("parent_uid IS NULL")
        sql = "SELECT * FROM tasks"
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY plan_id, position, created_at"
        return [TASKS.decode(row) for row in await self._fetchall(sql, params)]

    async def get_task(self, uid: str) -> dict[str, Any] | None:
        return await self._get(TASKS, uid)

    async def get_tasks(self, uids: Sequence[str]) -> list[dict[str, Any]]:
        if not uids:
            return []
        rows = await self._fetchall(
            "SELECT * FROM tasks WHERE uid IN (" + _marks(len(uids)) + ")", tuple(uids)
        )
        return [TASKS.decode(row) for row in rows]

    async def find_task_by_source(self, source: str, source_ref: str) -> dict[str, Any] | None:
        row = await self._fetchone(
            "SELECT * FROM tasks WHERE source = ? AND source_ref = ? ORDER BY created_at LIMIT 1",
            (source, source_ref),
        )
        return TASKS.decode(row)

    async def find_task_by_external(self, plan_id: str, external_id: str) -> dict[str, Any] | None:
        row = await self._fetchone(
            "SELECT * FROM tasks WHERE plan_id = ? AND external_id = ?", (plan_id, external_id)
        )
        return TASKS.decode(row)

    async def children(self, parent_uid: str) -> list[dict[str, Any]]:
        rows = await self._fetchall(
            "SELECT * FROM tasks WHERE parent_uid = ? ORDER BY position, created_at", (parent_uid,)
        )
        return [TASKS.decode(row) for row in rows]

    async def descendants(self, uid: str) -> list[dict[str, Any]]:
        """Return all descendants of ``uid`` (breadth first, parents before children)."""
        rows = await self._fetchall(
            """
            WITH RECURSIVE tree(uid, depth) AS (
                SELECT uid, 1 FROM tasks WHERE parent_uid = ?
                UNION ALL
                SELECT t.uid, tree.depth + 1 FROM tasks t JOIN tree ON t.parent_uid = tree.uid
            )
            SELECT tasks.* FROM tasks JOIN tree ON tasks.uid = tree.uid ORDER BY tree.depth, tasks.position
            """,
            (uid,),
        )
        return [TASKS.decode(row) for row in rows]

    async def create_task(self, data: dict[str, Any]) -> dict[str, Any]:
        async with self._tx():
            return await self.tx_create_task(data)

    async def tx_create_task(self, data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        record: dict[str, Any] = {column: None for column in TASKS.columns}
        record.update(
            {
                "status": "needs_action",
                "priority": "none",
                "time_of_day_bucket": "anytime",
                "recurrence_mode": "none",
                "context_tags": [],
                "assigned_to": [],
                "shift_aware": False,
                "hide_when_blocked": False,
                "is_repeatable": False,
                "source": "manual",
                "streak": 0,
                "extra": {},
            }
        )
        record.update({k: v for k, v in data.items() if k in TASKS.columns})
        record["uid"] = data.get("uid") or new_id()
        record["created_at"] = data.get("created_at") or now
        record["updated_at"] = data.get("updated_at") or now
        if not record.get("position"):
            if record.get("parent_uid"):
                record["position"] = await self._next_position(TASKS, {"parent_uid": record["parent_uid"]})
            else:
                record["position"] = await self._next_position(TASKS, {"plan_id": record["plan_id"], "parent_uid": None})
        await self._insert(TASKS, record)
        return record

    async def update_task(
        self, uid: str, changes: dict[str, Any], *, touch: bool = True
    ) -> dict[str, Any] | None:
        async with self._tx():
            await self.tx_update_task(uid, changes, touch=touch)
        return await self.get_task(uid)

    async def tx_update_task(self, uid: str, changes: dict[str, Any], *, touch: bool = True) -> None:
        payload = dict(changes)
        if touch:
            payload["updated_at"] = utc_now_iso()
        await self._update(TASKS, uid, payload)

    async def update_tasks(self, updates: dict[str, dict[str, Any]], *, touch: bool = True) -> None:
        """Apply several per-task change sets atomically."""
        if not updates:
            return
        async with self._tx():
            for uid, changes in updates.items():
                await self.tx_update_task(uid, changes, touch=touch)

    async def snapshot_tasks(self, uids: Sequence[str]) -> dict[str, Any]:
        """Collect everything needed to restore ``uids`` (and descendants) after deletion."""
        tasks: dict[str, dict[str, Any]] = {}
        for task in await self.get_tasks(uids):
            tasks[task["uid"]] = task
            for child in await self.descendants(task["uid"]):
                tasks[child["uid"]] = child
        all_uids = list(tasks)
        deps: list[dict[str, Any]] = []
        rules: list[dict[str, Any]] = []
        if all_uids:
            marks = _marks(len(all_uids))
            for row in await self._fetchall(
                "SELECT * FROM task_dependencies WHERE task_uid IN (" + marks + ") OR blocked_by_uid IN (" + marks + ")",
                (*all_uids, *all_uids),
            ):
                deps.append(dict(row))
            for row in await self._fetchall(
                "SELECT * FROM snooze_rules WHERE task_uid IN (" + marks + ")", tuple(all_uids)
            ):
                rules.append(SNOOZE.decode(row))
        return {"tasks": list(tasks.values()), "dependencies": deps, "snooze_rules": rules}

    async def delete_tasks(self, uids: Sequence[str], *, tombstone: bool = True) -> dict[str, Any]:
        """Delete tasks (cascading to subtasks/dependencies/rules) and return an undo snapshot."""
        snapshot = await self.snapshot_tasks(uids)
        async with self._tx():
            await self.tx_delete_tasks(uids, tombstone=tombstone)
        return snapshot

    async def tx_delete_tasks(self, uids: Sequence[str], *, tombstone: bool = True) -> None:
        if not uids:
            return
        marks = _marks(len(uids))
        if not tombstone:
            await self.conn.execute("DELETE FROM tasks WHERE uid IN (" + marks + ")", tuple(uids))
            return
        # Remember Mealie-linked items so the sync engine deletes them remotely too.
        now = utc_now_iso()
        for row in await self._fetchall(
            "WITH RECURSIVE tree(uid) AS ("
            " SELECT uid FROM tasks WHERE uid IN (" + marks + ")"
            " UNION ALL SELECT t.uid FROM tasks t JOIN tree ON t.parent_uid = tree.uid"
            ") SELECT tasks.external_id, tasks.plan_id FROM tasks JOIN tree ON tasks.uid = tree.uid"
            " WHERE tasks.external_id IS NOT NULL",
            tuple(uids),
        ):
            await self.conn.execute(
                "INSERT OR REPLACE INTO sync_tombstones (external_id, plan_id, deleted_at) VALUES (?, ?, ?)",
                (row[0], row[1], now),
            )
        await self.conn.execute("DELETE FROM tasks WHERE uid IN (" + marks + ")", tuple(uids))

    async def restore_snapshot(self, snapshot: dict[str, Any]) -> list[str]:
        """Re-insert a snapshot produced by :meth:`delete_tasks`. Returns restored uids."""
        tasks = list(snapshot.get("tasks") or [])
        known = {task["uid"] for task in tasks}
        restored: list[str] = []
        async with self._tx():
            existing_plans = {row[0] for row in await self._fetchall("SELECT id FROM plans")}
            sections = {row[0] for row in await self._fetchall("SELECT id FROM sections")}
            trips = {row[0] for row in await self._fetchall("SELECT id FROM trips")}
            pending = []
            for task in tasks:
                if task.get("plan_id") not in existing_plans:
                    continue
                if task.get("section_id") and task["section_id"] not in sections:
                    task = {**task, "section_id": None}
                if task.get("trip_id") and task["trip_id"] not in trips:
                    task = {**task, "trip_id": None}
                pending.append(task)
            inserted: set[str] = set()
            # Insert parents before children; give up on orphans after a full pass with no progress.
            while pending:
                progress = False
                remaining = []
                for task in pending:
                    parent = task.get("parent_uid")
                    if parent and parent in known and parent not in inserted:
                        remaining.append(task)
                        continue
                    if parent and parent not in known:
                        exists = await self._fetchone("SELECT 1 FROM tasks WHERE uid = ?", (parent,))
                        if exists is None:
                            task = {**task, "parent_uid": None}
                    if await self._fetchone("SELECT 1 FROM tasks WHERE uid = ?", (task["uid"],)) is None:
                        await self._insert(TASKS, task)
                        restored.append(task["uid"])
                    if task.get("external_id"):
                        await self.conn.execute(
                            "DELETE FROM sync_tombstones WHERE external_id = ?", (task["external_id"],)
                        )
                    inserted.add(task["uid"])
                    progress = True
                pending = remaining
                if not progress:
                    break
            for dep in snapshot.get("dependencies") or []:
                await self.conn.execute(
                    "INSERT OR IGNORE INTO task_dependencies (task_uid, blocked_by_uid, created_at) "
                    "SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM tasks WHERE uid = ?) "
                    "AND EXISTS (SELECT 1 FROM tasks WHERE uid = ?)",
                    (dep["task_uid"], dep["blocked_by_uid"], dep["created_at"], dep["task_uid"], dep["blocked_by_uid"]),
                )
            for rule in snapshot.get("snooze_rules") or []:
                if rule["task_uid"] in inserted:
                    await self.conn.execute("DELETE FROM snooze_rules WHERE id = ?", (rule["id"],))
                    await self._insert(SNOOZE, rule)
        return restored

    async def set_sibling_order(self, ordered_uids: Sequence[str]) -> None:
        async with self._tx():
            for position, uid in enumerate(ordered_uids, start=1):
                await self.conn.execute(
                    "UPDATE tasks SET position = ? WHERE uid = ?", (position, uid)
                )

    async def siblings(self, plan_id: str, parent_uid: str | None) -> list[dict[str, Any]]:
        if parent_uid:
            rows = await self._fetchall(
                "SELECT * FROM tasks WHERE parent_uid = ? ORDER BY position, created_at", (parent_uid,)
            )
        else:
            rows = await self._fetchall(
                "SELECT * FROM tasks WHERE plan_id = ? AND parent_uid IS NULL ORDER BY position, created_at",
                (plan_id,),
            )
        return [TASKS.decode(row) for row in rows]

    async def due_recurring_completed(self, today_iso: str) -> list[dict[str, Any]]:
        rows = await self._fetchall(
            "SELECT * FROM tasks WHERE status = 'completed' AND recurrence_mode != 'none' "
            "AND due_date IS NOT NULL AND due_date <= ?",
            (today_iso,),
        )
        return [TASKS.decode(row) for row in rows]

    async def reminder_candidates(self, today_iso: str) -> list[dict[str, Any]]:
        """Open top-level tasks with a phone reminder whose due date has come and that weren't reminded for it."""
        rows = await self._fetchall(
            "SELECT * FROM tasks WHERE remind_target IS NOT NULL AND parent_uid IS NULL "
            "AND status IN ('needs_action', 'in_process') AND due_date IS NOT NULL AND due_date <= ? "
            "AND (reminded_for IS NULL OR reminded_for != due_date)",
            (today_iso,),
        )
        return [TASKS.decode(row) for row in rows]

    async def overdue_recurring_with_streak(self, today_iso: str) -> list[dict[str, Any]]:
        rows = await self._fetchall(
            "SELECT * FROM tasks WHERE status != 'completed' AND recurrence_mode != 'none' "
            "AND streak > 0 AND due_date IS NOT NULL AND due_date < ?",
            (today_iso,),
        )
        return [TASKS.decode(row) for row in rows]

    async def snoozed_until_before(self, cutoff_iso: str) -> list[dict[str, Any]]:
        rows = await self._fetchall(
            "SELECT * FROM tasks WHERE status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= ?",
            (cutoff_iso,),
        )
        return [TASKS.decode(row) for row in rows]

    async def dependency_blocked_tasks(self) -> list[dict[str, Any]]:
        rows = await self._fetchall(
            "SELECT * FROM tasks WHERE status = 'blocked' AND status_before_block IS NOT NULL"
        )
        return [TASKS.decode(row) for row in rows]

    async def tasks_with_sensor(self) -> list[dict[str, Any]]:
        rows = await self._fetchall("SELECT * FROM tasks WHERE sensor_entity_id IS NOT NULL AND sensor_entity_id != ''")
        return [TASKS.decode(row) for row in rows]

    # ------------------------------------------------------------------
    # Dependencies
    # ------------------------------------------------------------------
    async def list_dependencies(self, plan_ids: Sequence[str] | None = None) -> list[tuple[str, str]]:
        if plan_ids is None:
            rows = await self._fetchall("SELECT task_uid, blocked_by_uid FROM task_dependencies")
        else:
            if not plan_ids:
                return []
            rows = await self._fetchall(
                "SELECT d.task_uid, d.blocked_by_uid FROM task_dependencies d "
                "JOIN tasks t ON t.uid = d.task_uid WHERE t.plan_id IN (" + _marks(len(plan_ids)) + ")",
                tuple(plan_ids),
            )
        return [(row[0], row[1]) for row in rows]

    async def blockers_of(self, uid: str) -> list[str]:
        rows = await self._fetchall("SELECT blocked_by_uid FROM task_dependencies WHERE task_uid = ?", (uid,))
        return [row[0] for row in rows]

    async def dependents_of(self, uid: str) -> list[str]:
        rows = await self._fetchall("SELECT task_uid FROM task_dependencies WHERE blocked_by_uid = ?", (uid,))
        return [row[0] for row in rows]

    async def set_blockers(self, uid: str, blocker_uids: Sequence[str]) -> None:
        async with self._tx():
            await self.tx_set_blockers(uid, blocker_uids)

    async def tx_set_blockers(self, uid: str, blocker_uids: Sequence[str]) -> None:
        now = utc_now_iso()
        await self.conn.execute("DELETE FROM task_dependencies WHERE task_uid = ?", (uid,))
        for blocker in dict.fromkeys(blocker_uids):
            if blocker == uid:
                continue
            await self.conn.execute(
                "INSERT OR IGNORE INTO task_dependencies (task_uid, blocked_by_uid, created_at) VALUES (?, ?, ?)",
                (uid, blocker, now),
            )

    async def add_dependency(self, uid: str, blocker_uid: str) -> None:
        async with self._tx():
            await self.conn.execute(
                "INSERT OR IGNORE INTO task_dependencies (task_uid, blocked_by_uid, created_at) VALUES (?, ?, ?)",
                (uid, blocker_uid, utc_now_iso()),
            )

    async def remove_dependency(self, uid: str, blocker_uid: str) -> None:
        async with self._tx():
            await self.conn.execute(
                "DELETE FROM task_dependencies WHERE task_uid = ? AND blocked_by_uid = ?", (uid, blocker_uid)
            )

    # ------------------------------------------------------------------
    # Completion log
    # ------------------------------------------------------------------
    async def tx_log_completion(
        self,
        task: dict[str, Any],
        *,
        person_entity_id: str | None,
        user_id: str | None,
        user_name: str | None,
        completed_at: str,
    ) -> int:
        cursor = await self.conn.execute(
            "INSERT INTO completion_logs (task_uid, plan_id, summary, person_entity_id, user_id, user_name, completed_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (task["uid"], task["plan_id"], task["summary"], person_entity_id, user_id, user_name, completed_at),
        )
        return int(cursor.lastrowid)

    async def tx_delete_log(self, log_id: int) -> None:
        await self.conn.execute("DELETE FROM completion_logs WHERE id = ?", (log_id,))

    async def last_completions(self, uids: Sequence[str] | None = None) -> dict[str, dict[str, Any]]:
        """Return the latest completion log row per task."""
        sql = (
            "SELECT task_uid, person_entity_id, user_name, MAX(completed_at) AS completed_at "
            "FROM completion_logs"
        )
        params: tuple[Any, ...] = ()
        if uids is not None:
            if not uids:
                return {}
            sql += " WHERE task_uid IN (" + _marks(len(uids)) + ")"
            params = tuple(uids)
        sql += " GROUP BY task_uid"
        return {row["task_uid"]: dict(row) for row in await self._fetchall(sql, params)}

    async def completion_history(self, uid: str, limit: int = 20) -> list[dict[str, Any]]:
        rows = await self._fetchall(
            "SELECT * FROM completion_logs WHERE task_uid = ? ORDER BY completed_at DESC LIMIT ?", (uid, limit)
        )
        return [dict(row) for row in rows]

    async def completion_counts_since(self, since_iso: str) -> dict[str, int]:
        rows = await self._fetchall(
            "SELECT person_entity_id, COUNT(*) FROM completion_logs WHERE completed_at >= ? "
            "AND person_entity_id IS NOT NULL GROUP BY person_entity_id",
            (since_iso,),
        )
        return {row[0]: int(row[1]) for row in rows}

    # ------------------------------------------------------------------
    # Pantry
    # ------------------------------------------------------------------
    async def list_pantry(self, plan_id: str | None = None) -> list[dict[str, Any]]:
        if plan_id:
            rows = await self._fetchall(
                "SELECT * FROM pantry_items WHERE plan_id = ? ORDER BY position, name", (plan_id,)
            )
        else:
            rows = await self._fetchall("SELECT * FROM pantry_items ORDER BY plan_id, position, name")
        return [PANTRY.decode(row) for row in rows]

    async def get_pantry_item(self, item_id: str) -> dict[str, Any] | None:
        return await self._get(PANTRY, item_id)

    async def save_pantry_item(self, data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        async with self._tx():
            if data.get("id") and await self._get(PANTRY, data["id"]) is not None:
                await self._update(PANTRY, data["id"], {**data, "updated_at": now})
                item_id = data["id"]
            else:
                record = {
                    "stock_state": "in_stock",
                    "low_action": "ask",
                    "ingredients": [],
                    "is_batch": False,
                    **data,
                    "id": data.get("id") or new_id(),
                    "created_at": now,
                    "updated_at": now,
                }
                if not record.get("position"):
                    record["position"] = await self._next_position(PANTRY, {"plan_id": record["plan_id"]})
                await self._insert(PANTRY, record)
                item_id = record["id"]
        item = await self.get_pantry_item(item_id)
        assert item is not None
        return item

    async def delete_pantry_item(self, item_id: str) -> dict[str, Any] | None:
        item = await self.get_pantry_item(item_id)
        async with self._tx():
            await self.conn.execute("DELETE FROM pantry_items WHERE id = ?", (item_id,))
        return item

    async def restore_pantry_item(self, item: dict[str, Any]) -> None:
        async with self._tx():
            if await self._get(PANTRY, item["id"]) is None:
                await self._insert(PANTRY, item)

    # ------------------------------------------------------------------
    # Bill of materials
    # ------------------------------------------------------------------
    async def list_bom(self, plan_id: str | None = None) -> list[dict[str, Any]]:
        if plan_id:
            rows = await self._fetchall("SELECT * FROM bom_items WHERE plan_id = ? ORDER BY position", (plan_id,))
        else:
            rows = await self._fetchall("SELECT * FROM bom_items ORDER BY plan_id, position")
        return [BOM.decode(row) for row in rows]

    async def get_bom_item(self, item_id: str) -> dict[str, Any] | None:
        return await self._get(BOM, item_id)

    async def save_bom_item(self, data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        async with self._tx():
            if data.get("id") and await self._get(BOM, data["id"]) is not None:
                await self._update(BOM, data["id"], {**data, "updated_at": now})
                item_id = data["id"]
            else:
                record = {
                    "category": "Hardware",
                    "acquired": False,
                    **data,
                    "id": data.get("id") or new_id(),
                    "created_at": now,
                    "updated_at": now,
                }
                if not record.get("position"):
                    record["position"] = await self._next_position(BOM, {"plan_id": record["plan_id"]})
                await self._insert(BOM, record)
                item_id = record["id"]
        item = await self.get_bom_item(item_id)
        assert item is not None
        return item

    async def set_bom_acquired_for_task(self, task_uid: str, acquired: bool) -> list[str]:
        """Mark BOM items pushed as ``task_uid`` acquired/not acquired; returns their plan ids."""
        rows = await self._fetchall("SELECT plan_id FROM bom_items WHERE pushed_task_uid = ?", (task_uid,))
        if not rows:
            return []
        async with self._tx():
            await self.conn.execute(
                "UPDATE bom_items SET acquired = ?, updated_at = ? WHERE pushed_task_uid = ?",
                (1 if acquired else 0, utc_now_iso(), task_uid),
            )
        return sorted({row[0] for row in rows})

    async def delete_bom_item(self, item_id: str) -> None:
        async with self._tx():
            await self.conn.execute("DELETE FROM bom_items WHERE id = ?", (item_id,))

    # ------------------------------------------------------------------
    # Snooze rules
    # ------------------------------------------------------------------
    async def list_snooze_rules(self) -> list[dict[str, Any]]:
        return [SNOOZE.decode(row) for row in await self._fetchall("SELECT * FROM snooze_rules ORDER BY armed_at")]

    async def tx_replace_snooze_rule(self, rule: dict[str, Any]) -> None:
        await self.conn.execute("DELETE FROM snooze_rules WHERE task_uid = ?", (rule["task_uid"],))
        await self._insert(SNOOZE, rule)

    async def tx_delete_snooze_rules(self, task_uid: str) -> None:
        await self.conn.execute("DELETE FROM snooze_rules WHERE task_uid = ?", (task_uid,))

    # ------------------------------------------------------------------
    # Item history (frequently bought)
    # ------------------------------------------------------------------
    async def tx_bump_item_history(self, plan_id: str, name_key: str, display_name: str, category: str | None) -> None:
        await self.conn.execute(
            """
            INSERT INTO item_history (plan_id, name_key, display_name, category, times_added, last_added_at)
            VALUES (?, ?, ?, ?, 1, ?)
            ON CONFLICT(plan_id, name_key) DO UPDATE SET
                display_name = excluded.display_name,
                category = COALESCE(excluded.category, item_history.category),
                times_added = item_history.times_added + 1,
                last_added_at = excluded.last_added_at
            """,
            (plan_id, name_key, display_name, category, utc_now_iso()),
        )

    async def set_history_category(self, plan_id: str, name_key: str, category: str) -> None:
        async with self._tx():
            await self.conn.execute(
                "UPDATE item_history SET category = ? WHERE plan_id = ? AND name_key = ?",
                (category, plan_id, name_key),
            )

    async def history_category(self, name_key: str, plan_id: str | None = None) -> str | None:
        if plan_id:
            row = await self._fetchone(
                "SELECT category FROM item_history WHERE plan_id = ? AND name_key = ? AND category IS NOT NULL",
                (plan_id, name_key),
            )
            if row is not None:
                return row[0]
        row = await self._fetchone(
            "SELECT category FROM item_history WHERE name_key = ? AND category IS NOT NULL "
            "ORDER BY times_added DESC LIMIT 1",
            (name_key,),
        )
        return row[0] if row else None

    async def item_history(self, plan_id: str, limit: int = 40) -> list[dict[str, Any]]:
        rows = await self._fetchall(
            "SELECT * FROM item_history WHERE plan_id = ? ORDER BY times_added DESC, last_added_at DESC LIMIT ?",
            (plan_id, limit),
        )
        return [dict(row) for row in rows]

    async def delete_history_item(self, plan_id: str, name_key: str) -> None:
        async with self._tx():
            await self.conn.execute(
                "DELETE FROM item_history WHERE plan_id = ? AND name_key = ?", (plan_id, name_key)
            )

    # ------------------------------------------------------------------
    # Sync tombstones
    # ------------------------------------------------------------------
    async def tombstones(self, plan_id: str) -> list[str]:
        rows = await self._fetchall("SELECT external_id FROM sync_tombstones WHERE plan_id = ?", (plan_id,))
        return [row[0] for row in rows]

    async def clear_tombstone(self, external_id: str) -> None:
        async with self._tx():
            await self.conn.execute("DELETE FROM sync_tombstones WHERE external_id = ?", (external_id,))

    # ------------------------------------------------------------------
    # Barcode mappings
    # ------------------------------------------------------------------
    async def get_barcode(self, barcode: str) -> dict[str, Any] | None:
        return await self._get(BARCODES, barcode)

    async def save_barcode(self, data: dict[str, Any]) -> dict[str, Any]:
        """Insert or replace the mapping for ``data["barcode"]`` (keeps its scan statistics)."""
        now = utc_now_iso()
        async with self._tx():
            existing = await self._get(BARCODES, data["barcode"])
            if existing is None:
                await self._insert(BARCODES, {"scan_count": 0, **data, "created_at": now, "updated_at": now})
            else:
                await self._update(BARCODES, data["barcode"], {**data, "updated_at": now})
        row = await self._get(BARCODES, data["barcode"])
        assert row is not None
        return row

    async def delete_barcode(self, barcode: str) -> None:
        async with self._tx():
            await self.conn.execute("DELETE FROM barcode_mappings WHERE barcode = ?", (barcode,))

    async def barcodes_for(self, target_type: str, target_ids: Sequence[str]) -> list[dict[str, Any]]:
        if not target_ids:
            return []
        rows = await self._fetchall(
            "SELECT * FROM barcode_mappings WHERE target_type = ? AND target_id IN (" + _marks(len(target_ids)) + ") "
            "ORDER BY created_at",
            (target_type, *target_ids),
        )
        return [BARCODES.decode(row) for row in rows]

    async def count_barcode_scan(self, barcode: str) -> None:
        async with self._tx():
            await self.conn.execute(
                "UPDATE barcode_mappings SET scan_count = scan_count + 1, last_scanned_at = ? WHERE barcode = ?",
                (utc_now_iso(), barcode),
            )

    # ------------------------------------------------------------------
    # Wishlist, gift & price tracker ("Hoard", see hoard.py)
    # ------------------------------------------------------------------
    async def hoard_urls_for(self, item_ids: Sequence[str]) -> list[dict[str, Any]]:
        if not item_ids:
            return []
        rows = await self._fetchall(
            "SELECT * FROM tracked_item_urls WHERE item_id IN (" + _marks(len(item_ids)) + ") ORDER BY created_at",
            tuple(item_ids),
        )
        return [HURLS.decode(row) for row in rows]

    async def hoard_deals_for(self, item_ids: Sequence[str]) -> list[dict[str, Any]]:
        if not item_ids:
            return []
        rows = await self._fetchall(
            "SELECT * FROM hoard_deals WHERE dismissed = 0 AND item_id IN (" + _marks(len(item_ids)) + ") "
            "ORDER BY found_at DESC",
            tuple(item_ids),
        )
        return [HDEALS.decode(row) for row in rows]

    async def price_points(self, item_ids: Sequence[str], since: str | None = None) -> list[dict[str, Any]]:
        """Price checks for ``item_ids`` (oldest first), optionally only those at or after ``since``."""
        if not item_ids:
            return []
        sql = "SELECT * FROM price_history WHERE item_id IN (" + _marks(len(item_ids)) + ")"
        params: list[Any] = list(item_ids)
        if since:
            sql += " AND checked_at >= ?"
            params.append(since)
        sql += " ORDER BY checked_at, id"
        return [HPRICES.decode(row) for row in await self._fetchall(sql, params)]

    async def lowest_online_price(self, item_id: str, *, before: str | None = None) -> float | None:
        sql = "SELECT MIN(price) FROM price_history WHERE item_id = ? AND source = 'online'"
        params: list[Any] = [item_id]
        if before:
            sql += " AND checked_at < ?"
            params.append(before)
        row = await self._fetchone(sql, params)
        return float(row[0]) if row and row[0] is not None else None

    async def add_price_points(self, points: Sequence[dict[str, Any]]) -> None:
        """Append price observations (the table numbers its own rows)."""
        if not points:
            return
        columns = [c for c in HPRICES.columns if c != "id"]
        sql = "INSERT INTO price_history (" + ", ".join(_ident(c) for c in columns) + ") VALUES (" + _marks(len(columns)) + ")"
        async with self._tx():
            for point in points:
                encoded = HPRICES.encode({**point, "checked_at": point.get("checked_at") or utc_now_iso()})
                await self.conn.execute(sql, tuple(encoded.get(c) for c in columns))

    async def prune_price_history(self, before: str) -> int:
        async with self._tx():
            before_count = self.conn.total_changes
            await self.conn.execute("DELETE FROM price_history WHERE checked_at < ?", (before,))
            return self.conn.total_changes - before_count

    async def save_deals(self, item_id: str, deals: Sequence[dict[str, Any]], keep: int) -> int:
        """Store newly found deals (already-known links are left alone); keep the newest ``keep``."""
        added = 0
        async with self._tx():
            for deal in deals:
                before = self.conn.total_changes
                encoded = HDEALS.encode({**deal, "id": new_id(), "item_id": item_id, "found_at": deal.get("found_at") or utc_now_iso(), "dismissed": False})
                await self.conn.execute(
                    "INSERT OR IGNORE INTO hoard_deals (" + ", ".join(_ident(c) for c in encoded) + ") VALUES (" + _marks(len(encoded)) + ")",
                    tuple(encoded.values()),
                )
                added += self.conn.total_changes - before
            await self.conn.execute(
                "DELETE FROM hoard_deals WHERE item_id = ? AND dismissed = 0 AND id NOT IN "
                "(SELECT id FROM hoard_deals WHERE item_id = ? AND dismissed = 0 ORDER BY found_at DESC, posted_at DESC LIMIT ?)",
                (item_id, item_id, int(keep)),
            )
        return added

    async def hoard_items_with_barcode(self, barcode: str) -> list[dict[str, Any]]:
        rows = await self._fetchall("SELECT * FROM hoard_items WHERE barcode = ? ORDER BY updated_at DESC", (barcode,))
        return [HITEMS.decode(row) for row in rows]

    async def hoard_snapshot(self, item_id: str) -> dict[str, list[dict[str, Any]]]:
        """Everything that belongs to one item, as raw rows (for undo after a delete)."""
        out: dict[str, list[dict[str, Any]]] = {}
        for table, column in ((HITEMS, "id"), (HURLS, "item_id"), (HDEALS, "item_id")):
            rows = await self._fetchall("SELECT * FROM " + _ident(table.name) + " WHERE " + _ident(column) + " = ?", (item_id,))
            out[table.name] = [dict(row) for row in rows]
        rows = await self._fetchall("SELECT * FROM price_history WHERE item_id = ?", (item_id,))
        out["price_history"] = [dict(row) for row in rows]
        return out

    async def restore_hoard_snapshot(self, snapshot: Mapping[str, Sequence[Mapping[str, Any]]]) -> None:
        """Put a :meth:`hoard_snapshot` back (rows that exist again are skipped)."""
        async with self._tx():
            for table in (HITEMS, HURLS, HDEALS, HPRICES):
                for record in snapshot.get(table.name) or []:
                    columns = [c for c in table.columns if c in record]
                    await self.conn.execute(
                        "INSERT OR IGNORE INTO " + _ident(table.name) + " (" + ", ".join(_ident(c) for c in columns) + ") VALUES (" + _marks(len(columns)) + ")",
                        tuple(record[c] for c in columns),
                    )

    # ------------------------------------------------------------------
    # Portable backups (see backup_manager.py)
    # ------------------------------------------------------------------
    async def _live_schema(self) -> dict[str, dict[str, Any]]:
        """Every table in the open database with its columns, primary key and parents."""
        schema: dict[str, dict[str, Any]] = {}
        for (name,) in await self._fetchall(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ):
            if not _LIVE_IDENT_RE.match(name):
                continue
            info = await self._fetchall("SELECT name, type, pk FROM pragma_table_info(?)", (name,))
            columns = [row[0] for row in info if _LIVE_IDENT_RE.match(row[0])]
            pk = [row[0] for row in sorted((r for r in info if r[2]), key=lambda r: r[2])]
            parents = {row[0] for row in await self._fetchall('SELECT "table" FROM pragma_foreign_key_list(?)', (name,))}
            schema[name] = {
                "columns": columns,
                "primary_key": pk,
                # A lone INTEGER PRIMARY KEY is the rowid: another database's numbers mean nothing here.
                "rowid_key": len(pk) == 1 and any(r[0] == pk[0] and str(r[1]).upper() == "INTEGER" for r in info),
                "parents": sorted(parents - {name}),
            }
        return schema

    @staticmethod
    def _table_order(schema: Mapping[str, Mapping[str, Any]]) -> list[str]:
        """Tables with every parent before its children (a cycle falls back to name order)."""
        order: list[str] = []
        pending = sorted(schema)
        while pending:
            ready = [t for t in pending if all(p in order or p not in schema for p in schema[t]["parents"])]
            if not ready:
                ready = pending[:1]
            for table in ready:
                order.append(table)
                pending.remove(table)
        return order

    async def _dump_unlocked(self) -> dict[str, Any]:
        schema = await self._live_schema()
        meta = {table.name: table for table in _TABLES}
        tables: dict[str, Any] = {}
        for name in self._table_order(schema):
            info = schema[name]
            rows = [
                {key: _portable_value(row[key]) for key in row.keys()}
                for row in await self._fetchall("SELECT * FROM " + _live_ident(name, schema) + " ORDER BY rowid")
            ]
            known = meta.get(name)
            tables[name] = {
                "primary_key": info["primary_key"],
                "columns": info["columns"],
                "json_columns": sorted(known.json_fields) if known else [],
                "bool_columns": sorted(known.bool_fields) if known else [],
                "row_count": len(rows),
                "rows": rows,
            }
        return {"db_schema_version": await self.schema_version(), "tables": tables}

    async def export_portable(self, copy_path: str | None = None) -> dict[str, Any]:
        """A JSON-ready dump of every table, plus (optionally) a hot SQLite copy taken at the same moment.

        Writers hold the same lock, so the dump and the copy always agree.
        """
        assert self._lock is not None
        async with self._lock:
            dump = await self._dump_unlocked()
            if copy_path:
                target = await asyncio.to_thread(sqlite3.connect, copy_path, check_same_thread=False)
                try:
                    await self.conn.backup(target)
                finally:
                    await asyncio.to_thread(target.close)
        return dump

    async def restore_portable(self, tables: Mapping[str, Any], *, mode: str) -> dict[str, Any]:
        """Load dumped tables: ``replace`` empties every table first, ``merge`` only adds missing rows.

        Table and column names are checked against the live schema; anything
        unknown is skipped with a warning. Rows that would break a foreign key
        (a task whose plan is missing) are dropped. Runs as one transaction.
        """
        if mode not in ("replace", "merge"):
            raise ValueError("Unknown restore mode")
        schema = await self._live_schema()
        warnings: list[str] = []
        prepared: dict[str, tuple[list[str], list[tuple[Any, ...]]]] = {}
        for name, data in tables.items():
            if name not in schema:
                warnings.append("Skipped unknown table " + str(name)[:64])
                continue
            if not isinstance(data, Mapping) or not isinstance(data.get("rows"), list):
                raise ValueError("Table " + name + " has no rows list")
            live_columns = schema[name]["columns"]
            seen: set[str] = set()
            for row in data["rows"]:
                if not isinstance(row, Mapping):
                    raise ValueError("A row in " + name + " is not an object")
                seen.update(row)
            unknown = sorted(str(c)[:64] for c in seen if c not in live_columns)
            if unknown:
                warnings.append("Ignored columns " + ", ".join(unknown[:10]) + " in " + name)
            columns = [c for c in live_columns if c in seen]
            if columns:
                prepared[name] = (columns, [tuple(_sqlite_value(row.get(c), name, c) for c in columns) for row in data["rows"]])
        order = self._table_order(schema)
        report: dict[str, dict[str, int]] = {}

        def entry(name: str) -> dict[str, int]:
            return report.setdefault(name, {"inserted": 0, "skipped": 0, "deleted": 0, "removed": 0})

        assert self._lock is not None
        async with self._lock:
            await self.conn.execute("PRAGMA foreign_keys = OFF")
            try:
                await self.conn.execute("BEGIN IMMEDIATE")
                try:
                    if mode == "replace":
                        for name in reversed(order):
                            before = self.conn.total_changes
                            await self.conn.execute("DELETE FROM " + _live_ident(name, schema))
                            entry(name)["deleted"] = self.conn.total_changes - before
                    for name in order:
                        if name not in prepared:
                            continue
                        columns, values = prepared[name]
                        inserted = await self._restore_rows(name, schema, columns, values, merge=mode == "merge")
                        entry(name)["inserted"] += inserted
                        entry(name)["skipped"] += len(values) - inserted
                    for _ in range(10):  # removing an orphan can orphan its own children
                        broken = await self._fetchall("PRAGMA foreign_key_check")
                        if not broken:
                            break
                        for table, rowid, _parent, _fk in broken:
                            if table in schema and rowid is not None:
                                await self.conn.execute("DELETE FROM " + _live_ident(table, schema) + " WHERE rowid = ?", (rowid,))
                                entry(table)["removed"] += 1
                except BaseException:
                    await self.conn.execute("ROLLBACK")
                    raise
                await self.conn.execute("COMMIT")
            finally:
                await self.conn.execute("PRAGMA foreign_keys = ON")
        return {"tables": report, "warnings": warnings}

    async def _restore_rows(
        self, name: str, schema: Mapping[str, Mapping[str, Any]], columns: list[str], values: list[tuple[Any, ...]], *, merge: bool
    ) -> int:
        table = _live_ident(name, schema)
        info = schema[name]
        if merge and info["rowid_key"] and info["primary_key"][0] in columns:
            # Merging a log table: match rows on their content and let SQLite number the new ones.
            key = columns.index(info["primary_key"][0])
            rest = [c for i, c in enumerate(columns) if i != key]
            match_sql = "SELECT 1 FROM " + table + " WHERE " + " AND ".join(_live_ident(c, schema, name) + " IS ?" for c in rest) + " LIMIT 1"
            insert_sql = "INSERT INTO " + table + " (" + ", ".join(_live_ident(c, schema, name) for c in rest) + ") VALUES (" + _marks(len(rest)) + ")"
            inserted = 0
            for row in values:
                content = tuple(v for i, v in enumerate(row) if i != key)
                if await self._fetchone(match_sql, content) is not None:
                    continue
                await self.conn.execute(insert_sql, content)
                inserted += 1
            return inserted
        sql = "INSERT OR IGNORE INTO " + table + " (" + ", ".join(_live_ident(c, schema, name) for c in columns) + ") VALUES (" + _marks(len(columns)) + ")"
        before = self.conn.total_changes
        await self.conn.executemany(sql, values)
        return self.conn.total_changes - before


_LIVE_IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")


def _live_ident(name: str, schema: Mapping[str, Mapping[str, Any]], table: str | None = None) -> str:
    """Quote a table (or, with ``table``, a column) name that exists in the live schema; refuse anything else."""
    known = schema.get(table, {}).get("columns", ()) if table else schema
    if not isinstance(name, str) or not _LIVE_IDENT_RE.match(name) or name not in known:
        raise ValueError("Refusing unknown SQL identifier " + repr(name)[:80])
    return '"' + name + '"'


def _portable_value(value: Any) -> Any:
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"$base64": base64.b64encode(bytes(value)).decode("ascii")}
    return value


def _sqlite_value(value: Any, table: str, column: str) -> Any:
    """A dumped JSON value back to something SQLite stores (scalars, or base64 blobs)."""
    if isinstance(value, bool):
        return 1 if value else 0
    if value is None or isinstance(value, (str, int, float)):
        return value
    if isinstance(value, Mapping) and set(value) == {"$base64"} and isinstance(value["$base64"], str):
        try:
            return base64.b64decode(value["$base64"], validate=True)
        except (ValueError, TypeError) as err:
            raise ValueError("Bad binary value in " + table + "." + column) from err
    raise ValueError("Unsupported value in " + table + "." + column)


def _split_sql(script: str) -> list[str]:
    """Split a schema script into individual statements."""
    return [statement.strip() for statement in script.split(";") if statement.strip()]
