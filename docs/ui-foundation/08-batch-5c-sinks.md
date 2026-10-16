# SalesShop UI Foundation v1 — Batch 5C: Sinks

**Branch:** `architecture/react-foundation`. **Stable main:** unchanged.

## What shipped

- **Shared PageHeader** replaces Sinks' custom product heading and carries the existing Cloud/saving status, Add Sink model, and Edit/Done editing actions. Their existing state and callbacks remain intact.
- **Field** provides a stable accessible label/ID for the Sinks search input, with its label visually hidden on compact screens to preserve the search-first mobile layout.
- **Shared Buttons** wrap model editing actions, Tools launcher and category filters without altering their handlers. The category strip is correctly marked as a **group of pressed filter buttons** rather than an incomplete ARIA tablist. Mobile Reference/Edit choices expose `aria-pressed`.
- **Theme and layout adapter** `src/design-system/sinks-adapter.css` is scoped to Catalog → Sinks. It coordinates background/foreground text pairs, card radii, focus outlines, inputs, select fields, mobile tools, model header, expanded sink variants, and the summary/pricing tiles.
- **Mobile reference cards** still use `MobileCatalogReferenceCard` with expand/collapse, sell-price summary and selected-model detail. Editing models on mobile continues to use existing `renderSinkDetail`, preserving form controls, variant fields and actions.
- **Safe input sizing:** iOS input/select controls use 16px text and 44px minimum height where applicable, preventing focus zoom and small tap areas. Model search stays visible; desktop summary header remains hidden in the embedded mobile Catalog.
- Tests in `src/design-system/sinks-adapter.test.tsx` protect selection accessibility, existing sink business operations and quote insertion, and adapter styling/scroll rules.

## Explicitly unchanged

- Data model, sink costs and customer prices, margin calculations and price-version history.
- Model and variant creation, default/ADA flags, archive/active states, model editing, variant duplication, and guarded variant deletion.
- Sink `CatalogAddToQuoteButton` and quote insertion destination selection.
- Auth, role permissions, cloud syncing, and category/query filters.
- Global hamburger Catalog navigation, mobile tool-sheet closing, and reference vs maintenance mode.
- No Supabase schema, migrations, data rewrites or changes to `main`.

## QC checklist

1. On phone, open Catalog → Sinks. Search by sink name, brand, model code, variant code and ADA. Switch Kitchen/Bathroom/etc category filters without losing the search. Open the Tools sheet, switch Reference/Edit, and close via backdrop/X.
2. Expand a sink. Confirm model name, variants, prices, cost, margins, ADA/default labels, and quote-insertion control appear without white-on-cream or dark-on-dark text in Warm/Dark/Contrast.
3. In authorized edit mode, edit model fields, change price/cost, duplicate a variant, add a model, and confirm Save status updates. Check minimum one-variant deletion safeguard still works.
4. Test 320/375/390/430px iPhone widths and landscape. No second Catalog navigation strip or fixed footer covering search or forms; Tools sheet is independently scrollable.
5. On desktop/tablet, use shared PageHeader and category strip; browse navigator/list and selected detail; check form sizing and layout at narrower widths.
6. Confirm Viewer and Owner Preview remain read-only through route permissions; this batch does not grant edit capability.
7. GitHub Actions must pass Vitest and TypeScript/Vite build; actual on-device screenshots remain the final visual review.

## Next scheduled

**Batch 5D — Rates:** unify search, sort, filters, service-rate editing and mobile card styling. Then **Batch 5E — Suppliers**, with importer/drawer and forms. Do not merge to `main` during migration.
