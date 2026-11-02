"""Constants for TaskDragon.

This module must stay free of Home Assistant imports so the pure-logic modules
(units, dependencies, recurrence, shift balancing, brain dump parsing, database)
can be unit tested without a Home Assistant installation.
"""

from __future__ import annotations

DOMAIN = "taskdragon"
VERSION = "1.5.0"

DB_FILENAME = "taskdragon.db"

# Frontend
FRONTEND_URL_BASE = "/taskdragon_static"
CARD_FILENAME = "taskdragon-card.js"
CARD_URL = f"{FRONTEND_URL_BASE}/{CARD_FILENAME}"
PANEL_URL_PATH = "taskdragon"
PANEL_ELEMENT = "taskdragon-panel"
PANEL_TITLE = "TaskDragon"
PANEL_ICON = "taskdragon:dragon"  # icon set registered by the card bundle

# Bus events (for automations) and dispatcher signals (internal)
EVENT_UPDATED = "taskdragon_updated"
EVENT_TASK_COMPLETED = "taskdragon_task_completed"
EVENT_TASK_UNSNOOZED = "taskdragon_task_unsnoozed"
EVENT_PANTRY_LOW = "taskdragon_pantry_low"
EVENT_BARCODE_ACTION = "taskdragon_barcode_action"
EVENT_PRICE_ALERT = "taskdragon_price_alert"
SIGNAL_UPDATED = "taskdragon_updated_signal"
SIGNAL_PLAN_ADDED = "taskdragon_plan_added"
SIGNAL_PLAN_REMOVED = "taskdragon_plan_removed"

# ---------------------------------------------------------------------------
# Config entry options
# ---------------------------------------------------------------------------
CONF_PEOPLE = "people"
CONF_PERSON_ENTITY = "entity_id"
CONF_WORK_CALENDAR = "calendar"
CONF_SHIFT_KEYWORDS = "keywords"
CONF_WEATHER_ENTITY = "weather_entity"
CONF_CONVERSATION_AGENT = "conversation_agent"
# Mealie connection settings live in ConfigEntry.data, never in options.
CONF_MEALIE_URL = "mealie_url"
CONF_MEALIE_TOKEN = "mealie_api_token"
CONF_MEALIE_VERIFY_SSL = "mealie_verify_ssl"
LEGACY_CONF_MEALIE_TOKEN = "mealie_token"  # 1.0.x kept the token in options under this key
MEALIE_DATA_KEYS = (CONF_MEALIE_URL, CONF_MEALIE_TOKEN, CONF_MEALIE_VERIFY_SSL)
CONF_MEALIE_SYNC_MINUTES = "mealie_sync_minutes"
CONF_MEALIE_LOOKAHEAD_DAYS = "mealie_lookahead_days"
CONF_SHIFT_CHECK_TIME = "shift_check_time"
CONF_ROLLOVER_HOUR = "rollover_hour"
CONF_WEEKEND_CHECK_TIME = "weekend_check_time"
CONF_BREAKFAST_TIME = "breakfast_time"
CONF_LUNCH_TIME = "lunch_time"
CONF_DINNER_TIME = "dinner_time"
CONF_ENABLE_LEFTOVERS = "enable_leftovers"
CONF_LEFTOVER_TIME = "leftover_time"
CONF_LEFTOVER_DAYS = "leftover_days"
CONF_CREATE_COOK_TASKS = "create_cook_tasks"
CONF_PREP_RULES = "prep_rules"
CONF_SHOW_PANEL = "show_panel"

DEFAULT_SHIFT_KEYWORDS = "Shift, Work, PRN"
DEFAULT_SHIFT_CHECK_TIME = "05:00:00"
DEFAULT_ROLLOVER_HOUR = 0
DEFAULT_WEEKEND_CHECK_TIME = "07:00:00"
DEFAULT_BREAKFAST_TIME = "08:00:00"
DEFAULT_LUNCH_TIME = "12:00:00"
DEFAULT_DINNER_TIME = "18:00:00"
DEFAULT_LEFTOVER_TIME = "20:00:00"
DEFAULT_LEFTOVER_DAYS = 3
DEFAULT_MEALIE_SYNC_MINUTES = 15
DEFAULT_MEALIE_LOOKAHEAD_DAYS = 3
DEFAULT_PREP_RULES = (
    "thaw-36h => 36 | Move {meat} from freezer to fridge to thaw for {recipe}\n"
    "brine-24h => 24 | Start the brine for {recipe}\n"
    "marinate-12h => 12 | Start marinating {meat} for {recipe}\n"
    "smoker-4h => 4 | Prep rub and fire up smoker for {recipe}"
)

