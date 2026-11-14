# Batch 348a — Quick Quote phone worksheet keyboard navigation

Date: November 14, 2026
Branch: `main`
Status: Source committed. Cloudflare build and real-device iPhone QA pending.

## Entry gate: 347 follow-up tests

The first Cloudflare build after 347b–347d ran TypeScript successfully and reported 491 passing tests / 2 failing tests among 493 total. Both failures were old test assumptions, not TypeScript compile errors:

1. `confirmedBidSubmissions.test.ts` assumed native manual delivery was proven without a revision. The deliberately stricter 347c proof requires an explicit valid revision; the tested confirmed event now uses `revision:0`, with an additional assertion that an old event lacking a revision does **not** complete a protected Deal submission Task.
2. `quoteRevisionView.test.ts` expected the public material row to retain its original `rate:50` even though 347a intentionally folds an undisclosed included sink into the public Area material total. The test now checks the customer-safe direct charge, its reconciled signed total, and the original frozen `rate:50` inside the issued internal snapshot.

No customer pricing or CRM submission predicate was relaxed to accommodate the tests.

## Actual 348a behavior

Quick Quote Area and Takeoff spreadsheets share `quoteGridNavigation` and a phone keyboard accessory:

- Shift+Enter moves to the previous editable single-line cell, complementing Enter/Tab forward and Shift+Tab backward.
- Multiline inputs, contenteditable, IME composition and Ctrl/Alt/Meta browser shortcuts are not hijacked by Enter/arrow navigation.
- The navigation filter skips read-only/disabled cells, disabled ancestors, `visibility:hidden` desktop columns, inert/hidden/aria-hidden sections.
- The phone Prev and Next buttons disable automatically when the focused cell has no navigable predecessor or successor. Pressing an unavailable boundary control no longer blurs/commits the active editor. Done explicitly commits/dismisses the keyboard.
- Disabled button styling remains theme-aware and visually distinct.

## Coverage

Pure regression tests in `quoteGridNavigation.test.ts` now cover Shift+Enter, browser modifiers, IME composition, multiline input, visibility-hidden cells, and boundary availability. The mobile source contract in `quoteQuickMobileUx.test.ts` verifies the toolbar uses those availability checks.

The existing Cloudflare `test:quick-quote` gate already runs both test files, so no build-script changes were needed for 348a. No Supabase schema, RLS, Auth, customer prices, historical signatures, or issued Quote revisions changed.

## Manual acceptance after green

1. On a real phone, edit Areas SF and pricing, and Takeoffs Qty/L/W. Use Prev/Next/Done with the software keyboard open. At the first and last cell, disabled controls should not dismiss or save the editor.
2. On a desktop, verify Enter/Shift+Enter/Tab/Shift+Tab and arrow navigation; hidden columns must not gain focus.
3. Verify in-progress numeric edits still commit on Done/blur and cancel on Escape, without duplicate row writes.
4. Check overlay behavior, phone rotation, keyboard viewport, WARM/LIGHT/DARK, and Android/iOS. No physical-device or live authenticated browser pass has been performed in this source batch.

## Following batches

After Cloudflare green and initial keyboard checks, continue 348b for responsive bottom-sheet/popover and field-reveal parity, then return to Catalog/worktable consistency. Keep multifamily Gantt deferred.
