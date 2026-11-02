"""The wishlist, gift & price tracker: privacy, lifecycle, price checks, alerts, deals and scans."""

from __future__ import annotations

import json
from datetime import date, timedelta

import pytest

from conftest import TZ, plan_by_name

from taskdragon.database import HITEMS
from taskdragon.hoard import HoardManager, SecretBox, alert_message, next_occurrence
from taskdragon.planner import Actor, PlannerError
from taskdragon.price_tracker import FetchError, LookupLimit, Page, reddit_url, slickdeals_url

ALEX = Actor(user_id="u-alex", user_name="Alex", person="person.alex", is_admin=True)
SAM = Actor(user_id="u-sam", user_name="Sam", person="person.sam")
KID = Actor(user_id="u-kid", user_name="Kid", person="person.kid")
USERS = {"person.alex": "u-alex", "person.sam": "u-sam", "person.kid": "u-kid"}


def product_page(price: float | None, *, in_stock: bool = True, name: str = "LG 27GP950") -> str:
    offer = {"@type": "Offer", "price": str(price), "priceCurrency": "USD", "availability": "https://schema.org/" + ("InStock" if in_stock else "OutOfStock")}
    data = {"@type": "Product", "name": name, "image": "https://img.example/lg.jpg", "offers": offer}
    script = f'<script type="application/ld+json">{json.dumps(data)}</script>' if price is not None else ""
    return f"<html><head>{script}</head><body>Product</body></html>"


class FakeFetcher:
    def __init__(self) -> None:
        self.pages: dict[str, object] = {}
        self.calls: list[str] = []

    async def get(self, url, *, headers, max_bytes, truncate=False):
        self.calls.append(url)
        value = self.pages[url]
        if isinstance(value, Exception):
            raise value
        body = value if isinstance(value, bytes) else str(value).encode()
        return Page(url, 200, body, "utf-8", "text/html")

    async def get_json(self, url, headers=None):
        self.calls.append(url)
        value = self.pages[url]
        if isinstance(value, Exception):
            raise value
        return value

    async def close(self) -> None:
        pass


class FakeProducts:
    def __init__(self) -> None:
        self.product = None
        self.error: Exception | None = None

    async def lookup(self, code):
        if self.error:
            raise self.error
        return self.product


@pytest.fixture
async def hoard(planner, tmp_path):
    box = SecretBox(str(tmp_path / "keys" / "hoard.key"))
    box.load()
    alerts: list[dict] = []
    spawned: list = []

    async def on_alert(alert):
        alerts.append(alert)

    manager = HoardManager(
        planner.db,
        planner,
        box=box,
        fetcher=FakeFetcher(),
        products=FakeProducts(),
        person_user=USERS.get,
        on_alert=on_alert,
        spawn=lambda coro, name: spawned.append(coro),
    )
    planner.hoard = manager
    planner.undo_handlers["hoard_item"] = manager.undo_delete
    plan = await planner.create_plan({"name": "Wishlist & Gifts", "archetype": "wishlist_hoard"})
    manager.test_plan = plan  # type: ignore[attr-defined]
    manager.test_alerts = alerts  # type: ignore[attr-defined]
    manager.test_spawned = spawned  # type: ignore[attr-defined]
    yield manager
    for coro in spawned:
        coro.close()


def section(board: dict, name: str) -> dict:
    return next(s for s in board["sections"] if s["name"] == name)


async def test_starter_sections_and_concept_tags(hoard, planner) -> None:
    plan = hoard.test_plan
    board = await hoard.board(plan["id"], ALEX)
    assert [(s["name"], s["kind"]) for s in board["sections"]] == [("Want to Buy", "want"), ("Christmas", "holiday"), ("Birthdays", "birthday")]
    christmas = section(board, "Christmas")
    assert christmas["repeats_yearly"] and christmas["next_date"] == "2026-12-25" and christmas["days_left"] == 59
    item = await hoard.save_item({"plan_id": plan["id"], "title": "  4k   monitor ", "spec_notes": "27-inch+, IPS or OLED, USB-C PD", "target_price": 300}, ALEX)
    assert item["title"] == "4k monitor" and item["tier"] == "concept" and item["section_id"] == section(board, "Want to Buy")["id"]
    assert item["status"] == "idea" and item["urls"] == [] and item["best"] is None and item["cooldown_eligible"]
    # Opening the plan again does not seed a second set of sections.
    assert len((await hoard.board(plan["id"], ALEX))["sections"]) == 3
    # Plain to-dos never land in a wishlist, and tasks can't move into one.
    with pytest.raises(PlannerError):
        await planner.save_task({"plan_id": plan["id"], "summary": "Buy a monitor"})
    quick = await plan_by_name(planner, "Quick List")
    task = await planner.save_task({"plan_id": quick["id"], "summary": "Call mom"})
    with pytest.raises(PlannerError):
        await planner.save_task({"uid": task["uid"], "plan_id": plan["id"]})


