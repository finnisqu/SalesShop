# SalesShop Project Timeline — small opt-in beta

**Purpose:** Give users a real, low-risk timeline they can try in the main SalesShop app while the larger multifamily execution Gantt remains in draft PR #67.

## How to try it

1. Open **Settings → Beta Features**, switch on **Enable Project Timelines**.
2. Choose **Explore Deal Timelines**, or open **Connections → Deals → Timeline**.
3. Open a Deal, choose **Project timeline (Beta)**, then **Start multifamily timeline**.
4. Expand Contract & preconstruction, Phased imports, Buildings, or Closeout. Enter planned start/finish dates and select statuses.
5. Add imports or buildings whenever phases change. The optional Timeline bar column visualizes entered dates. No artificial dates are inserted.
6. Switch the beta off in Settings to hide it; the drafts remain on the same browser for later.

## Scope of this release

- Reuses the existing `createMultifamilyStarterSchedule()` template on `main`. Includes shop drawings, deposit, PO, production, on-water shipping, port/customs/site delivery, installation per building, phased invoices, closeout and retainage.
- Every Deal's schedule remains separate from the CRM Deal itself. Editing the timeline does not mutate Deal stage, quote totals, tasks, calendar, invoices, or other shared data.
- Device-only draft persistence under `salesshop:project-timeline-beta-drafts-v1:<scope>`, with cloud identities scoped to organization and user.
- User opt-in under `salesshop:project-timeline-beta-enabled-v1`, off by default.
- A lightweight portfolio navigator covers Closed Won and Completed Deals, linking into their individual timelines.
- Editing: planned start, planned finish, status, add import, add building, expand/collapse group. Lightweight bar view is for visualization only.
- No production migration, cloud schedule sync, RLS changes, billable staging branch, CI action or automatic release of the advanced PR #67.

## Known limitations

- Drafts are private to this browser and may be lost if site data is cleared. **They are not cloud-backed or visible to other team members.**
- No drag-to-reschedule, predecessor enforcement, actual dates editor, invoice/payment ledger, Tasks or Calendar sync in this first beta.
- No deletion or reordering of phases yet; add-only phases to reduce first-version data-loss risk.
- The standard Deal list and unrelated UI are untouched when beta is off.

## Release validation

- Unit tests in `src/store/dealTimelineBetaStore.test.ts` cover account isolation, idempotent startup, phase addition without mutating prior revisions, invalid date rejection and hiding beta without erasing data.
- `npm run test:timeline` includes this suite.
- Full `npm run build`, Vitest and browser visual tests require an actual connected repository checkout; they cannot be run in the current isolated container.
- Manual smoke test after deployment: sign in, enable beta, create test timeline, edit dates, add a third building/import, revisit page, disable and re-enable, verify draft remains and Quotes/CRM records unchanged.
- Keep the larger draft PR #67 separate until cloud security and its more complex features have passed review.
