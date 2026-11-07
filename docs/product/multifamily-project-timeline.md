# SalesShop — Contracted Deal Timeline / Multifamily Starter

**Status:** Template foundation in `src/services/dealScheduleTemplates.ts` (not yet exposed as a live editor).
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
