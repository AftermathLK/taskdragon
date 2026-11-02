<p align="center">
  <img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/banner.webp" alt="TaskDragon: the household planner that lives inside Home Assistant" width="100%">
</p>

<p align="center">
  <a href="https://hacs.xyz/"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/badges/hacs.svg" alt="HACS custom repository"></a>
  <a href="https://www.home-assistant.io/"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/badges/home-assistant.svg" alt="Home Assistant 2024.11 or newer"></a>
  <img src="https://img.shields.io/github/manifest-json/v/AftermathLK/taskdragon?filename=custom_components%2Ftaskdragon%2Fmanifest.json&style=for-the-badge&label=version&color=0A84E0" alt="Version">
  <img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/badges/no-cloud.svg" alt="No cloud">
  <a href="https://ko-fi.com/aftermathlk"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/badges/ko-fi.svg" alt="Support TaskDragon on Ko-fi"></a>
</p>

<p align="center">
  <b>Chores, groceries, Mealie recipes, home maintenance, wishlists and gift plans with price tracking, trips and projects in one card.</b><br>
  Local-first: no cloud, no add-on, no Docker. Everything lives in your Home Assistant.
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#ten-minute-setup">Ten-minute setup</a> ·
  <a href="#features">Features</a> ·
  <a href="#card-configuration">Card options</a> ·
  <a href="docs/GUIDE.md">User guide</a> ·
  <a href="docs/REFERENCE.md">Reference</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

---

TaskDragon is a Home Assistant custom integration plus a dashboard card and sidebar panel. It keeps a household's lists in one SQLite file inside Home Assistant (`.storage/taskdragon.db`), exposes every shared plan as a native `todo.*` entity, and adds what plain to-do lists can't do: recurring chores with streaks, a shopping grid that merges quantities, a Mealie recipe browser and cooking view, an asset register with sensor-driven maintenance, a wishlist and gift planner that tracks prices across stores, a camera barcode scanner, and portable backups.

<table>
  <tr>
    <td width="33%" valign="top"><b>Quick List home screen</b><br>Shared and private lists with sections. Promote any item into a real plan, or make it recurring, in one tap.</td>
    <td width="33%" valign="top"><b>Chores that run themselves</b><br>Morning / afternoon / evening blocks, streaks, rollover, "My Day", a family wall view and shift-aware assignment.</td>
    <td width="33%" valign="top"><b>Groceries with brains</b><br>Aisle tiles, quantity merging (<code>0.5 cup + 120 ml → 1 cup / 240 ml</code>), pantry stock and two-way Mealie sync.</td>
  </tr>
  <tr>
    <td valign="top"><b>Mealie recipes &amp; cooking view</b><br>Browse recipes, add ingredients without the spice rack, plan meals, and cook full screen with timers and keep-awake.</td>
    <td valign="top"><b>Home maintenance</b><br>Objects, intervals, sensor triggers, parts, manuals, NFC and QR completion, learning intervals and a water-softener salt model.</td>
    <td valign="top"><b>Barcode scanner &amp; backups</b><br>Scan filters, salt bags and groceries with the phone camera. Download one portable <code>.zip</code> that can rebuild everything.</td>
  </tr>
  <tr>
    <td valign="top"><b>Wishlists &amp; gift planning</b><br>Want to Buy, holidays with budgets and countdowns, birthdays. Gifts stay hidden from the person they're for.</td>
    <td valign="top"><b>Price tracking across stores</b><br>Track one item at several shops, see the trend, get alerts at your target price, and claim refunds when it drops after you buy.</td>
    <td valign="top"><b>In-store price check</b><br>Scan a barcode in the aisle, type the shelf price, and see at once whether it's cheaper here or online.</td>
  </tr>
</table>

## Features

### Quick List and categories

<p align="center"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/quick-list.webp" alt="The Quick List on desktop, and the category dropdown on a phone" width="100%"></p>

