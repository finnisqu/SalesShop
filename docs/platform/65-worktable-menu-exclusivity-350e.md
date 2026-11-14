# Batch 350e — One open worktable menu across Filters, More and Columns

Date: November 14, 2026  
Branch: `main`  
Status: Source committed, tests registered, source-contract checks passed; this new commit's Cloudflare build and authenticated browser/device acceptance remain unverified.

## Issue

The shared `WorktableFilterMenu`, `WorktableActionMenu`, and Records `Columns` details menus already dismiss on outside pointer events and Escape, and share viewport-bound positioning. However, opening a second menu via keyboard or programmatic `<details open>` transitions can bypass the outside-pointer dismissal path, allowing two panels to overlap and compete for the same visual viewport.

## Implementation

1. **Shared single-open guard.** `closeOtherOpenWorktableDetails` in `src/components/useViewportBoundDetails.ts` only targets open native-details members of the established worktable family: `.ss-worktable-filter-menu`, `.ss-worktable-action-menu`, `.connections-columns-menu`. On an opening `toggle` event, it closes other open peers in the same `.sales-app` scope before applying the existing viewport geometry. It works with keyboard, touch/pointer, and programmatic details opening.
2. **Safe scoping.** A closed or unrelated details element never triggers peer dismissal. Separate SalesShop surfaces are not traversed when a local app scope exists. Containing or nested worktable menus are not collapsed, and unrelated disclosure elements (such as help content) remain unaffected.
3. **No focus theft or filter state changes.** Closing peers changes only their native `open` property. The newly opened control retains focus, the currently selected Filters input and draft remain mounted, and the existing outside-pointer/Escape/Done behavior is unchanged.
4. **One existing positioning path.** No new popover wrapper, scroll region, portal, event bus, z-index or CSS overrides were introduced. The current `useViewportBoundDetails` hook still bounds panels against the visual viewport, keyboard, and scroll; `useDismissibleDetails` retains its established pointer/Escape handlers.
5. **Regression suite.** Added `src/services/worktableMenuExclusivity350e.test.ts` with six cases: menu family, switching from Filters/More to Columns, opening Filters from Columns, isolation from unrelated menus/apps, closed/nested menu behavior, and integration contracts for existing hooks. Registered exactly once in `test:quick-quote`. Source-contract checks found all relevant references and the expected registration; the full compiler/Vitest/Cloudflare pipeline was not runnable from the connected GitHub tools.

## Acceptance when Cloudflare green

- Open Filters, then Columns using mouse/touch and keyboard navigation. Only Columns should stay open; return to Filters and confirm only Filters stays open. Repeat with a worktable More menu.
- Change controls inside Filters, open another menu, reopen Filters; selected constraints must remain unchanged and results must still match.
- Use Escape and outside click to close the active panel; keyboard focus should remain predictable. Tap the phone-sized Done button on Filters or Columns and confirm focus returns to its trigger.
- Test narrow portrait/landscape, virtual keyboard and pinch zoom for popover placement and no overlapping menus.
- Check Catalog Sinks, OTHER, Materials/Rates Filters (where present), Records, Tasks, and Catalog Tags. Unrelated disclosure panels should not be affected.
- Verify Cloudflare `tsc --noEmit`, `test:quick-quote`, `test:record-gate` and Vite build on this commit. A GitHub commit-status response with no checks is not deployment confirmation.

## Scope

No changes to Supabase schemas/RLS/Auth, Catalog price calculations, Quote snapshots, issued documents, directory preferences or multifamily Gantt. This batch modifies only worktable popover visibility control and its associated regression tests.

## Next

Batch #350f: prioritize any reported Cloudflare regression; after green, continue targeted mobile accessibility/scroll QA for shared worktable pagination and filtering without creating another bespoke table implementation.
