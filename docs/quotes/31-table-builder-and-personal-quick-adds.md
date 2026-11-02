# SalesShop — Quote Builder tables & personal quick adds (2026-11-02)

## Changes
- The mobile/desktop **Quotes Beta → Areas & scope** build page uses a compact, column-headed Area table (Area, Material, Measured SF, Display, Amount) and General table (Description, Type, Pricing, Amount, Open).
- Rows stay clickable and retain the original Area and General editor, undo, contextual actions, move/delete confirmation, and drag/reorder mode; the underlying pricing, quantities and issue/approval rules are untouched.
- General rows still expand in place to reveal all edit fields and Catalog integrations. This is a presentation change, not a new pricing engine.
- On smaller viewports secondary columns hide and item/amount/open remain accessible without forcing horizontal scrolling; on larger screens full columns appear.
- Two account/organization-scoped **My Quote Builder** preferences are introduced, saved **in the current browser**: compact vs comfortable table spacing and starred General quick-add types. Unstarred types remain accessible under **More · My quick adds**. Neither preference mutates a quote, charges, or company data.
- A missing cloud identity never inherits another account's browser preferences, and storage unavailability reverts to defaults. Cloud sync/tenant company publishing is deferred.

## Acceptance checklist (not executed)
1. Build/typecheck and Vitest at the deployed SHA; test browser-local personal preference read/write across two cloud accounts.
2. Verify Areas/General table alignment and focus across phone widths, 800px tablet, >=1000px desktop with sidebars, dark/light themes, browser zoom and long names.
3. Open a General item, edit the rate/quantity/description, close; confirm exact previous and new totals, undo, quote audit and customer preview. Test a text-only Note and a missing-rate item.
4. Reorder/delete multiple Areas/General lines using touch, pointer and keyboard; verify handles and confirmation still work and no selection/drag soft locks.
5. Star and unstar each General quick-add type, use More to add a nonfavorite, switch accounts, reload and verify only the intended personal view persists.
6. Verify no pricing, signed snapshot, preview approval or customer issue/share semantics changed. Keep Classic enabled through acceptance.

Related: `docs/quotes/30-personal-area-layouts.md` for user-specific saved takeoff layouts, and `docs/quotes/27-end-to-end-workflow-gap-audit.md` for remaining Classic/Beta parity.
