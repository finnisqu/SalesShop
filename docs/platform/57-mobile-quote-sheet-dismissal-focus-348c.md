# Batch 348c — Mobile Quick Quote sheet dismissal, picker Escape and focus return

Date: November 14, 2026
Source: `main`
Release status: Code and tests committed; Cloudflare build and authenticated iPhone/device acceptance still pending.

## Findings and changes

1. **Nested Catalog picker Escape ownership.** `useDismissibleLayer` listens to `keydown` in the capture phase, so Escape from a Material/Sink picker could close the entire parent Area panel before the picker received its own `onKeyDown`. The shared handler now recognizes `.qtl-combobox` with an open `.qtl-combobox-menu` and leaves that initial Escape to the child. Existing unified CRM record picker behavior is retained. A subsequent Escape, when the picker is closed, can dismiss the parent sheet.
2. **Three sheet headers share safe swipe-to-dismiss.** Area summary, Takeoffs row details and Area quick editor previously closed after any downward motion greater than 85 pixels, regardless of sideward drift, multi-finger touch, cancellation or the keyboard. They now use the pure `quoteSheetSwipeCanStart` and `quoteSheetSwipeShouldClose` guards: one touch, noninteractive header surface, at least 85 pixels downward, limited sideways drift, and no keyboard-open state. `touchcancel` discards a pending gesture.
3. **Backdrop taps while editing.** On all three sheets, the first tap outside while the mobile keyboard is open and an editable input has focus now blurs that input to dismiss the keyboard without also closing the sheet. After keyboard dismissal, tapping outside still closes the sheet. Desktop/backdrop behavior is unchanged.
4. **Return spreadsheet focus.** `useQuoteSheetFocusReturn` captures the original focused cell before the temporary Area/Takeoffs editor opens and restores focus when it closes, but only if the original control still exists and focus has not already moved to a newly opened dialog. The Area quick editor continues using `useDismissibleLayer` for focus management.

## Regression coverage

`src/services/quoteMobileSheetDismissal348c.test.ts` exercises the pure swipe start/dismiss and backdrop policies: threshold boundaries, intentional down swipe, sideward motion, upward motion, missing points, malformed coordinates, keyboard-open state, multi-touch and interactive header targets. It also asserts the three source integrations, Escape ownership in nested Material/Sink menus and guarded focus return. The suite is included in the existing Cloudflare `test:quick-quote` gate exactly once.

## Boundaries and manual acceptance

No Supabase migrations, schema, Auth/RLS, customer pricing, Quote revision/issuance, CRM delivery, historical signatures or Catalog data changes.

After the new Cloudflare build is green, manually check iPhone Safari and Android, plus desktop:

- Open a Material/Sink picker inside an Area quick edit dialog. Press Escape: the menu closes but the Area editor stays open. A second Escape closes the editor.
- Focus a numeric input with the phone keyboard up. Tap the backdrop: keyboard dismisses, sheet stays. Tap again: sheet closes.
- Swipe downward on the header deliberately: sheet closes. Horizontal swipes, two-finger contact, cancelled gestures, and swipes with keyboard open must not close it.
- Close an Area/Takeoff editor and verify focus returns to the launching spreadsheet cell, unless the workflow opened another modal.
- Confirm no unexpected Quote saves, duplicate edits, lost pending values, or theme regression in WARM/LIGHT/DARK.

## Next

After authenticated build/device acceptance, move to #349 Catalog and shared worktable consistency, or address any concrete #348c mobile feedback first. Multifamily Gantt remains deferred.