async def test_gifts_are_hidden_from_their_recipient(hoard) -> None:
    plan = hoard.test_plan
    board = await hoard.board(plan["id"], ALEX)
    xmas = section(board, "Christmas")["id"]
    gift = await hoard.save_item({"plan_id": plan["id"], "title": "Telescope", "section_id": xmas, "gift_for_person_id": "person.sam", "target_price": 250}, ALEX)
    wish = await hoard.save_item({"plan_id": plan["id"], "title": "Hiking boots", "section_id": xmas, "gift_for_person_id": "person.sam"}, SAM)
    assert gift["secret"] and gift["mine"] and wish["mine"]
    sam_view = await hoard.board(plan["id"], SAM)
    assert [i["id"] for i in sam_view["items"]] == [wish["id"]], "Sam sees only what Sam added"
    assert sam_view["hidden"] == [{"section_id": xmas, "buyer": "Alex", "count": 1}]
    assert "Telescope" not in json.dumps(sam_view) and gift["id"] not in json.dumps(sam_view)
    assert section(sam_view, "Christmas")["summary"]["hidden"] == 1
    for attempt in (
        hoard.save_item({"id": gift["id"], "title": "peek"}, SAM),
        hoard.delete_item(gift["id"], SAM),
        hoard.history(gift["id"], SAM),
        hoard.add_url(gift["id"], SAM, url="https://shop.example/x", check=False),
        hoard.mark_purchased(gift["id"], SAM, paid_price=1),
    ):
        with pytest.raises(PlannerError) as caught:
            await attempt
        assert caught.value.code == "not_found"
    # Everyone else in the household sees the gift (a kiosk covers it until revealed).
    kid_view = await hoard.board(plan["id"], KID)
    assert {i["title"] for i in kid_view["items"]} == {"Telescope", "Hiking boots"} and kid_view["hidden"] == []


async def test_stealth_items_and_sections_belong_to_their_creator(hoard) -> None:
    plan = hoard.test_plan
    board = await hoard.board(plan["id"], ALEX)
    want = section(board, "Want to Buy")["id"]
    secret = await hoard.save_item({"plan_id": plan["id"], "title": "Anniversary ring", "section_id": want, "stealth_mode": True}, ALEX)
    hidden_section = await hoard.save_section({"plan_id": plan["id"], "name": "Sam's 40th", "kind": "birthday", "stealth_mode": True, "budget": 500}, ALEX)
    await hoard.save_item({"plan_id": plan["id"], "title": "Surprise party supplies", "section_id": hidden_section["id"]}, ALEX)
    open_item = await hoard.save_item({"plan_id": plan["id"], "title": "Air fryer", "section_id": want}, ALEX)
    sam_view = await hoard.board(plan["id"], SAM)
    assert [i["title"] for i in sam_view["items"]] == ["Air fryer"]
    assert "Sam's 40th" not in json.dumps(sam_view) and sam_view["hidden_sections"] == 1
    assert {(h["section_id"], h["count"]) for h in sam_view["hidden"]} == {(want, 1), (None, 1)}
    with pytest.raises(PlannerError):
        await hoard.save_item({"plan_id": plan["id"], "title": "x", "section_id": hidden_section["id"]}, SAM)
    with pytest.raises(PlannerError) as caught:
        await hoard.save_item({"id": open_item["id"], "stealth_mode": True}, SAM)
    assert caught.value.code == "unauthorized"
    assert (await hoard.item_view(secret["id"], ALEX))["stealth_mode"]


async def test_hiding_spot_is_encrypted_and_survives_a_rekey(hoard, tmp_path) -> None:
    plan = hoard.test_plan
    item = await hoard.save_item({"plan_id": plan["id"], "title": "Bike", "hiding_spot": "Top shelf of pole barn tote #4"}, ALEX)
    assert item["hiding_spot"] == "Top shelf of pole barn tote #4" and not item["hiding_spot_locked"]
    raw = await hoard.db.row(HITEMS, item["id"])
    assert raw["hiding_spot"].startswith("gAAAA") and "pole barn" not in raw["hiding_spot"]
    old_key = hoard.box.key
    other = SecretBox(str(tmp_path / "other.key"))
    other.load()
    hoard.box = other
    locked = await hoard.item_view(item["id"], ALEX)
    assert locked["hiding_spot"] is None and locked["hiding_spot_locked"]
    assert await hoard.rekey([old_key]) == 1
    assert (await hoard.item_view(item["id"], ALEX))["hiding_spot"] == "Top shelf of pole barn tote #4"
    assert await hoard.rekey([old_key]) == 0
    cleared = await hoard.save_item({"id": item["id"], "hiding_spot": ""}, ALEX)
    assert cleared["hiding_spot"] is None


