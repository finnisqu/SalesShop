# Batch 18D — Classic/Beta shared price reliability

**Scope:** Quote pricing parity and regression gates. Both editors use the same
`Quote` state, selling-price functions, Takeoffs synchronization and pricing
audit; the new tests intentionally operate on that shared engine instead of
inventing separate Beta totals.

## Verified scenarios in this batch

- Three Areas (Kitchen / Vanity / Island) with top SF and selected 4-inch splash; independently priced sinks, a trip charge, fixed builder discount and explicit tax amount
- Re-measuring an Area updates its own live SF charge, not its sink/other Area rows
- Editing a managed sink replaces its row rather than charging twice
- Hidden line items are aggregated into an Area's visible presentation without changing the seller total or printing the hidden sink description
- A partial buying-cost record cannot produce a false complete margin; shop, install, fractional purchased slabs and sink cost stay **private internal inputs**
- Manual, SF and multiplier customer-selling methods use independent calculations; purchased slab quantity remains distinct from the selling slab count
- Missing prices block issuing, and explicit zero prices remain review findings

**Bug fix:** The Beta desktop seller-rate and flat-amount textboxes previously fell back to an old stored value when cleared. Now explicit field deletion is persisted as `undefined`, causing a missing-selling-price Review blocker; selecting a new rate or entering zero remains distinct. Rate Book snapshots are still applied only on explicit rate selection.

## Baseline sample expected results

Kitchen (120″ × 25.5″ + 4″ backsplash) = 24.58 billable SF × $50 + $220 sink = **$1,449**.
Vanity (48″ × 22″ + 4″ backsplash) = 8.67 billable SF × $55 + $95 sink = **$571.85**.
Island (72″ × 36″) = 18 SF × $65 = **$1,170**.
Add trip $150, discount −$125, explicit tax $70: **$3,285.85** customer quote total.

These are disposable test fixtures and **not** World Stone customer data, a supplier cost sheet, or an instruction to apply tax automatically.

## Release gates

The new TypeScript/React build, `quotePricingParityMatrix.test.ts`, `quotePriceInput.test.ts`, browser cleared-rate regression, workbook QC and full visual suite must pass before integrating. Classic stays enabled. Pricing correctness does not satisfy Supabase real-auth privacy, signed-revision acceptance or production deployment requirements.

Integration target: `architecture/react-foundation` (manual-only GitHub Pages deployment guard first); production `main` and Supabase unchanged.