# ---------------------------------------------------------------------------
# Domain vocabulary
# ---------------------------------------------------------------------------
STATUS_NEEDS_ACTION = "needs_action"
STATUS_IN_PROCESS = "in_process"
STATUS_COMPLETED = "completed"
STATUS_SNOOZED = "snoozed"
STATUS_BLOCKED = "blocked"
STATUSES = (
    STATUS_NEEDS_ACTION,
    STATUS_IN_PROCESS,
    STATUS_COMPLETED,
    STATUS_SNOOZED,
    STATUS_BLOCKED,
)
OPEN_STATUSES = (STATUS_NEEDS_ACTION, STATUS_IN_PROCESS)

PRIORITIES = ("none", "low", "medium", "high", "urgent")
PRIORITY_RANK = {name: index for index, name in enumerate(PRIORITIES)}

BUCKET_ANYTIME = "anytime"
BUCKETS = (BUCKET_ANYTIME, "morning", "afternoon", "evening")

RECURRENCE_NONE = "none"
RECURRENCE_CALENDAR = "calendar"
RECURRENCE_ROLLING = "rolling"
RECURRENCE_MODES = (RECURRENCE_NONE, RECURRENCE_CALENDAR, RECURRENCE_ROLLING)

SENSOR_MODE_DELTA = "delta"
SENSOR_MODE_BINARY = "binary"
SENSOR_MODES = (SENSOR_MODE_DELTA, SENSOR_MODE_BINARY)

ESTIMATE_CHOICES = (5, 15, 30, 60)

CONTEXT_TAGS = ("Indoor", "Garage/Yard", "Computer", "Errand")

ARCHETYPE_QUICK = "quick_list"
ARCHETYPE_DAILY = "daily_chores"
ARCHETYPE_SHOPPING = "shopping_errands"
ARCHETYPE_PROJECTS = "projects_diy"
ARCHETYPE_MAINTENANCE = "home_maintenance"
ARCHETYPE_PACKING = "packing_trips"
ARCHETYPE_PANTRY = "pantry_spices"
ARCHETYPE_HOARD = "wishlist_hoard"
ARCHETYPES = (
    ARCHETYPE_QUICK,
    ARCHETYPE_DAILY,
    ARCHETYPE_SHOPPING,
    ARCHETYPE_PROJECTS,
    ARCHETYPE_MAINTENANCE,
    ARCHETYPE_PACKING,
    ARCHETYPE_PANTRY,
    ARCHETYPE_HOARD,
)
# Archetypes whose items are "tasks" (as opposed to shopping/pantry/packing items)
ACTIONABLE_ARCHETYPES = (ARCHETYPE_QUICK, ARCHETYPE_DAILY, ARCHETYPE_PROJECTS, ARCHETYPE_MAINTENANCE)

TRIP_UPCOMING = "upcoming"
TRIP_ACTIVE = "active"
TRIP_ARCHIVED = "archived"
TRIP_STATUSES = (TRIP_UPCOMING, TRIP_ACTIVE, TRIP_ARCHIVED)
PACKING_GROUPS = ("Clothes", "Toiletries", "Tech", "Kids Gear", "Documents", "Food & Snacks", "Gear")

DEFAULT_QUICK_SECTIONS = ("Calls to Make", "House Stuff", "Weekend", "Quick Ideas")

KANBAN_BACKLOG = "backlog"
KANBAN_READY = "ready"
KANBAN_IN_PROGRESS = "in_progress"
KANBAN_DONE = "done"
KANBAN_COLUMNS = (KANBAN_BACKLOG, KANBAN_READY, KANBAN_IN_PROGRESS, KANBAN_DONE)

