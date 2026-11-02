# Quick Quote — Integrated Area Worktables (2026-11-02)

## Intent
Quick Quotes use a separate editable worktable per Area and a General worktable, in the same center workspace. Each Area summary combines its named material, quoted SF, known internal cost (marked Partial if incomplete), selling method, rate/multiplier, estimated margin (shown only if fully costed), total, sink count, customer presentation and calculator.

Each Area's detail rows sort by category: **Pieces**, **Sink selections**, **Other charges**. For a piece with splash selections, its splash is a subrow with its own contract-exclusion toggle. The table keeps dimensions, quantity, sink prices and ordinary charges editable without multiple screen transitions. Inputs accept fractional inch dimensions and normal keyboard navigation.

The **Calculator** button at Area/General level opens a right-side private drawer. Area uses the existing selling/pricing engine, buying-cost coverage and three scenario comparison (30% target margin by default, SF, multiplier); merely choosing a comparison scenario never reprices without Apply. General shows known costs without inventing unknown costs. Detailed catalog and fabrication editing remain available.

Selected line checkboxes support bulk contract exclude, restore and move, with an atomic undo record. A strike-through preserves the source piece, splash, sink, quantity and supplier snapshot while removing applicable current customer billing; restoration is explicit. Sink row identities are kept through exclusion/move so normalized cloud synchronization does not restore an obsolete customer charge.

Measured SF and live quantity-rate lines resync when pieces or splash rows are excluded. **Manual/multiplier area selling totals do not automatically change** when a piece/splash is excluded: the Area visibly warns that the seller must adjust the manual selling price before issuing. Quote revisions and signed snapshots remain immutable, as before. The existing quote audit is still the final issuing authority.

## Progress
Five non-blocking milestones: Project details; Takeoffs; Selections & pricing; Pricing review; Contract review. Takeoffs and Selections & pricing lead to the same unified worktable. Pricing review reuses the quote-wide cost/readiness page, Contract review reuses the existing explicit issue/approval flow.

## Not yet verified / follow-up
- Existing Google Drive search could not locate the requested **New Project Template 2.0** / AMENITIES sheet. Need a verified link or access before comparing exact business columns or importing template formulas.
- Need signed-in browser cloud save/reload testing for excluding/moving sinks and for pooled slab allocations, without changing the customer share boundary.
- Browser desktop/phone visual QC and long-form regression parity are required, particularly keyboard controls, table horizontal scroll, catalog picker layering, dark theme, and print/contract visibility.
- Bulk numerical rate edits, custom row sorting within each category, and an explicit issue-blocking acknowledgment for manual-price exclusions would make a useful second pass. Do not claim those are shipped.