async def test_key_file_is_created_once(tmp_path) -> None:
    path = tmp_path / "s" / "hoard.key"
    box = SecretBox(str(path))
    box.load()
    token = box.encrypt("garage")
    again = SecretBox(str(path))
    again.load()
    assert again.decrypt(token) == ("garage", True) and box.key == again.key
    path.write_bytes(b"not a key")
    broken = SecretBox(str(path))
    broken.load()
    assert broken.decrypt(token) == (None, False) and (tmp_path / "s" / "hoard.key.bad").exists()


async def test_price_checks_history_and_alerts(hoard, clock) -> None:
    plan = hoard.test_plan
    fetcher = hoard.fetcher
    item = await hoard.save_item({"plan_id": plan["id"], "title": "4k monitor", "target_price": 250}, ALEX)
    with_url = await hoard.add_url(item["id"], ALEX, url="https://www.bestbuy.com/site/lg/1.p")
    assert with_url["status"] == "watching" and with_url["urls"][0]["retailer_name"] == "Best Buy" and with_url["tier"] == "tracked"
    assert len(hoard.test_spawned) == 1, "the first check runs in the background"
    await hoard.add_url(item["id"], ALEX, url="https://www.amazon.com/dp/B0X", check=False)
    with pytest.raises(PlannerError):
        await hoard.add_url(item["id"], ALEX, url="https://www.amazon.com/dp/B0X", check=False)
    with pytest.raises(PlannerError):
        await hoard.add_url(item["id"], ALEX, url="http://192.168.1.5/admin", check=False)
    urls = {u["retailer_name"]: u["id"] for u in with_url["urls"]} | {"Amazon": (await hoard.item_view(item["id"], ALEX))["urls"][1]["id"]}

    fetcher.pages = {"https://www.bestbuy.com/site/lg/1.p": product_page(279), "https://www.amazon.com/dp/B0X": product_page(289)}
    assert await hoard.check_urls(list(urls.values())) == 2
    view = await hoard.item_view(item["id"], ALEX)
    assert view["best"]["price"] == 279 and view["best"]["retailer"] == "Best Buy" and view["image_url"] == "https://img.example/lg.jpg"
    assert hoard.test_alerts == [], "the first prices only set the baseline"

    clock.now += timedelta(days=1)
    fetcher.pages["https://www.bestbuy.com/site/lg/1.p"] = product_page(249.99)
    await hoard.check_urls(list(urls.values()))
    assert [(a["kind"], a["price"], a["all_time_low"]) for a in hoard.test_alerts] == [("target", 249.99, True)]
    assert "🎯 4k monitor is $249.99 at Best Buy" in alert_message(hoard.test_alerts[0])
    await hoard.check_urls(list(urls.values()))
    assert len(hoard.test_alerts) == 1, "the same price never alerts twice"

    clock.now += timedelta(days=1)
    fetcher.pages["https://www.amazon.com/dp/B0X"] = product_page(239, in_stock=False)
    await hoard.check_urls(list(urls.values()))
    assert len(hoard.test_alerts) == 1, "an out-of-stock store doesn't count as the best price"

    view = await hoard.item_view(item["id"], ALEX)
    assert view["meets_target"] and view["all_time_low"] == 239 and len(view["sparkline"]) == 3
    assert view["average_price"] and view["below_average_pct"] > 0
    assert [p["price"] for p in (await hoard.history(item["id"], ALEX))["points"]][-2:] == [249.99, 239.0]

    # Bought at Best Buy: the refund guard keeps watching and alerts on any drop below what was paid.
    bought = await hoard.mark_purchased(item["id"], ALEX, paid_price=249.99, store="Best Buy", protection_days=14)
    assert bought["status"] == "purchased" and bought["protection"]["days_left"] == 14 and bought["protection"]["claim"] is None
    clock.now += timedelta(days=9)
    fetcher.pages["https://www.amazon.com/dp/B0X"] = product_page(229)
    await hoard.check_urls(list(urls.values()))
    protection = hoard.test_alerts[-1]
    assert protection["kind"] == "protection" and protection["savings"] == 20.99 and protection["days_since_purchase"] == 9
    assert alert_message(protection) == "💰 Price Drop Alert! 4k monitor dropped to $229.00 at Amazon ($20.99 less than you paid 9 days ago) — Claim your price adjustment!"
    claim = (await hoard.item_view(item["id"], ALEX))["protection"]["claim"]
    assert claim == {"price": 229.0, "retailer": "Amazon", "url": "https://www.amazon.com/dp/B0X", "savings": 20.99}
    await hoard.check_urls(list(urls.values()))
    assert len(hoard.test_alerts) == 2, "the same drop alerts once"

    # After the window closes the item is no longer polled.
    clock.now += timedelta(days=10)
    fetcher.calls.clear()
    result = await hoard.tick()
    assert result["checked"] == 0 and fetcher.calls == []


