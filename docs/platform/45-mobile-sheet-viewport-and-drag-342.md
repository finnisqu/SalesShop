# Batch 342 — Mobile shared-sheet viewport and drag reliability

## Goal

Make SalesShop's Task, Activity, Record and related quick-preview bottom sheets behave consistently on iPhone/Android while typing, rotating the phone and dragging the handle. Maintain the spreadsheet and compact mobile treatment without introducing new full-screen backdrops or individual per-page implementations.

## What changed

1. **Per-sheet visual viewport measurement.** `MobileSheetHandle` now reads `window.visualViewport.height` and `offsetTop` and sets `--ss-mobile-visual-height` / `--ss-mobile-visual-top` on its **nearest backdrop**, not on `document.documentElement`. The overlay is therefore sized to the visible area after a software keyboard opens, even if CSS `100dvh` is stale. Other open dialogs retain independent viewport variables.
2. **Reactive keyboard handling.** The handle listens to VisualViewport `resize` and `scroll`, plus window `resize`; cleanup removes all listeners and both scoped variables. The pure `mobileSheetViewportGeometry` helper clamps negative, invalid or excessively large dimensions before they reach CSS.
3. **Short phone landscape parity.** Shared sheet CSS and drag detection now use the same portrait/short-landscape rule: `(max-width:760px), (orientation:landscape) and (max-height:520px) and (pointer:coarse)`. Thus rotating a phone no longer removes the shared drag treatment simply because its landscape width is greater than 760px.
4. **Safe drag cancellation.** The drag grip will not start a gesture while the virtual keyboard is explicitly open or with an ordinary mouse pointer. A keyboard opening mid-drag aborts that gesture. Disabled handles reset an in-progress transform. Canceled or lost pointer capture still springs the sheet back. If the consumer declines a completed close request, a surviving sheet is reset rather than remaining shifted downward.
5. **Focused fields and footer.** The scrollable sheet body gets focus-aware bottom scroll padding so keyboard navigation keeps inputs above the fixed action footer. Safe-area padding, 44px touch targets and 16px minimum editable text sizes remain in the shared CSS.

## Scope and constraints

- Shared, backward-compatible changes: `src/components/MobileSheetHandle.tsx`, `src/components/mobile-sheet.css`, `src/lib/mobileSheetViewport.ts`.
- No change to business data, CRM permissions, Task completion rules, or Quick Quote pricing.
- No new global keyboard flag, backdrop blur, separate page styles or auto CI/browser checks. Existing HTML close buttons remain the accessible fallback to swipe gestures.
- The existing Record external-quote capture also has a viewport listener. The shared per-backdrop measurements complement it rather than replacing its capture-specific presentation.

## Verification

- `src/services/mobileSheetViewport342.test.tsx` adds 6 cases for keyboard geometry, invalid viewport values, CSS/JS phone query agreement, listener cleanup, pointer/keyboard guards, and SSR.
- The new suite is registered in `test:quick-quote`, which Cloudflare runs during `npm run build`.
- Existing `mobileNavigationMonthAndSheets.test.ts` grip/cancel behavior remains supported.
- Source checks passed. Actual TypeScript/Vitest/Vite compilation and physical device/Cloudflare tests have **not** been run in this session.

## Hands-on acceptance checklist

1. On an iPhone, open a Task edit sheet. Focus the title input; the sheet should shrink above the keyboard without losing its footer and Save actions.
2. Edit an Activity note and a Person/Deal quick-preview action; keyboard, focus and close button should remain usable, and the body should scroll independently of the backdrop.
3. Rotate a phone into short landscape. Verify the shared handle remains visible and a downward drag closes the preview; small/canceled drags return it to position.
4. Begin dragging the handle and then invoke a keyboard focus change: the grip should no longer close the panel unexpectedly.
5. Start a save that disables the Activity close grip, then attempt a drag. The panel should remain stationary until the operation finishes.
6. Open a Record preview from a Task, then use **Back to Task**. Check that no sheet is left visually translated and the underlying page is not unexpectedly scrolled.
7. Check WARM, DARK and LIGHT themes and iOS safe-area inset/Android navigation bars. Footer buttons should remain above system UI.
8. Verify desktop panes and wide tablets continue using their existing non-sheet layout.

## Next

Continue Batch 342 with mobile inline editing and narrow-width popovers if Cloudflare is green. Batch 343 will review the complete lead → Deal → Quote → task/activity workflow, including equal treatment of external quote submissions. Deal timeline/Gantt remains deferred.
