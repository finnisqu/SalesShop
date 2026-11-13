# Batch 332d — Mobile Worktable viewport and toolbar

## Problem

Worktable Filter/Actions menus and the Records Columns panel were individually aligned left or right. On a narrow phone (particularly with a landscape viewport, magnification, or the software keyboard) an otherwise width-bounded menu could still extend beyond the visible viewport. Catalog mobile also retained 38px–40px controls from older page-specific CSS even after the shared chrome established its own touch sizing. For mobile Notebook Pages and Activity History, Records retains a horizontally scrollable table, unlike card-based directories.

## Shared implementation

- `src/components/useViewportBoundDetails.ts` owns menu geometry and React attachment for the three native-details menu types.
- `placeWorktableMenu` is a pure calculation using the trigger, menu, and visual viewport rectangles. It computes horizontal offset, above/below placement and available vertical height.
- `useViewportBoundDetails` binds to open/close, viewport resize and outer scrolling; it updates only open menus. It reattaches on a rerender if a worktable toolbar initially had no host and later appears via a portal. It skips geometry work while the menu's own contents scroll.
- `WorktableChrome.tsx` uses the hook for shared Filter and Action menus; `ConnectionsTable.tsx` uses it for Columns. No change to menu contents, filter state or click-away/Escape behavior.
- `worktable-chrome.css` and `connections-table.css` own the computed offset and above-menu selectors. On phones and coarse landscape screens, controls use touch-sized minimum heights, responsive Catalog pagination/extras, bounded popover scrolling, and horizontal momentum scrolling without a toolbar overflow container.

## Acceptance checks

1. On a 320–390px phone, open a Catalog Filter or Records Columns control at either screen edge. The panel should stay within the visible screen.
2. With a text input focused and the keyboard raised, the panel should resize or flip above when below space is too small.
3. Rotate a phone or pinch-zoom; placement should recalculate against the visual viewport and not compound horizontal shifts.
4. Scroll inside a long Filter menu; panel positioning should remain stable, without forcing the page to scroll.
5. Confirm Catalog page controls and Catalog Tags extras wrap without horizontal overflow; touch targets remain at least 44px.
6. On mobile Activity History/Notebook Pages, horizontal swipes should scroll the table instead of changing pages. On desktop, confirm no new nested vertical scrolling and unchanged centered Records tabs.

## Automated/source coverage

- `src/services/worktableViewport332.test.ts`: menu geometry for left/right edge, center, keyboard and zoom.
- `src/services/worktableMobile332.test.ts`: integration/source contracts across shared Filter/Actions, Records Columns, mobile touch and pagination CSS.
- Both tests are registered in the existing Quick Quote build gate. A green build and real-device QC are separate requirements.
