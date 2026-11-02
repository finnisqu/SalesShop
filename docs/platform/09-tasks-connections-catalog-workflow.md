# November 1 — Tasks / Connections / Materials incremental redesign
## Tasks
- Task-to-record association picker uses live search limited to 12 results and multiple removable chips. Older single linked records remain readable and are upgraded on edit; links continue to use canonical CRM IDs.
- Independent Start on and Due dates; future due dates do not disappear from All open. Start later is the filter for tasks with future Start on dates. Today is work with no future start and due today/overdue/unscheduled.
- Queue is an optional categorization with suggestions such as Prospecting, Quotes, Deliveries and Meetings; custom strings are retained with the task. Queue view filter uses existing labels.
- Contrasty priority badges. Existing owner-scoped sync and Home task store remain.
## Notebook
- Right-click promotions now display a modal over Notebook and do not navigate away.
- Task, Touchpoint, Deal, Contact / Person and Company are separate opt-in actions. CRM creation uses original store methods and checks department access; no auto-conversion.
- Touchpoint uses a new explicit CRM activity type, not a task or a forced communication log.
## Connections
- Dense, theme-aware configurable tables on desktop across Companies, People, Deals; existing mobile cards preserved.
- Column visibility/order saved locally, sortable headers, pagination (25 per page), pin comparison tray, row checkboxes and safe bulk Create task with multiple associations.
- No bulk deletion, mass CRM mutation or data-model migration in this batch.
## Catalog
- Existing collection/series and features fields used to filter materials by Collection and tag across mobile/desktop. No material price changes.
## Acceptance
- Test cloud sync task associations, refresh across devices, Notebook modal stays in Notebook, multiple record links, Today/Upcoming/Start later, Connect tables, pins, column settings, bulk Create task and material collection/tag filters.
- Compiler build and browser checks are pending until Cloudflare runs on the published commit.
