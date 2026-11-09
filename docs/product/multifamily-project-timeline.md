# SalesShop — Contracted Deal Timeline / Multifamily Starter

**Status (2026-11-08 feature branch):** Editable Gantt and portfolio view plus planned/actual milestone dates, manual personal Task linking, and Home calendar milestones. Device-local drafts work by default; a feature-gated shared Supabase adapter is implemented but **cannot be enabled until the staged database schema and security release gate are approved and tested**. This branch is not deployed or production-ready.
**CRM location:** CONNECTIONS → DEALS → Timeline, with a filtered Portfolio Gantt and a Deal-specific Gantt.
**Selection:** Contracted/open project execution means stage `Closed Won`; `Completed` remains discoverable via a show-completed filter. Earlier deals may opt in to plan ahead, without changing the sales stage.

## Data model

A project schedule belongs to an existing Deal ID, not a duplicate Deal. It is a separately persisted child record. Use a nested, collapsible structure with five useful levels: project → project-wide approvals / finance → import batches → building installation phases → closeout. Building rows can reference **more than one** import batch, and imports can serve more than one building. Do not assume one truck/container equals one building.

All tasks support planned/actual start and finish, status, owner, notes, dependencies and links to existing Tasks / Calendar events. Financial milestones additionally support amounts, invoice number, date billed, payment date, and **retainage rate/amount** (not invented defaults). Shipment milestones can include PO, vessel/container, tracking reference, ETA and actual arrival. Blank is valid for fields not yet known.

## Starter template

### Contract and preconstruction (once per deal)
- Contract executed
- Notice to proceed
- Deposit invoiced
- Deposit received
- Shop drawings submitted
- Shop drawings approved
- Material / finish selections approved

### Material import batch (repeat for each wave, each with independent dates)
- Purchase order / material release
- Production (date range)
- On water / ocean transit (date range)
- Port arrival
- Customs cleared / domestic freight
- Delivery to site

One material order may be produced while a previous shipment is still on the water or while earlier buildings are being installed. Batch dates should not be flattened to one project-wide shipping date.

### Building (repeat as often as necessary)
- Site ready / field verification
- Material delivery to building, linked to chosen import batch(es)
- Installation (date range)
- Punch list / building sign-off
- Progress invoice submitted
- Progress invoice paid

Each building gets its own billing workflow and can have a separate invoice and retainage portion. The first version should not pretend to be a full AR ledger; it tracks milestones and references.

### Overall closeout
- All buildings / punch lists complete
- Final billing reconciled
- Retainage invoice / release request
- Retainage received
- Project complete

## User interactions

- **Portfolio view:** one row per Deal, expandable by import wave and building. Collapse completed buildings by default. Filter by pipeline, assigned salesperson, status, late milestones and date window.
- **Deal detail:** expand/import multiple batches; add/duplicate/rename/reorder buildings; assign which imports supply each building; drag or resize scheduled bars; date change should be recorded explicitly.
- **Calendar integration:** only dated milestones become Calendar items, with their Deal/Building links; do not create duplicate Tasks for every automatic dependency.
- **Financial integration:** highlight outstanding deposit, invoices and retainage separately from physical completion. Do not mark a deal financially complete simply because the last installation was signed off.
- **Status:** completed / in progress / on hold / not started; overdue calculated from actual date and planned date, not an arbitrary color. Warning for overlapping constraints, impossible successor dates, late import vs expected installation.
- **Dates:** never invent deadlines, ship dates or transit duration. Dates can be estimated with a clearly labeled assumption only after a user selects a planning preset.
- **Mobile:** vertical grouped milestone view default, with optional sideways-scroll Gantt. Each section collapsible; keep spreadsheet-density editing for individual milestones.

## Dependency behavior

First iteration: show predecessor relationships as advisory, including shop drawing approvals → import PO, import arrivals + site readiness → delivery to building, building delivery → installation, installation → punch list → building billing, and building sign-offs/billing → retainage request. Later, offer suggested date shifts, with explicit confirmation; don't silently shift contract commitments or invoices.

## Deployment gate / next work

1. Persist schedule rows and linked import/building relationships in a dedicated, tenant-scoped normalized Supabase model, with RLS and local-mode equivalent. **Do not reuse** the Deal stage, Activity history, or Notebook text as the authoritative schedule storage.
2. Add template selection and schedule CRUD to Deal details; ensure repeated open/close/sync doesn't create duplicate template rows.
3. Add read-only portfolio Gantt, then editing, drag interactions, task/calendar linking, and mobile vertical view.
4. Test multi-company isolation, permissions, partial imports, repeated invoice milestones, cross-batch dependencies, and fresh reload/cloud sync before enabling a production flag.

The repository README currently holds a staging/auth rollout gate. Creating or applying production database migrations is a separate action and was **not** part of the template foundation.


## Implemented in first functional batch (not yet released)

