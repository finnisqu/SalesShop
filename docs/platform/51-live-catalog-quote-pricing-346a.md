# Batch 346a — Live Catalog source and Quote pricing snapshot accuracy

## Goal

Complete the Catalog-to-Quote source parity check for **Materials, Rates, Sinks and OTHER**. The customer selling price, supplier buying reference and frozen catalog provenance must come from the source current at insertion time, not an old record retained by an open destination dialog. Preserve previous Quote snapshots, existing issued revisions and the separation between private costs and customer-visible prices.

## Issue found

The Catalog destination dialog already re-resolved live Sinks and OTHER records when inserting. But Materials and Rate Book records continued using the initial worktable row snapshot. If a supplier price list, material variant/program, Rate Book sell rate or private installation cost changed while a Quote chooser stayed open, a newly inserted Quote could capture the **outdated price or supplier reference**. Material insertion additionally forwarded a default variant and purchase program selected from React render-time state, even when those defaults changed just before the final click.

The dialog also set its duplicate-insert lock before checking a now-unavailable destination outside the `try/finally` block. That error path could leave the lock engaged until the dialog was closed.

## Implemented

1. `resolveCatalogQuoteLiveSource` accepts optional `materials` and `rateItems` alongside `sinkModels` and `otherItems`. For hydrated stores, matching records are fetched **by immutable Catalog ID**, and removed material/rate IDs return `null` rather than inserting an old snapshot.
2. `CatalogQuoteInsert` watches the same live `useCompanySettingsStore` and `useRateBookStore` backing the Materials and Rates worktables. Dialog pricing and available sources update if the Catalog changes.
3. On final submit, the dialog reads `getState()` from all four stores immediately before validation and snapshot creation. Material default variant and supplier purchase options are resolved by the builder from this **latest source**. Explicit selections keep their IDs and are rejected if no longer active, instead of silently falling back.
4. The invalid destination guard now runs inside the existing `try/finally`, ensuring the duplicate-insert lock is reset on a failed attempt.
5. No customer selling price is derived from a Material's supplier cost. The Material patch remains a private cost reference with `rate` and `amount` unset. Rate Book `cost-reference` entries remain excluded from customer totals and hidden from customer output.
6. No existing Quote lines are re-priced: this work only changes new Catalog-to-Quote insertion. Frozen Sink/OTHER metadata and normal price editing were left unchanged.

## Coverage

- New `src/services/catalogQuoteLivePricing346.test.ts` contains **8 tests** for updated material buying costs, active default variant/program changes, retired explicit variants/programs, removed materials, updated Rate Book selling/private costs, cost-only Rate Book behavior, removed/inactive Rates and the dialog's last-moment source-read contracts.
- The suite is registered in `test:quick-quote` alongside the existing `catalogQuoteLiveSource337.test.ts`, `catalogQuoteInsertion.test.ts`, snapshot privacy and normalized cloud reload tests.
- Source-level consistency checks passed. The **actual Cloudflare TypeScript/Vitest/Record/Vite build, manual browser interaction, and authenticated Catalog write/reload have not been verified for this new batch**.
- No new schema, RLS, Auth, migrations, supplier-price publications or production data changes.

## Manual acceptance

1. Open a Material's **Add to quote** dialog; in another tab change its active supplier cost (or import a revised price list). Insert a Quote line, and verify its private buying snapshot is **the newer cost**, not the value at dialog open. The customer selling rate should remain blank for manual pricing.
2. While the dialog stays open, retire its material variant or supplier program. An explicit retired selection must fail rather than silently select the next active option. An unspecified selection should use the current default.
3. Open a Rate Book item, change its selling rate and internal cost in another tab, then insert. Verify the new Quote has the current customer rate and current private cost reference.
4. Repeat with a `cost-reference` Rate. It must remain private, nonbillable and absent from the customer total regardless of the recorded internal cost.
5. Delete or deactivate a Material or Rate while its chooser is open. Insertion should be blocked. If the destination Quote becomes issued or otherwise noneditable, the dialog should report it and permit choosing a different destination without a stuck button.
6. Insert a Sink and OTHER variant with known dimensions, colors, sell rate and internal cost. Update their Catalog prices afterward; existing Quote and revision snapshots should remain frozen until an explicit source refresh/reprice.
7. Confirm that a fresh Quote from Catalog gets exactly one source line and that customer preview/projection contains selling fields but does not leak internal buying data.
8. Check tablet/phone, modal close interactions and WARM/LIGHT/DARK; then validate the completed Cloudflare build and authenticated save/reload before declaring the release ready.

## Next

After a confirmed green Cloudflare build, continue Batch 346b with existing Quote source-reselection and manual override/round-trip margin tests. Multifamily Gantt remains deferred.
