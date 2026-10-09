# UI Foundation — Batch 5D: Rates

**Working branch:** `architecture/react-foundation`; `main` unchanged.

## Implemented
- Shared `PageHeader` for Rates with current Reference/Edit mode badge, existing Edit/Done callbacks, and Add rate button.
- Accessible `Field` for pricing lookup, preserving search terms and sort behavior.
- Shared `RatesFilterFields` for Pricing behavior, Unit, and Division pricing in both desktop popover and mobile sheet; one state model, stable control IDs, same original predicates and clear behavior.
- Category selectors are now a group of accessible pressed buttons; selecting a category still synchronizes the embedded RateBook editor.
- Scoped `design-system/rates-adapter.css` normalizes cards, price columns, table headers, modal filters, expanded mobile reference cards, reference/edit switches, rate editor inputs, mobile tool sheet and Dark/Contrast foreground-background pairings.
- Preserves the short touch-landscape phone media rule used by the rest of the app.
- `rates-adapter.test.tsx` tests filter parity and existing price/quote operation wiring. CI is required before deployment.

## Intentionally preserved
- Source rate data, internal costs, suggested sales rates, margin formula, divisions and overrides, effective dates, history and category associations.
- Material level cost bands, slab threshold/multiplier policy, Material RateBook editing.
- RateBook spreadsheet editor and its bulk edit, column visibility, search, import and row actions.
- Add to Quote and destination handling, quote snapshots, RLS, role restrictions and cloud sync.
- Compact mobile hamburger and tool-sheet behavior; no extra desktop header in phone landscape.

## QA on device
1. **iPhone portrait/landscape:** Rates search, horizontal category chips, Tools and Filter sheets (three selectable fields), clear filters, current sort selection, expanded details and Add to Quote.
2. **Desktop:** Rate category, price search, desktop filter popover, sort, desktop table rows, cost/sell/margin/effective columns.
3. **Edit mode:** Add rate row, edit a rate, view versions/overrides, change material price bands, switch back to Reference, confirm autosave.
4. **Themes:** Warm, Light, Dark, Contrast — no cream-on-cream or dark-on-dark on cards, sort or embedded edit controls.
5. **Permissions:** Viewer/Owner preview remain read-only as controlled by the app router.

## Next
**Batch 5E — Suppliers:** common catalog header/form/toolbar, price import control, mobile supplier reference cards and navigator scroll. Do not touch `main` until explicit cutover approval.
