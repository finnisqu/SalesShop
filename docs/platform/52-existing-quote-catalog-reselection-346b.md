# Batch 346b — Existing Quote Catalog source refresh and margin accuracy

## Goal

When a salesperson selects or refreshes an already-linked Material, Sink, Rate Book entry or OTHER product, retain the **negotiated customer selling price** and any manual private total-cost override, while using a current, valid Catalog source for the refreshed specifications and private cost snapshot. Do not silently reprice issued documents or manufacture supplier references for retired items.

## Gap closed

The source-refresh services already separated Catalog provenance from customer pricing, and prior tests covered much of that contract. However, the four existing-Quote picker callbacks still passed item/variant objects captured during their prior React render. An edit, delete or deactivation in another tab—or a late store hydration—could leave a stale callback inserting an outdated buying cost or formerly active SKU into a Quote.

Batch 346a guarded the **new Quote / insert** pathway; this batch applies the same commit-time principle to **existing Quote source reselection**.

## Changes

- Created `src/services/quoteCatalogLiveReselection.ts` with `liveMaterialSelection`, `liveSinkSelection`, `liveRateSelection`, and `liveOtherSelection`. Each resolves an immutable ID from the latest local Catalog store and refuses removed/inactive products and variants. Material reselection also requires a valid active supplier program when programs are configured; explicitly chosen retired programs are rejected.
- `QuoteMaterialLineFields` now re-reads `useCompanySettingsStore.getState().settings.stockMaterials` at the time of selection, not the old row object, and updates any Quote pin using that same current Material/variant identity.
- `QuoteSinkLineFields` now re-reads `useSinkCatalogStore.getState().models` before creating its private/captured Sink snapshot.
- `QuoteRateLineFields` now re-reads `useRateBookStore.getState().items`, checks the current permitted charge category, and captures its current division-aware pricing snapshot.
- `QuoteOtherLineFields` now re-reads `useOtherCatalogStore.getState().items` before updating its OTHER snapshot and unit-cost metadata.
- Strengthened `quoteMaterialSourcePatch`: a structured variant whose supplier programs are **all inactive** no longer falls back to a legacy buying reference on an unqualified refresh.
- Existing `quoteMaterialSourcePatch`, `quoteSinkSourcePatch`, `quoteRateSourcePatch` and `quoteOtherSourcePatch` still preserve manually edited `rate` or fixed `amount`, line quantity, billing visibility and `internalCost` totals. Applying the refreshed Catalog selling price remains a separate explicit action. Material slab-multiplier customer totals require an intentional recalculation.
- No quote schema, supplier data, cloud tables, policies, customer projection, existing frozen revision or contract issuance logic changed.

## Regression coverage

`src/services/quoteCatalogReselection346b.test.ts` contains **11 tests**, covering:
1. Current Material buying-cost snapshot with unchanged customer selling price and updated spread/margin.
2. Manually overridden internal total-cost precedence over a refreshed Material supplier cost.
3. Removed Material identities and inactive supplier programs, including no explicit program selection.
4. Sink variant supplier cost changes with negotiated customer rate and quantity left untouched.
5. Rate Book cost/sell reference changes without altering a customer's approved rate.
6. Cost-reference Rate privacy/nonbilling and preserved internal cost accounting.
7. OTHER item unit-cost refresh, customer selling override and manual total-cost override.
8. Removed/retired Sink, Rate and OTHER identities refused at action time.
9. OTHER Catalog source metadata and private unit-cost cloud-codec round-trip independent of the customer's rate.
10. Source assertions requiring all four picker components to re-read current store state before source-patch application.
11. Slab-multiplier source refresh keeping agreed customer total and locked cost until an explicit reprice.

The suite is registered in `test:quick-quote`, bringing the registered build gate to **80 test files**. Existing catalog snapshot, privacy, cloud reload and Record gate suites remain intact.

Source-level checks verify picker wiring, active guards and registration. The latest Batch 346b code **has not yet received a confirmed Cloudflare TypeScript/Vitest/Record/Vite build or authenticated browser acceptance**. Previous user's confirmed-green build was for the earlier Batch 346a/Record gate commit.

## Manual acceptance

1. Insert a Material, Sink, Rate Book service and OTHER item into a Draft Quick Quote. Set manual selling prices and, for some charges, private total-cost overrides.
2. In a separate Catalog tab, revise the underlying supplier cost, product spec and published sell rate. Return to the Quote without reopening the editor. Press **Refresh source · keep quoted price** (or reselect). The latest price/spec reference should be captured while the actual customer price remains unchanged.
3. Retire a selected product/variant or all of a Material variant's supplier purchase programs in another tab. Reselection must fail visibly rather than resurrecting the old source. Existing frozen quote and revision references must remain intact until corrected.
4. Check the private internal pricing summary before and after refresh. Cost-based margins should adjust when supplier cost snapshots are deliberately refreshed; a manually overridden private total cost should remain authoritative.
5. Click the explicit **Use Catalog selling price** action. Only this explicit action should change the customer-facing selling rate/amount.
6. For slab-multiplier Material charges, check that supplier-cost refresh does not change the agreed customer total or locked cost. Use the explicit **Recalculate slab selling total** action to reprice.
7. Save and reload the Quote, then create a revision. Verify all frozen Material, Sink, Rate Book and OTHER snapshot IDs/costs, Qty, price overrides and internal-only flags persist.
8. Check customer print/preview and issued contract do not leak private buying information, and excluded/cost-only charges do not inflate sell totals.
9. Check keyboard/touch, WARM/LIGHT/DARK, and mobile source selectors. Validate the Cloudflare build before considering deployment green.

## Next

Once the next Cloudflare build passes, complete authenticated save/reload and real-device verification for pricing before moving to additional scope. Multifamily project Gantt remains deferred.
