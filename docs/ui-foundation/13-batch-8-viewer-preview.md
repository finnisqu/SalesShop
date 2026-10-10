# UI Foundation — Batch 8: Viewer / Owner Preview Parity

**Working branch:** `architecture/react-foundation`  
**Production `main`:** unchanged

## Why this is Batch 8
Batch 7 already completed Board/Accounts headers, Quotes internal chrome and phone landscape, and Notebook chrome, with tests/build/deployment passing. The unconverted piece of the shared application experience was restricted-role browsing and Owner role-preview parity. This batch is a narrow acceptance pass rather than a redesign of the previous seven batches.

## Changes
- `ViewerWorkspace` now uses shared `PageHeader` with the existing role title, View only status and access explanation.
- Viewer's shared `Field` search keeps the same query predicate and results, and the project/quote disclosure actions adopt `Button` with `aria-expanded`.
- Purchasing's shortcut to the editable Suppliers section uses the shared button without changing the permission boundary.
- `restricted-view-adapter.css` pairs themed foreground/background colors for Viewer records, quote/project details, supplier/stock references, KPI tiles, role capability grid, and restricted-role search.
- Read-only pages retain one vertically scrolling surface. Phones use compact typography and single-column records; inputs are 16px to avoid mobile Safari focus zoom.
- Owner's role-preview banner remains **outside** the workspace viewport and continues to display a visible Exit control. A short touch-phone landscape variant keeps the role title, switch selector and Exit Preview on one line rather than blocking the screen.
- Owners' simulated role settings now match the palette without changing which capabilities are real or which role can issue quotes. Preview does not impersonate a user or test Supabase RLS.

## Unchanged by design
- Viewer records and their filters; no CRM or quote mutations exposed.
- Owner preview uses its original inert restrictions on writable areas, and existing read-only routes for restricted roles.
- The shared mobile hamburger and Catalog navigation remain reachable for Viewer and Owner preview.
- Notebook writing/drawing and physical paper, commercial quotes and customer-facing quote/PDF styling, supplier importer, pricing, permissions and database schema are untouched.

## Acceptance and QA
1. Real Viewer: open Board, Quotes, Catalog and Connections using the hamburger. Search results and expand a quote/project. No editing controls. On mobile Quotes, ensure the shared hamburger remains visible.
2. Owner Preview: switch among Admin, General Member, Salesperson, Estimator, Purchasing, Project Manager and Viewer. Verify banner remains outside the workspace and Exit Preview works at any time, including on phone landscape.
3. In Purchasing preview, Catalog → Suppliers remains visible but non-interactive (owner simulation); real Purchasing can access their editable Suppliers workspace.
4. On portrait phones (320/375/390/430) and landscape touch phones (e.g. 844×390), inspect header height, scrollability, search focus/zoom, records, banner switch selector, hamburger and escape.
5. Check Light, Warm, Dark, Contrast and alternate themes: header labels, record details, KPI text, buttons, dates and role capability grid remain legible.
6. Ensure customer quote documents and notebook paper remain unchanged.
7. Confirm CI full regression suite, TypeScript/Vite build, GitHub Pages deployment before treating as live.

**Next:** use real-device screenshots to triage specific remaining inconsistencies and carefully retire superseded legacy CSS rather than launching another blind global restyle.