async def test_secret_alerts_carry_no_details(hoard) -> None:
    plan = hoard.test_plan
    board = await hoard.board(plan["id"], ALEX)
    gift = await hoard.save_item({"plan_id": plan["id"], "title": "Telescope", "section_id": section(board, "Christmas")["id"], "gift_for_person_id": "person.sam", "target_price": 300}, ALEX)
    await hoard.add_url(gift["id"], ALEX, url="https://shop.example/scope", check=False)
    url_id = (await hoard.item_view(gift["id"], ALEX))["urls"][0]["id"]
    hoard.fetcher.pages = {"https://shop.example/scope": product_page(320)}
    await hoard.check_urls([url_id])
    hoard.fetcher.pages = {"https://shop.example/scope": product_page(280)}
    await hoard.check_urls([url_id])
    alert = hoard.test_alerts[-1]
    assert alert["secret"] and "Telescope" not in alert_message(alert)
    assert alert_message(alert).startswith("🐉 A secret gift")


async def test_failures_back_off_and_explain_themselves(hoard, clock) -> None:
    plan = hoard.test_plan
    item = await hoard.save_item({"plan_id": plan["id"], "title": "Router"}, ALEX)
    await hoard.add_url(item["id"], ALEX, url="https://www.walmart.com/ip/1", check=False)
    await hoard.add_url(item["id"], ALEX, url="https://niche.example/router", check=False)
    hoard.fetcher.pages = {"https://www.walmart.com/ip/1": FetchError("blocked", status=403), "https://niche.example/router": product_page(None)}
    view = await hoard.item_view(item["id"], ALEX)
    await hoard.check_urls([u["id"] for u in view["urls"]])
    rows = {u["retailer_name"]: u for u in (await hoard.item_view(item["id"], ALEX))["urls"]}
    assert "refused the automatic check (HTTP 403)" in rows["Walmart"]["last_error"]
    assert "add a custom selector" in rows["Niche"]["last_error"]
    raw = await hoard.db.row(hoard_urls_table(), rows["Walmart"]["id"])
    assert raw["failures"] == 1
    assert not HoardManager._due(raw, 6, clock.now + timedelta(hours=7)), "one failure doubles the wait"
    assert HoardManager._due(raw, 6, clock.now + timedelta(hours=13))
    fixed = await hoard.update_url(rows["Niche"]["id"], ALEX, {"css_selector": ".price@data-v"})
    assert fixed["urls"][1]["css_selector"] == ".price@data-v"
    with pytest.raises(PlannerError):
        await hoard.update_url(rows["Niche"]["id"], ALEX, {"css_selector": "div["})


def hoard_urls_table():
    from taskdragon.database import HURLS

    return HURLS


async def test_manual_check_is_rate_limited(hoard) -> None:
    plan = hoard.test_plan
    item = await hoard.save_item({"plan_id": plan["id"], "title": "Drill"}, ALEX)
    with pytest.raises(PlannerError):
        await hoard.check_now(item["id"], ALEX)
    await hoard.add_url(item["id"], ALEX, url="https://shop.example/drill", check=False)
    hoard.fetcher.pages = {"https://shop.example/drill": product_page(99)}
    checked = await hoard.check_now(item["id"], ALEX)
    assert checked["best"]["price"] == 99
    with pytest.raises(PlannerError) as caught:
        await hoard.check_now(item["id"], ALEX)
    assert caught.value.code == "rate_limited"


RSS = b"""<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Samsung 32" 4K Monitor $279</title><link>https://slickdeals.net/f/2</link></item>
<item><title>LG 27" 4K Monitor $449</title><link>https://slickdeals.net/f/1</link></item>
<item><title>Air fryer $49</title><link>https://slickdeals.net/f/9</link></item>
</channel></rss>"""