- The card opens on a zero-friction **Quick List**. Switch between the **shared household** list and **your private** one, file items into collapsible sections ("Calls to Make", "House Stuff"…), and type `Calls: dentist` to land straight in a section.
- **Promote** an item into any plan (shopping items get an aisle, packing items go to the next trip), or **Repeat it…** to turn it into a recurring chore.
- One **category dropdown** in the header shows where you are and how many items are open. Create categories with an icon and a behavior (quick list, chores, shopping grid, Kanban, trip packing, maintenance, pantry), and hide or reorder them per person.
- **Brain Dump**: type or say *"pick up 2x4s at Menards Saturday morning and add garlic powder to the grocery list"* and it becomes a project task plus a grocery item, using your Assist LLM when there is one and a built-in parser when there isn't.
- **Swipe** a task right to tick it off and left to clear it away (with Undo), or tap **Clear** on a finished one.

### Chores, My Day and the family view

<p align="center"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/family.webp" alt="Family split view with a column per person, and My Day on a phone" width="100%"></p>

- **Time-blocked chores** with calendar (RRULE) or rolling recurrence, streaks, and a rollover hour so late-night completions count for today.
- **Phone reminders**: pick a phone from the list of companion-app devices (or "whoever it's assigned to") and a time. Each occurrence of a repeating chore pings that phone, with **Done** and **Snooze** buttons right on the notification.
- **My Day** for whoever is signed in, and a **family split** for a wall tablet: a column per person plus the up-for-grabs pool with one-tap **Claim**. "Last done by Sam yesterday at 6:15 PM" on every recurring chore.
- **Shift-aware chores** go each morning to whoever is off work, based on everyone's work calendar.
- **Snooze until context**: until a time, next time I'm home, when we're all home, this weekend if it's not raining, or when any entity reaches a state. **Blocking dependencies** keep Task B blocked (and optionally hidden) until Task A is done.

### Groceries and pantry

<p align="center"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/groceries.webp" alt="Aisle-grouped shopping tiles, and the pantry drawer after scanning an item" width="100%"></p>

