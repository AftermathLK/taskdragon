"""Wishlist, gift & price tracker ("Hoard") business logic.

A hoard plan (archetype ``wishlist_hoard``) holds *sections* (Want to Buy, a
holiday with a budget and a countdown, birthdays, any occasion) and *items*,
which grow through three tiers without ever requiring a link:

1. a concept tag ("4k monitor") with spec notes, a target price and an optional
   deal radar that searches public deal feeds for matching posts;
2. a specific product with one or more store URLs, polled for price and stock,
   every check logged for the trend sparkline, with alerts at the target price
   or a new all-time low;
3. after purchase, a price-protection watch that keeps polling during the
   return / adjustment window and alerts when the price falls below what was
   paid.

Anti-spoiler privacy is enforced here, on the server, for every read and write:

* an item or section that is a gift for a person is hidden from the Home
  Assistant user linked to that person (unless they added it themselves);
* a *stealth* item or section is visible only to the person who added it.

A section can hold *categories*, one level deep ("Christmas" → "Ellie",
"Grandma", "Stocking stuffers"). A category shares its occasion's type and date,
has its own name, budget and recipient, and whatever hides the occasion hides
its categories too.

Hidden items come back only as anonymous placeholders ("1 secret gift hidden by
Sam"): their ids, titles, prices and links never reach that user, and every
command that names one answers ``not_found``. Notifications and bus events
about secret items carry no item text.

The hiding-spot note is encrypted at rest with a per-installation key
(:class:`SecretBox`) and only decrypted for users who may see the item.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
from collections import OrderedDict, defaultdict
from collections.abc import Awaitable, Callable, Iterable, Mapping, Sequence
from datetime import date, datetime, timedelta
from typing import Any
from urllib.parse import urlsplit

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from .barcodes import BarcodeError, display_barcode, lookup_gtin, normalize_barcode
from .const import (
    ARCHETYPE_HOARD,
    HOARD_DEFAULT_CHECK_HOURS,
    HOARD_DEFAULT_DEAL_HOURS,
    HOARD_DEFAULT_IMPULSE_DAYS,
    HOARD_DEFAULT_IMPULSE_THRESHOLD,
    HOARD_DEFAULT_PROTECTION_DAYS,
    HOARD_DEFAULT_SECTIONS,
    HOARD_GIFT_KINDS,
    HOARD_GIFTED,
    HOARD_HISTORY_DAYS,
    HOARD_IDEA,
    HOARD_KIND_WANT,
    HOARD_MAX_DEALS_PER_ITEM,
    HOARD_MAX_URLS_PER_ITEM,
    HOARD_OWNED_STATUSES,
    HOARD_PURCHASED,
    HOARD_SECTION_KINDS,
    HOARD_SHOPPING_STATUSES,
    HOARD_STATUSES,
    HOARD_WATCHING,
    HOARD_WRAPPED,
    ICON_PATTERN,
    MAX_NAME,
    PRIORITIES,
)
from .database import HDEALS, HITEMS, HSECTIONS, HURLS, TaskDragonDB
from .planner import Actor, Planner, PlannerError
from .price_tracker import (
    API_USER_AGENT,
    BROWSER_HEADERS,
    MAX_PAGE_BYTES,
    Deal,
    FetchError,
    GuardedFetcher,
    LookupLimit,
    ProductLookup,
    UnsafeUrl,
    check_selector,
    check_url,
    extract_offer,
    filter_deals,
    parse_reddit_deals,
    parse_rss_deals,
    reddit_url,
    retailer_name,
    search_links,
    slickdeals_url,
)
from .ratelimit import RateLimiter
from .timeutil import parse_date, parse_datetime, to_utc_iso

_LOGGER = logging.getLogger(__name__)

SETTINGS_META = "hoard_settings"
SEEDED_META = "hoard_seeded_plans"
PRUNED_META = "hoard_history_pruned"
DEFAULT_SETTINGS: dict[str, Any] = {
    "tracking": True,
    "check_hours": HOARD_DEFAULT_CHECK_HOURS,
    "deal_radar": True,
    "deal_hours": HOARD_DEFAULT_DEAL_HOURS,
    "upc_lookup": True,
    "impulse_threshold": float(HOARD_DEFAULT_IMPULSE_THRESHOLD),
    "impulse_days": HOARD_DEFAULT_IMPULSE_DAYS,
    "protection_days": HOARD_DEFAULT_PROTECTION_DAYS,
}
SETTING_LIMITS = {"check_hours": (1, 168), "deal_hours": (1, 168), "impulse_days": (1, 60), "protection_days": (1, 180)}
SPARKLINE_DAYS = 30
MANUAL_CHECK_SECONDS = 60
MAX_TEXT_NOTES = 2000
MAX_HIDING_SPOT = 500
NEW_LOW_FRACTION = 0.01  # a new all-time low must beat the previous one by at least 1 %
MAX_ITEMS_PER_PLAN = 2000
FETCH_LIMIT = 120  # store-page, deal and image fetches one user can start ...
LOOKUP_LIMIT = 40  # ... and UPC lookups (the free allowance is shared by the household) ...
LIMIT_WINDOW = 3600  # ... per hour
IMAGE_TYPES = ("image/webp", "image/jpeg", "image/png", "image/gif")
MAX_IMAGE_BYTES = 3 * 1024 * 1024
IMAGE_CACHE_ENTRIES = 120
IMAGE_CACHE_BYTES = 24 * 1024 * 1024
_IMAGE_MAGIC = ((b"\x89PNG\r\n\x1a\n", "image/png"), (b"\xff\xd8\xff", "image/jpeg"), (b"GIF87a", "image/gif"), (b"GIF89a", "image/gif"))
_PERSON_RE = re.compile(r"^person\.[a-z0-9_]{1,250}$")
_ICON_RE = re.compile(ICON_PATTERN)
_EDITABLE_ITEM = (
    "title", "spec_notes", "priority", "target_price", "status", "barcode", "brand", "model", "image_url",
    "recipient_name", "gift_for_person_id", "stealth_mode", "hiding_spot", "watch_keyword_deals", "deal_query",
    "deal_max_price", "paid_price", "purchase_date", "purchase_store", "protection_days", "impulse_cooldown", "section_id",
)
_EDITABLE_SECTION = (
    "name", "kind", "icon", "budget", "event_date", "repeats_yearly", "recipient_name", "gift_for_person_id", "stealth_mode", "position",
    "parent_id",
)
MAX_CATEGORIES = 60  # per section


def _not_found() -> PlannerError:
    return PlannerError("not_found", "Not found (or not shared with you)")


def _text(value: Any, limit: int, *, multiline: bool = False) -> str | None:
    """Trimmed text; single-line fields also collapse runs of whitespace."""
    if value is None:
        return None
    text = str(value).strip() if multiline else " ".join(str(value).split())
    return text[:limit] or None


def _money(value: Any, label: str = "Prices") -> float | None:
    if value in (None, ""):
        return None
    try:
        number = round(float(value), 2)
    except (TypeError, ValueError) as err:
        raise PlannerError("invalid", f"{label} must be numbers") from err
    if number < 0 or number >= 10_000_000:
        raise PlannerError("invalid", f"{label} must be between 0 and 10,000,000")
    return number


def _person(value: Any) -> str | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if not _PERSON_RE.match(text):
        raise PlannerError("invalid", "Pick a household member (a person.* entity)")
    return text


def _icon(value: Any) -> str | None:
    if value in (None, ""):
        return None
    text = str(value).strip()
    if not _ICON_RE.match(text):
        raise PlannerError("invalid", "Icons look like mdi:gift-outline")
    return text


def _day(value: Any, label: str) -> str | None:
    if value in (None, ""):
        return None
    parsed = parse_date(value)
    if parsed is None:
        raise PlannerError("invalid", f"{label} must be a date")
    return parsed.isoformat()


def _https(value: Any) -> str | None:
    if value in (None, ""):
        return None
    try:
        url = check_url(value)
    except UnsafeUrl as err:
        raise PlannerError("invalid", f"Image: {err}") from err
    if not url.lower().startswith("https://"):
        raise PlannerError("invalid", "Images must use https://")
    return url


def next_occurrence(event_date: str | None, repeats_yearly: bool, today: date) -> date | None:
    """The coming date of an occasion (this year's or next year's for yearly ones)."""
    parsed = parse_date(event_date) if event_date else None
    if parsed is None:
        return None
    if not repeats_yearly:
        return parsed

    def on(year: int) -> date:
        try:
            return parsed.replace(year=year)
        except ValueError:  # 29 February in a common year
            return date(year, 2, 28)

    candidate = on(today.year)
    return candidate if candidate >= today else on(today.year + 1)


def money_text(value: float | None, currency: str = "$") -> str:
    if value is None:
        return ""
    return f"{currency}{value:,.2f}"


def alert_message(alert: Mapping[str, Any], currency: str = "$") -> str:
    """The notification text for a price alert (no item details for secret items)."""
    kind = alert["kind"]
    if alert.get("secret"):
        if kind == "protection":
            return "🐉 A secret gift you bought dropped below what you paid — open TaskDragon to claim your price adjustment."
        return "🐉 A secret gift on your list dropped in price — open TaskDragon to see it."
    title = alert["title"]
    price = money_text(alert["price"], currency)
    retailer = alert.get("retailer") or "a store"
    if kind == "protection":
        days = int(alert.get("days_since_purchase") or 0)
        when = "today" if days <= 0 else ("1 day ago" if days == 1 else f"{days} days ago")
        return (
            f"💰 Price Drop Alert! {title} dropped to {price} at {retailer} "
            f"({money_text(alert['savings'], currency)} less than you paid {when}) — Claim your price adjustment!"
        )
    if kind == "target":
        text = f"🎯 {title} is {price} at {retailer} — at or below your {money_text(alert.get('target_price'), currency)} target."
        return text + " That's a new all-time low." if alert.get("all_time_low") else text
    return f"📉 New all-time low: {title} is {price} at {retailer}."


class SecretBox:
    """Fernet encryption for hiding-spot notes, keyed per installation.

    The key lives next to the database (``.storage``) with owner-only
    permissions. Portable backups carry it so a restore elsewhere can read the
    notes; :meth:`rotate` re-encrypts notes written under another key.
    """

    def __init__(self, path: str) -> None:
        self.path = path
        self._key: bytes | None = None
        self._fernet: Fernet | None = None

    def load(self) -> None:
        """Read the key, creating it on first use (blocking: run in the executor)."""
        key = None
        try:
            with open(self.path, "rb") as handle:
                key = handle.read().strip()
            Fernet(key)
        except FileNotFoundError:
            key = None
        except (ValueError, OSError):
            _LOGGER.warning("The wishlist key file %s is unreadable; a new key was created and older hiding spots can't be read", self.path)
            try:
                os.replace(self.path, self.path + ".bad")
            except OSError:
                pass
            key = None
        if key is None:
            key = Fernet.generate_key()
            os.makedirs(os.path.dirname(os.path.abspath(self.path)), exist_ok=True)
            temp = self.path + ".tmp"
            fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, "wb") as handle:
                handle.write(key)
            os.replace(temp, self.path)
        self._key = key
        self._fernet = Fernet(key)

    @property
    def ready(self) -> bool:
        return self._fernet is not None

    @property
    def key(self) -> bytes:
        if self._key is None:
            raise RuntimeError("The wishlist key is not loaded")
        return self._key

    def encrypt(self, text: str | None) -> str | None:
        if not text:
            return None
        if self._fernet is None:
            raise RuntimeError("The wishlist key is not loaded")
        return self._fernet.encrypt(text.encode("utf-8")).decode("ascii")

    def decrypt(self, token: str | None) -> tuple[str | None, bool]:
        """``(text, readable)``; a note written under another key is ``(None, False)``."""
        if not token:
            return None, True
        if self._fernet is None:
            return None, False
        try:
            return self._fernet.decrypt(token.encode("ascii")).decode("utf-8"), True
        except (InvalidToken, ValueError, UnicodeError):
            return None, False

    def rotate(self, token: str, old_keys: Sequence[bytes]) -> str | None:
        """Re-encrypt ``token`` under this key when one of ``old_keys`` (or this key) can read it."""
        if self._fernet is None:
            return None
        keys = [self._fernet]
        for key in old_keys:
            try:
                keys.append(Fernet(key))
            except ValueError:
                continue
        try:
            return MultiFernet(keys).rotate(token.encode("ascii")).decode("ascii")
        except (InvalidToken, ValueError):
            return None


AlertSink = Callable[[dict[str, Any]], Awaitable[None]]


class HoardManager:
    """Sections, items, store links, price checks, deal radar and scans."""

    def __init__(
        self,
        db: TaskDragonDB,
        planner: Planner,
        *,
        box: SecretBox,
        fetcher: GuardedFetcher,
        products: ProductLookup,
        food_lookup: Callable[[str], Awaitable[dict[str, Any] | None]] | None = None,
        run_blocking: Callable[..., Awaitable[Any]] | None = None,
        person_user: Callable[[str], str | None] | None = None,
        on_alert: AlertSink | None = None,
        spawn: Callable[[Any, str], None] | None = None,
    ) -> None:
        self.db = db
        self.planner = planner
        self.box = box
        self.fetcher = fetcher
        self.products = products
        self._food_lookup = food_lookup
        self._run = run_blocking
        self._person_user = person_user or (lambda _entity_id: None)
        self._on_alert = on_alert
        self._spawn = spawn
        self._manual_checks: dict[str, datetime] = {}
        self._ticking = False
        self._alert_lock = asyncio.Lock()
        self._fetch_limit = RateLimiter(FETCH_LIMIT, LIMIT_WINDOW)
        self._lookup_limit = RateLimiter(LOOKUP_LIMIT, LIMIT_WINDOW)
        self._images: OrderedDict[str, tuple[bytes, str]] = OrderedDict()

    # ------------------------------------------------------------------
    # Small helpers
    # ------------------------------------------------------------------
    def _today(self) -> date:
        return self.planner.now_local().date()

    def _now_iso(self) -> str:
        return to_utc_iso(self.planner.now())

    async def _blocking(self, func: Callable[..., Any], *args: Any) -> Any:
        if self._run is not None:
            return await self._run(func, *args)
        return func(*args)

    def _notify(self, plan_ids: Iterable[str | None]) -> None:
        self.planner.notify(plan_ids)

    def _spend(self, limiter: RateLimiter, actor: Actor, cost: int = 1, what: str = "store checks") -> None:
        """Count outbound work a user starts; refuse once their hourly allowance is used up."""
        if not limiter.allow(actor.user_id, cost):
            minutes = max(1, round(limiter.retry_after(actor.user_id) / 60))
            raise PlannerError("rate_limited", f"Too many {what} in the last hour — try again in about {minutes} min")

    async def settings(self) -> dict[str, Any]:
        stored = await self.db.get_meta(SETTINGS_META, {}) or {}
        out = dict(DEFAULT_SETTINGS)
        for key, default in DEFAULT_SETTINGS.items():
            if key in stored and isinstance(stored[key], type(default)):
                out[key] = stored[key]
            elif key in stored and isinstance(default, float) and isinstance(stored[key], int):
                out[key] = float(stored[key])
        return out

    async def save_settings(self, changes: Mapping[str, Any]) -> dict[str, Any]:
        current = await self.settings()
        for key, value in changes.items():
            if key not in DEFAULT_SETTINGS:
                continue
            default = DEFAULT_SETTINGS[key]
            if isinstance(default, bool):
                current[key] = bool(value)
            elif isinstance(default, float):
                current[key] = _money(value, "The cooldown amount") or 0.0
            else:
                low, high = SETTING_LIMITS[key]
                try:
                    current[key] = max(low, min(high, int(value)))
                except (TypeError, ValueError) as err:
                    raise PlannerError("invalid", "Settings must be whole numbers") from err
        await self.db.set_meta(SETTINGS_META, current)
        return current

    # ------------------------------------------------------------------
    # Privacy
    # ------------------------------------------------------------------
    def hidden_from(self, record: Mapping[str, Any] | None, actor: Actor) -> bool:
        """Whether a section or item must be kept from ``actor`` (see the module docstring)."""
        if record is None or actor.user_id is None:
            return False
        if record.get("created_by") and record.get("created_by") == actor.user_id:
            return False
        if record.get("stealth_mode") and record.get("created_by"):
            return True
        recipient = record.get("gift_for_person_id")
        if recipient and (recipient == actor.person or self._person_user(recipient) == actor.user_id):
            return True
        return False

    def _section_hidden(self, section: Mapping[str, Any] | None, actor: Actor) -> bool:
        """A section is hidden when it is, or (for a category) when its occasion is."""
        return self.hidden_from(section, actor) or bool(section and self.hidden_from(section.get("_parent"), actor))

    def _item_hidden(self, item: Mapping[str, Any], section: Mapping[str, Any] | None, actor: Actor) -> bool:
        return self._section_hidden(section, actor) or self.hidden_from(item, actor)

    @staticmethod
    def _secret(item: Mapping[str, Any], section: Mapping[str, Any] | None) -> bool:
        """A gift (for anyone, signed in or not) or a stealth item: kiosk views mask it, alerts leave its text out.

        Everything in a category of a gift occasion counts as a gift (the category is
        usually a person: Christmas → Ellie).
        """
        keys = ("gift_for_person_id", "recipient_name", "stealth_mode")
        parent = section.get("_parent") if section else None
        return bool(
            any(item.get(k) for k in keys)
            or (section and any(section.get(k) for k in keys))
            or (parent and (any(parent.get(k) for k in keys) or parent.get("kind") in HOARD_GIFT_KINDS))
        )

    async def _load_section(self, section_id: str | None) -> dict[str, Any] | None:
        """A section row with its occasion attached as ``_parent`` (for categories)."""
        section = await self.db.row(HSECTIONS, section_id) if section_id else None
        if section is not None and section.get("parent_id"):
            section["_parent"] = await self.db.row(HSECTIONS, section["parent_id"])
        return section

    async def _require_plan(self, plan_id: str | None, actor: Actor) -> dict[str, Any]:
        plan = await self.db.get_plan(plan_id) if plan_id else None
        if plan is None or plan["archetype"] != ARCHETYPE_HOARD or not self.planner.can_access(plan, actor):
            raise _not_found()
        return plan

    async def _require_section(self, section_id: str | None, actor: Actor, plan_id: str | None = None) -> dict[str, Any]:
        section = await self._load_section(section_id)
        if section is None or (plan_id and section["plan_id"] != plan_id) or self._section_hidden(section, actor):
            raise _not_found()
        await self._require_plan(section["plan_id"], actor)
        return section

    async def _require_item(self, item_id: str | None, actor: Actor) -> tuple[dict[str, Any], dict[str, Any] | None, dict[str, Any]]:
        item = await self.db.row(HITEMS, item_id) if item_id else None
        if item is None:
            raise _not_found()
        plan = await self._require_plan(item["plan_id"], actor)
        section = await self._load_section(item["section_id"])
        if self._item_hidden(item, section, actor):
            raise _not_found()
        return item, section, plan

    async def _require_url(self, url_id: str, actor: Actor) -> tuple[dict[str, Any], dict[str, Any]]:
        url = await self.db.row(HURLS, url_id)
        if url is None:
            raise _not_found()
        item, _section, _plan = await self._require_item(url["item_id"], actor)
        return url, item

    # ------------------------------------------------------------------
    # Sections
    # ------------------------------------------------------------------
    async def ensure_sections(self, plan_id: str) -> None:
        """Give a hoard plan its starter sections the first time it is opened."""
        seeded = list(await self.db.get_meta(SEEDED_META, []) or [])
        if plan_id in seeded:
            return
        today = self._today()
        async with self.db.transaction():
            # Checked inside the transaction (it holds the writer lock), so two dashboards
            # opening a new wishlist at the same moment can't both seed it.
            existing = await self.db.rows(HSECTIONS, {"plan_id": plan_id}, limit=1)
            if not existing:
                for position, template in enumerate(HOARD_DEFAULT_SECTIONS, start=1):
                    record = {k: v for k, v in template.items() if k != "event_date"}
                    if template.get("event_date"):
                        month_day = str(template["event_date"])[5:]
                        record["event_date"] = f"{today.year}-{month_day}"
                    await self.db.tx_insert_row(HSECTIONS, {**record, "plan_id": plan_id, "position": position})
        seeded.append(plan_id)
        await self.db.set_meta(SEEDED_META, seeded[-500:])

    async def clone_sections(self, source_plan_id: str, target_plan_id: str) -> None:
        """Copy a wishlist's occasion sections (not its items) into a duplicated plan."""
        sections = await self.db.rows(HSECTIONS, {"plan_id": source_plan_id}, order=("position", "created_at"))
        copied: dict[str, str] = {}
        async with self.db.transaction():
            # Occasions first, so each category can point at its copy.
            for section in sorted(sections, key=lambda s: bool(s.get("parent_id"))):
                if section["stealth_mode"] or section["gift_for_person_id"]:
                    continue  # never copy someone's secret occasion into a plan others can open
                parent = section.get("parent_id")
                if parent and parent not in copied:
                    continue  # its occasion was secret
                record = {k: section[k] for k in ("kind", "name", "icon", "budget", "event_date", "repeats_yearly", "recipient_name", "position")}
                row = await self.db.tx_insert_row(HSECTIONS, {**record, "plan_id": target_plan_id, "parent_id": copied.get(parent) if parent else None})
                copied[section["id"]] = row["id"]
        seeded = list(await self.db.get_meta(SEEDED_META, []) or [])
        await self.db.set_meta(SEEDED_META, [*seeded, target_plan_id][-500:])

    def _clean_section(self, data: Mapping[str, Any], current: Mapping[str, Any] | None, actor: Actor) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for key in _EDITABLE_SECTION:
            if key not in data:
                continue
            value = data[key]
            if key == "name":
                out[key] = _text(value, MAX_NAME)
                if not out[key]:
                    raise PlannerError("invalid", "A section needs a name")
            elif key == "kind":
                if value not in HOARD_SECTION_KINDS:
                    raise PlannerError("invalid", "Unknown section type")
                out[key] = value
            elif key == "icon":
                out[key] = _icon(value)
            elif key == "budget":
                out[key] = _money(value, "Budgets")
            elif key == "event_date":
                out[key] = _day(value, "The occasion date")
            elif key in ("repeats_yearly",):
                out[key] = bool(value)
            elif key == "stealth_mode":
                out[key] = bool(value)
            elif key == "recipient_name":
                out[key] = _text(value, MAX_NAME)
            elif key == "gift_for_person_id":
                out[key] = _person(value)
            elif key == "position":
                try:
                    out[key] = max(0, int(value))
                except (TypeError, ValueError) as err:
                    raise PlannerError("invalid", "Positions are whole numbers") from err
            elif key == "parent_id":
                out[key] = str(value) if value else None
        self._check_secret_change(out, current, actor)
        return out

    async def _place_category(self, changes: dict[str, Any], current: Mapping[str, Any] | None, plan_id: str, actor: Actor) -> None:
        """Check a section's occasion (one level deep, same list) and make a category follow it.

        A category takes its occasion's type, and its own date is dropped: the
        countdown is the occasion's.
        """
        parent_id = changes["parent_id"] if "parent_id" in changes else (current or {}).get("parent_id")
        if not parent_id:
            return
        if current is not None and parent_id == current["id"]:
            raise PlannerError("invalid", "A section can't be its own category")
        parent = await self._require_section(parent_id, actor, plan_id=plan_id)
        if parent.get("parent_id"):
            raise PlannerError("invalid", "Categories go one level deep: pick an occasion, not another category")
        if current is not None and "parent_id" in changes and await self.db.rows(HSECTIONS, {"parent_id": current["id"]}, limit=1):
            raise PlannerError("invalid", "This section has its own categories, so it can't become one")
        if "parent_id" in changes and changes["parent_id"] != (current or {}).get("parent_id"):
            siblings = await self.db.rows(HSECTIONS, {"parent_id": parent_id})
            if len(siblings) >= MAX_CATEGORIES:
                raise PlannerError("invalid", f"A section holds at most {MAX_CATEGORIES} categories")
            if "position" not in changes:
                changes["position"] = max((sib["position"] for sib in siblings), default=0) + 1
        changes["kind"] = parent["kind"]
        changes["event_date"] = None
        changes["repeats_yearly"] = False

    @staticmethod
    def _check_secret_change(changes: Mapping[str, Any], current: Mapping[str, Any] | None, actor: Actor) -> None:
        """Only whoever added something may make it (or stop it being) stealth."""
        if current is None or "stealth_mode" not in changes or bool(changes["stealth_mode"]) == bool(current.get("stealth_mode")):
            return
        owner = current.get("created_by")
        if actor.user_id is not None and owner and owner != actor.user_id:
            raise PlannerError("unauthorized", "Only the person who added this can change whether it's secret")

    async def save_section(self, data: Mapping[str, Any], actor: Actor) -> dict[str, Any]:
        if data.get("id"):
            section = await self._require_section(data["id"], actor)
            changes = self._clean_section(data, section, actor)
            await self._place_category(changes, section, section["plan_id"], actor)
            if changes.get("stealth_mode") and not section.get("created_by") and actor.user_id:
                # A starter section has no owner; whoever makes it secret becomes the one who can see it.
                changes.update(created_by=actor.user_id, created_by_name=actor.user_name)
            if changes:
                updated = await self.db.update_row(HSECTIONS, section["id"], changes)
                section = await self._load_section(section["id"]) if updated else section
            if not section.get("parent_id") and any(k in changes for k in ("kind",)):
                # Categories follow their occasion's type.
                async with self.db.transaction():
                    for child in await self.db.rows(HSECTIONS, {"parent_id": section["id"]}):
                        await self.db.tx_update_row(HSECTIONS, child["id"], {"kind": section["kind"]})
            self._notify([section["plan_id"]])
            return self._section_view(section, [], 0, self._today(), actor)
        plan = await self._require_plan(data.get("plan_id"), actor)
        await self.ensure_sections(plan["id"])
        changes = self._clean_section({"kind": HOARD_KIND_WANT, **data}, None, actor)
        if not changes.get("name"):
            raise PlannerError("invalid", "A section needs a name")
        await self._place_category(changes, None, plan["id"], actor)
        if "position" not in changes:
            existing = await self.db.rows(HSECTIONS, {"plan_id": plan["id"]})
            changes["position"] = max((s["position"] for s in existing if not s.get("parent_id")), default=0) + 1
        section = await self.db.insert_row(
            HSECTIONS, {**changes, "plan_id": plan["id"], "created_by": actor.user_id, "created_by_name": actor.user_name}
        )
        self._notify([plan["id"]])
        return self._section_view(await self._load_section(section["id"]) or section, [], 0, self._today(), actor)

    async def delete_section(self, section_id: str, actor: Actor, *, move_to: str | None = None) -> dict[str, Any]:
        """Delete a section and its categories.

        Items move to ``move_to`` if given. Otherwise a category's items move up to
        its occasion, and an occasion's items (its categories' too) become unsorted.
        """
        section = await self._require_section(section_id, actor)
        children = await self.db.rows(HSECTIONS, {"parent_id": section_id})
        gone = {section_id, *(c["id"] for c in children)}
        target = None
        if move_to:
            target = await self._require_section(move_to, actor, plan_id=section["plan_id"])
            if target["id"] in gone:
                raise PlannerError("invalid", "Move the items somewhere outside the section you're deleting")
        elif section.get("parent_id"):
            target = section.get("_parent")
        items = [item for sid in gone for item in await self.db.rows(HITEMS, {"section_id": sid})]
        async with self.db.transaction():
            for item in items:
                await self.db.tx_update_row(HITEMS, item["id"], {"section_id": target["id"] if target else None})
            for child in children:
                await self.db.conn.execute("DELETE FROM hoard_sections WHERE id = ?", (child["id"],))
            await self.db.conn.execute("DELETE FROM hoard_sections WHERE id = ?", (section_id,))
        self._notify([section["plan_id"]])
        return {"moved": len(items), "to": target["id"] if target else None, "categories": len(children)}

    def _section_view(self, section: Mapping[str, Any], items: Sequence[Mapping[str, Any]], hidden: int, today: date, actor: Actor) -> dict[str, Any]:
        """A section for the card. An occasion's ``items`` include its categories' items."""
        occasion = section.get("_parent") or section
        upcoming = next_occurrence(occasion.get("event_date"), bool(occasion.get("repeats_yearly")), today)
        owned = [i for i in items if i["status"] in HOARD_OWNED_STATUSES]
        spent = round(sum(float(i["paid_price"]) for i in owned if i.get("paid_price") is not None), 2)
        return {
            "id": section["id"],
            "kind": section["kind"],
            "name": section["name"],
            "icon": section.get("icon"),
            "budget": section.get("budget"),
            "event_date": section.get("event_date"),
            "repeats_yearly": bool(section.get("repeats_yearly")),
            "recipient_name": section.get("recipient_name"),
            "gift_for_person_id": section.get("gift_for_person_id"),
            "stealth_mode": bool(section.get("stealth_mode")),
            "position": section.get("position") or 0,
            "parent_id": section.get("parent_id"),
            "is_gift": section["kind"] in HOARD_GIFT_KINDS,
            "next_date": upcoming.isoformat() if upcoming else None,
            "days_left": (upcoming - today).days if upcoming else None,
            "mine": bool(actor.user_id and section.get("created_by") == actor.user_id),
            "summary": {
                "total": len(items),
                "spent": spent,
                "bought": len(owned),
                "watching": sum(1 for i in items if i["status"] == HOARD_WATCHING),
                "ideas": sum(1 for i in items if i["status"] == HOARD_IDEA),
                "wrapped": sum(1 for i in items if i["status"] in (HOARD_WRAPPED, HOARD_GIFTED)),
                "gifted": sum(1 for i in items if i["status"] == HOARD_GIFTED),
                "hidden": hidden,
            },
        }

    # ------------------------------------------------------------------
    # Board
    # ------------------------------------------------------------------
    async def board(self, plan_id: str, actor: Actor) -> dict[str, Any]:
        plan = await self._require_plan(plan_id, actor)
        await self.ensure_sections(plan_id)
        settings = await self.settings()
        today = self._today()
        sections = await self.db.rows(HSECTIONS, {"plan_id": plan_id}, order=("position", "created_at"))
        items = await self.db.rows(HITEMS, {"plan_id": plan_id}, order=("position", "created_at"))
        by_id = {s["id"]: s for s in sections}
        for section in sections:
            if section.get("parent_id"):
                section["_parent"] = by_id.get(section["parent_id"])
        hidden_sections = {s["id"] for s in sections if self._section_hidden(s, actor)}

        def occasion_of(section: Mapping[str, Any]) -> str:
            return section["parent_id"] if section.get("parent_id") in by_id else section["id"]

        visible: list[dict[str, Any]] = []
        placeholders: dict[tuple[str | None, str], int] = defaultdict(int)
        hidden_per_section: dict[str, int] = defaultdict(int)
        for item in items:
            section = by_id.get(item["section_id"]) if item["section_id"] else None
            if section is not None and section["id"] in hidden_sections:
                # A hidden category of a visible occasion is announced under the occasion.
                occasion = occasion_of(section)
                key = occasion if occasion not in hidden_sections else None
                placeholders[(key, section.get("created_by_name") or item.get("created_by_name") or "someone")] += 1
                if key:
                    hidden_per_section[key] += 1
            elif self.hidden_from(item, actor):
                key = occasion_of(section) if section is not None else None
                placeholders[(key, item.get("created_by_name") or "someone")] += 1
                if key:
                    hidden_per_section[key] += 1
            else:
                visible.append(item)
        views = await self._item_views(visible, by_id, settings, today, actor)
        items_by_section: dict[str | None, list[dict[str, Any]]] = defaultdict(list)
        for item in visible:
            items_by_section[item["section_id"] if item["section_id"] in by_id else None].append(item)
        children: dict[str, list[str]] = defaultdict(list)
        for section in sections:
            if section.get("parent_id") in by_id and section["id"] not in hidden_sections:
                children[section["parent_id"]].append(section["id"])
        section_views = [
            self._section_view(
                s,
                [*items_by_section.get(s["id"], []), *(i for c in children.get(s["id"], []) for i in items_by_section.get(c, []))],
                hidden_per_section.get(s["id"], 0),
                today,
                actor,
            )
            for s in sections
            if s["id"] not in hidden_sections
        ]
        stores = sorted({u["retailer_name"] for v in views for u in v["urls"]} | {v["purchase_store"] for v in views if v.get("purchase_store")})
        return {
            "plan": {"id": plan["id"], "name": plan["name"], "icon": plan.get("icon"), "settings": plan.get("settings") or {}},
            "sections": section_views,
            "items": views,
            "hidden": [
                {"section_id": section_id, "buyer": buyer, "count": count}
                for (section_id, buyer), count in sorted(placeholders.items(), key=lambda kv: (kv[0][0] or "", kv[0][1]))
                if count
            ],
            "hidden_sections": len(hidden_sections),
            "settings": settings,
            "stores": stores[:100],
            "today": today.isoformat(),
            "me": {"user_id": actor.user_id, "person": actor.person},
        }

    async def _item_views(
        self, items: Sequence[dict[str, Any]], sections: Mapping[str, Mapping[str, Any]], settings: Mapping[str, Any], today: date, actor: Actor
    ) -> list[dict[str, Any]]:
        ids = [i["id"] for i in items]
        urls: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for url in await self.db.hoard_urls_for(ids):
            urls[url["item_id"]].append(url)
        deals: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for deal in await self.db.hoard_deals_for(ids):
            deals[deal["item_id"]].append(deal)
        since = (today - timedelta(days=SPARKLINE_DAYS)).isoformat()
        points: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for point in await self.db.price_points(ids, since):
            points[point["item_id"]].append(point)
        return [
            self._item_view(item, sections.get(item["section_id"] or ""), urls[item["id"]], deals[item["id"]], points[item["id"]], settings, today, actor)
            for item in items
        ]

    def _item_view(
        self,
        item: Mapping[str, Any],
        section: Mapping[str, Any] | None,
        urls: Sequence[Mapping[str, Any]],
        deals: Sequence[Mapping[str, Any]],
        points: Sequence[Mapping[str, Any]],
        settings: Mapping[str, Any],
        today: date,
        actor: Actor,
    ) -> dict[str, Any]:
        url_views = [
            {
                "id": u["id"],
                "retailer_name": u["retailer_name"],
                "url": u["url"],
                "css_selector": u.get("css_selector"),
                "last_price": u.get("last_price"),
                "lowest_price": u.get("lowest_price"),
                "highest_price": u.get("highest_price"),
                "currency": u.get("currency"),
                "in_stock": None if u.get("in_stock") is None else bool(u["in_stock"]),
                "last_checked_at": u.get("last_checked_at"),
                "last_error": u.get("last_error"),
                "method": u.get("extraction_method"),
            }
            for u in urls
        ]
        best = _best_url(url_views)
        online = [p for p in points if p["source"] == "online"]
        daily: dict[str, float] = {}
        for point in online:
            day = str(point["checked_at"])[:10]
            daily[day] = min(daily.get(day, point["price"]), point["price"])
        sparkline = [[day, price] for day, price in sorted(daily.items())]
        average = round(sum(p["price"] for p in online) / len(online), 2) if online else None
        lows = [u["lowest_price"] for u in url_views if u["lowest_price"] is not None]
        all_time_low = min(lows) if lows else None
        best_price = best["last_price"] if best else None
        below_average = round((average - best_price) / average * 100) if best_price is not None and average and best_price < average else 0
        status = item["status"]
        protection = None
        purchase_day = parse_date(item.get("purchase_date")) if item.get("purchase_date") else None
        if status in HOARD_OWNED_STATUSES and purchase_day and item.get("protection_days"):
            ends = purchase_day + timedelta(days=int(item["protection_days"]))
            days_left = (ends - today).days
            claim = None
            if days_left >= 0 and item.get("paid_price") is not None and best_price is not None and best_price < float(item["paid_price"]) - 0.009:
                claim = {"price": best_price, "retailer": best["retailer_name"], "url": best["url"], "savings": round(float(item["paid_price"]) - best_price, 2)}
            protection = {
                "days": int(item["protection_days"]),
                "ends": ends.isoformat(),
                "days_left": days_left,
                "active": days_left >= 0,
                "days_since_purchase": (today - purchase_day).days,
                "claim": claim,
            }
        cooldown = None
        if item.get("impulse_cooldown") and item.get("cooldown_until"):
            until = parse_date(item["cooldown_until"])
            if until:
                cooldown = {"until": until.isoformat(), "days_left": max(0, (until - today).days), "active": until > today}
        hiding, readable = self.box.decrypt(item.get("hiding_spot"))
        reference = best_price if best_price is not None else item.get("target_price")
        return {
            "id": item["id"],
            "plan_id": item["plan_id"],
            "section_id": item["section_id"] if section is not None else None,
            "title": item["title"],
            "spec_notes": item.get("spec_notes"),
            "priority": item.get("priority") or "none",
            "target_price": item.get("target_price"),
            "status": status,
            "barcode": item.get("barcode"),
            "barcode_display": display_barcode(item["barcode"]) if item.get("barcode") else None,
            "brand": item.get("brand"),
            "model": item.get("model"),
            "image_url": item.get("image_url"),
            # Photos come through Home Assistant, so viewers' browsers never contact the store.
            "image_path": f"/api/taskdragon/hoard_image/{item['id']}?v={_digest(item['image_url'])}" if item.get("image_url") else None,
            "recipient_name": item.get("recipient_name"),
            "gift_for_person_id": item.get("gift_for_person_id"),
            "stealth_mode": bool(item.get("stealth_mode")),
            "secret": self._secret(item, section),
            "hiding_spot": hiding,
            "hiding_spot_locked": not readable,
            "watch_keyword_deals": bool(item.get("watch_keyword_deals")),
            "deal_query": item.get("deal_query"),
            "deal_max_price": item.get("deal_max_price"),
            "deals_checked_at": item.get("deals_checked_at"),
            "paid_price": item.get("paid_price"),
            "purchase_date": item.get("purchase_date"),
            "purchase_store": item.get("purchase_store"),
            "protection_days": item.get("protection_days"),
            "impulse_cooldown": bool(item.get("impulse_cooldown")),
            "cooldown": cooldown,
            "cooldown_eligible": reference is None or float(reference) >= float(settings["impulse_threshold"]),
            "tier": "tracked" if url_views else "concept",
            "urls": url_views,
            "best": {"price": best_price, "retailer": best["retailer_name"], "url": best["url"], "url_id": best["id"], "in_stock": best["in_stock"]} if best else None,
            "average_price": average,
            "below_average_pct": below_average,
            "all_time_low": all_time_low,
            "meets_target": bool(best_price is not None and item.get("target_price") is not None and best_price <= float(item["target_price"])),
            "sparkline": sparkline,
            "deals": [
                {k: d.get(k) for k in ("id", "source", "title", "url", "discussion_url", "price", "posted_at", "found_at")}
                for d in deals[:HOARD_MAX_DEALS_PER_ITEM]
            ],
            "protection": protection,
            "mine": bool(actor.user_id and item.get("created_by") == actor.user_id),
            "added_by": item.get("created_by_name"),
            "position": item.get("position") or 0,
            "updated_at": item.get("updated_at"),
        }

    async def item_view(self, item_id: str, actor: Actor) -> dict[str, Any]:
        item, section, _plan = await self._require_item(item_id, actor)  # the section carries its occasion
        settings = await self.settings()
        sections = {section["id"]: section} if section else {}
        return (await self._item_views([item], sections, settings, self._today(), actor))[0]

    # ------------------------------------------------------------------
    # Items
    # ------------------------------------------------------------------
    async def _clean_item(self, data: Mapping[str, Any], current: Mapping[str, Any] | None, plan_id: str, actor: Actor) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for key in _EDITABLE_ITEM:
            if key not in data:
                continue
            value = data[key]
            if key == "title":
                out[key] = _text(value, 200)
                if not out[key]:
                    raise PlannerError("invalid", "Give it a name, like 4k monitor")
            elif key == "spec_notes":
                out[key] = _text(value, MAX_TEXT_NOTES, multiline=True)
            elif key == "priority":
                if value not in PRIORITIES:
                    raise PlannerError("invalid", "Unknown priority")
                out[key] = value
            elif key in ("target_price", "deal_max_price", "paid_price"):
                out[key] = _money(value)
            elif key == "status":
                if value not in HOARD_STATUSES:
                    raise PlannerError("invalid", "Unknown status")
                out[key] = value
            elif key == "barcode":
                if value in (None, ""):
                    out[key] = None
                else:
                    try:
                        out[key] = normalize_barcode(value)[0]
                    except BarcodeError as err:
                        raise PlannerError("invalid", str(err)) from err
            elif key in ("brand", "model", "recipient_name", "purchase_store"):
                out[key] = _text(value, MAX_NAME)
            elif key == "deal_query":
                out[key] = _text(value, 120)
            elif key == "image_url":
                out[key] = _https(value)
            elif key == "gift_for_person_id":
                out[key] = _person(value)
            elif key in ("stealth_mode", "watch_keyword_deals", "impulse_cooldown"):
                out[key] = bool(value)
            elif key == "hiding_spot":
                text = _text(value, MAX_HIDING_SPOT)
                out[key] = self.box.encrypt(text) if text else None
            elif key == "purchase_date":
                out[key] = _day(value, "The purchase date")
            elif key == "protection_days":
                if value in (None, "", 0):
                    out[key] = None
                else:
                    try:
                        out[key] = max(1, min(180, int(value)))
                    except (TypeError, ValueError) as err:
                        raise PlannerError("invalid", "Protection days must be a whole number") from err
            elif key == "section_id":
                if value in (None, ""):
                    out[key] = None
                else:
                    out[key] = (await self._require_section(str(value), actor, plan_id=plan_id))["id"]
        self._check_secret_change(out, current, actor)
        if out.get("impulse_cooldown") and not (current or {}).get("impulse_cooldown"):
            settings = await self.settings()
            out["cooldown_until"] = (self._today() + timedelta(days=int(settings["impulse_days"]))).isoformat()
        elif "impulse_cooldown" in out and not out["impulse_cooldown"]:
            out["cooldown_until"] = None
        status = out.get("status")
        if status in HOARD_OWNED_STATUSES and not (current or {}).get("purchase_date") and "purchase_date" not in out:
            out["purchase_date"] = self._today().isoformat()
        return out

    async def save_item(self, data: Mapping[str, Any], actor: Actor) -> dict[str, Any]:
        if data.get("id"):
            item, _section, plan = await self._require_item(data["id"], actor)
            changes = await self._clean_item(data, item, plan["id"], actor)
            if "target_price" in changes and changes["target_price"] != item.get("target_price"):
                changes["alert_state"] = {k: v for k, v in (item.get("alert_state") or {}).items() if k != "target"}
            if changes:
                await self.db.update_row(HITEMS, item["id"], changes)
            self._notify([plan["id"]])
            return await self.item_view(item["id"], actor)
        plan = await self._require_plan(data.get("plan_id"), actor)
        changes = await self._clean_item(data, None, plan["id"], actor)
        if not changes.get("title"):
            raise PlannerError("invalid", "Give it a name, like 4k monitor")
        if len(await self.db.rows(HITEMS, {"plan_id": plan["id"]})) >= MAX_ITEMS_PER_PLAN:
            raise PlannerError("invalid", f"A wishlist can hold at most {MAX_ITEMS_PER_PLAN} items")
        if "section_id" not in changes:
            changes["section_id"] = await self._default_section_id(plan["id"], actor)
        existing = await self.db.rows(HITEMS, {"plan_id": plan["id"]})
        record = {
            "priority": "none",
            "status": HOARD_IDEA,
            **changes,
            "plan_id": plan["id"],
            "position": max((i["position"] for i in existing), default=0) + 1,
            "created_by": actor.user_id,
            "created_by_name": actor.user_name,
            "alert_state": {},
        }
        item = await self.db.insert_row(HITEMS, record)
        self._notify([plan["id"]])
        return await self.item_view(item["id"], actor)

    async def _default_section_id(self, plan_id: str, actor: Actor) -> str | None:
        await self.ensure_sections(plan_id)
        for section in await self.db.rows(HSECTIONS, {"plan_id": plan_id}, order=("position", "created_at")):
            if section["kind"] == HOARD_KIND_WANT and not section.get("parent_id") and not self.hidden_from(section, actor):
                return section["id"]
        return None

    async def delete_item(self, item_id: str, actor: Actor) -> dict[str, Any]:
        item, _section, plan = await self._require_item(item_id, actor)
        snapshot = await self.db.hoard_snapshot(item_id)
        await self.db.delete_row(HITEMS, item_id)
        self._notify([plan["id"]])
        return {"plan_id": plan["id"], "snapshot": snapshot}

    async def undo_delete(self, payload: Mapping[str, Any], actor: Actor) -> dict[str, Any]:
        """Undo handler for ``hoard_item`` (registered on the planner)."""
        await self._require_plan(payload.get("plan_id"), actor)
        await self.db.restore_hoard_snapshot(payload["snapshot"])
        self._notify([payload["plan_id"]])
        return {"restored": [row["id"] for row in payload["snapshot"].get("hoard_items") or []]}

    async def set_status(self, item_id: str, status: str, actor: Actor) -> dict[str, Any]:
        return await self.save_item({"id": item_id, "status": status}, actor)

    async def mark_purchased(
        self,
        item_id: str,
        actor: Actor,
        *,
        paid_price: Any = None,
        purchase_date: Any = None,
        store: Any = None,
        protection_days: Any = None,
    ) -> dict[str, Any]:
        item, _section, plan = await self._require_item(item_id, actor)
        settings = await self.settings()
        paid = _money(paid_price, "The price you paid")
        day = _day(purchase_date, "The purchase date") or self._today().isoformat()
        store_name = _text(store, MAX_NAME)
        days: int | None
        try:
            requested = None if protection_days in (None, "") else int(protection_days)
        except (TypeError, ValueError) as err:
            raise PlannerError("invalid", "Protection days must be a whole number") from err
        if requested is None:
            days = int(settings["protection_days"])
        else:
            days = max(1, min(180, requested)) if requested > 0 else None
        changes: dict[str, Any] = {
            "paid_price": paid,
            "purchase_date": day,
            "purchase_store": store_name,
            "protection_days": days,
            "impulse_cooldown": False,
            "cooldown_until": None,
            "alert_state": {k: v for k, v in (item.get("alert_state") or {}).items() if k != "protection"},
        }
        if item["status"] not in HOARD_OWNED_STATUSES:
            changes["status"] = HOARD_PURCHASED
        await self.db.update_row(HITEMS, item_id, changes)
        if paid is not None:
            await self.db.add_price_points([{"item_id": item_id, "source": "purchase", "store": store_name, "price": paid, "checked_at": _at(day)}])
        self._notify([plan["id"]])
        return await self.item_view(item_id, actor)

    async def record_price(self, item_id: str, actor: Actor, *, price: Any, store: Any = None, source: str = "in_store") -> dict[str, Any]:
        item, _section, plan = await self._require_item(item_id, actor)
        value = _money(price)
        if value is None or value <= 0:
            raise PlannerError("invalid", "Enter the price you saw")
        if source not in ("in_store", "manual"):
            raise PlannerError("invalid", "Unknown price source")
        await self.db.add_price_points([{"item_id": item_id, "source": source, "store": _text(store, MAX_NAME), "price": value, "checked_at": self._now_iso()}])
        self._notify([plan["id"]])
        return await self.item_view(item_id, actor)

    async def history(self, item_id: str, actor: Actor, days: int = 365) -> dict[str, Any]:
        await self._require_item(item_id, actor)
        since = (self._today() - timedelta(days=max(1, min(int(days), HOARD_HISTORY_DAYS)))).isoformat()
        points = await self.db.price_points([item_id], since)
        return {
            "points": [{k: p.get(k) for k in ("url_id", "source", "store", "price", "currency", "in_stock", "checked_at")} for p in points],
        }

    # ------------------------------------------------------------------
    # Store links
    # ------------------------------------------------------------------
    async def add_url(self, item_id: str, actor: Actor, *, url: Any, retailer: Any = None, css_selector: Any = None, check: bool = True) -> dict[str, Any]:
        item, _section, plan = await self._require_item(item_id, actor)
        try:
            clean_url = check_url(url)
            selector = check_selector(css_selector)
        except (UnsafeUrl, ValueError) as err:
            raise PlannerError("invalid", str(err)) from err
        existing = await self.db.rows(HURLS, {"item_id": item_id})
        if any(u["url"] == clean_url for u in existing):
            raise PlannerError("invalid", "That link is already on this item")
        if len(existing) >= HOARD_MAX_URLS_PER_ITEM:
            raise PlannerError("invalid", f"An item can track at most {HOARD_MAX_URLS_PER_ITEM} stores")
        if check:
            self._spend(self._fetch_limit, actor)
        row = await self.db.insert_row(
            HURLS,
            {"item_id": item_id, "url": clean_url, "retailer_name": _text(retailer, 60) or retailer_name(clean_url), "css_selector": selector, "failures": 0},
        )
        if item["status"] == HOARD_IDEA:
            await self.db.update_row(HITEMS, item_id, {"status": HOARD_WATCHING})
        self._notify([plan["id"]])
        if check:
            self._background(self.check_urls([row["id"]]), "taskdragon_hoard_first_check")
        return await self.item_view(item_id, actor)

    async def update_url(self, url_id: str, actor: Actor, changes: Mapping[str, Any]) -> dict[str, Any]:
        url, item = await self._require_url(url_id, actor)
        clean: dict[str, Any] = {}
        if "retailer_name" in changes:
            clean["retailer_name"] = _text(changes["retailer_name"], 60) or retailer_name(url["url"])
        if "css_selector" in changes:
            try:
                clean["css_selector"] = check_selector(changes["css_selector"])
            except ValueError as err:
                raise PlannerError("invalid", str(err)) from err
            clean["failures"] = 0
            self._spend(self._fetch_limit, actor)
        if clean:
            await self.db.update_row(HURLS, url_id, clean)
        self._notify([item["plan_id"]])
        if "css_selector" in clean:
            self._background(self.check_urls([url_id]), "taskdragon_hoard_selector_check")
        return await self.item_view(item["id"], actor)

    async def delete_url(self, url_id: str, actor: Actor) -> dict[str, Any]:
        _url, item = await self._require_url(url_id, actor)
        await self.db.delete_row(HURLS, url_id)
        self._notify([item["plan_id"]])
        return await self.item_view(item["id"], actor)

    def _background(self, coro: Any, name: str) -> None:
        if self._spawn is not None:
            self._spawn(coro, name)
        else:
            coro.close()

    # ------------------------------------------------------------------
    # Price checks
    # ------------------------------------------------------------------
    async def check_now(self, item_id: str, actor: Actor) -> dict[str, Any]:
        """Check every store link of one item right away (at most once a minute per item)."""
        item, _section, _plan = await self._require_item(item_id, actor)
        urls = await self.db.rows(HURLS, {"item_id": item["id"]})
        if not urls:
            raise PlannerError("invalid", "Add a store link first")
        now = self.planner.now()
        last = self._manual_checks.get(item_id)
        if last is not None and (now - last).total_seconds() < MANUAL_CHECK_SECONDS:
            raise PlannerError("rate_limited", "Checked less than a minute ago — give the stores a moment")
        self._spend(self._fetch_limit, actor, len(urls))
        self._manual_checks[item_id] = now
        if len(self._manual_checks) > 500:
            for key in sorted(self._manual_checks, key=self._manual_checks.__getitem__)[:250]:
                self._manual_checks.pop(key, None)
        await self.check_urls([u["id"] for u in urls])
        return await self.item_view(item_id, actor)

    def _pollable(self, item: Mapping[str, Any], today: date) -> bool:
        if item["status"] in HOARD_SHOPPING_STATUSES:
            return True
        if item["status"] in HOARD_OWNED_STATUSES and item["status"] != HOARD_GIFTED and item.get("purchase_date") and item.get("protection_days"):
            bought = parse_date(item["purchase_date"])
            return bool(bought and today <= bought + timedelta(days=int(item["protection_days"])))
        return False

    @staticmethod
    def _due(url: Mapping[str, Any], hours: int, now: datetime) -> bool:
        checked = parse_datetime(url.get("last_checked_at")) if url.get("last_checked_at") else None
        if checked is None:
            return True
        backoff = 2 ** min(int(url.get("failures") or 0), 3)
        return (now - checked).total_seconds() >= hours * 3600 * backoff - 60

    async def tick(self) -> dict[str, int]:
        """The periodic job: check due store links, refresh deal radars, prune old history."""
        if self._ticking:
            return {"checked": 0, "deals": 0}
        self._ticking = True
        try:
            settings = await self.settings()
            today = self._today()
            now = self.planner.now()
            checked = 0
            if settings["tracking"]:
                plans = {p["id"] for p in await self.db.list_plans() if p["archetype"] == ARCHETYPE_HOARD}
                items = [i for i in await self.db.rows(HITEMS, {"plan_id": sorted(plans)}) if self._pollable(i, today)] if plans else []
                urls = await self.db.hoard_urls_for([i["id"] for i in items])
                due = [u["id"] for u in urls if self._due(u, int(settings["check_hours"]), now)]
                checked = await self.check_urls(due)
            deals = await self.refresh_deals() if settings["deal_radar"] else 0
            await self._prune(today)
            return {"checked": checked, "deals": deals}
        finally:
            self._ticking = False

    async def check_urls(self, url_ids: Sequence[str]) -> int:
        """Fetch and parse the given store links (round-robin across stores), then evaluate alerts."""
        rows = [row for row in [await self.db.row(HURLS, uid) for uid in dict.fromkeys(url_ids)] if row is not None]
        by_host: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in rows:
            by_host[_host(row["url"])].append(row)
        ordered: list[dict[str, Any]] = []
        while any(by_host.values()):
            for host in list(by_host):
                if by_host[host]:
                    ordered.append(by_host[host].pop(0))
        touched: dict[str, str] = {}
        checked = 0
        for row in ordered:
            item = await self.db.row(HITEMS, row["item_id"])
            if item is None:
                continue
            await self._check_one(row, item)
            touched[item["id"]] = item["plan_id"]
            checked += 1
        for item_id in touched:
            try:
                await self.evaluate_alerts(item_id)
            except Exception:  # noqa: BLE001 - one item's alert must not stop the others
                _LOGGER.exception("Evaluating price alerts failed")
        if touched:
            self._notify(set(touched.values()))
        return checked

    async def _check_one(self, row: Mapping[str, Any], item: Mapping[str, Any]) -> None:
        now_iso = self._now_iso()
        try:
            page = await self.fetcher.get(row["url"], headers=BROWSER_HEADERS, max_bytes=MAX_PAGE_BYTES, truncate=True)
            found = await self._blocking(extract_offer, page.body, page.url, page.charset, row.get("css_selector"))
        except FetchError as err:
            message = str(err)
            if err.blocked:
                message = f"The store refused the automatic check (HTTP {err.status}); it may block price trackers"
            await self.db.update_row(HURLS, row["id"], {"last_checked_at": now_iso, "last_error": message[:300], "failures": int(row.get("failures") or 0) + 1})
            return
        except Exception:  # noqa: BLE001 - a page that breaks the parser is reported, never fatal
            _LOGGER.exception("Reading the price from %s failed", _host(row["url"]))
            await self.db.update_row(HURLS, row["id"], {"last_checked_at": now_iso, "last_error": "The page couldn't be read", "failures": int(row.get("failures") or 0) + 1})
            return
        changes: dict[str, Any] = {"last_checked_at": now_iso}
        if found.in_stock is not None:
            changes["in_stock"] = 1 if found.in_stock else 0
        if found.price is None:
            hint = "No price found on the page" + ("" if row.get("css_selector") else " — add a custom selector for this store")
            changes.update({"last_error": hint, "failures": int(row.get("failures") or 0) + 1})
            await self.db.update_row(HURLS, row["id"], changes)
            return
        lowest = row.get("lowest_price")
        highest = row.get("highest_price")
        changes.update(
            {
                "last_price": found.price,
                "lowest_price": found.price if lowest is None else min(float(lowest), found.price),
                "highest_price": found.price if highest is None else max(float(highest), found.price),
                "currency": found.currency or row.get("currency"),
                "extraction_method": found.method,
                "last_error": None,
                "failures": 0,
            }
        )
        await self.db.update_row(HURLS, row["id"], changes)
        await self.db.add_price_points(
            [{"item_id": item["id"], "url_id": row["id"], "source": "online", "store": row["retailer_name"], "price": found.price, "currency": found.currency, "in_stock": changes.get("in_stock"), "checked_at": now_iso}]
        )
        if not item.get("image_url") and found.image:
            try:
                image = _https(found.image)
            except PlannerError:
                image = None  # a product photo on a private or plain-http address is ignored
            if image:
                await self.db.update_row(HITEMS, item["id"], {"image_url": image}, touch=False)

    async def evaluate_alerts(self, item_id: str) -> list[dict[str, Any]]:
        """Fire target / all-time-low / price-protection alerts for one item (each price once).

        One evaluation at a time, so "Check now" overlapping the scheduled round can't
        announce the same drop twice.
        """
        async with self._alert_lock:
            return await self._evaluate_alerts(item_id)

    async def _evaluate_alerts(self, item_id: str) -> list[dict[str, Any]]:
        item = await self.db.row(HITEMS, item_id)
        if item is None:
            return []
        section = await self._load_section(item["section_id"])
        urls = await self.db.rows(HURLS, {"item_id": item_id})
        best = _best_url([{**u, "in_stock": None if u.get("in_stock") is None else bool(u["in_stock"])} for u in urls])
        if best is None:
            return []
        price = float(best["last_price"])
        state = dict(item.get("alert_state") or {})
        before = dict(state)
        alerts: list[dict[str, Any]] = []
        today = self._today()
        base = {
            "item_id": item_id,
            "plan_id": item["plan_id"],
            "title": item["title"],
            "price": price,
            "retailer": best["retailer_name"],
            "url": best["url"],
            "secret": self._secret(item, section),
            "created_by": item.get("created_by"),
            "target_price": item.get("target_price"),
            "paid_price": item.get("paid_price"),
        }
        if item["status"] in HOARD_SHOPPING_STATUSES:
            previous_low = state.get("atl")
            new_low = previous_low is not None and price <= float(previous_low) * (1 - NEW_LOW_FRACTION)
            if previous_low is None:
                state["atl"] = min(price, *(float(u["lowest_price"]) for u in urls if u.get("lowest_price") is not None))
            elif new_low or price < float(previous_low):
                state["atl"] = price
            target = item.get("target_price")
            if target is not None and price <= float(target):
                if state.get("target") is None or price < float(state["target"]) - 0.009:
                    alerts.append({**base, "kind": "target", "all_time_low": new_low})
                    state["target"] = price
                    new_low = False
            elif target is not None and state.get("target") is not None:
                state.pop("target", None)  # back above target: the next drop alerts again
            if new_low:
                alerts.append({**base, "kind": "all_time_low"})
        elif self._pollable(item, today) and item.get("paid_price") is not None:
            paid = float(item["paid_price"])
            if price < paid - 0.009 and (state.get("protection") is None or price < float(state["protection"]) - 0.009):
                bought = parse_date(item["purchase_date"])
                days_since = (today - bought).days if bought else 0
                alerts.append(
                    {
                        **base,
                        "kind": "protection",
                        "savings": round(paid - price, 2),
                        "days_since_purchase": days_since,
                        "days_left": int(item["protection_days"]) - days_since,
                    }
                )
                state["protection"] = price
        if state != before:
            await self.db.update_row(HITEMS, item_id, {"alert_state": state}, touch=False)
        if self._on_alert is not None:
            for alert in alerts:
                try:
                    await self._on_alert(alert)
                except Exception:  # noqa: BLE001 - a broken notify service must not stop price checks
                    _LOGGER.exception("Delivering a price alert failed")
        return alerts

    async def _prune(self, today: date) -> None:
        if await self.db.get_meta(PRUNED_META) == today.isoformat():
            return
        cutoff = (today - timedelta(days=HOARD_HISTORY_DAYS)).isoformat()
        removed = await self.db.prune_price_history(cutoff)
        if removed:
            _LOGGER.debug("Pruned %s old price checks", removed)
        await self.db.set_meta(PRUNED_META, today.isoformat())

    # ------------------------------------------------------------------
    # Deal radar
    # ------------------------------------------------------------------
    async def refresh_deals(self, item_ids: Sequence[str] | None = None, *, force: bool = False) -> int:
        """Search the deal feeds for concept tags with deal radar on; returns how many new deals were found."""
        settings = await self.settings()
        hours = int(settings["deal_hours"])
        now = self.planner.now()
        plans = {p["id"] for p in await self.db.list_plans() if p["archetype"] == ARCHETYPE_HOARD}
        if not plans:
            return 0
        filters: dict[str, Any] = {"plan_id": sorted(plans)}
        if item_ids is not None:
            filters["id"] = list(item_ids)
        items = [
            i for i in await self.db.rows(HITEMS, filters)
            if i.get("watch_keyword_deals") and i["status"] in HOARD_SHOPPING_STATUSES
        ]
        cache: dict[str, list[Deal]] = {}
        added = 0
        touched: set[str] = set()
        for item in items:
            checked = parse_datetime(item.get("deals_checked_at")) if item.get("deals_checked_at") else None
            if not force and checked is not None and (now - checked).total_seconds() < hours * 3600 - 60:
                continue
            query = (item.get("deal_query") or item["title"]).strip()
            try:
                if query not in cache:
                    cache[query] = await self._search_deals(query)
                limit = item.get("deal_max_price") if item.get("deal_max_price") is not None else item.get("target_price")
                matches = filter_deals(cache[query], query, float(limit) if limit is not None else None)
                dismissed = {row["url"] for row in await self.db.rows(HDEALS, {"item_id": item["id"], "dismissed": 1})}
                fresh = [d.as_row() for d in matches if d.url not in dismissed]
                added += await self.db.save_deals(item["id"], fresh, HOARD_MAX_DEALS_PER_ITEM)
            except Exception:  # noqa: BLE001 - one item's search must not stop the others
                _LOGGER.exception("Deal radar search failed")
                cache.setdefault(query, [])
            await self.db.update_row(HITEMS, item["id"], {"deals_checked_at": self._now_iso()}, touch=False)
            touched.add(item["plan_id"])
        if touched:
            self._notify(touched)
        return added

    async def _search_deals(self, query: str) -> list[Deal]:
        deals: list[Deal] = []
        try:
            page = await self.fetcher.get(slickdeals_url(query), headers={"User-Agent": BROWSER_HEADERS["User-Agent"], "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.5"}, max_bytes=1024 * 1024)
            deals.extend(await self._blocking(parse_rss_deals, page.body, "slickdeals"))
        except (FetchError, ValueError, SyntaxError, LookupError) as err:  # ET.ParseError is a SyntaxError
            _LOGGER.debug("Slickdeals search failed: %s", err)
        try:
            deals.extend(parse_reddit_deals(await self.fetcher.get_json(reddit_url(query))))
        except FetchError as err:
            _LOGGER.debug("Reddit deal search failed: %s", err)
        seen: set[str] = set()
        unique = []
        for deal in deals:
            if deal.url not in seen:
                seen.add(deal.url)
                unique.append(deal)
        return unique

    async def check_deals_now(self, item_id: str, actor: Actor) -> dict[str, Any]:
        item, _section, _plan = await self._require_item(item_id, actor)
        if not item.get("watch_keyword_deals"):
            raise PlannerError("invalid", "Turn on the deal radar for this item first")
        self._spend(self._fetch_limit, actor, 2, "deal searches")
        await self.refresh_deals([item_id], force=True)
        return await self.item_view(item_id, actor)

    async def deal_action(self, deal_id: str, action: str, actor: Actor) -> dict[str, Any]:
        deal = await self.db.row(HDEALS, deal_id)
        if deal is None:
            raise _not_found()
        item, _section, plan = await self._require_item(deal["item_id"], actor)
        if action == "dismiss":
            await self.db.update_row(HDEALS, deal_id, {"dismissed": True})
            self._notify([plan["id"]])
            return await self.item_view(item["id"], actor)
        if action == "promote":
            await self.db.update_row(HDEALS, deal_id, {"dismissed": True})
            return await self.add_url(item["id"], actor, url=deal["url"])
        raise PlannerError("invalid", "Unknown deal action")

    # ------------------------------------------------------------------
    # In-store scan & price check
    # ------------------------------------------------------------------
    async def _hoard_plans(self, actor: Actor) -> list[dict[str, Any]]:
        return [p for p in await self.planner.accessible_plans(actor) if p["archetype"] == ARCHETYPE_HOARD]

    async def scan_price_check(self, raw: Any, actor: Actor, *, symbology: str | None = None, plan_id: str | None = None) -> dict[str, Any]:
        try:
            code, kind = normalize_barcode(raw, symbology)
        except BarcodeError as err:
            raise PlannerError("invalid", str(err)) from err
        plans = await self._hoard_plans(actor)
        if not plans:
            raise PlannerError("invalid", "Add a Wishlist & Gifts list first")
        plan = next((p for p in plans if p["id"] == plan_id), None) or plans[0]
        await self.ensure_sections(plan["id"])
        settings = await self.settings()
        allowed = {p["id"] for p in plans}
        sections_cache: dict[str, dict[str, Any] | None] = {}
        local_rows = []
        for item in await self.db.hoard_items_with_barcode(code):
            if item["plan_id"] not in allowed:
                continue
            sid = item["section_id"]
            if sid and sid not in sections_cache:
                sections_cache[sid] = await self._load_section(sid)
            if not self._item_hidden(item, sections_cache.get(sid) if sid else None, actor):
                local_rows.append(item)
        local = await self._item_views(local_rows, {k: v for k, v in sections_cache.items() if v}, settings, self._today(), actor)
        product: dict[str, Any] | None = None
        status = "disabled"
        if not lookup_gtin(code):
            status = "not_retail"
        elif settings["upc_lookup"] and not self._lookup_limit.allow(actor.user_id):
            status = "limit"
        elif settings["upc_lookup"]:
            try:
                product = await self.products.lookup(code)
                status = "ok" if product else "not_found"
            except LookupLimit:
                status = "limit"
            except FetchError as err:
                _LOGGER.debug("UPC lookup failed: %s", err)
                status = "error"
            if product is None and self._food_lookup is not None:
                try:
                    food = await self._food_lookup(code)
                except Exception:  # noqa: BLE001 - the food database is a best-effort fallback
                    food = None
                if food and food.get("name"):
                    product = {"title": food["name"], "brand": food.get("brand"), "model": None, "image": None, "offers": [], "source": "Open Food Facts", "description": food.get("quantity")}
                    status = "ok"
        if product is None and local:
            first = local[0]
            product = {"title": first["title"], "brand": first.get("brand"), "model": first.get("model"), "image": first.get("image_url"), "offers": [], "source": "Your wishlist"}
        online: list[dict[str, Any]] = []
        for offer in (product or {}).get("offers") or []:
            online.append({"retailer": offer["merchant"], "price": offer["price"], "url": offer["link"], "in_stock": offer.get("in_stock"), "source": "upcitemdb", "updated_at": offer.get("updated_at")})
        for view in local:
            for url in view["urls"]:
                if url["last_price"] is not None:
                    online.append({"retailer": url["retailer_name"], "price": url["last_price"], "url": url["url"], "in_stock": url["in_stock"], "source": "tracked", "updated_at": url["last_checked_at"]})
        online.sort(key=lambda o: o["price"])
        buyable = [o for o in online if o.get("in_stock") is not False]
        best = (buyable or online or [None])[0]
        display = display_barcode(code)
        sections = await self.db.rows(HSECTIONS, {"plan_id": plan["id"]}, order=("position", "created_at"))
        names = {s["id"]: s["name"] for s in sections}
        for section in sections:
            if section.get("parent_id"):
                section["_parent"] = next((x for x in sections if x["id"] == section["parent_id"]), None)
        return {
            "barcode": code,
            "display": display,
            "symbology": kind,
            "plan_id": plan["id"],
            "plans": [{"id": p["id"], "name": p["name"]} for p in plans],
            "product": product,
            "lookup": status,
            "local": local,
            "online": online[:25],
            "best_online": best,
            "search_links": search_links(display),
            "model_links": search_links(product["model"]) if product and product.get("model") else [],
            "sections": [
                {
                    "id": s["id"],
                    "name": f"{names.get(s['parent_id'], '')} › {s['name']}" if s.get("parent_id") else s["name"],
                    "kind": s["kind"],
                    "gift_for_person_id": s.get("gift_for_person_id"),
                    "parent_id": s.get("parent_id"),
                }
                for s in sorted(sections, key=lambda x: (x["_parent"]["position"] if x.get("_parent") else x["position"], bool(x.get("parent_id")), x["position"]))
                if not self._section_hidden(s, actor)
            ],
            "stores": sorted({o["retailer"] for o in online})[:50],
        }

    async def add_from_scan(self, data: Mapping[str, Any], actor: Actor) -> dict[str, Any]:
        """Save a scanned product (or update a tracked one) from the in-store sheet."""
        shelf = _money(data.get("shelf_price"), "The shelf price")
        store = _text(data.get("store"), MAX_NAME)
        if data.get("item_id"):
            item, _section, plan = await self._require_item(data["item_id"], actor)
            item_id = item["id"]
            updates = {k: data[k] for k in ("section_id", "gift_for_person_id", "recipient_name", "stealth_mode") if k in data}
            # A scan fills in what the item doesn't know yet, never overwrites what it does.
            for key in ("barcode", "brand", "model", "image_url"):
                if data.get(key) and not item.get(key):
                    updates[key] = data[key]
            if updates.get("image_url"):
                try:
                    _https(updates["image_url"])
                except PlannerError:
                    updates.pop("image_url")
            if updates:
                await self.save_item({"id": item_id, **updates}, actor)
        else:
            plan = await self._require_plan(data.get("plan_id"), actor)
            record = {k: data.get(k) for k in ("title", "brand", "model", "barcode", "image_url", "section_id", "gift_for_person_id", "recipient_name", "stealth_mode", "target_price") if data.get(k) not in (None, "")}
            if record.get("image_url"):
                try:
                    _https(record["image_url"])
                except PlannerError:
                    record.pop("image_url")  # a product photo that can't be shown safely is just left out
            record["plan_id"] = plan["id"]
            item_id = (await self.save_item(record, actor))["id"]
        added: list[str] = []
        existing = {u["url"] for u in await self.db.rows(HURLS, {"item_id": item_id})}
        for offer in list(data.get("offers") or [])[:HOARD_MAX_URLS_PER_ITEM]:
            try:
                url = check_url(offer.get("url"))
            except UnsafeUrl:
                continue
            if url in existing or len(existing) >= HOARD_MAX_URLS_PER_ITEM:
                continue
            row = await self.db.insert_row(HURLS, {"item_id": item_id, "url": url, "retailer_name": _text(offer.get("retailer_name"), 60) or retailer_name(url), "failures": 0})
            existing.add(url)
            added.append(row["id"])
        item_now = await self.db.row(HITEMS, item_id)
        if added and item_now is not None and item_now["status"] == HOARD_IDEA:
            await self.db.update_row(HITEMS, item_id, {"status": HOARD_WATCHING})
        if shelf is not None and shelf > 0:
            await self.db.add_price_points([{"item_id": item_id, "source": "in_store", "store": store, "price": shelf, "checked_at": self._now_iso()}])
        if data.get("bought"):
            await self.mark_purchased(item_id, actor, paid_price=shelf, store=store, protection_days=data.get("protection_days"))
        if added:
            self._background(self.check_urls(added), "taskdragon_hoard_scan_check")
        self._notify([plan["id"]])
        return await self.item_view(item_id, actor)

    # ------------------------------------------------------------------
    # Product photos
    # ------------------------------------------------------------------
    async def image(self, item_id: str, actor: Actor) -> tuple[bytes, str]:
        """An item's photo, fetched through the guarded client and cached (only real image types, 3 MB at most)."""
        item, _section, _plan = await self._require_item(item_id, actor)
        url = item.get("image_url")
        if not url:
            raise _not_found()
        cached = self._images.get(url)
        if cached is not None:
            self._images.move_to_end(url)
            return cached
        self._spend(self._fetch_limit, actor, 1, "photo downloads")
        try:
            page = await self.fetcher.get(url, headers={"User-Agent": API_USER_AGENT, "Accept": ", ".join(IMAGE_TYPES)}, max_bytes=MAX_IMAGE_BYTES)
        except FetchError as err:
            raise PlannerError("not_found", "The photo couldn't be loaded") from err
        kind = _image_type(page.body, page.content_type)
        if kind is None:
            raise PlannerError("not_found", "That address isn't a supported image")
        self._images[url] = (page.body, kind)
        while len(self._images) > IMAGE_CACHE_ENTRIES or sum(len(v[0]) for v in self._images.values()) > IMAGE_CACHE_BYTES:
            self._images.popitem(last=False)
        return page.body, kind

    # ------------------------------------------------------------------
    # Backups
    # ------------------------------------------------------------------
    async def rekey(self, old_keys: Sequence[bytes]) -> int:
        """After a restore: re-encrypt hiding spots written under another installation's key."""
        if not old_keys or not self.box.ready:
            return 0
        rotated = 0
        for item in await self.db.rows(HITEMS, {}):
            token = item.get("hiding_spot")
            if not token:
                continue
            _text_value, readable = self.box.decrypt(token)
            if readable:
                continue
            fresh = self.box.rotate(token, old_keys)
            if fresh is not None:
                await self.db.update_row(HITEMS, item["id"], {"hiding_spot": fresh}, touch=False)
                rotated += 1
        return rotated


def _host(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


def _at(day: str) -> str:
    """Noon UTC on ``day`` (a stable timestamp for a dated, untimed observation)."""
    return f"{day}T12:00:00Z"


def _best_url(urls: Sequence[Mapping[str, Any]]) -> Mapping[str, Any] | None:
    priced = [u for u in urls if u.get("last_price") is not None]
    if not priced:
        return None
    buyable = [u for u in priced if u.get("in_stock") is not False]
    return min(buyable or priced, key=lambda u: float(u["last_price"]))


def _digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def _image_type(body: bytes, claimed: str | None) -> str | None:
    """The image type from the file's first bytes; the server's claimed type only has to agree it's an image."""
    if not body or (claimed and claimed.split(";")[0].strip().lower() not in (*IMAGE_TYPES, "application/octet-stream", "binary/octet-stream")):
        return None
    for magic, kind in _IMAGE_MAGIC:
        if body.startswith(magic):
            return kind
    if body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return "image/webp"
    return None