async def test_deal_radar_finds_dismisses_and_promotes(hoard) -> None:
    plan = hoard.test_plan
    item = await hoard.save_item({"plan_id": plan["id"], "title": "4k monitor", "target_price": 300, "watch_keyword_deals": True}, ALEX)
    reddit = {"data": {"children": [{"data": {"title": "[Monitor] Dell 27 4K USB-C monitor - $229.99", "permalink": "/r/buildapcsales/comments/z/", "url": "https://www.dell.com/monitor"}}]}}
    hoard.fetcher.pages = {slickdeals_url("4k monitor"): RSS, reddit_url("4k monitor"): reddit}
    assert await hoard.refresh_deals() == 2
    view = await hoard.item_view(item["id"], ALEX)
    assert {d["url"] for d in view["deals"]} == {"https://slickdeals.net/f/2", "https://www.dell.com/monitor"}, "the $449 deal is over the target"
    assert await hoard.refresh_deals() == 0, "searched less than three hours ago"
    slick = next(d for d in view["deals"] if d["source"] == "slickdeals")
    await hoard.deal_action(slick["id"], "dismiss", ALEX)
    assert await hoard.refresh_deals([item["id"]], force=True) == 0, "a dismissed deal never comes back"
    dell = next(d for d in view["deals"] if d["source"] == "reddit")
    promoted = await hoard.deal_action(dell["id"], "promote", ALEX)
    assert promoted["urls"][0]["url"] == "https://www.dell.com/monitor" and promoted["status"] == "watching" and promoted["deals"] == []
    with pytest.raises(PlannerError):
        await hoard.deal_action(dell["id"], "explode", ALEX)


async def test_scan_price_check_and_buying_in_store(hoard) -> None:
    plan = hoard.test_plan
    hoard.products.product = {
        "title": "Apple AirPods Pro",
        "brand": "Apple",
        "model": "MWP22AM/A",
        "image": "https://img.example/airpods.jpg",
        "offers": [
            {"merchant": "Walmart", "price": 189.0, "link": "https://www.upcitemdb.com/norob/alink/?id=2", "in_stock": True},
            {"merchant": "Best Buy", "price": 199.99, "link": "https://www.upcitemdb.com/norob/alink/?id=1", "in_stock": True},
        ],
        "source": "UPCitemdb",
    }
    res = await hoard.scan_price_check("885909950805", SAM, symbology="upc_a")
    assert res["barcode"] == "0885909950805" and res["display"] == "885909950805" and res["plan_id"] == plan["id"]
    assert res["best_online"]["price"] == 189.0 and res["best_online"]["retailer"] == "Walmart" and res["local"] == []
    assert {l["name"] for l in res["search_links"]} >= {"Amazon", "CamelCamelCamel"} and res["model_links"]
    assert {s["kind"] for s in res["sections"]} == {"want", "holiday", "birthday"}
    want = next(s for s in res["sections"] if s["kind"] == "want")
    bought = await hoard.add_from_scan(
        {
            "plan_id": plan["id"],
            "barcode": res["barcode"],
            "title": "Apple AirPods Pro",
            "brand": "Apple",
            "image_url": "http://insecure.example/x.jpg",
            "section_id": want["id"],
            "offers": [{"url": o["url"], "retailer_name": o["retailer"]} for o in res["online"]],
            "shelf_price": 179,
            "store": "Target",
            "bought": True,
        },
        SAM,
    )
    assert bought["status"] == "purchased" and bought["paid_price"] == 179 and bought["purchase_store"] == "Target"
    assert bought["protection"]["days"] == 30 and len(bought["urls"]) == 2 and bought["image_url"] is None
    assert len(hoard.test_spawned) == 1
    points = (await hoard.history(bought["id"], SAM))["points"]
    assert {(p["source"], p["store"], p["price"]) for p in points} == {("in_store", "Target", 179.0), ("purchase", "Target", 179.0)}
    # Scanning it again finds the item on the list; the lookup limit is reported, not fatal.
    hoard.products.error = LookupLimit("used up", status=429)
    again = await hoard.scan_price_check("0885909950805", ALEX)
    assert again["lookup"] == "limit" and [i["id"] for i in again["local"]] == [bought["id"]] and again["product"]["title"] == "Apple AirPods Pro"
    with pytest.raises(PlannerError):
        await hoard.scan_price_check("", ALEX)


async def test_scan_fills_in_an_existing_item(hoard) -> None:
    plan = hoard.test_plan
    item = await hoard.save_item({"plan_id": plan["id"], "title": "Earbuds", "brand": "Mine"}, ALEX)
    updated = await hoard.add_from_scan({"item_id": item["id"], "barcode": "885909950805", "brand": "Apple", "model": "MWP22AM/A", "shelf_price": 199}, ALEX)
    assert updated["barcode"] == "0885909950805" and updated["brand"] == "Mine" and updated["model"] == "MWP22AM/A"


