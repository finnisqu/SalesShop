# November 2 — Previews/tables and Tasks usability (Batches 1–2)

## Source changes
- Shared directory Columns popover now dismisses on outside click and Escape; the Name column stays openable.
- Filter changes prune selected records that are no longer in the current table; page-to-page selection in the same view is retained.
- Tasks gain inline Complete/Reopen and quick due-date presets in desktop tables, plus quick due-date controls on mobile cards.
- Task summary now displays Today and Upcoming alongside All open, Overdue, Start later and Completed.
- Task queues and queue suggestions use the active personal task scope only; stale tasks from another workspace cannot supply queue labels.
- Quick due dates are local calendar-day presets (Today, Tomorrow, In 7 days, Clear); preserve existing due time when moving a due date, but clear it when clearing the date.
- Record preview drawer uses a bounded scrolling body, focus-visible controls and safe mobile dimensions.
- No Supabase schema or quote-price changes.

## Release/acceptance checklist
1. On desktop, open Columns, change visibility and order; verify outside click and Escape dismiss it. Change the search filter after selecting rows and ensure hidden records cannot be bulk-actioned; moving between pages should preserve selections within the view.
2. Check Board and Connections preview drawers on desktop/mobile: one-click name, dim backdrop, related navigation, Escape/close, long content scroll, safe-area footer and accessible keyboard focus.
3. Tasks: Today, Upcoming, Overdue and Start later match their date semantics. Test dates around month/year rollover. Set a task Due Today/Tomorrow/In 7 days and Clear due date from desktop table and mobile card; test Complete/Reopen, filtering and refresh.
4. Confirm new task queue suggestions show only the active user's queues after switching account/org, and quotes in task associations remain owner-scoped.
5. Check light/dark themes and viewport widths 375, 768 and 1280px. Verify Cloudflare loaded SHA/build badge, sign-in, task private cloud round-trip and quote navigation manually.

## Verification scope
Source-level assertions and pure scheduling tests added. Live Cloudflare, browser, authenticated Supabase and the Vite/TypeScript build must be verified separately; do not infer a passed check from this document.
