# SalesShop UI Foundation v1 — Batch 5A: Catalog Shell

**Branch:** `architecture/react-foundation`  
**Production:** `main` not modified.  
**Goal:** Adopt the shared PageHeader / SectionTabs / Panel foundation for Catalog **without changing data-heavy Catalog sections**.

## What changed

- `src/components/CatalogWorkspace.tsx`:
  - Shared `PageHeader` replaces tab-specific header markup. The active section's eyebrow, label, and description remain in the actions slot.
  - Shared `SectionTabs` replaces five hand-styled desktop nav buttons (Materials, Sinks, Other, Rates, Suppliers) and maintains `setCatalogSection`, `aria-current`, and current section state.
  - The `Other` placeholder uses shared `Panel` header/body structure while retaining its examples and planned scope.
  - Section scroll restoration on tab change remains: `sectionScrollRef.current.scrollTop = 0`.
- `src/design-system/catalog-adapter.css`:
  - Defines route-scoped palette aliases and shared typography/radius/spacing/active states for the shell.
  - Replaces Catalog's desktop header/nav presentation with patterns consistent with Settings and Connections.
  - Uses variable-height flex layout instead of a desktop `calc(100vh - 54px)` / mobile `calc(100dvh - 50px)` override in the new adapter, respecting the global chrome and Owner preview banner.
  - **Phone navigation deliberately stays in the global hamburger drawer.** It does **not** expose another Catalog tab strip on small screens.
  - Preserves the existing section host as the mobile scrolling surface with iOS momentum scrolling.
  - Restyles only the shared `Other` placeholder panel, not customer quote documents or Notebook paper.
- `src/main.tsx`: loads the Catalog adapter after the legacy appearance contrast bridge and after Settings/Connections adapters.
- `src/design-system/catalog-adapter.test.tsx`: adds behavior/source contracts for the five tabs, shared components, drawer navigation, themed surfaces, and scroll ownership.

## Explicitly preserved

The existing child components remain mounted and unmodified:

- `MaterialsWorkspace embedded`: search, mobile cards, pin/compare, slab variants, cost references, filters, tools, quote insertion.
- `SinksWorkspace embedded`: sink selections, pricing, import/edit controls, quote insertion.
- `RatesWorkspace embedded`: labor/service pricing rules, rate searches, filters, quote insertion.
- `SuppliersWorkspace`: supplier contact and price program editing/import workflow.
- `OtherCatalogComingSoon`: same categories and explanatory text.

**Critical UX constraint:** Materials/Sinks/Rates own their context-specific search, filters and tools. Batch 5A does *not* move them into the shared header or create a competing global search input on phones. Those controls migrate **one subsection at a time** in subsequent Catalog batches.

## Acceptance checks before broader migration

1. Desktop (1024 / 1440): header, section summary, five section tabs, active state and focus ring; each section loads and its search/actions work.
2. Phone (320 / 375 / 390 / 430): global hamburger expands Catalog, permits changing sections, closes cleanly; no second tab bar or oversized header consuming screen; only intended Catalog body scrolls.
3. Tablet (700 / 768 / 900 / 1024): section tabs scroll rather than squeeze or overflow; active panel remains visible.
4. Owner Preview / real Viewer: read-only Catalog retains hamburger and back navigation; no mutation controls reintroduced.
5. Appearance: Warm, Dark, High Contrast, and at least one alternate theme; ensure card/header foreground/background contrast without blanket descendant text overrides.
6. Existing pricing, supplier importing, sinks, rate formulas, Materials selection and Add to Quote unchanged.
7. GitHub Actions: regression tests and TypeScript/Vite build green. Device screenshots remain necessary to verify actual layout.

## Planned next Catalog sub-batches

- **Batch 5B — Materials:** unifying its subheader/search/filter/tool placement and mobile reference cards while keeping cost/variant selection intact.
- **Batch 5C — Sinks:** common controls and resilient narrow-width editing.
- **Batch 5D — Rates:** consistent sort/filter and service-rate editors.
- **Batch 5E — Suppliers:** importer/drawer consistency and supplier detail forms.

After each subsection, remove superseded selectors only once screenshot parity is verified; avoid accumulating another set of permanent overrides.