async def test_budget_bar_counts(hoard) -> None:
    plan = hoard.test_plan
    board = await hoard.board(plan["id"], ALEX)
    xmas = section(board, "Christmas")
    await hoard.save_section({"id": xmas["id"], "budget": 1000}, ALEX)
    for title, status, paid in (("Lego", "wrapped", 120), ("Bike", "purchased", 300), ("Book", "watching", None), ("Scarf", "idea", None), ("Puzzle", "gifted", 25)):
        created = await hoard.save_item({"plan_id": plan["id"], "title": title, "section_id": xmas["id"], "status": status}, ALEX)
        if paid:
            await hoard.mark_purchased(created["id"], ALEX, paid_price=paid, protection_days=0)
    summary = section(await hoard.board(plan["id"], ALEX), "Christmas")
    assert summary["budget"] == 1000 and summary["summary"] == {"total": 5, "spent": 445.0, "bought": 3, "watching": 1, "ideas": 1, "wrapped": 2, "gifted": 1, "hidden": 0}


async def test_impulse_cooldown_and_settings(hoard) -> None:
    plan = hoard.test_plan
    settings = await hoard.save_settings({"impulse_days": 99, "check_hours": 0, "impulse_threshold": 150, "tracking": False, "bogus": 1})
    assert settings["impulse_days"] == 60 and settings["check_hours"] == 1 and settings["impulse_threshold"] == 150.0 and settings["tracking"] is False
    await hoard.save_settings({"impulse_days": 7})
    item = await hoard.save_item({"plan_id": plan["id"], "title": "Espresso machine", "target_price": 600, "impulse_cooldown": True}, ALEX)
    assert item["cooldown"] == {"until": "2026-11-03", "days_left": 7, "active": True}
    cheap = await hoard.save_item({"plan_id": plan["id"], "title": "Mug", "target_price": 12}, ALEX)
    assert not cheap["cooldown_eligible"]
    off = await hoard.save_item({"id": item["id"], "impulse_cooldown": False}, ALEX)
    assert off["cooldown"] is None
    assert (await hoard.tick())["checked"] == 0, "tracking is switched off"


async def test_delete_with_undo(hoard, planner) -> None:
    plan = hoard.test_plan
    item = await hoard.save_item({"plan_id": plan["id"], "title": "Kayak"}, ALEX)
    await hoard.add_url(item["id"], ALEX, url="https://shop.example/kayak", check=False)
    await hoard.record_price(item["id"], ALEX, price=499, store="REI")
    payload = await hoard.delete_item(item["id"], ALEX)
    token = planner.stash_undo("hoard_item", payload, ALEX)
    assert (await hoard.board(plan["id"], ALEX))["items"] == []
    assert (await planner.undo(token, ALEX))["restored"] == [item["id"]]
    back = await hoard.item_view(item["id"], ALEX)
    assert back["urls"][0]["url"] == "https://shop.example/kayak" and (await hoard.history(item["id"], ALEX))["points"][0]["price"] == 499


async def test_sections_crud_and_cloning(hoard, planner) -> None:
    plan = hoard.test_plan
    halloween = await hoard.save_section({"plan_id": plan["id"], "name": "Halloween", "kind": "holiday", "icon": "mdi:pumpkin", "event_date": "2026-10-31", "repeats_yearly": True, "budget": 80}, ALEX)
    assert halloween["days_left"] == 4 and halloween["is_gift"]
    with pytest.raises(PlannerError):
        await hoard.save_section({"plan_id": plan["id"], "name": "Bad", "icon": "javascript:alert(1)"}, ALEX)
    item = await hoard.save_item({"plan_id": plan["id"], "title": "Costume", "section_id": halloween["id"]}, ALEX)
    await hoard.save_section({"plan_id": plan["id"], "name": "Secret stuff", "stealth_mode": True}, ALEX)
    copy = await planner.clone_plan(plan["id"], "Wishlist 2027", actor=ALEX)
    copied = await hoard.board(copy["id"], ALEX)
    assert "Halloween" in [s["name"] for s in copied["sections"]] and "Secret stuff" not in [s["name"] for s in copied["sections"]]
    assert copied["items"] == []
    board = await hoard.board(plan["id"], ALEX)
    want = section(board, "Want to Buy")["id"]
    moved = await hoard.delete_section(halloween["id"], ALEX, move_to=want)
    assert moved == {"moved": 1, "to": want, "categories": 0}
    assert (await hoard.item_view(item["id"], ALEX))["section_id"] == want