AISLE_PRODUCE = "Produce"
AISLE_MEAT = "Meat"
AISLE_DAIRY = "Dairy"
AISLE_PANTRY = "Spices/Pantry"
AISLE_HARDWARE = "Hardware"
AISLE_OTHER = "Other"
AISLES = (AISLE_PRODUCE, AISLE_MEAT, AISLE_DAIRY, AISLE_PANTRY, AISLE_HARDWARE, AISLE_OTHER)

STOCK_IN = "in_stock"
STOCK_LOW = "low"
STOCK_OUT = "out"
STOCK_STATES = (STOCK_IN, STOCK_LOW, STOCK_OUT)

LOW_ACTION_SHOPPING = "shopping"
LOW_ACTION_BATCH = "batch_task"
LOW_ACTION_ASK = "ask"
LOW_ACTION_NONE = "none"
LOW_ACTIONS = (LOW_ACTION_SHOPPING, LOW_ACTION_BATCH, LOW_ACTION_ASK, LOW_ACTION_NONE)

SNOOZE_TIME = "time"
SNOOZE_PERSON_HOME = "person_home"
SNOOZE_ALL_HOME = "all_home"
SNOOZE_WEEKEND_DRY = "weekend_dry"
SNOOZE_ENTITY_STATE = "entity_state"
SNOOZE_RULE_TYPES = (
    SNOOZE_TIME,
    SNOOZE_PERSON_HOME,
    SNOOZE_ALL_HOME,
    SNOOZE_WEEKEND_DRY,
    SNOOZE_ENTITY_STATE,
)
WET_WEATHER_CONDITIONS = ("rainy", "pouring", "lightning-rainy", "snowy", "snowy-rainy", "hail")

# Task "source" values for generated tasks
SOURCE_MANUAL = "manual"
SOURCE_MEALIE_PREP = "mealie_prep"
SOURCE_MEALIE_COOK = "mealie_cook"
SOURCE_LEFTOVER = "leftover"
SOURCE_PANTRY = "pantry"
SOURCE_BOM = "bom"
SOURCE_MEALIE_SHOPPING = "mealie_shopping"
SOURCE_BRAIN_DUMP = "brain_dump"

# Plan roles used for routing (stored in plan settings["role"])
ROLE_GROCERIES = "groceries"
ROLE_HARDWARE = "hardware"
ROLE_CHORES = "chores"
ROLE_QUICK = "quick"
SHARED_ROLES = (ROLE_GROCERIES, ROLE_HARDWARE, ROLE_CHORES, ROLE_QUICK)

POOL = "pool"

# ---------------------------------------------------------------------------
# Input limits and formats (validated server-side; the card is never trusted)
# ---------------------------------------------------------------------------
MAX_NAME = 120
MAX_SUMMARY = 500
MAX_TEXT = 20000
MAX_LIST = 500
ICON_PATTERN = r"^mdi:[a-z0-9]+(?:-[a-z0-9]+)*$"
COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"
SLUG_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$"
LINK_SCHEMES = ("http", "https")

# Per-user card preferences (stored server-side so they follow the user)
PREF_HIDDEN_TABS = "hidden_tabs"
PREF_TAB_ORDER = "tab_order"
PREF_COLLAPSED = "collapsed"
PREF_KEYS = (PREF_HIDDEN_TABS, PREF_TAB_ORDER, PREF_COLLAPSED)  # lists of strings

UNDO_TTL_SECONDS = 600
MEALIE_TIMEOUT_SECONDS = 10
PREF_MAINT_VIEWS = "maint_views"  # saved maintenance dashboard views (list of dicts)

# ---------------------------------------------------------------------------
# Maintenance (assets → tasks → parts & documents)
# ---------------------------------------------------------------------------
MAINT_CATEGORIES = ("Replacement", "Service", "Cleaning", "Inspection", "Calibration", "Refill")

