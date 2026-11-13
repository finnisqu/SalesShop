# Batch 333 — Catalog variant default management and creation visibility

## Current behavior

Sinks and OTHER each represent a sellable model/item with one or more variants. A variant can be active or inactive (retired), and one active variant may be chosen as the default for new Catalog selections.

### Canonical invariant
- One **available/active** variant is default when the model has any active variant.
- No default exists if every variant is inactive.
- Selecting another active variant as default unmarks the old default. The active default's checkbox cannot be unchecked directly, and inactive variants cannot be promoted until reactivated.
- If the current default becomes inactive or is deleted, the next active variant automatically becomes default.
- Duplicating a variant preserves its specifications, pricing and source history as appropriate, but it never creates a second default. Variant and Catalog IDs remain stable for existing items.
- Cloud/local hydration normalizes legacy multiple/missing/inactive defaults in memory, without deleting inactive SKUs or changing historical quote records.

This is implemented in `src/services/catalogVariantDefaults.ts`, called by the `sinkCatalogStore` and `otherCatalogStore` at hydration and mutation boundaries. No Supabase schema migration was introduced.

### UI
- Both expanded worktables explain default selection, disable impossible default toggles and retain the rest of the per-variant editor (specifications, ADA, finish, dimensions, supplier costs, sell price, archived notes).
- The Sinks worktable sorts by the **active default** SKU's internal cost when Cost sort is chosen. OTHER list summaries display active default cost and price; if all variants are unavailable, show a dash instead of an inactive historical price.
- + Sink and + Item clear search/category restrictions before opening their new row. Sinks still creates the model under the category that was selected before clearing the filter. Pinned comparisons are not discarded.

## Regression coverage

- `src/services/catalogVariantDefaults333.test.ts` — invariant, legacy defaults, inactive preferred SKU, empty/all-inactive, immutable input and active default lookup.
- `src/store/catalogVariantManagement333.test.ts` — live Zustand mutations, local storage writes, duplicate/delete/reassignment, and frozen Quote snapshot values after Catalog edits.
- `src/services/catalogVariantWorkflow333.test.ts` — UX protections, creation visibility under filters, default-priced summaries, Quote source identity.
- All three tests are registered in the normal `test:quick-quote` build command.

## Verification to complete

1. Confirm a Cloudflare green build with TypeScript, unit tests, record-page gate and Vite.
2. In Catalog → Sinks, choose a different active default; deactivate it, reactivate it, duplicate it, delete it. Confirm exactly one active default and the same SKU IDs after refresh.
3. In Catalog → OTHER, repeat the variant workflow, including an all-inactive item. Its summary cost/customer price should show “—” until an active SKU exists.
4. With global Catalog search and section-specific filters applied, use + Sink and + Item. The new editable row should become visible without changing its intended Sink category or clearing pinned comparisons.
5. Confirm an already-issued or draft Quote retains its frozen variant ID, customer price and internal cost after later Catalog changes. Check local and authenticated cloud reload.
6. On iPhone-sized screens and WARM/DARK themes, inspect the disabled default controls and helper text for readability, keyboard focus and no horizontal overflow.

## Next

A further small batch could introduce safe duplicate item/model actions and clarify how an item is archived without deleting historical source identity. No Deal timeline/Gantt work is included.
