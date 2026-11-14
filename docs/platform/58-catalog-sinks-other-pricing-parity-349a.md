# Batch 349a — Catalog Sinks / OTHER price worktable parity

Date: November 14, 2026  
Branch: `main`  
Release state: source committed; new Cloudflare build and real authenticated desktop/mobile checks pending. User confirmed the preceding #348c Cloudflare build green.

## Goal

Return from Quick Quote mobile hardening to shared Catalog consistency. In particular, make Sinks and OTHER worktables expose comparable default buying and selling prices, retain variant identity, and avoid misleading prices from archived or missing variants.

## Implementation

1. **Sinks reference table now includes Default cost and Customer price.** The two new columns display the active default variant's private buying cost and selling price, or an em dash if unavailable. Sink category, material, mount, total W × L × H, editable model expansion and variant details remain intact. Expanded/empty row column spans reflect the additional cells. The mobile/desktop worktable remains horizontally scrollable; Sink tables have a min-width suitable for the additional financial columns, and currency columns are kept tabular and nowrap.
2. **Customer price sort in Sinks.** The Filters/Sort menu now offers `Customer price · low first`, matching OTHER. Existing Brand/name, Name, Category and Cost sort options remain available.
3. **Shared price interpretation.** Both Sinks and OTHER use `compareCatalogVariantPrice`, which selects an *active* default variant and sorts finite buying/selling prices ascending. Missing, invalid, and all-inactive values sort last; equal and missing values break ties by name. This avoids `Infinity-Infinity` / `NaN` comparator ambiguity and prevents archived first/default SKUs from appearing as live price references. Read-only source comparison never changes Catalog data or frozen Quote snapshots.
4. **Pinned variants show availability status.** Sinks and OTHER comparison cards now display a lifecycle status for the pinned variant *and* its owning model/item. Previously pinned archived variants remain available for historical comparison and unpinning, but the existing `CatalogQuoteLauncher` eligibility gate still hides the Add to Quote control for inactive records.
5. **Regression coverage.** Four new tests in `src/services/catalogVariantPriceSort349a.test.ts` exercise active defaults, legacy/retired variants, missing and non-finite values, independent cost/sell sorting, and source UI parity. Existing Batch 333/336 source contracts were updated for the intentional additional Sinks columns and new shared comparison function. The new suite is registered in Cloudflare's existing `test:quick-quote` gate.

## Boundaries

No Supabase schema/Auth/RLS changes, no mutations to Catalog variant data or price programs, no automatic repricing of draft/issued Quotes, and no change to signed receipts, supplier purchases, or customer document previews.

## Cloudflare and authenticated verification required

- Confirm **new** Cloudflare build is green (TypeScript, Quote tests, Record gate, Vite). A passing build has not been independently observed for #349a.
- In Catalog > Sinks, verify Default cost and Customer price display against the active default SKU, including no variant, archived variant, and no-price cases. Confirm price sort places unpriced records last.
- In Catalog > OTHER, check that Cost and Customer price sort matches Sinks, especially when both prices are empty or a default SKU has been retired.
- Compare pinned Sinks/OTHER variants, archive/restore a model or SKU, and confirm the comparison card clearly marks archival and the Add to Quote control remains unavailable for retired sources.
- Verify Sinks horizontal worktable on desktop/phone and WARM, LIGHT, DARK themes; check expansion, bulk-select, and no-results spanning after the two new columns.
- Add a priced Sink/OTHER SKU to a new and existing Quote to confirm the live source snapshot, private buying cost, and customer selling price still follow the preexisting Quote insertion safeguards.

## Following batch

#349b: review shared Catalog filters, mobile worktable controls, and Materials/Sinks/OTHER compare-board parity, or handle any user-reported #349a regression first. Multifamily Gantt remains deferred.
