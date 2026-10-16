# Connections 2.0 — Batch 17E: record navigation and visual parity

**Parent:** PR #54 / Batch 17D (`309ff299`).
**Branch:** `feature/connections-record-polish-batch-5`.
**Production:** `main` unchanged; this PR depends on #50–#54.

## Layout, interaction and privacy

- Shared Company / Person / Deal records have one Back-to-directory control (no duplicate breadcrumb button).
- Phones use three compact **Details / Records / Related** jump controls, not extra tab panels; all data remains visible and scrollable, so direct links and browser Back still work.
- Touch-landscape and narrow viewports stack content without horizontal overflow; tablets keep appropriate two-region layouts. Every jump scrolls into view without changing the route or retaining a stale section preference.
- Edit forms use consistent **Cancel / Save changes** actions. Cancelling does not write to CRM. Company Add Person retains its own Save Person action.
- Record controls have 42–44px targets, visible focus rings, palette-aware hover surfaces, consistent panel padding and reduced-motion behavior.
- Deal editor now permits explicitly clearing its linked company through the existing `updateProject({companyName:''})` mechanism, without a new data field or migration.
- Removed redundant **New quote** button from Deal Quotes panel (top action remains).
- Removed empty Deal involvement placeholder from Person pages until explicit roles exist.
- Global Sales Dashboard remains disabled; Activity history remains in More or collapsed on records. No activity pressure prompts or automatic cross-company attribution.

## QA

- `src/components/RecordPageLayout.test.tsx` checks the three entity types, semantic regions and one Back action.
- Mobile/desktop Playwright Company/Person/Deal journeys now follow consistent Save changes action.
- Updated the Company test to expect **Deals**, not **Projects**, and fixed stale Quote Details selectors after the rename.
- Validate Light, Warm, Contrast, Dark, phone portrait, phone landscape, desktop and browser navigation in CI and manual visual inspection.
- Pre-existing non-Connections Quote Beta and HOME journey failures seen in PR #54's visual CI must not be mistaken for passing status. See related CI artifacts and fix separately if they continue.

## Authorization boundary

This is UI/navigation polish, **not** an access-control migration. Salesperson-level Supabase RLS still requires a distinct audited security batch; see `docs/security/02-privacy-first-sales-ownership.md`.