- The Deal detail page has a **Project timeline** action opening a full-width workspace.
- CONNECTIONS → DEALS can switch between **List** and **Timeline**; completed Deals are optional.
- A Deal's multifamily starter is created **only on explicit click**, preventing repeated opens from duplicating phases.
- Imports and buildings can be added and deleted independently. Removing a phase also cleans dependent ID references.
- Users can edit planned and actual dates, phase labels, status, invoice amounts and retainage percentages.
- A building can be linked to multiple imports, updating advisory delivery predecessors.
- Date ranges appear as Gantt bars and milestones; mobile defaults to a compact milestone list.
- Device-local draft persistence uses an organization-and-user-scoped key in cloud mode to prevent one login's cache being shown to another.
- Test cases for phased imports, building billing, dependencies, date validation and deletion are added, but not yet executed in CI or a local full build.

### Explicit limitations before team launch

- **No Supabase schedule schema or RLS migration has been applied.** Cloud users see a **device-only draft** notice. Changes do **not** sync to other devices or teammates; clearing browser data will erase that device's schedule.
- No automatic generation of tasks, calendar entries, invoice records or payments. Dates and amounts are manual schedule references.
- Bars are selectable, not yet drag-to-reschedule; no real-time change conflict management.
- No role-matrix/cloud sync verification, no browser visual QA and no production deployment as part of this feature branch.
- A future migration must store all schedule rows under an existing Deal and tenant-scoped normalized tables with role-appropriate SELECT/INSERT/UPDATE/DELETE policies. Following the README's staging release gate remains mandatory.

## Shared storage + Home integrations (2026-11-08 batch)

- `docs/staging/deal-execution-schedules.schema.sql`: **staged-only** tenant-scoped schedule table keyed by `(organization_id, deal_id)` with a composite Deal FK, CRM editor RLS and revision counter. No SQL was executed or migration applied in production.
- `src/services/dealScheduleCloud.ts` and `src/store/sharedDealScheduleStore.ts`: organization-wide read with authenticated CRM edit access; creating a shared schedule is explicit, never automatic. Edits use a revision compare-and-swap, not last-write-wins. On a stale revision, reload the authoritative server copy and require the user to reapply their changes.
- `src/services/useDealExecutionSchedules.ts`: an adapter that uses local drafts by default and activates shared storage only with `VITE_DEAL_SCHEDULE_CLOUD_ENABLED=true` on a verified deployment. Cloud mode does not silently publish old device drafts; a separate Publish action is available if no server schedule exists.
- `src/services/dealScheduleCalendar.ts`: projects schedule dates into **Home → On this day → Project milestones**. These do not count as overdue personal Tasks or inflate task/bid badges. Only Deals visible to the user through assignment or existing task/quote links feed their personal Home calendar.
- The selected milestone offers a manually requested follow-up Task with a stable source ID and Deal link. The milestone's completion and personal Task completion remain independent.
- Added tests for calendar milestones, cross-deal filtering, stable reminder IDs and date projection. Tests and full build require execution before release.

### Activation order

1. Keep GitHub PR #67 as a draft. Run `npm run build`, `npm test`, and mobile/desktop visual QC using a disposable or checked-out working tree with dependencies installed.
2. Approve staging provisioning separately (see repo `README.md` and security release gate) and confirm Supabase costs before creating any billable branch.
3. Apply the SQL **only to staging**. Test all role, tenant, FK, CAS, deletion and malformed-document cases with synthetic Deals.
4. Point a staging frontend at the staging backend with `VITE_DEAL_SCHEDULE_CLOUD_ENABLED=true`. Verify from two distinct browsers that concurrent revisions cannot silently clobber one another, and that an old device draft is published only after explicit action.
5. Verify that the Home calendar shows only authorized Deals' milestones, manually created follow-up Tasks do not duplicate, and every relevant building invoice / import phase survives fresh reload.
6. Only after separate production approval: add a formal migration to the approved deployment process, apply SQL, then enable the shared schedule flag. Never deploy the flag before the schema and RLS.

## November 9 hardening and execution details

- Added a generic milestone reference for purchase orders, vessel/container and shipment tracking, or building invoice/payment references. These references are descriptive only, not invoices posted to accounting.
- Milestone notes support manual field/production/shipping context; both reference and notes are bounded in the editor and normalized before saving.
- Added advisory warnings for incomplete milestones past planned finish and for a successor planned before the end of a predecessor. They are visible in a collapsible alert group and never automatically modify dates, create Tasks, or modify CRM stage.
- Progress is explicitly separated into **materials**, **building work** and **billing/retainage**. Physical completion does not imply financial closeout.
- Hardened imported/cloud schedule validation: reject parent cycles, dependency cycles, invalid linked imports, impossible calendar dates, invalid invoice amounts and retainage percentages before loading or saving.
- Extended timeline regression tests for these cases. Tests have been committed but not executed in an actual project checkout; no production SQL, CI triggers, or deployment changes have been made.
