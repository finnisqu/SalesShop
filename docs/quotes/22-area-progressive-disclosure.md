# Quotes Beta — Area progressive disclosure

November 2026 main-first batch. Presentation and navigation only.

## Changes
1. **Desktop selection/pricing**: material selection and selling-price controls stay fully visible. Optional Sinks and Add-ons are disclosure sections; when the Area already contains their work, those sections start expanded. No data is deleted or migrated by collapsing them.
2. **Desktop Measure**: Pieces stay visible. Optional sink models and Add-ons start collapsed when empty, expanded when populated.
3. **Mobile material/sink editing**: internal buying-cost references and per-sink buying-cost overrides move behind an explicit "internal" disclosure. Material selection, sink model, quantity and customer selling-price inputs remain visible.
4. **Mobile selling-price step**: the supplier cost reference moves behind a disclosure. Its label still calls out when the current catalog reference has changed. Linked SF rate selection, editable charges, and issue resolution remain visible.
5. **Calculator**: no financial calculation, cost-completeness logic or pricing method was altered. The dedicated desktop Calculator remains accessible.

## Acceptance
- A fresh Kitchen shows Pieces and a compact Add sink / Add-on option on desktop. Expanding each shows existing controls and entering a sink/add-on persists.
- Reopen that Kitchen: existing Sinks and Add-ons are already expanded. A blank Area stays compact.
- On mobile, material catalog selection and sink selling price are immediately visible. Buying reference/details can be expanded and edited as previously.
- Mobile Pricing shows linked SF price picker and charge rows without internal supplier-cost panel occupying the top of the screen.
- No changes to price totals, quote drafts/issued revisions, undo/redo, Review approval, Supabase or Classic Quotes.
- Verify narrow mobile layouts, dark theme, desktop, read-only quotes, and quote switching.

**Verification status:** source reviewed; Vitest fixtures authored but not executed in this GitHub connector session. Confirm Cloudflare Workers build and manual UI checks before declaring browser acceptance.
