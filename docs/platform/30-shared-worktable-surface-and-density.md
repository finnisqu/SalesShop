# Batch 332 — Shared Worktable surface and density audit

## Current canonical ownership

| Surface / behavior | Canonical implementation | Consumers |
| --- | --- | --- |
| Labeled, keyboard-scrollable table viewport and rounded surface | `src/components/WorktableChrome.tsx` → `WorktableSurface`; `src/worktable-chrome.css` → `.ss-worktable-surface` | Records directory (`ConnectionsTable` including Companies, People, Deals, Quotes, Tasks, Activity, Notebook Pages and Catalog Tags); Suppliers; Catalog Materials, Rates, material pricing levels, Sinks and OTHER |
| Filter and contextual action popovers | `WorktableFilterMenu`, `WorktableActionMenu` and `src/worktable-chrome.css` | Records and Catalog; filter data remains page-owned |
| Pagination math, page size (25/50/100) | `worktablePageRange`, `WorktablePagination`; `CatalogPagination` is an adapter | Records, Catalog |
| Comfortable/compact row density | `src/services/workbookTableDensity.ts`; `src/workbook-table-foundation.css` | Records and all Catalog reference tables |
| Heading height and cell typography | `src/workspace-table-polish.css` (desktop heading tokens), `src/catalog-product-worktable.css` (Catalog implementation consuming those tokens) | Records and Catalog |
| Expanded variant editors and Catalog-only details | Catalog's `MaterialsWorkspace`, `RatesWorkspace`, `CatalogSinksWorktable` and `CatalogOtherWorktable` | Specialized content; excluded from ordinary-row sizing |

## Consolidation completed

- Five Catalog table wrappers now render `WorktableSurface`, not duplicate divs carrying `ss-worktable-surface`. This preserves existing wrapping classes for horizontal scrolling, column widths and Catalog-specific styling.
- Catalog reference headers read `--ss-workbook-heading-height` and `--ss-workbook-heading-size`; ordinary rows read `--ss-workbook-row-height` and `--ss-workbook-cell-pad-y`. Removing 46px/60px one-off constants makes the already existing compact-mode preference relevant to these rows.
- Filters and Actions use one summary trigger style, open treatment and shared control-size token, with a visible keyboard focus style.
- `src/services/worktableSurface332.test.tsx`, `src/services/worktableChrome130.test.ts`, and `src/services/catalogWorktableConsistency114.test.tsx` lock in the contract.

## Intentionally preserved

- Mobile Catalog reference cards, touch-sized controls, responsive column widths, wide-table scrolling, and expanded variant details.
- Table-specific filters, sorting, quotes, Catalog pin boards, selection, bulk actions and other business behavior.
- Records toolbar placement and Quotes' centered top navigation. No new scroll parent or overlay was introduced.

## Remaining QC (not yet visually verified)

1. Inspect desktop WARM, DARK and LIGHT themes for heading contrast, rounded first/last header cells and column line-height consistency.
2. Verify compact/comfortable row spacing in Materials, Rates, Sinks, OTHER, Tags and Records. Expanded variants must grow naturally.
3. Check narrow desktop and mobile pagination/filter popovers; ensure menus remain visible and tab focus follows the expected surface.
4. Finish Batch 332d–f mobile, inspector and final interaction sweep. Do not infer a passed Cloudflare build from source inspection.
