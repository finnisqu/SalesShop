# Batch 342b — Mobile Record inline editors and viewport-bound worktable menus

## Objective

Finish the shared phone polish for Record inline edits and filter/action/column popovers. Prevent menus from overflowing under the iOS keyboard or along a panned/zoomed viewport while retaining the same compact Worktable and About-panel design.

## Changes implemented

### Worktable / Record action popovers

- Updated `placeWorktableMenu` to clamp the rendered panel's horizontal origin against **both** edges of the visual viewport, including cases where a CSS legacy min-width made the panel wider than the available width.
- Removed the hard 40px minimum `maxHeight` that caused an open popover to run below the visible area when the software keyboard left less than 40px of space. The menu now respects the actual available height on whichever side of the trigger has room.
- `useViewportBoundDetails` now constrains `max-width` to the visible viewport without a forced 100px floor. It temporarily clears legacy minimum widths when the visual viewport is extremely narrow (under 240px), then restores CSS-driven widths after zooming back out.
- Existing resize, outside-scroll, native `details`, Escape and focus behavior is preserved across the shared Filters, More Actions, Columns, and Record actions popovers.

### Record inline editing on phones

- New pure helper `recordInlineScrollDelta` determines whether a focused input/select is hidden above or below the **visual viewport**. When iOS/Android keyboard resize changes the available height, the active inline field scrolls just enough within the nearest owning scrollport. The desktop layout and inactive fields are left unchanged.
- The editor's visual-viewport and window-resize listeners are cleaned up when inline editing ends. The initial adjustment runs after autofocus.
- Mobile Save/Cancel controls remain 44px touch targets with consistent spacing. Fields retain 16px text for iOS zoom avoidance and gain bottom scroll margin for the keyboard and action area. Wrapped errors remain visible without widening the About panel.
- No alteration to Record data mutations, permissions or the one-editor-at-a-time guard introduced in Batch 341.

## Validation

- `src/services/mobileRecordPopover342b.test.tsx` adds **six** regression cases covering existing left/right popover placement, panned visual viewports, extremely short keyboard viewports, inline scroll deltas, event cleanup and 44px touch targets.
- Updated the original `RecordChrome332.test.tsx` CSS contract to match the improved mobile Save/Cancel layout.
- The new suite is registered under `test:quick-quote` in the existing Cloudflare `npm run build` pipeline.
- Source consistency checks passed. Full TypeScript/Vitest/Vite and live phone/browser verification are **not yet confirmed**.

## Mobile acceptance checklist

1. On a narrow iPhone screen, open Worktable **Filters**, **More**, and **Columns** near the right edge. Confirm menus remain visible horizontally.
2. Activate a filter search input and open the iOS keyboard. The popover must move above the anchor or shrink to the available height rather than covering the keyboard.
3. Zoom/pan the browser slightly and reopen those menus. Verify left/right placement resets correctly between zoom levels without a compounding sideways shift.
4. On a Company/Person/Deal record page, tap a pencil near the bottom of the viewport. The focused input should move above the keyboard without needing to manually scroll; Save and Cancel remain tappable.
5. Test on 320px, 375px and 390px widths. An inline email/date/value edit should not overflow its About panel; long validation errors should wrap.
6. Check Record action menu placement in WARM, LIGHT and DARK themes, and confirm Escape still dismisses the menu and returns keyboard focus to its trigger.
7. Confirm read-only perspectives still hide/disable editing and that a successfully saved inline property returns focus to its original pencil.

## Next

Batch 343: a broader QC sweep of lead → Deal → Quote submission → Task / Activity history, including the external-quote submission path and bid due-date proof guard. The Deal timeline/Gantt remains deferred.