MAINT_OK = "ok"
MAINT_DUE_SOON = "due_soon"
MAINT_OVERDUE = "overdue"
MAINT_TRIGGERED = "triggered"
MAINT_STATUSES = (MAINT_OK, MAINT_DUE_SOON, MAINT_OVERDUE, MAINT_TRIGGERED)
MAINT_SEVERITY = {MAINT_OK: 0, MAINT_DUE_SOON: 1, MAINT_OVERDUE: 2, MAINT_TRIGGERED: 3}

SCHEDULE_NONE = "none"  # trigger-only
SCHEDULE_ONCE = "once"
SCHEDULE_ROLLING = "rolling"  # next due = actual completion + interval
SCHEDULE_PLANNED = "planned"  # anchored: completing late doesn't drift future cycles
SCHEDULE_MODES = (SCHEDULE_NONE, SCHEDULE_ONCE, SCHEDULE_ROLLING, SCHEDULE_PLANNED)
INTERVAL_UNITS = ("days", "weeks", "months", "years")

TRIGGER_THRESHOLD = "threshold"
TRIGGER_COUNTER = "counter"
TRIGGER_RUNTIME = "runtime"
TRIGGER_STATE_COUNT = "state_count"
TRIGGER_PROBLEM = "problem"
TRIGGER_SALT = "salt_level"
TRIGGER_TYPES = (TRIGGER_THRESHOLD, TRIGGER_COUNTER, TRIGGER_RUNTIME, TRIGGER_STATE_COUNT, TRIGGER_PROBLEM, TRIGGER_SALT)
TRIGGER_LOGIC = ("or", "and")

OBJECT_GENERIC = "generic"
OBJECT_SOFTENER = "water_softener"
OBJECT_VEHICLE = "vehicle"
OBJECT_FLEET = "battery_fleet"
OBJECT_TYPES = (OBJECT_GENERIC, OBJECT_SOFTENER, OBJECT_VEHICLE, OBJECT_FLEET)

EVENT_KIND_COMPLETED = "completed"
EVENT_KIND_SKIPPED = "skipped"
EVENT_KIND_MISSED = "missed"
EVENT_KIND_PURCHASE = "purchase"
EVENT_KIND_SALT = "salt"
EVENT_KIND_REGEN = "regeneration"
EVENT_KIND_PART_USED = "part_used"
FEEDBACK_CHOICES = ("too_early", "just_right", "too_late")

COST_MODE_PURCHASE = "purchase"  # book part cost when it is bought
COST_MODE_CONSUMPTION = "consumption"  # book part cost when a task uses it
COST_MODES = (COST_MODE_PURCHASE, COST_MODE_CONSUMPTION)
RESTOCK_SHOPPING = "shopping"
RESTOCK_TASK = "task"
RESTOCK_NONE = "none"
RESTOCK_ACTIONS = (RESTOCK_SHOPPING, RESTOCK_TASK, RESTOCK_NONE)

SALT_SCALE_LEVELS = "levels"
SALT_SCALE_PERCENT = "percent"
SALT_SCALE_BAGS = "bags"
SALT_SCALES = (SALT_SCALE_LEVELS, SALT_SCALE_PERCENT, SALT_SCALE_BAGS)
SALT_OBS_FILL = "fill"
SALT_OBS_LEVEL = "level"
SALT_OBS_EMPTY = "empty"
SALT_OBS_KINDS = (SALT_OBS_FILL, SALT_OBS_LEVEL, SALT_OBS_EMPTY)

DOC_CATEGORIES = ("manual", "invoice", "warranty", "photo", "other")
DOCS_DIRNAME = "taskdragon_docs"
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
# Only these types are stored and served (never HTML or SVG, which could run script).
DOC_CONTENT_TYPES = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "text/plain": "txt",
}

EVENT_MAINT_DUE = "taskdragon_maintenance_due"
EVENT_MAINT_COMPLETED = "taskdragon_maintenance_completed"
SOURCE_MAINT_PART = "maint_part"
CONF_MAINT_NOTIFY = "maintenance_notify_service"

