# SalesShop UI Foundation v1 — Batch 5B: Materials

**Branch:** `architecture/react-foundation`  
**Production:** `main` untouched  
**Scope:** Catalog → Materials only. No schema, pricing, supplier importer or quote-creation changes.

## Changes

1. **One set of filters for desktop and mobile.**
   - Added `src/components/MaterialsFilterFields.tsx` with six shared accessible `Field` controls for STOCK program, family, material type, brand, finish, and thickness.
   - The existing `MaterialsWorkspace` still owns all filter state and setter functions. Both desktop `rates-filter-popover` and the existing mobile `MobileCatalogFilterSheet` render the exact same controlled fields. Separate ID prefixes prevent duplicate labels if both happen to mount.
   - Existing Clear Filters, active chip removal, search and sort predicates are unchanged.
2. **Shared controls.**
   - Materials search now uses accessible `Field`, with a visually hidden label to preserve compact mobile search-first design.
   - The existing mobile Filter and Tools launchers adopt shared `Button`, retaining the original classes and open/close handlers.
   - Sort selector retains its specialized two-line compact mobile layout; the new adapter standardizes its colors, font scale and focus treatment without changing options or comparator functions.
3. **A scoped visual adapter.**
   - `src/design-system/materials-adapter.css` adds semantic palette tokens and matched background/foreground colors to search, filters, sort, comparison, reference table, mobile material cards and the tools sheet.
   - Preserves the one scrollable contents region in mobile filters and keeps the Done button in a separate normal-flow footer. No fixed footer over the list.
   - Continues to show Global Catalog navigation via the existing mobile hamburger, rather than adding another crowded toolbar.
   - Styles Materials-only variants; Sinks, Rates and Suppliers keep their current section-specific appearance until their migrations.
4. **Regression tests.**
   - `src/design-system/materials-adapter.test.tsx` covers filter semantics, six control IDs, desktop/mobile parity, clear behavior, price/filter/pin/add-to-quote source contracts and scroll/theme CSS.
   - Existing full Vitest suite and production Vite build remain the deployment gates.

## Must preserve

- Supplier cost and STOCK price resolution; sorting by name, brand, family/type, ascending/descending cost.
- Material slab variants, supplier purchase programs, images/links and pinned comparison order.
- Mobile expanded reference cards and touch targets; focus, scrolling and auto-restoration after Pin.
- Import center, Reference/Edit mode, Show Inactive toggle and `MaterialRateBook` catalog editor.
- Direct Add to Quote with the same material/variant identities and destination handling.
- Owner Preview / Viewer read-only navigation, shared hamburger, company workspace permissions.

## Device/browser QC after deployment

- **Phone 320 / 375 / 390 / 430:** search across top; Filter/Sort/Tools second row; keyboard focus; no horizontally cropped controls. Filter sheet should scroll through all six selectors while Done · View results remains accessible below content.
- **Catalog browsing:** change filter selections, tap active filter chips, clear all; test STOCK/brand sort and cost sort; open material card and variant details; pin two slabs, reorder and unpin; Add to Quote.
- **Themes:** Warm, Light, Dark and High Contrast: legible card names, supplier notes, costs, sort selection, search placeholder, popup labels, and tools sheet.
- **Desktop:** five Catalog section navigation tabs stay intact; Materials search, filter popover and sort fit on one line where space permits, and the comparison tray and reference table retain their behavior.
- **Viewer and Owner Preview:** no reintroduced edit capability and still able to leave the Catalog via the hamburger.

## Next

**Batch 5C — Sinks:** migrate its shared search/actions, sink card headers and mobile variants before tackling Rates (5D) and Suppliers (5E). Only remove legacy CSS declarations once measured visual parity is confirmed.
