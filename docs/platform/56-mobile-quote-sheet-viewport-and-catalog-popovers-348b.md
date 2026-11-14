# Batch 348b — Quick Quote sheet focus, Catalog popovers, and phone keyboard viewport

Date: November 14, 2026  
Branch: `main`  
State: Source committed; Cloudflare and authenticated mobile-browser QC pending.

## Objective

Make mobile Area quick editing, Area detail editing and Takeoffs detail editing behave predictably when iOS Safari's virtual keyboard reduces the visible viewport.

## Changes

1. **Only the active sheet scrolls.** `useMobileQuoteSheetFieldReveal` previously called `active.scrollIntoView()`, which can also scroll a portal's ancestors, including the Quote editor behind an open modal. It now identifies the focused field's own `.qqs-panel-body`, `.qqt-panel-body`, or `.qmb-quick-area-body` and adjusts only that scrollport's `scrollTop`. The scroll target is clipped to the intersection of the inner sheet body and the actual `visualViewport`. It clamps against the available scroll range and does not move when the active field is already visible. It still listens to focus, visual viewport resize and scroll and cleans up listeners.
2. **Real bottom scroll space.** When the mobile keyboard is open, the three sheet bodies have enough actual bottom padding for the final field to move above the keyboard/accessory. `scroll-padding-bottom` alone had not increased the available scroll distance.
3. **Material/Sink Catalog menus fit the remaining visible sheet.** Both Takeoff Catalog picker components reuse `useMobileQuoteCatalogMenuViewport`. With the menu open on a phone, it measures trigger, inner scrollport, and Safari visual viewport bounds. An absolutely positioned menu can flip above when the space below is too small and the space above is better; static-flow menus remain below and are capped to their real below-trigger capacity. The menu is vertically scrollable and recomputes on viewport resize/scroll, sheet body scroll, and query/selection changes. Effects remove listeners and inline style overrides on closure/unmount.
4. **Pure geometry and regression tests.** `quoteSheetFieldScrollDelta` and `quoteSheetCatalogMenuPlacement` are independently tested for visible fields, keyboard clipping, scroller clipping, viewport offsets, no available space and static-flow menu constraints. Source contract assertions cover both Catalog integrations, cleanup, and sheet-only scrolling. The new 348b suite is included exactly once in the normal `test:quick-quote` Cloudflare build gate; the existing field-visibility suite remains included once.

## Risk boundaries

- No database schema, Supabase Auth/RLS/policies, Quote pricing, customer contract format, revisions, or signed receipts were modified.
- These are code-level changes. Neither a passing Cloudflare build nor a physical iPhone/browser acceptance run is claimed.
- Existing desktop popovers are unchanged; the new adaptive behavior runs only for `PHONE_LAYOUT_QUERY` and only within a Quick Quote detail sheet.

## Acceptance after build green

- On iOS Safari: focus the last input in an Area/Takeoffs sheet while the keyboard is open. The field stays above the keyboard and accessory; the Quote page behind the modal should not jump.
- Test first and last fields, switching between Areas and Takeoffs, scrolling the editor body, and portrait/landscape.
- Open Material and Sink Catalog pickers near the bottom of a sheet. Suggestion menus must remain within the visible sheet, scroll internally, and be selectable with the keyboard open.
- Rotate the device or close/reopen the keyboard while a picker is open; check listeners/positioning and dismissal. Confirm desktop, WARM/LIGHT/DARK themes, and no regressions to customer quote prices or save behavior.

## Next

After Cloudflare green, do authenticated/physical phone QC and continue #348c with remaining mobile sheet/picker focus and dismissal issues or move to #349 Catalog/worktable consistency if clean. Multifamily Gantt remains deferred.
