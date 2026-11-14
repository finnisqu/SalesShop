# Batch 350d — Records Columns menu order and touch parity

Date: November 14, 2026  
Branch: `main`  
State: Source, documentation and regressions committed. New Cloudflare build and authenticated mobile/desktop browser QA remain unverified.

## Observed code issue

The Records worktable already persisted per-directory column layouts and rendered the table columns in the user-selected order using `visibleConnectionColumns`. But its Columns popover still rendered the original `columns.map(...)` schema order. Moving a column left/right therefore updated the table and persisted the preference while its position in the open menu appeared unchanged. Hidden fields were mixed into the visible sequence as well, increasing the chance of mistaken taps on narrow devices.

## Batch work

1. **Column menu follows real table order.**
   - Added the pure `orderedConnectionColumnChoices(columns,activeKeys)` helper beside `visibleConnectionColumns` in `src/services/connectionsTablePreferences.ts`.
   - Visible columns render first in exactly the saved, actual left-to-right table order; hidden columns follow in their original schema order. Unknown or duplicate saved keys are ignored and the source column array is not mutated.
   - The menu now shows a visible/hidden count and clear **Visible · left to right** and **Hidden** dividers. Clicking the existing arrow buttons visibly moves the choice in the menu as well as the column in the table. Restoring a hidden field places it at the end of the active sequence under current behavior.
   - Existing Name visibility requirement, Reset columns, pinning, row-density controls, dataset selection, directory-scoped localStorage persistence, and sorting are preserved.

2. **Mobile Columns actions match Filters.**
   - Added a small-screen **Done · View table** action to the existing Records Columns `<details>` panel. It closes the same details menu and returns keyboard focus to its `summary` trigger. Desktop stays unchanged.
   - Arrow buttons and the Done target are at least 44 × 44px on phone/short touch landscape; section text and checkboxes retain theme variables and wrap instead of pushing the popover wider than the viewport.
   - The existing `useViewportBoundDetails` placement and `useDismissibleDetails` outside-click/Escape logic are not replaced. The Columns popover remains the only menu scrolling region; the underlying `WorktableSurface` remains the only horizontally scrollable table.

3. **Regression protection.**
   - Added six tests in `src/services/worktableColumns350d.test.ts`: actual vs schema ordering, movement, invalid/duplicate keys, restoring hidden fields, component/persistence integration, and mobile Done styling/focus.
   - Registered the suite exactly once in the existing Cloudflare `test:quick-quote` gate. Source-contract checks verified component imports/markers, CSS hooks, one gate entry and the six tests.
   - Full `tsc --noEmit`, Vitest, authenticated browser, and Cloudflare build acceptance cannot be claimed without a new deployment run.

## Manual acceptance after green

- In Connections / Companies (desktop), open Columns and rearrange two visible fields. The menu choices must move in the same order as the actual table, while the hidden fields remain grouped underneath. Navigate to People, then back to Companies; each directory must preserve its own saved layout.
- Uncheck a visible non-Name field, then re-enable it. It should be listed under Hidden while unchecked and return to the end of Visible after re-enabling. Name must remain available to open its record; Reset columns should restore the provided order.
- Test on phone portrait and short landscape with enough columns to make the table horizontally scrollable. Verify 44px arrows, wrapped long labels, the visible/hidden count, reachable Done button, no overflow beyond the visual viewport, and correct focus after Done.
- Confirm the same shared Columns menu still works for Catalog Tags and any other Records-backed directories.
- Verify WARM, LIGHT, DARK themes and keyboard/Escape/outside-click behavior. Open Filters, Columns and pagination sequentially; ensure no menu remains stranded behind the table.
- Verify Cloudflare `tsc --noEmit && npm run test:quick-quote && npm run test:record-gate && vite build` succeeds on the new HEAD commit.

## Scope and next

No schema/Auth/RLS, data operations, price changes, Quote snapshots, signed docs, task completion rules or multifamily Gantt changes. This is presentation and device-scoped column preference ordering only.

Next batch #350e: address any reported build regression first, then narrow remaining mobile Worktable popover/toolbar parity with actual user screenshots and authenticated phone checks before larger UI refactors.