- A compact **aisle grid** (Produce, Meat, Dairy, Spices/Pantry…) that merges duplicates and units, with a frequently-bought drawer.
- A **pantry** with In stock / Low / Out. Going low can push the item (or a batch recipe's raw ingredients) to the list, or create a "make a new batch" chore.
- **Two-way Mealie shopping-list sync**: adds, check-offs, edits and deletes propagate both ways.

### Mealie recipe browser

<p align="center"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/recipes.webp" alt="Mealie recipe browser with photos, filters and one-tap actions" width="100%"></p>

- Every Mealie recipe with its photo, categories, time and how often you cooked it. Filter by category or tag, sort, and search.
- **Add ingredients** skips seasonings and anything your pantry has in stock: *"Added 6 items from Chicken Sausage Orzo (Skipped 4 seasonings/pantry items)"*. **Review** lets you choose, and **Plan meal** puts it on Mealie's meal plan.
- The ignored-seasonings list is yours to edit, and Mealie foods labelled as spices are ignored automatically.
- Meal plans drive **prep timelines** (thaw T-36h, smoker T-4h…), **cook** tasks and **leftover** reminders with a countdown.

### Cooking view

<p align="center"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/cooking-view.webp" alt="Full-screen cooking view with keep-screen-on, batch size, ingredients, steps and a running timer" width="100%"></p>

- Open any recipe full screen, readable from across the counter. **Keep screen on while viewing** holds a wake lock and takes it back when you return to the app.
- A **½× to 3× batch multiplier** rescales every amount (1½ cups, ⅔ tsp), ingredients strike through as you measure, and the current step is highlighted.
- Times in the instructions become **Start 15m timer** buttons. Timers keep running in a bar at the bottom and ring, vibrate and show a message when done.
- **Add missing ingredients to Groceries** adds what isn't in the pantry, at the current batch size.

### Barcode scanner

<p align="center"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/barcode-scanner.webp" alt="Scanning a salt bag, using or restocking the part, and linking a new barcode" width="100%"></p>

- Scan from the header, the pantry, or a maintenance object's parts. The camera opens with a framing guide, **flashlight** and **camera switch**, and turns off the moment a code is read.
- **Parts**: one tap for **−1 Use part** (which re-orders when stock runs low), or **Restock** with +1 / +2 / +4 / +6. **Pantry**: a scan marks the item In Stock so recipe imports skip it.
- **New barcodes** are linked in one tap, with the product name suggested by Open Food Facts. Several brands can share one part.
- Works on Android with the built-in barcode reader and on iPhone, the iOS Companion app and desktops with a bundled ZXing reader, so no internet access is needed.

### Wishlist, gifts & price tracker

<p align="center"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/wishlist.webp" alt="Wishlist with a concept tag and its deal matches, a product tracked at three stores with a price trend, and the in-store price check saying buy here on a phone" width="100%"></p>

A **Wishlist & Gifts** category for everything that isn't groceries: a personal or household **Want to Buy** list, holidays (Christmas comes ready, with a **$ budget** and a countdown) and **birthdays and events** for a person. Inside an occasion, keep a **list per person**: Christmas → Ellie, Grandma, Stocking stuffers, each with its own budget, and hidden from the person it's for.

- **Start vague, get specific.** Type "4k monitor" with notes ("27-inch+, IPS or OLED, USB-C PD") and a target price; no link needed. Turn on the **deal radar** and TaskDragon searches Slickdeals and Reddit's deal subreddits for matching posts ("🔥 3 live deal matches found"), each one a tap away from being tracked.
- **Track one item at many stores.** Paste product pages from Amazon, Best Buy, Walmart, Target, Home Depot, Menards, B&H, Newegg or any shop. Prices and stock are checked every few hours; the card shows the **best current price** in green, the other stores, a **30-day sparkline**, how far below average it is, and the lowest price seen. You get a notification at your **target price** or a **new all-time low**.
- **Refund guard.** Mark it bought with the price you paid and TaskDragon keeps watching during the 14- or 30-day return window: *"💰 Price Drop Alert! … $20 less than you paid 9 days ago — Claim your price adjustment!"*
- **In-store scan & price check.** Scan the barcode in the aisle: you get the product, recorded online prices and one-tap searches (Amazon, Walmart, Best Buy, Target, Google Shopping, CamelCamelCamel). Type the shelf price for an instant **✅ Buy here** or **⚠️ Cheaper online** verdict, then add it to the list, add it as a gift, or mark it **bought here** to start the refund guard.
- **No spoilers.** A gift for someone is hidden from that person on their own login ("🐉 1 secret gift hidden by Sam"); the server never sends it to them. **Stealth** items and sections are visible only to whoever added them, and wall tablets in kiosk mode cover secret gifts until someone taps **Show**. (An administrator who downloads a backup or opens Home Assistant's files can still see everything.)
- **Gift pipeline** from Idea to Watching, Purchased, Shipped, Stashed, Wrapped and Gifted, with an encrypted **hiding spot** note ("top shelf of the pole barn, tote #4") so early purchases don't get lost.
- **7-day impulse cooldown** for bigger Want to Buy items, so the tracker can hunt for a sale first.

### Home maintenance and assets

<p align="center"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/maintenance.webp" alt="Maintenance dashboard with status, progress and actions, and a water softener's salt gauge" width="100%"></p>

- Every appliance, system or vehicle is an **object** (`#3`) with **tasks** (`#3.1`), a parts inventory, manuals and invoices, and a full service history.
- Tasks fall due on **rolling or planned intervals**, seasonal windows, or **sensor triggers**: thresholds, counters (gallons, miles, kWh), runtime hours, cycle counts and leak sensors. Feedback (*too early / just right / too late*) teaches TaskDragon a better interval.
- Complete by tapping, scanning an **NFC tag** at the appliance, or a printed **QR code**. Print a **PDF service record** for any date range.
- A **water softener** with a water meter gets a live salt estimate: level, gallons and days until refill, learned from what you see in the tank.

### Projects and trip packing

<p align="center"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/packing-projects.webp" alt="Projects Kanban board, and a trip packing list on a phone" width="100%"></p>

- **Projects** switch between a Kanban board and a dependency tree, with a bill of materials that can be pushed to the hardware list.
- **Trips** are dated and grouped (Clothes, Toiletries, Tech…), with a live "18 / 24 packed" bar. Items flagged *repeatable* start fresh on every new trip.

### Backups and the standalone bridge

<p align="center"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/backups.webp" alt="Settings and backups: download, snapshots, schedule and restore" width="100%"></p>

- **Download a portable backup** (`.zip`) with the database, a plain-JSON dump of every table, every uploaded document and a checksum manifest.
- **Daily snapshots** at 03:15 into `/config/backups/taskdragon/` (the last 14 are kept), plus the `taskdragon.create_backup` service for automations.
- **Restore** with *Merge import* or *Full replace*. Checksums and the schema are verified, and a safety snapshot is taken first.
- The manifest maps every person and every Home Assistant entity, tag and service TaskDragon uses to portable ids, enough to move TaskDragon to a standalone app later.

### Light and dark

<p align="center"><img src="https://raw.githubusercontent.com/AftermathLK/taskdragon/main/docs/images/dark-mode.webp" alt="TaskDragon following a dark Home Assistant theme" width="100%"></p>

The card uses your Home Assistant theme's colors, so it follows light, dark and custom themes.

## Install

### HACS (recommended)

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=AftermathLK&repository=taskdragon&category=integration)

1. Click the button above, or in HACS open **⋮ → Custom repositories**, add `https://github.com/AftermathLK/taskdragon` with type **Integration**.
2. Find **TaskDragon** in HACS and **Download** it.
3. **Restart Home Assistant.** The Python requirements (`aiosqlite`, `beautifulsoup4`, `python-dateutil`) install automatically.

### Manual

1. Download this repository and copy `custom_components/taskdragon` into your Home Assistant `config/custom_components/` folder.
2. Restart Home Assistant.

### Requirements

- Home Assistant **2024.11** or newer (Core, Container, OS or Supervised; nothing else to install).
- Optional: [Mealie](https://mealie.io/) v1 or v2 for recipes, meal plans and shopping sync.
- For the barcode scanner, Home Assistant must be reached over **HTTPS** (or through the Companion app), because browsers only allow the camera on secure pages.

### Coming from OmniPlan?

TaskDragon is the new name of the integration previously published as OmniPlan. The repository moved from `AftermathLK/omniplan` to `AftermathLK/taskdragon`, and the old address redirects here. Nothing is lost when you switch:

1. Install TaskDragon (above) and restart. On its first start TaskDragon copies the old database (lists, maintenance history, barcodes, settings) and the uploaded documents into its own files. The old ones are left untouched.
2. **Add integration → TaskDragon** offers to **import your existing setup** (people, schedule and Mealie connection) in one step.
3. Update what refers to the old name:
   - automations and scripts: `omniplan.*` services become `taskdragon.*`, and `omniplan_*` events become `taskdragon_*`;
   - to-do entities are recreated as `todo.taskdragon_*`;
   - dashboards: change `type: custom:omniplan-card` to `custom:taskdragon-card` (old cards keep working meanwhile);
   - the sidebar panel moves to `/taskdragon`. Printed QR labels that point at `/omniplan` keep opening the right item.
4. Remove OmniPlan: **Settings → Devices & services → OmniPlan → Delete**, then remove it in HACS.

Old portable backups (`/config/backups/omniplan/`) restore through **Upload & restore**.

## Ten-minute setup

1. **Add the integration.**

   [![Open your Home Assistant instance and start setting up TaskDragon.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=taskdragon)

   Or go to **Settings → Devices & services → Add integration → TaskDragon**, then walk through:
   - **Household**: your `person.*` entities, a `weather.*` entity, and optionally an Assist agent for Brain Dump.
   - **Work shifts**: per person, an optional work calendar and shift keywords for shift-aware chores.
   - **Mealie** (optional): URL and API token (Mealie → Profile → API Tokens). TaskDragon tests them before saving and never sends the token to the browser.
   - **Schedule**: rollover hour, shift and weekend-weather check times, meal times, leftovers, prep rules and the sidebar panel.
2. **Link people to users.** In **Settings → People**, link each household member's person to their Home Assistant user, so My Day, Claim and "Last done by" know who is who.
3. **Open TaskDragon.** Use the **TaskDragon** sidebar panel, or add the card to a dashboard (it's in the card picker; no resource to add). TaskDragon starts with Quick List, Daily Chores, Groceries, Hardware, Projects, Home Maintenance, Trip Packing and Pantry & Spices.
4. **Try it.**
   - Type into the Brain Dump bar: *"call the dentist tomorrow and add milk to groceries"*.
   - In **Groceries → Browse Mealie Recipes**, tap a recipe's photo to cook, or **Add ingredients**.
   - In **Home Maintenance**, start from a template (furnace, water softener, smoke detectors…) with **+ Add ▾**.
   - Tap the barcode button in the header and scan something in your pantry.
5. **Protect it.** Under **⋮ → Settings & backups**, download a portable backup and check the daily snapshot schedule.

The [user guide](docs/GUIDE.md) walks through every screen.

## Card configuration

The card's JavaScript is served and registered automatically. Add it from the card picker ("TaskDragon") or in YAML:

```yaml
# Opens on the Quick List (the default)
type: custom:taskdragon-card
view_mode: quick       # quick | auto | personal | kiosk_split
```

```yaml
# Phone / Companion app: opens on "My Day" for whoever is logged in
type: custom:taskdragon-card
view_mode: auto
```

```yaml
# Wall tablet: family split view
type: custom:taskdragon-card
view_mode: kiosk_split
title: Today
```

```yaml
# One plan only, no category dropdown (e.g. the grocery list on the fridge tablet)
type: custom:taskdragon-card
plan: Groceries        # plan name or id
```

| Option | Default | Description |
| --- | --- | --- |
| `view_mode` | `quick` | `quick` opens on the Quick List, `personal` on My Day, `kiosk_split` on the family split, and `auto` picks personal when your user is linked to a person. |
| `plan` | none | Show one plan only (name or id). |
| `plans` | all | Plan names or ids to offer in the category dropdown. |
| `person` | your person | Force whose My Day is shown. |
| `title` | `TaskDragon` | Card title. |
| `show_brain_dump` | `true` | Show the Brain Dump bar and microphone. |

## Documentation

| | |
| --- | --- |
| [User guide](docs/GUIDE.md) | Everyday use, recurrence, home maintenance, Mealie and the cooking view, the wishlist and price tracker, barcode scanning, backups. |
| [Reference](docs/REFERENCE.md) | Services, events for automations, the privacy and security model, code layout and development. |
| [Changelog](CHANGELOG.md) | What changed in each version. |

## Privacy and security

- **Local-first.** Data stays in Home Assistant. The only outside calls are the ones you set up: your Mealie server, Open Food Facts for unknown barcodes, and for the wishlist the store pages you add, the deal radar's searches (Slickdeals, Reddit) and UPCitemdb for scanned products. Only the page address, search words or barcode number are sent, and an administrator can turn each one off.
- **Gifts stay secret on the server.** A gift is never sent to the person it's for, stealth items only to whoever added them, and alerts about secret gifts leave out the name and price. Wishlists get no `todo.*` entity. This protects gifts in the app, not from administrators: a portable backup holds every gift and the key to the hiding-spot notes, and an administrator can read Home Assistant's files.
- **Store links can't reach your network.** The price tracker only fetches public `http(s)` addresses on the standard ports, re-checks every redirect, and refuses DNS answers that point inside your network, so a pasted link can't probe your router or Home Assistant.
- **Private lists are filtered on the server.** Every command checks each id against the signed-in user, and other people's private items answer exactly like items that don't exist. Private lists get no `todo.*` entity.
- **Secrets stay on the server.** The Mealie token never reaches the browser; recipe photos come through an authenticated proxy.
- **Escape-by-default rendering** with an allow-list sanitizer, parameterized SQL everywhere, server-side undo tokens, and administrator-only backups and household settings.

Details are in the [reference](docs/REFERENCE.md#privacy--security).

## Development

```bash
pip install -r requirements_test.txt
pytest tests          # pure logic, no Home Assistant needed
pytest tests_ha       # end-to-end against a real Home Assistant core
```

See the [reference](docs/REFERENCE.md#development) for the module map.

## Support

TaskDragon is free and stays that way. If it saves your household some time, you can [buy me a coffee on Ko-fi](https://ko-fi.com/aftermathlk). Bug reports and ideas are just as welcome in the [issues](https://github.com/AftermathLK/taskdragon/issues).

## Credits

- Built for [Home Assistant](https://www.home-assistant.io/); icons are [Material Design Icons](https://pictogrammers.com/library/mdi/) as shipped with Home Assistant.
- Recipe features use the [Mealie](https://mealie.io/) API. Product suggestions come from [Open Food Facts](https://world.openfoodfacts.org/).
- The barcode fallback is [ZXing](https://github.com/zxing-js/library) 0.23.0 (Apache License 2.0), bundled unmodified in `custom_components/taskdragon/frontend/vendor/`.
- Screenshots show demo data in a test harness; recipe photos are illustrations. The TaskDragon emblem is an original ouroboros design.
