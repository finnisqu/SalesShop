# Quotes Beta — Safe Area starters and contextual Review fixes (November 2, 2026)

## Shipped on `main`

### Starter layouts
- The new Area layout gallery offers five explicit starting patterns: **Kitchen, Bathroom Vanity, Island, Laundry, Unit Type**.
- Accessible from new quote Details, mobile Areas and desktop Area navigator; **Blank Area** remains available.
- Each selection is **one undoable store operation** creating a new Area and named piece placeholders. No measurements, material cost, slab assumptions, sink selections, catalog snapshots, service rates, customer prices or billable lines are inferred. Editing names or measurements still uses the existing quote store and live SF rules.
- All templates are deliberately non-persistent built-in starter layouts. **Company-wide reusable custom templates and cross-device preset synchronization are deferred** until their catalog snapshot/permissions and privacy rules can be designed safely. For an exact priced replica of an existing Area, use the existing explicit Duplicate Area flow or Start from previous quote.
- Keyboard handling for the picker includes Escape and a contained Tab cycle.

### Review return navigation
- Choosing **Go to** from a Review finding now leaves a temporary **Return to Review** bar in the editor. Dismissal is explicit; opening a new quote or the library clears it.
- Returning focuses the original finding if it remains, otherwise the next canonical blocker/review finding, or delivery when none remain. No issue acknowledgment, preview approval, signing, issuance or link sharing happens implicitly.
- The bar is only shown in the same quote and avoids the customer Preview screen.

## Regression coverage authored
- `src/services/quoteAreaPresets.test.ts`: starter pieces have distinct identities, no dimensions or billable amounts.
- `src/services/quoteReviewReturn.test.ts`: live finding focus, resolved fallback and no quote mutations.
- `e2e/quotes-beta-area-presets-review-return.pw.ts`: named Quick Quote → starter pieces → Review → Go to repair → return to Review.

## Required release acceptance (not yet performed in this connector-only session)
1. TypeScript typecheck, Vite production build, all Vitest tests, and Playwright phone/tablet/desktop journeys at the exact commit.
2. Test undo once after adding a preset (entire Area should disappear), edit dimensions and verify no customer price until the salesperson sets a selling rate.
3. Verify keyboard Escape/focus in the picker, no mobile footer overlap or scroll lock, and Light/Warm/Dark appearance.
4. From a Review blocker, navigate to the editor, repair it, return; confirm only remaining findings are highlighted and Preview approval is re-required for changed customer content.
5. Test on a dedicated organization and verify Cloudflare deployment loaded SHA. Classic/Supabase/Auth/RLS/customer share/signed historical snapshots were not modified in this batch.

Classic should remain available pending the full parity and authenticated acceptance gate documented in `docs/quotes/27-end-to-end-workflow-gap-audit.md`.