def test_next_occurrence_and_messages() -> None:
    today = date(2026, 10, 27)
    assert next_occurrence("2020-12-25", True, today) == date(2026, 12, 25)
    assert next_occurrence("2020-03-01", True, today) == date(2027, 3, 1)
    assert next_occurrence("2024-02-29", True, date(2026, 3, 5)) == date(2027, 2, 28)
    assert next_occurrence("2026-11-05", False, today) == date(2026, 11, 5)
    assert next_occurrence(None, True, today) is None
    low = {"kind": "all_time_low", "title": "Router", "price": 89.0, "retailer": "Newegg"}
    assert alert_message(low) == "📉 New all-time low: Router is $89.00 at Newegg."
    assert alert_message({**low, "kind": "protection", "savings": 5, "days_since_purchase": 1}).endswith("($5.00 less than you paid 1 day ago) — Claim your price adjustment!")
    assert TZ.key == "America/Chicago"


async def test_portable_backup_carries_the_key(hoard, planner, tmp_path) -> None:
    """A restore on another installation re-encrypts hiding spots under that installation's key."""
    import zipfile
    from datetime import datetime

    from taskdragon.backup_manager import BackupManager
    from taskdragon.database import TaskDragonDB

    plan = hoard.test_plan
    gift = await hoard.save_item({"plan_id": plan["id"], "title": "Bike", "hiding_spot": "Garage loft"}, ALEX)

    async def users():
        return []

    source = BackupManager(
        db=hoard.db, docs_dir=str(tmp_path / "docs"), backup_dir=str(tmp_path / "backups"), app_version="test",
        users=users, people=lambda: [], options=lambda: {}, local_now=lambda: datetime(2026, 10, 27, 9, 0),
        secrets_provider=lambda: _async({"hoard.key": hoard.box.key}),
    )
    snapshot = await source.create_snapshot("snapshot")
    path = source.snapshot_path(snapshot["name"])
    with zipfile.ZipFile(path) as archive:
        assert archive.read("secrets/hoard.key") == hoard.box.key
        manifest = json.loads(archive.read("manifest_bridge.json"))
    assert "secrets/hoard.key" in manifest["files"]

    other_db = TaskDragonDB(str(tmp_path / "other" / "taskdragon.db"))
    await other_db.async_open()
    try:
        other_box = SecretBox(str(tmp_path / "other" / "hoard.key"))
        other_box.load()
        other = HoardManager(other_db, planner, box=other_box, fetcher=FakeFetcher(), products=FakeProducts())
        received: list[dict] = []

        async def restore_secrets(keys):
            received.append(dict(keys))
            await other.rekey([keys["hoard.key"]])

        target = BackupManager(
            db=other_db, docs_dir=str(tmp_path / "other" / "docs"), backup_dir=str(tmp_path / "other" / "backups"), app_version="test",
            users=users, people=lambda: [], options=lambda: {}, local_now=lambda: datetime(2026, 10, 27, 9, 5),
            restore_secrets=restore_secrets,
        )
        await target.restore_file(path, "replace")
        assert received == [{"hoard.key": hoard.box.key}]
        raw = await other_db.row(HITEMS, gift["id"])
        assert other_box.decrypt(raw["hiding_spot"]) == ("Garage loft", True)
    finally:
        await other_db.async_close()


async def _async(value):
    return value


async def test_gifts_for_people_without_an_account_are_still_secret(hoard) -> None:
    plan = hoard.test_plan
    item = await hoard.save_item({"plan_id": plan["id"], "title": "Rain boots", "recipient_name": "Ellie"}, ALEX)
    assert item["secret"]
    kid_view = await hoard.board(plan["id"], KID)
    assert kid_view["items"][0]["secret"], "nobody's login to hide it from, but kiosks cover it and alerts leave it out"


