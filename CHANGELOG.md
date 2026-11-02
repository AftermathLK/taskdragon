# Changelog

## 1.5.0 (2026-11-01)

- **Phone reminders on tasks.** The task editor has a **Phone reminder** field. It lists the phones and tablets that have the Home Assistant companion app, plus "whoever it's assigned to". The reminder goes out on the due date at the time you pick, or at the due time, and again every time the task repeats. Each notification has **Done** and **Snooze 60 min** buttons that act as the person whose phone it was. Administrators can also pick any other `notify.*` service. A reminder set after its time waits for the next occurrence. One that Home Assistant couldn't send on time is dropped once it's more than six hours late.
- **Swipe away tasks.** On a phone, swipe a task right to tick it off (or un-tick it), and left to clear it off the list (deleting asks first for repeating tasks). Finished one-off tasks also get a **Clear** button. Both have Undo.
- **Wishlist categories.** An occasion can hold categories, one per person or group: Christmas → Ellie, Grandma, Stocking stuffers. Each category has its own budget, recipient and secret setting, and shares its occasion's date and countdown. The occasion's budget bar counts everything inside it. A category for a household member is hidden from that person, along with everything in it. Everything in a gift occasion's categories counts as a gift, so wall tablets cover it. Deleting a category moves its items up to the occasion.
- **A quieter header.** Search is now a magnifier button in the header instead of a permanent row; Escape closes it. On the wishlist, the Brain Dump bar is hidden and the second scan button is gone. Adding an idea and **Price check** share one row, and the tracker settings moved to the ⋮ menu.
- Making a starter section (Want to Buy, Christmas, Birthdays) secret now hides it from everyone else. It used to have no owner, so the setting had no effect. Whoever makes it secret becomes its owner.
- A **Support on Ko-fi** link in the README and on GitHub.
- Database schema 6: reminder columns on tasks, `parent_id` on wishlist sections. Older backups restore as before.

## 1.4.1 (2026-10-31)

Fixes from a security review. Nothing was exploitable without being signed in to Home Assistant, and none of it was Critical or High.

- **On-complete device actions** are stamped with the administrator who saved them and only run while that person is still an active administrator. Actions that come back through a backup restore are paused until an administrator saves the task again; the restore report and the task say so. Actions saved before this version keep working.
- **Uploads** read their form fields with a size limit, so a huge field can't exhaust Home Assistant's memory, and a document can only be attached to a service record of the same object.
- **Price tracker**: IPv6 addresses that carry an IPv4 address (NAT64, 6to4, IPv4-mapped) are judged by that address, so they can't reach your network; Teredo is refused.
- **Wishlist photos** are fetched by Home Assistant and shown through an authenticated endpoint, so viewers' browsers never contact a store (and a gift's photo stays hidden from its recipient). A product page's photo on a private or plain-http address is ignored.
- **Per-user limits**: 120 store checks, deal searches and photo downloads and 40 UPC lookups an hour, 30 Brain Dumps per ten minutes, and at most 2,000 items per wishlist.
- **Administrator-only**: the `taskdragon.run_shift_balance` service (as over WebSocket), the household recipe-import filter, and picking another conversation agent in `taskdragon.parse_brain_dump`.
- **Fixed**: person pictures and product photos never appeared. The card's style check removed every quoted `url('…')`. It now allows `http(s)` and same-origin images again and still refuses everything else, including protocol-relative `//host` addresses.
- Signed download links live 60 seconds (30 for backups) instead of 5 minutes; non-administrators no longer receive people's work-calendar entities; a malformed time in a Brain Dump action fails only that action; a deal search or feed with an unknown character set no longer stops the rest of the round; two dashboards opening a new wishlist at once, or two tabs creating a personal Quick List, no longer create duplicates; an alert can't be sent twice when "Check now" overlaps the scheduled check.
- The docs now say plainly that gift privacy doesn't extend to Home Assistant administrators, who can read backups and files.

## 1.4.0 (2026-10-31)

**Wishlist, gifts & price tracker.** A new category type (`wishlist_hoard`) for everything that isn't groceries; existing installations get a **Wishlist & Gifts** category.

