# Batch 350f — Shared pagination and mobile bulk-page safety

Date: November 14, 2026  
Branch: `main`  
Status: Source changes, regression tests and roadmap committed. Cloudflare build and authenticated mobile-browser QA for this HEAD remain **unverified**.

## Issue found

The shared `worktablePageRange` already clamps invalid, fractional and stale pages to the last valid page, but the `WorktablePagination` display continued to render the original unsanitized total and page-size selector value. If a caller supplied an invalid total or a restored unsupported page size, the pager could show a different count from its actual slice or a selector with no valid selected option.

Separately, Records' mobile bulk-selection list had its own Previous/Next buttons. It displayed `currentPage`, the **clamped** page, but advanced the stored `page` with `setPage(page=>page+1/-1)`. After a filter reduced the number of pages, these could differ, resulting in navigation from a stale requested page rather than the visible one.

## Implementation

1. **One normalized pager presentation.** The shared `WorktablePagination` applies the same nonnegative integer total and supported 25/50/100 page-size validation used by `worktablePageRange`, then renders the normalized total and page-size selection. Previous/Next enablement and page announcements still use the clamped range. The existing accessible `aria-live`, named buttons, and familiar compact header design are unchanged.
2. **One visible Records slice.** `ConnectionsTable` now slices with `pageRange.start,pageRange.end` rather than independently recalculating slice offsets, keeping the rendered rows aligned with the same shared helper used by Catalog and the header pager.
3. **Mobile bulk pagination follows the displayed page.** Its Previous/Next actions now use `currentPage-1` and `currentPage+1` instead of incrementing the stale stored page value. The existing disabled limits still use the displayed clamped page, and selections, bulk actions and device-scoped directory states are unchanged.
4. **Phone input readability.** The shared page-size selector uses 16px text on narrow touch screens to discourage unwanted viewport zoom on focus, with a 70px minimum width and the existing 44px touch target. No extra toolbar row, popover, table card or scroll region.
5. **Regression protection.** Five tests in `src/services/worktablePagination350f.test.tsx` cover Catalog/Records range parity, invalid/negative/fractional totals in rendered markup, stale page-size fallback, clamped mobile bulk buttons, keyboard-operable previous/next announcements and bounds. Registered once in the existing `test:quick-quote` Cloudflare build gate. Source-contract checks passed; full compiler/test/build execution is not confirmed.

## Manual acceptance after green

- In a Records directory with multiple pages, navigate near the end, then narrow the dataset with search/filters. Confirm the displayed page and visible rows are consistent. Use Previous/Next and ensure they move one page relative to what is shown.
- Repeat while using phone bulk selection on Companies, People or Tasks. No unexpected jumps should occur after filtering a list down to fewer pages.
- Empty lists show 0–0 of 0, with previous/next disabled. First/last pages disable the correct direction; screen readers announce Page N of M.
- Catalog Materials/Sinks/OTHER/Rates and Catalog Tags should still use the shared 25/50/100 page-size control. Verify the pager and mobile selector appearance in WARM, LIGHT and DARK themes, portrait and short landscape.
- Confirm Cloudflare `tsc --noEmit && npm run test:quick-quote && npm run test:record-gate && vite build` on this HEAD. GitHub statuses with an empty status list do not establish Cloudflare green.

## Scope and next

No changes to Supabase/Auth/RLS, CRM records, Catalog costs, Quote price snapshots or signed documents. Multifamily timeline/Gantt remains deferred.

Next Batch #350g: prioritize any actual Cloudflare build errors; otherwise a targeted mobile bulk-selection and pagination UI pass after authenticated phone screenshots, followed by wider release QA rather than additional bespoke worktable layers.