async def test_categories_under_an_occasion(hoard, planner) -> None:
    plan = hoard.test_plan
    board = await hoard.board(plan["id"], ALEX)
    xmas = section(board, "Christmas")
    ellie = await hoard.save_section({"plan_id": plan["id"], "name": "Ellie", "parent_id": xmas["id"], "budget": 150, "kind": "want", "event_date": "2027-01-01"}, ALEX)
    sams = await hoard.save_section({"plan_id": plan["id"], "name": "Sam's list", "parent_id": xmas["id"], "gift_for_person_id": "person.sam"}, ALEX)
    assert ellie["parent_id"] == xmas["id"] and ellie["kind"] == "holiday" and ellie["is_gift"], "a category takes its occasion's type"
    assert ellie["event_date"] is None and ellie["days_left"] == xmas["days_left"], "and its countdown"
    with pytest.raises(PlannerError):
        await hoard.save_section({"plan_id": plan["id"], "name": "Deeper", "parent_id": ellie["id"]}, ALEX)
    with pytest.raises(PlannerError):
        await hoard.save_section({"id": xmas["id"], "parent_id": section(board, "Birthdays")["id"]}, ALEX)  # it has categories
    with pytest.raises(PlannerError):
        await hoard.save_section({"id": ellie["id"], "parent_id": ellie["id"]}, ALEX)
    other = await planner.create_plan({"name": "Other wishlist", "archetype": "wishlist_hoard"})
    with pytest.raises(PlannerError):
        await hoard.save_section({"plan_id": other["id"], "name": "Elsewhere", "parent_id": xmas["id"]}, ALEX)

    doll = await hoard.save_item({"plan_id": plan["id"], "title": "Doll house", "section_id": ellie["id"]}, ALEX)
    await hoard.mark_purchased(doll["id"], ALEX, paid_price=120, purchase_date="2026-10-27", store="Toy shop", protection_days=0)
    bike = await hoard.save_item({"plan_id": plan["id"], "title": "Bike", "section_id": sams["id"]}, ALEX)
    assert doll["secret"] and bike["secret"], "everything in a gift occasion's category is a gift"

    alex_view = await hoard.board(plan["id"], ALEX)
    assert section(alex_view, "Christmas")["summary"]["spent"] == 120 and section(alex_view, "Christmas")["summary"]["total"] == 2
    assert section(alex_view, "Ellie")["summary"]["spent"] == 120 and section(alex_view, "Ellie")["budget"] == 150
    # Sam can't see the category made for Sam, or what's in it: it's announced under Christmas instead.
    sam_view = await hoard.board(plan["id"], SAM)
    assert "Sam's list" not in [s["name"] for s in sam_view["sections"]] and "Ellie" in [s["name"] for s in sam_view["sections"]]
    assert [i["title"] for i in sam_view["items"]] == ["Doll house"]
    assert {"section_id": xmas["id"], "buyer": "Alex", "count": 1} in sam_view["hidden"]
    for call in (hoard.item_view(bike["id"], SAM), hoard.save_section({"id": sams["id"], "name": "Peek"}, SAM)):
        with pytest.raises(PlannerError):
            await call
    # The occasion's secret hides its categories too.
    birthdays = section(board, "Birthdays")
    secret = await hoard.save_section({"id": birthdays["id"], "stealth_mode": True}, ALEX)
    party = await hoard.save_section({"plan_id": plan["id"], "name": "Party bags", "parent_id": secret["id"]}, ALEX)
    assert "Party bags" not in [s["name"] for s in (await hoard.board(plan["id"], SAM))["sections"]]
    with pytest.raises(PlannerError):
        await hoard.save_item({"plan_id": plan["id"], "title": "Balloons", "section_id": party["id"]}, SAM)

    # Changing the occasion's type carries the categories along.
    await hoard.save_section({"id": xmas["id"], "kind": "occasion"}, ALEX)
    assert section(await hoard.board(plan["id"], ALEX), "Ellie")["kind"] == "occasion"

    # Deleting a category moves its items up to the occasion; deleting the occasion takes the rest along.
    moved = await hoard.delete_section(ellie["id"], ALEX)
    assert moved == {"moved": 1, "to": xmas["id"], "categories": 0}
    assert (await hoard.item_view(doll["id"], ALEX))["section_id"] == xmas["id"]
    gone = await hoard.delete_section(xmas["id"], ALEX)
    assert gone["categories"] == 1 and gone["moved"] == 2 and gone["to"] is None
    after = await hoard.board(plan["id"], ALEX)
    assert "Sam's list" not in [s["name"] for s in after["sections"]] and {i["section_id"] for i in after["items"]} == {None}


async def test_categories_are_cloned_and_listed_for_scans(hoard, planner) -> None:
    plan = hoard.test_plan
    board = await hoard.board(plan["id"], ALEX)
    xmas = section(board, "Christmas")
    await hoard.save_section({"plan_id": plan["id"], "name": "Ellie", "parent_id": xmas["id"]}, ALEX)
    await hoard.save_section({"plan_id": plan["id"], "name": "Sam", "parent_id": xmas["id"], "gift_for_person_id": "person.sam"}, ALEX)
    copy = await planner.clone_plan(plan["id"], "Wishlist 2027", actor=ALEX)
    copied = await hoard.board(copy["id"], ALEX)
    copied_xmas = section(copied, "Christmas")
    assert section(copied, "Ellie")["parent_id"] == copied_xmas["id"] and "Sam" not in [s["name"] for s in copied["sections"]]
    scan = await hoard.scan_price_check("012345678905", ALEX, plan_id=plan["id"])
    names = [s["name"] for s in scan["sections"]]
    assert names.index("Christmas › Ellie") == names.index("Christmas") + 1
    assert "Christmas › Sam" not in [s["name"] for s in (await hoard.scan_price_check("012345678905", SAM, plan_id=plan["id"]))["sections"]]