# ---------------------------------------------------------------------------
# Barcode scanning
# ---------------------------------------------------------------------------
BARCODE_PANTRY = "pantry_item"
BARCODE_PART = "maintenance_part"
BARCODE_TARGETS = (BARCODE_PANTRY, BARCODE_PART)
BARCODE_CONTEXTS = ("pantry", "maintenance", "auto")
BARCODE_USE_ONE = "use_one"
BARCODE_RESTOCK = "restock_qty"
BARCODE_SET_PANTRY = "set_pantry_status"
BARCODE_ACTIONS = (BARCODE_USE_ONE, BARCODE_RESTOCK, BARCODE_SET_PANTRY)
BARCODE_SYMBOLOGIES = ("upc_a", "upc_e", "ean_13", "ean_8", "code_128", "code_39", "qr_code", "unknown")
OPENFOODFACTS_URL = "https://world.openfoodfacts.org/api/v2/product/{code}.json"
OPENFOODFACTS_TIMEOUT_SECONDS = 4

# ---------------------------------------------------------------------------
# Portable backups
# ---------------------------------------------------------------------------
BACKUP_DIRNAME = "taskdragon"  # under <config>/backups/
BACKUP_DEFAULT_RETENTION = 14
BACKUP_DEFAULT_TIME = "03:15"

# ---------------------------------------------------------------------------
# Wishlist, gift & price tracker ("Hoard")
# ---------------------------------------------------------------------------
HOARD_KIND_WANT = "want"
HOARD_KIND_HOLIDAY = "holiday"
HOARD_KIND_BIRTHDAY = "birthday"
HOARD_KIND_OCCASION = "occasion"
HOARD_SECTION_KINDS = (HOARD_KIND_WANT, HOARD_KIND_HOLIDAY, HOARD_KIND_BIRTHDAY, HOARD_KIND_OCCASION)
HOARD_GIFT_KINDS = (HOARD_KIND_HOLIDAY, HOARD_KIND_BIRTHDAY, HOARD_KIND_OCCASION)
HOARD_IDEA = "idea"
HOARD_WATCHING = "watching"
HOARD_PURCHASED = "purchased"
HOARD_SHIPPED = "shipped"
HOARD_STASHED = "stashed"
HOARD_WRAPPED = "wrapped"
HOARD_GIFTED = "gifted"
HOARD_STATUSES = (HOARD_IDEA, HOARD_WATCHING, HOARD_PURCHASED, HOARD_SHIPPED, HOARD_STASHED, HOARD_WRAPPED, HOARD_GIFTED)
HOARD_SHOPPING_STATUSES = (HOARD_IDEA, HOARD_WATCHING)  # still deciding what (and where) to buy
HOARD_OWNED_STATUSES = (HOARD_PURCHASED, HOARD_SHIPPED, HOARD_STASHED, HOARD_WRAPPED, HOARD_GIFTED)
HOARD_PRICE_SOURCES = ("online", "in_store", "manual", "purchase")
HOARD_DEFAULT_SECTIONS = (
    {"kind": HOARD_KIND_WANT, "name": "Want to Buy", "icon": "mdi:cart-heart"},
    {"kind": HOARD_KIND_HOLIDAY, "name": "Christmas", "icon": "mdi:pine-tree", "event_date": "2026-12-25", "repeats_yearly": True},
    {"kind": HOARD_KIND_BIRTHDAY, "name": "Birthdays", "icon": "mdi:cake-variant-outline"},
)
HOARD_KEY_FILENAME = "taskdragon_hoard.key"  # under <config>/.storage/
HOARD_DEFAULT_CHECK_HOURS = 6
HOARD_DEFAULT_DEAL_HOURS = 3
HOARD_DEFAULT_PROTECTION_DAYS = 30
HOARD_DEFAULT_IMPULSE_THRESHOLD = 100
HOARD_DEFAULT_IMPULSE_DAYS = 7
HOARD_MAX_URLS_PER_ITEM = 12
HOARD_MAX_DEALS_PER_ITEM = 20
HOARD_HISTORY_DAYS = 400  # price checks older than this are pruned
UPCITEMDB_URL = "https://api.upcitemdb.com/prod/trial/lookup"
SLICKDEALS_RSS_URL = "https://slickdeals.net/newsearch.php"
REDDIT_SEARCH_URL = "https://www.reddit.com/r/{subs}/search.json"
REDDIT_DEAL_SUBS = ("buildapcsales", "deals")