- **Sections**: Want to Buy, Christmas and Birthdays to start, plus any occasion, each with an optional budget (*Spent $420 / $1,000 budget · 6 bought · 3 watching · 2 wrapped*), a date or yearly countdown, and a recipient.
- **Three tiers**: concept tags with spec notes, a target price and a **deal radar** (Slickdeals and Reddit deal searches); products tracked at up to 12 stores, with price and stock checked every few hours, history, a 30-day sparkline, the best price in green and *% below average*; and after purchase a 14- or 30-day **price-protection** watch.
- **Price extraction** runs a four-stage cascade: schema.org JSON-LD, product meta tags, built-in layouts for 14 large retailers, then an optional custom CSS selector per store (`selector@attribute`).
- **Alerts** at the target price, a new all-time low, and a drop below what you paid (*"💰 Price Drop Alert! … Claim your price adjustment!"*). They arrive as a persistent notification, through the wishlist's notify service, and as the new `taskdragon_price_alert` event.
- **In-store scan & price check**: scan a barcode for the product (UPCitemdb, then Open Food Facts), recorded online prices and one-tap store searches. Type the shelf price for a **Buy here / Cheaper online** verdict, then add to Want to Buy, add as a stealth gift, or mark **bought here**. That last one starts price protection.
- **Anti-spoiler privacy** enforced on the server: gifts are hidden from the person they're for (*🐉 1 secret gift hidden by Sam*), stealth items and sections are seen only by whoever added them, and kiosk views cover secret gifts until tapped. Alerts about secret gifts carry no details.
- **Gift pipeline** (Idea → Watching → Purchased → Shipped → Stashed → Wrapped → Gifted) with an encrypted **hiding spot** note. Portable backups carry its key (`secrets/hoard.key`).
- **7-day impulse cooldown** for bigger Want to Buy items.
- Store links can never reach your own network: only public `http(s)` addresses, every redirect re-checked, and DNS answers pointing inside the network refused.
- Database schema 5. New requirement `beautifulsoup4` (installed automatically).

## 1.3.4 (2026-10-31)

**OmniPlan is now TaskDragon.** Same integration, new name and emblem (a monochrome ouroboros dragon).

- Domain `taskdragon`: folder `custom_components/taskdragon`, services `taskdragon.*`, events `taskdragon_*`, WebSocket commands `taskdragon/*`, card `custom:taskdragon-card` (bundle `/taskdragon_static/taskdragon-card.js`), sidebar panel `/taskdragon`.
- The repository is now [AftermathLK/taskdragon](https://github.com/AftermathLK/taskdragon); the old `AftermathLK/omniplan` address redirects.
- The card header and the sidebar show the TaskDragon emblem (the `taskdragon:dragon` icon, also usable anywhere Home Assistant takes an icon).
- **Upgrading**: the first start copies the previous installation's database and documents, the config flow imports its people, schedule and Mealie connection, dashboards that still say `custom:omniplan-card` keep working, old `/omniplan` QR links still open, and old backups and Mealie `omniplan:` prep notes are still understood. See [Coming from OmniPlan?](README.md#coming-from-omniplan).

Versions below were released as OmniPlan.

## 1.3.3 (2026-10-29)

- **Docs**: new README with screenshots and a ten-minute setup, a full [user guide](docs/GUIDE.md), a [reference](docs/REFERENCE.md), an app icon and a social preview image.
- **Fix**: the default Home Maintenance category icon (`mdi:home-wrench`) doesn't exist in Material Design Icons, so it showed blank in the card and on its `todo.*` entity. New installs use `mdi:tools`, and existing plans are updated on startup.
- **Fix**: long grocery tile names no longer run under the tile's ⋯ button.
- Buttons that showed both an icon and an emoji (Scan, Add missing ingredients, timers, backup actions) now show just the icon, matching Home Assistant.

## 1.3.2 (2026-10-29)

- **Barcode scanner** for the pantry, maintenance parts and the card header: the browser's built-in reader where available and a bundled ZXing reader elsewhere, with flashlight, camera switch and manual entry. Parts get *Use* and *Restock* actions, pantry staples are marked In Stock, and new barcodes are linked in one tap with Open Food Facts suggestions.
- **Cooking view** for Mealie recipes: keep-screen-on (wake lock), ½× to 3× batch sizes, tick-off ingredients, step tracking, timers found in the instructions, notes and nutrition.
- **Portable backups**: a downloadable `.zip` (database, JSON dump, documents, checksum manifest, users and hardware bridge maps), daily rolling snapshots, the `taskdragon.create_backup` service, and verified restore with *Merge* or *Full replace*.

## 1.3.0 (2026-10-29)

- One **category dropdown** in the header replaces the tab bar; menus stay inside the screen on phones.
- **Mealie recipe browser** inside Groceries: photos (through an authenticated proxy), filters, sorting, search, one-tap *Add ingredients* that skips seasonings and in-stock pantry items, *Review*, and *Plan meal*.
- **Pantry & Excluded Spices** drawer to edit the ignored-seasonings list and mark staples in stock.
- Removed the duration and context filters ("Quick wins").
- Fix: service-record PDFs no longer count a part's cost twice.

## 1.2.0 (2026-10-28)

First public release: Quick List with sections, time-blocked chores with streaks and shift-aware assignment, shopping grid with quantity merging, Kanban projects with bills of materials, trip packing, pantry, context snoozes, blocking dependencies, Brain Dump, home maintenance with sensor triggers, NFC and QR completion, learning intervals and the water-softener salt model, two-way Mealie sync with prep timelines and leftovers, native `todo.*` entities, and server-side privacy for private lists.
