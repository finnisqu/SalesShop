# Batch 336 — Catalog page selection, bulk lifecycle actions and sort parity

## Overview

Both **CATALOG → SINKS** and **CATALOG → OTHER** use the same page-scoped selection controls while edit mode is active. The shared implementation lives in `src/components/CatalogBulkSelection.tsx`.

### Selection and bulk actions

- Edit mode adds a checkbox column to each worktable. The heading checkbox selects the **current page only**, never all matching Catalog records.
- Selecting rows exposes a compact bulk action group in the existing pagination toolbar, not a permanent extra action row.
- The action group shows **N selected**, **Archive (N)**, **Restore (N)** and **Clear selection**. Counts are split by the selected records' current lifecycle state.
- Bulk archive asks for confirmation and explicitly says historical quote selections are retained. Bulk restore does not delete, merge or reprice anything.
- A selection is limited to rendered page IDs even if an older/hidden ID remains in React state. Changes to page, page size, sort, local/global search, category, archive visibility or edit state clear the selection. Bulk actions also clear selection afterward.
- The shared controls remain inaccessible to non-editors and role-perspective previews.
- Both top-level stores batch the active flag updates in **one local persistence/scheduled cloud operation** per action, avoid writes if no IDs need changing, preserve untouched objects and do not modify variant or quote identity.
- Archiving enables **Include archived** to keep the affected records findable in the table. Existing pinned comparisons are unchanged.

### Search/sort parity

- Sinks' local/global search now recognizes its human-readable category labels (e.g. Vanity) and variant configuration labels (e.g. Rectangular), in addition to its existing model/SKU/finish fields.
- OTHER now offers **Cost · low first** and **Customer price · low first** using the available active default variant. Records with missing/retired-only prices sort last; there is no guess at zero pricing.
- Global Catalog search and worktable-specific search remain conjunctive rather than being joined into a fabricated phrase. Existing filter-reset and pagination behavior is retained.

## Regression coverage

- `src/services/catalogBulkSelection336.test.ts` tests pure page scoping, stale IDs, active-vs-archived targets, read-only selection guards, action confirmation, reset wiring and sort/source parity.
- `src/store/catalogVariantManagement333.test.ts` adds live Sink and OTHER store bulk archive/restore tests with untouched-record structural sharing, no-op writes and historical quote snapshot safety.
- The new suite is registered under `test:quick-quote`, part of the standard `npm run build` pipeline.
- No Supabase migrations were required.

## Manual QC

1. Open Sinks → Edit sinks; select two rows and observe the bulk actions in the existing top pagination bar. Select All must select only the current page, not the full search result.
2. Archive the selection and confirm. The archived records should remain findable with **Include archived** enabled, with their variants and prices unchanged. Select and restore them.
3. Repeat on OTHER, including a mixed active/archived selection; the Archive and Restore counts should each reflect only their eligible rows.
4. Select records, change page, page size, search, sort, category or edit state; previous selections must not carry into the new view.
5. Search Sinks for a human category/configuration label. In OTHER, sort on Cost and Customer price and confirm records with no active default price show last.
6. Check the mobile table, selection controls and top action bar in WARM and DARK themes. Ensure keyboard focus and checkbox targets remain accessible.
7. Review an existing quote tied to an archived/restored Catalog source; previously captured prices and variant IDs must stay unchanged.

## Verification status

The modifications and registered tests have been committed and source-consistency checked. The full Cloudflare build and browser QA are not yet confirmed.

## Next

Batch 337: Catalog-to-Quote insertion and pricing integration, with attention to default variant consistency, source refresh without repricing historical quote lines, and mirrored Sinks/OTHER behavior. Deal timeline/Gantt remains deferred.
