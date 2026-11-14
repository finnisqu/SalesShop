# Batch 350a — Shared Catalog worktable sortable headers and pagination-safe sort behavior

Date: November 14, 2026
Branch: `main`
Status: Source changes and regression suite committed; this batch's Cloudflare build and authenticated phone/desktop acceptance are **not verified**.

## Problem

Records already allowed sorting by clicking column headings and announced the sorted field using `aria-sort`. Catalog Materials, Rates, Sinks and OTHER had sort controls in menus, and Sinks/OTHER announced header sort states, but their column headings were plain text. A second issue in Sinks/OTHER was that an expanded row's page-follow effect could pull the user back to the old expanded record when a sort changed the list.

## Implementation

1. **One shared heading control.** `WorktableSortButton` is an accessible native button in `WorktableChrome.tsx`. Its parent `<th>` continues to own the table's `aria-sort` value; the button provides the focusable click/tap target, accessible "Sort by …" label, and ascending/descending or unsorted indicator. Its styling inherits the shared darker worktable heading and theme palette instead of adding another competing header theme. Keyboard focus has a visible accent outline; Sinks/OTHER phone table headings get a minimum 44px tap target.
2. **Sinks and OTHER.** Brand, name/model/item, category, default cost and customer price are now sortable directly from the table (five columns per table). Clicking a column chooses its existing ascending sort; no changed cost/price comparator or new pricing calculation. The existing Filters menu remains fully functional and uses the same sorting handler.
3. **Materials.** Brand, Name, Type and Default cost headers are clickable. The cost header can switch between the existing low-first and high-first sort options, with correct `aria-sort` direction. The existing default STOCK/brand sort, variant expansion, comparison board and mobile reference card behavior are retained.
4. **Rates.** Item, Category, Cost, Suggested sell and Effective headers are clickable. Suggested sell toggles between the existing low-first/high-first options. Effective date remains the existing newest-first sort and announces descending. The separate Material Pricing table is unchanged.
5. **Safe sorting and paging.** Every newly connected header sort, and the existing Catalog dropdown sort controls, clears any expanded row before applying sort changes. Sinks/OTHER sort-chip removal also clears expansion. This prevents expanded-record page-follow effects from hijacking the selected sorted page, while leaving Quote selection and worktable bulk actions intact.
6. **Regression gates.** `src/services/worktableHeaderSort350a.test.tsx` covers native semantics and visual direction, Sinks/OTHER parity, Materials and Rates sorting, expansion reset, shared surfaces, existing filter menus, and theme/focus styling. The suite is included once in `test:quick-quote`. Updated Batch 349a source assertions for the two Sinks/OTHER price header labels, which are now rendered by the shared component rather than raw text children.

## Boundaries

No Supabase/Auth/RLS/schema, catalog price write, quote price/variant snapshot, supplier relationship, signed document, or Gantt work. No duplicate table implementation was created: all tables continue using the shared `WorktableSurface` and existing pagination/filter primitives.

## Acceptance following a green build

- Confirm Cloudflare `tsc --noEmit`, `test:quick-quote`, `test:record-gate` and Vite. The passing build of #349c preceded this batch and is not evidence of #350a build success.
- On desktop click heading sort in Catalog > Materials/Rates/Sinks/OTHER; verify visible row order and `aria-sort` orientation, and that menu sort values stay synchronized.
- In Sinks/OTHER expand a record, sort by customer price, and verify page one of the sorted list remains visible rather than returning to the expanded record. Repeat with sort reset from mobile chip.
- In Materials click Cost twice to toggle low/high first. In Rates click Suggested sell twice to toggle direction, and Effective once for newest first.
- On phone check horizontally scrolled Sinks/OTHER headings for tap target, focus ring, clipped labels, and scrollbars. Materials/Rates retain mobile cards and their existing mobile sort selectors.
- Confirm WARM, LIGHT, DARK worktable dark-header styling and rounded corners, and no regressions to existing Records and Quotes tables.

## Next

Batch #350b: remaining shared Catalog/Records column-header and mobile visual polish based on authenticated UX observations, especially bidirectional sorting parity and horizontal scrolling, without reintroducing bespoke worktable styling.
