# SalesShop UI Foundation v1 — Batch 10: CSS ownership and cleanup

**Date:** 2026-10-10  
**Development branch:** `architecture/react-foundation`  
**Production fallback:** `main` (must remain unchanged)  
**Scope:** internal application UI only; no pricing, quote data, permissions, customer document or print redesign.

## What was audited

- Re-read the active `src/main.tsx` and `src/App.tsx` stylesheet import order: **57** imports in `main.tsx`, **31** in `App.tsx`, with **86 distinct direct CSS imports**. Two paths appear in both: `customer-document-brand.css` and `sinks-workspace.css`.
- Inspected the current Batch 3–9 adapter set across **Settings, Connections, Catalog, Materials, Sinks, Rates, Suppliers, Board, Quotes, Notebook and Viewer/Owner preview**.
- In the 13 reviewed foundation adapters (including Catalog QC and Quotes' editor): no `100vh`/`100dvh` declarations, and no `!important` declarations except five in `sinks-adapter.css`. Those five are deferred for actual browser/device cascade testing rather than removed speculatively.
- Confirmed the current Quotes editor renders `QuoteDocumentSetupFields`, `QuoteRevisionLabelField` and `QuoteNotesFields`, inside configuration popovers, not the old `<details class="quote-document-setup">` accordion.

## Superseded rules removed

1. **`quote-document-setup.css`:** deleted unused accordion surfaces, headings, disclosure markers, expansion/chevron styles and the obsolete fourth-child layout reset. Retained document-type switch, status/date grid, revision ordering and responsive rules, all still used.
2. **`quote-popover-polish.css`:** removed the old `.quote-document-meta-fields` input/label aliases from the shared CRM styling blocks. Kept `.quote-project-details-grid` CRM labels/inputs and the document grid geometry.
3. **`quote-mobile-pass.css`:** stopped assigning legacy 42px heights to the migrated document status/date fields. The later scoped `quote-editor-adapter.css` now owns their 44px touch sizing/16px font. Retained the original mobile CRM field rules.
4. **`style-cleanup.test.ts`:** checks that retired selectors stay gone, documents the import-precedence boundary, verifies live controls remain, and guards scoped Quotes styling/customer document isolation.

## Cascade ownership decisions

- **Continue loading the shared foundation last:** `appearance-contrast.css` bridges still-active legacy workspaces; subsequent route-scoped adapters own migrated controls. This avoids unsafely deleting broad dark-mode fixes before fully migrating all descendants.
- **Keep both duplicate CSS imports for now:** deleting one can shift Vite's first-load/cascade order for customer quote document styles or Sinks styling. Deduplicate only after visual parity comparison at multiple widths and themes; it is not automatically safe.
- **Keep the five Sinks `!important` exceptions for now:** identify the specific legacy selector they're overcoming, then simplify alongside computed-style screenshots. Do not globally zero out specificity.
- **Keep Notebook paper / Pencil gesture layers and public customer quote documents outside generic UI rules.** Never sweep old CSS simply because its filename predates the design system.
- **Keep `main` frozen.** This is not the React production cutover.

## Automated gates

The existing Pages workflow runs the full `npm test`, TypeScript check, Vite build and asset-base verification on each push. New CSS ownership tests run under the existing Vitest suite. Verify actual workflow results for the final HEAD; a push alone is not proof of successful deployment.

## Remaining device-level acceptance checks

These require **actual rendered browser or phone checks**, not static source inspection:

- Phone 320/375/390/430 px portrait and short landscape: the Quotes editor, navigator, popovers, notes, Company Settings, Catalog tools, View Results button and scrolling.
- Tablet 700/768/1024 px: breakpoint handoff, drawer escape, panel scroll ownership and two-column layouts.
- Desktop 1024/1280/1440 px at 100% and 125% zoom: shared card radii, control heights, header alignment, long-content scroll, keyboard focus, all six tabs.
- Warm, After Hours, High Contrast and company palette: white/black text readability across Catalog, Board, Settings, Connections, Quotes and Viewer.
- Owner preview (especially real Viewer restrictions), invitation flow and public quote paper/print isolation.
- Notebook iPhone touch scroll versus Apple Pencil strokes; Quotes customer/private notes separation, snapshots, rates/sinks and send/sign rules.

**QC status:** code-scoped cleanup implemented and regression guards added. Browser/device screenshot parity and the final workflow outcome must be checked before claiming the entire UI Foundation visually signed off.
