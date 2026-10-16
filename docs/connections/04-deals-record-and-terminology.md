# Connections 2.0 — Batch 17D: Deals and product terminology

**Parent:** Batch 17C (PR #53, `b0b4c8c0`).
**Development branch:** `feature/connections-deal-records-batch-4`.
**Production:** `main` remains unchanged.

## Product change
The user-facing CRM entity is now a **Deal**, consistent with the HubSpot reference. Connections has **Companies · People · Deals**; Board presents **Deals · Accounts**. Quick Create, global search, quote CRM links, company/person associations, and mobile headings use Deals.

The canonical individual deal route is `/connections/deals/:id`. The existing `openProject(id)` navigation action now opens a Deal page. Old `/board/projects/:id` URLs stay parseable and open the legacy Board edit dialog. This is deliberate backwards compatibility.

## Deal record page
- Shared Company/People three-region record shell.
- Name, stage, amount, due date, next action, last touchpoint; edit via existing `updateProject` CRM store, preserving stage transition logic.
- Associate an existing company by ID. Deal creation is available from Connections, Quick Create and the Board; deals can be opened through Company, Quotes and global search.
- Quotes selected only by explicit `quote.projectId`; create a linked Quote from the deal.
- Notebook pages are associated by existing `context.projectId`, and remain under Notebook privacy/persistence behavior.
- Contact references reflect **explicit quote contact IDs only**. Deal-wide role assignments are deferred until a permission-reviewed normalized relation exists.
- Activity history is collapsed, read-only and confined to the deal and explicitly associated quotes. No tracking prompts or salesperson scorecards.

## Internal compatibility
**Do not rename** persisted database columns, identifiers, records, activity event type keys, Supabase tables, quote `projectId`, Notebook context IDs, CSS classes, or the `'projects'` Board mode/storage key in this batch. Migration of those would break existing quote/Notebook/sync consumers. This is a copy/navigation change, not a schema migration.

## Privacy
Hiding the Overview dashboard and scoping deal UI do not fix the existing broad CRM/quote RLS reads. Follow `docs/security/02-privacy-first-sales-ownership.md` before claiming strict salesperson-private access. No new RLS/grants are introduced here.

## QC
- `src/services/dealRecordView.test.ts` checks ID-only quote/contact/history selection.
- `src/services/appRoutes.test.ts` checks new/legacy routes and invalid URLs.
- `src/store/navigationStore.test.ts` checks new deal navigation.
- `e2e/connections-deal-record.pw.ts` checks create, edit, reload, Back and missing ID on phone/desktop.
- Existing quote/Board/Connections tests must be updated where their *visible strings* have changed, without weakening functionality checks.
