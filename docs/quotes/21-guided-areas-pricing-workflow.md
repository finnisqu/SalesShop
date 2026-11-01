# Guided Quotes Beta: Area actions, pricing issue navigation, context-aware flow

November 2026, source-reviewed staging on main. Scope: navigation and presentation only.

## Batch 1 — Area quick start
- Brand-new empty Areas offer explicit Add first piece, which uses existing newTakeoffPiece and updateTakeoffPieces. No automatic creation and no pricing changes until the user clicks.
- Measure / Material & sinks / Selling price are shortcuts into the established Area tabs. All pricing returns to the quote-wide overview.
- A flat-fee Area with manual lines is never treated as an empty first-use Area, even without pieces.
- Done from an Area opened through the Pricing overview returns to Pricing; from Areas it returns to Areas. The desktop rail remains accessible.

## Batch 2 — Pricing issue resolution
- Quote-wide pricing overview lists up to six blockers with per-finding direct navigation to canonical audit destinations.
- No-priced-work blocker goes to General/Areas rather than a dead-end.
- Each Area row has a Measurements shortcut, alongside Material & sinks, Selling price and the existing issue shortcut.
- The existing audit is the source of pricing severity and issue count; no new issue model is introduced.

## Batch 3 — Focused next actions
- Project details footer explicitly continues to Areas. Areas footer continues to quote-wide Materials & Pricing. Pricing footer opens existing Review.
- Removed the duplicate inline Areas continuation callout to make the screen less dense.
- The General section includes optional guidance without a redundant heading.
- General charges navigation from pricing returns to the existing Build editor and scrolls to the General entry controls.
- Preview/approval, issued revisions, cloud permissions, pricing formulas, and Classic remain unchanged.

## Acceptance
- New Quick Quote: Details → Areas → Pricing overview → Review, with any stage accessible out of sequence.
- Empty Area: Add first piece creates exactly one piece; Area can be left blank or priced flat instead.
- Kitchen and Bath: click all pricing, jump back into each measured/price tab, then Done returns to pricing.
- General-only quote: edit General charges from overview and ensure correct price/scroll behavior.
- Multiple audit blockers link to their own fix destinations; Review still enforces the original approval and issue gate.
- Reload/Back navigation, mobile widths, desktop rail, dark mode, existing read-only documents and pricing schedules.
- No new database changes; tests authored, **not executed** without a local checkout/browser or Cloudflare deployment feedback. Verify Cloudflare Ready.

