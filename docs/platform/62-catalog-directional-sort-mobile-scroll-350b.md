# Batch 350b — Bidirectional Catalog sorting and mobile horizontal-table cues

Date: November 14, 2026  
Branch: `main`  
Release state: source, tests and roadmap committed; Cloudflare build and authenticated desktop/mobile browser verification pending.

## Context

Batch 350a introduced shared clickable sort headers in Catalog. Sinks and OTHER still only used ascending comparator logic; clicking an already-sorted header did not change order. Their mobile filter chips likewise could not represent a descending default sort. Both tables preserve the horizontal-scrolling spreadsheet layout on phones, but that sideways affordance was not visually discoverable.

## Implementation

1. **Sinks and OTHER have two-way sorting for all five interactive headings.** Clicking the active column reverses ascending/descending; clicking a different column selects ascending. New sort direction state drives the shared `WorktableSortButton` arrow and the parent `<th aria-sort>`. The Sinks fields are Brand, Model, Category, Default cost and Customer price; OTHER fields are Category, Item, Brand/supplier, Default cost and Customer price.
2. **One Filters-menu source for field and direction.** A new Direction dropdown offers Ascending/Descending within the existing single Filters popover. Existing sort field dropdowns use direction-neutral labels. Header interaction and menu direction state stay synchronized. Sorting closes an expanded row, avoiding the old expanded-record page-follow jump, and the pagination/selection reset keys include direction to avoid stale pages or bulk selections.
3. **Numeric price comparator keeps unavailable values last both ways.** `compareCatalogVariantPrice` takes an optional direction, defaulting to its existing ascending behavior. The same active-default price and finite-value guard from 349a applies; archived, missing, `NaN`, and infinite prices never jump to the top when descending. Equal or unavailable values break ties alphabetically for stable results. This is display-only ordering; underlying values and existing Quote snapshots are unchanged.
4. **Mobile filter chips include direction.** The shared `catalogProductFilterChips` recognizes a descending sort as an active filter even when sorting on the table's default field. Its single sort chip shows a down arrow, and removing it resets both field and direction. New/duplicate entries and `Reset filters & sort` restore the default field in ascending order.
5. **Horizontal scrolling is more discoverable.** The new shared `WorktableHorizontalHint` appears just above Sinks and OTHER's existing `WorktableSurface` on phone/narrow landscape screens. It reads "Swipe sideways to view more … columns", without creating a second scroller, a row/card transformation, or a fixed overlay. Touch horizontal scrolling uses containment and iOS momentum behavior. It remains hidden on desktop and inherits existing theme colors.
6. **Regression coverage.** The new `catalogBidirectionalSort350b.test.tsx` suite checks descending/ascending real numeric comparisons, zero pricing, missing/retired/invalid values, active mobile chips, matching sort indicators, safe expanded-row resets, selection/pagination keys, and the accessible mobile hint/CSS. The suite is registered once in the existing Cloudflare `test:quick-quote` gate. Older source-contract tests from batches 333/336/338/349a/350a were updated for the intentional direction-aware comparator, accessible headers and neutral dropdown labels.

## Scope and safeguards

- No Supabase/Auth/RLS/schema, supplier cost edits, price calculations, material variant changes, archived-item status, new Quote records or issued document revisions.
- Existing Material and Rates worktables keep their 350a sorting logic; this batch affects only Sinks/OTHER bidirectional sorting and shared read-only utilities.
- No separate or replacement worktable grid was introduced. Shared pagination, theme styles, selection controls, column counts and comparison boards remain in place.

## Manual acceptance after green

- On Sinks and OTHER, repeatedly click Brand/Item/Category/Cost/Customer price headings; confirm ascending then descending, and that the arrow and screen-reader `aria-sort` track the chosen direction.
- Choose descending customer-price or default-cost order with a mixture of priced, zero-price, and blank/retired SKUs; verify all missing/unavailable values stay at the bottom.
- In Filters, change the sort field and direction separately. Set descending on the default field; its mobile sort chip should be visible and removable. Clear/reset should restore default ascending.
- Expand a model, change direction, paginate or select rows; confirm the table doesn't jump back to the expanded record or preserve selected rows from the prior order.
- Check phone landscape and portrait: one scrollable spreadsheet, horizontal-swipe hint outside the scrolling region, no clipped popover/dropdown, and WARM/LIGHT/DARK theme consistency.
- Confirm the new Cloudflare `tsc --noEmit && test:quick-quote && test:record-gate && vite build` pipeline is green. The GitHub commit-status endpoint had no checks during implementation; it does **not** establish Cloudflare success.

## Next

#350c: address observed Cloudflare regressions first, then shared Catalog mobile menu density, horizontal table scroll behavior, and any remaining Records/Catalog surface differences. Multifamily Gantt still deferred.
