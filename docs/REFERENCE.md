# TaskDragon reference

Services, events, the security model and how the code is organised. For day-to-day use see the [user guide](GUIDE.md).

- [Services](#services)
- [Privacy & security](#privacy--security)
- [How it fits together](#how-it-fits-together)
- [Development](#development)

## Services

All services return data when called with `response_variable`.

| Service | What it does |
| --- | --- |
| `taskdragon.parse_brain_dump` | Free text → tasks and shopping items (`dry_run: true` only parses). |
| `taskdragon.add_task` | Create a task (`plan` takes a name, id, or the plan's `todo.*` entity). |
| `taskdragon.complete_task` | Complete or re-open by `uid` or exact `summary`. |
| `taskdragon.snooze_task` | `time`, `person_home`, `all_home`, `weekend_dry` or `entity_state`. |
| `taskdragon.add_shopping_item` | Adds an item and merges quantities with an existing entry. |
| `taskdragon.trigger_pantry_low` | Set stock and run the item's low-stock action. |
| `taskdragon.run_shift_balance` | Run today's shift-aware assignment now. |
| `taskdragon.sync_mealie` | Sync now. |
| `taskdragon.create_trip` | Start a trip in a packing plan; repeatable items are copied onto it. |
| `taskdragon.clone_plan` | Duplicate a plan (its sections and every item that isn't part of a trip). |
| `taskdragon.reset_plan` | Un-check every item in a plan. |
| `taskdragon.complete_maintenance` | Log a maintenance task as done (`task`: id, `#3.1`, `Furnace / Replace Filter` or a unique name; optional `cost`, `duration_minutes`, `notes`). NFC-only tasks refuse. |
| `taskdragon.log_salt_level` | `fill` (with `level` or `bags`), `level` or `empty` for a water softener `object` (name, id or `#2`). |
| `taskdragon.create_backup` | Write a portable snapshot to `/config/backups/taskdragon/` and prune old ones (administrators; automations may call it, e.g. before an update). Returns the file name, size and row count. |

A service call made by a signed-in user (a dashboard button, a script they run, Assist) acts as that user, so it only sees household plans and that user's private lists. Calls from automations act as TaskDragon itself.

### Voice Brain Dump through Assist

```yaml
automation:
  - alias: TaskDragon brain dump by voice
    triggers:
      - trigger: conversation
        command:
          - "brain dump {text}"
          - "remind me to {text}"
          - "add {text} to the grocery list"
    actions:
      - action: taskdragon.parse_brain_dump
        data:
          text: "{{ trigger.sentence }}"
        response_variable: dump
      - set_conversation_response: >-
          Added {{ dump.results | selectattr('ok') | map(attribute='summary') | join(', ') or 'nothing' }}.
```

### Events for automations

| Event | Data |
| --- | --- |
| `taskdragon_task_completed` | `uid`, `summary`, `plan_id`, `person`, `user_name`, `next_due`, `unblocked` (for private lists `summary` is `null` and `private` is `true`) |
| `taskdragon_task_unsnoozed` | `uid`, `summary`, `plan_id`, `reason`, `assigned_to` |
| `taskdragon_pantry_low` | `item_id`, `name`, `state`, `action` |
| `taskdragon_maintenance_due` | `task_id`, `object_id`, `plan_id`, `code`, `name`, `object_name`, `status` (`due_soon`, `overdue` or `triggered`), `countdown`, `assigned_to` |
| `taskdragon_maintenance_completed` | `uid` (the task id), `name`, `object`, `code`, `method` (`manual`, `nfc`, `qr`, `todo`, `service`, `auto_recovery`), `person`, `user_name`, `next_due`, `plan_id` |
| `taskdragon_barcode_action` | `barcode`, `target_type` (`pantry_item` or `maintenance_part`), `target_id`, `name`, `action` (`use_one`, `restock_qty`, `set_pantry_status`), `quantity` or `status`, `user_id` |
| `taskdragon_price_alert` | `kind` (`target`, `all_time_low` or `protection`), `item_id`, `plan_id`, `title`, `price`, `retailer`, `url`, `target_price`, `paid_price`, `savings`, `days_left` (for secret gifts everything but the ids and `kind` is `null` and `secret` is `true`) |
| `taskdragon_updated` | `plan_ids` |

For private lists, the name fields are `null` and `private` is `true`. For example, to notify the assignee when a "next time I'm home" task wakes up, trigger on `taskdragon_task_unsnoozed`.

**Phone reminders** (the task editor's *Phone reminder*) call `notify.<service>` with `title` (the task), `message` (*Due today* or *Due at 14:30*, the repeat and the list) and companion-app `data`: `tag: taskdragon-task-<uid>` (a newer reminder replaces an older one), `url` / `clickAction` (`/taskdragon?task=<uid>`, which opens the task) and two `actions`, `TASKDRAGON_DONE_<uid>` and `TASKDRAGON_SNOOZE_<uid>`. TaskDragon listens for `mobile_app_notification_action` and completes or snoozes the task (60 minutes) as the user whose phone sent it, provided that user can see the task's list. The phone list comes from `mobile_app` config entries whose `notify.mobile_app_<device>` service exists. For maintenance, pick a `notify.*` service in the plan's **Settings** (administrators), or build your own automation on `taskdragon_maintenance_due`.

## Privacy & security

- **Private lists are filtered on the server.** A private category, including each user's "My Quick List", is returned only to its owner and the household members it's explicitly shared with. Every WebSocket command checks each plan, task, section, trip, pantry or BOM id it's given against the signed-in user before doing anything. Ids the user can't see answer `not_found`, exactly like ids that don't exist. Administrators get no back door through the API. Private lists have no `todo.*` entity, because entity state is readable by every Home Assistant user, and bus events for them carry no task text.
- **Admin-only changes**: deleting a household category (`taskdragon/delete_plan`), listing Mealie shopping lists and running shift balancing use Home Assistant's `require_admin`. Changing routing roles, Mealie links, archiving, or making a household list private also need an administrator (or the list's creator). Owners delete their own private lists with `taskdragon/delete_private_plan`. Tab order, hidden tabs and collapsed sections are per-user preferences.
- **Mealie credentials** live in the config entry's `data` (`.storage/core.config_entries`; protected by file permissions, not encrypted), never in options, entity attributes, WebSocket payloads or the card. The card receives a sync status and, in the recipe browser, recipe names, categories and Mealie links, but never the token. Recipe photos are fetched by Home Assistant and passed to the card through an authenticated endpoint (`/api/taskdragon/mealie_image/…`), so they work away from home. That endpoint only accepts recipe ids, only passes through real image types up to 3 MB, and serves them with `nosniff` and a sandboxing CSP. All Mealie traffic goes from Home Assistant's own HTTP session, with a 10-second timeout, no redirects (so the token is never replayed to another host), percent-encoded path segments and validated recipe slugs. Error messages and logs never contain the URL, the token or response bodies. Upgrading from 1.0 moves an existing token out of options automatically.
- **Diagnostics** (Settings → Devices & services → TaskDragon → ⋮ → Download diagnostics) contain settings and counts only; the token, URLs, user ids, calendars and private list names are `**REDACTED**`.
- **SQL**: every value is a `?` parameter. The only text spliced into SQL is table and column names, which must appear in the schema allow-list (for a backup restore, in the live database's own schema). A unit test fails the build if an f-string or `%` formatting builds SQL anywhere in the integration.
- **XSS**: the card renders through an escape-by-default `html` tagged template (the same model as Lit's bindings). Every interpolated value is HTML-escaped unless it is itself trusted template output, and an allow-list sanitizer then strips any element or attribute TaskDragon doesn't use (scripts, `on*` handlers, `javascript:` links) before anything reaches the live page. Links are only ever `http(s)`, both when stored and when rendered.
- **Undo** data stays on the server behind single-use tokens tied to your user, so a client can never "restore" records into someone else's list.
- **Barcodes**: lookups, links and scan actions go through the same per-plan checks. A barcode linked to something in a list you can't see behaves like an unknown code, the pickers only list what you can see, and you can't re-link someone else's private item. The camera feed never leaves the phone; only the decoded number goes to Home Assistant. For unknown retail codes Home Assistant asks Open Food Facts about that number only (no account, no household data, 4-second timeout, no redirects, 512 KB cap, answers cached). An administrator can switch that lookup off in Settings.
- **Backups**: listing, creating, downloading, deleting and restoring backups is administrator-only, over WebSocket (`require_admin`) and HTTP (`/api/taskdragon/backup/…`, which also accepts short-lived signed paths so downloads save natively in the Companion apps). Uploads stream to disk with a 1 GB cap, and the small form fields of every upload are read with a size limit. Signed download links (`auth/sign_path`) live 60 seconds, 30 for backups. Zip members are read by exact name with size limits, so nothing is ever extracted to a path taken from the archive. Restored table and column names are checked against the live schema before they reach SQL, and values must be plain scalars. A backup holds the whole household's data, including private lists and people's names, so keep the file somewhere safe.
- **Wishlist and gifts**: anti-spoiler rules are applied on the server for every read and write. A gift for a household member is left out of everything sent to the Home Assistant user linked to that person (the board, scans, item sheets, history), unless that user added it. Stealth items and sections go only to the user who added them, and only that user can change their stealth setting (a starter section has no owner until someone makes it secret). Categories (`parent_id`, one level deep) are hidden whenever their occasion is, and a hidden category of a visible occasion is announced as a count under the occasion. Hidden items come back as anonymous counts per buyer, and any command naming one answers `not_found`. Kiosk masking is an extra, client-side cover on shared screens. Hiding-spot notes are encrypted at rest with Fernet (`cryptography`, part of Home Assistant). The key is `.storage/taskdragon_hoard.key` (owner-only permissions), portable backups carry it as `secrets/hoard.key` with a checksum, and a restore re-encrypts notes under the local key. Wishlists get no `todo.*` entity, and price-alert notifications and events for secret gifts carry no title, price or store. Tracker settings can be changed by administrators only. Product photos are fetched by Home Assistant through the guarded client and served from `/api/taskdragon/hoard_image/<item>` (authenticated, gift rules applied, only PNG/JPEG/GIF/WebP recognized by their bytes, 3 MB at most, cached), so viewers' browsers never contact a store. The anti-spoiler rules are not a boundary against administrators: portable backups hold every gift together with the hiding-spot key, and administrators can read Home Assistant's files.
- **Price tracker network access**: store pages, deal feeds and UPC lookups go through one guarded client. It allows only `http`/`https` on ports 80 and 443 and no credentials in URLs, and refuses names like `localhost` or `*.local` and literal private, loopback, link-local and CGNAT addresses. A DNS resolver inside the connection drops non-public answers, so DNS rebinding can't reach the LAN either. Redirects are followed manually (at most five), each one re-checked. Requests time out after 10 seconds, read at most 4 MB of pages (1 MB of feeds and JSON), keep no cookies and wait 3 seconds between requests to the same host. Pages are parsed with BeautifulSoup's pure-Python parser in the executor, and scripts never run. RSS with a DTD or entities is refused. IPv6 forms that carry an IPv4 address (IPv4-mapped, 6to4, NAT64 `64:ff9b::/96` and `64:ff9b:1::/48`) are judged by that IPv4 address, and Teredo is refused. Custom price selectors are validated CSS of at most 300 characters; free-form regular expressions aren't accepted, because a slow pattern could stall the parser. Each user can start at most 120 fetches (store checks, deal searches, photo downloads) and 40 UPC lookups an hour, a wishlist holds at most 2,000 items, and the per-store bookkeeping is capped. Sent out: only the page address, the deal search words and the barcode digits.
- **Maintenance**: objects, tasks, parts and documents go through the same per-plan access checks as everything else, including the upload, download and PDF endpoints (`/api/taskdragon/…`, Home Assistant authentication required). The card opens files through short-lived signed URLs. Uploads are accepted by their content (magic bytes), not their name or claimed type. Anything outside the allowed types is refused, filenames are sanitized, and files are served with `nosniff` and a sandboxing CSP. Only administrators can set a task's on-complete service call or a plan's notify service, because both run with Home Assistant's privileges. A task's phone reminder can be aimed by anyone at a companion-app phone or at "whoever it's assigned to"; other `notify.*` services need an administrator. Reminder buttons act as the phone's user and are ignored for lists that user can't see. An on-complete action is stamped with the administrator who saved it and only runs while that user is still an active administrator; actions that arrive through a backup restore are paused until an administrator opens the task and saves it again (the restore report says how many). Reorder and document links must be `http(s)`.

## How it fits together

```
custom_components/taskdragon/
├── __init__.py        setup/unload, static path + extra JS module, sidebar panel
├── config_flow.py     household → per-person shifts → Mealie → schedule (also the options flow)
├── coordinator.py     timers, state listeners, shift balancing, weekend weather, Mealie sync, leftovers
├── planner.py         all task rules: completion + audit log, recurrence, dependencies, snoozes, pantry, BOM,
│                      quick-list sections, trips, access control, undo tokens, per-user preferences
├── database.py        aiosqlite schema + migrations (plans, tasks, sections, trips, task_dependencies,
│                      completion_logs, pantry_items, snooze_rules, bom_items, item_history, user_prefs, barcode_mappings,
│                      hoard_sections, hoard_items, tracked_item_urls, price_history, hoard_deals, …)
├── todo.py            one native TodoListEntity per household plan
├── websocket_api.py   taskdragon/* commands (each with an access guard) + per-user taskdragon/subscribe
├── diagnostics.py     redacted diagnostics download
├── services.py        taskdragon.* services
├── brain_dump.py      LLM prompt + JSON validation, deterministic rules fallback
├── mealie_client.py   async Mealie REST client (v2 household routes, v1 group fallback)
├── recipes.py         recipe summaries and the seasoning / pantry import filter
├── recipe_browser.py  cached recipe list, image cache, recipe → groceries and meal planning
├── units.py           quantity parsing, unit normalization/merging, aisle categorization
├── kitchen.py         prep-rule discovery, leftover naming, ingredient lines
├── dependencies.py    blocking-dependency resolution and cycle detection
├── recurrence.py      RRULE and rolling recurrence
├── reminders.py       phone reminders: when one is due, its text and its Done / Snooze buttons
├── shift_balance.py   PRN / shift-aware assignment
├── snooze.py          context-snooze rule evaluation
├── maintenance.py     intervals, seasons, trigger state machines, status, Weibull/EWA learning,
│                      salt scales and estimates, spend reports, templates, battery fleet
├── maintenance_manager.py   objects, tasks, parts, documents, completions, NFC, salt learning, board views
├── maintenance_runtime.py   HA glue: state + tag events, zone-gated notifications, document files
├── maintenance_ws.py  taskdragon/maint_* WebSocket commands
├── http_views.py      document upload/download, service-record PDF, Mealie image proxy, backup download/restore
├── barcodes.py        GTIN normalization (UPC-A/E, EAN), Open Food Facts response parsing, name matching
├── barcode_manager.py barcode → pantry item / part links, lookups, use / restock / stock actions with undo
├── barcode_ws.py      taskdragon/barcode_* WebSocket commands
├── openfoodfacts.py   cached, size-capped Open Food Facts product lookups
├── backup_manager.py  portable zip export, users / hardware bridge maps, verified replace / merge restore, snapshots
├── backup_ws.py       taskdragon/backup_* WebSocket commands (administrators)
├── hoard.py           wishlist sections and items, anti-spoiler masking, store links, price checks, alerts,
│                      price protection, deal radar, in-store scans, encrypted hiding spots
├── hoard_ws.py        taskdragon/hoard_* and taskdragon/scan_price_check WebSocket commands
├── price_tracker.py   guarded HTTP client (public addresses only), JSON-LD / meta / retailer / custom-selector
│                      price extraction, Slickdeals + Reddit deal feeds, UPCitemdb lookups
├── migration.py       carries an installation over from the integration's former name (OmniPlan)
├── qr.py              QR-code encoder (Reed–Solomon, byte mode)
├── pdf.py             minimal PDF table writer
└── frontend/
    ├── taskdragon-card.js   zero-dependency card, panel and card editor (escape-by-default rendering)
    └── vendor/            ZXing barcode reader (Apache-2.0), loaded only where the browser has no BarcodeDetector
```

The modules that hold the logic (`planner`, `database`, `units`, `dependencies`, `recurrence`, `shift_balance`, `snooze`, `kitchen`, `brain_dump`, `maintenance`, `maintenance_manager`, `qr`, `pdf`, `recipes`, `recipe_browser`, `barcodes`, `barcode_manager`, `backup_manager`, `migration`, `hoard`, `price_tracker`, `reminders`) don't import Home Assistant, which is why most of the behaviour can be unit-tested without it.

The database file and the `taskdragon_docs` folder are included in Home Assistant backups because they live in `.storage`, and so are the portable snapshots in `backups/taskdragon/`. Deleting the integration leaves them all in place.

`frontend/vendor/zxing-library-0.23.0.min.js` is the unmodified UMD build of [`@zxing/library`](https://github.com/zxing-js/library) 0.23.0, © ZXing authors, under the Apache License 2.0 (`frontend/vendor/zxing-library-LICENSE.txt`).

## Development

```bash
pip install -r requirements_test.txt
pytest tests          # pure logic, no Home Assistant needed
pytest tests_ha       # end-to-end against a real HA core (pytest-homeassistant-custom-component)
```

`tests_ha/conftest.py` contains two Windows-only shims (the proactor event loop's socket pair, and aiodns). On Linux CI the Home Assistant test plugin's socket guard stays fully active.
