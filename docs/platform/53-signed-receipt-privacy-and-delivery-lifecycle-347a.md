# Batch 347a — Issued revision, signed acceptance receipt and delivery audit safety

## Purpose

Follow the priced Quote lifecycle after Batch 346b, especially **immutable issued revisions**, **signed acceptance data**, **customer-safe document projection**, and **duplicate-free delivery history**.

## Finding 1: signed receipts serialized private Quote data

`buildAcceptedQuoteSnapshot` previously copied complete `QuoteLine` objects with `structuredClone(lines.filter(line=>line.customerVisible))`, and complete `QuoteSection` objects with `structuredClone(sections.filter(section=>section.customerVisible))`.

Even when a line was shown to the customer, its internal fields were not customer-safe: `internalCost`, `unitCost`, `supplierName`, `materialReference`, `sinkReference`, `otherReference`, `rateReference`, `quantitySource`, and `takeoffSinkId` could carry sensitive supplier pricing, private production costs, purchase programs and manufacturing data into `SignatureRecord.acceptedSnapshot` in the signatures store and cloud table. A customer-visible Area also carried its full internal `scope`.

The signed snapshot also filtered hidden billed lines from its rows but retained their amounts in `acceptedTotal`, making line totals differ from the signed amount.

### Fix

- Added `src/services/quoteCustomerReceipt.ts` with a **strict allowlist** of customer-appropriate QuoteLine fields (identity, Area reference, kind, description, selling mode, quantity, rate, amount, Show and Include) and Area fields (identity, title, customer visibility and display mode). It never copies private source objects or raw takeoff scope.
- It removes excluded priced lines and hidden Area scope, while retaining visible information-only notes. Hidden billed amounts are consolidated into a visible material/item priced host where possible, using a direct total to preserve pricing math. If there is no visible billable host, it creates an anonymous **Included work** amount. Thus the acceptance rows sum to the same approved total even when hidden included charges or discounts exist.
- `buildAcceptedQuoteSnapshot` now calls these projections on the **issued frozen revision**. It never writes private fields to newly created acceptance receipts. Internal company quotes and their frozen revisions remain unchanged and keep their supplier references for authorized cost/margin reporting.
- This changes **newly generated** receipts; existing immutable historical signature rows are not edited retroactively.
- A serialized issued revision still rehydrates into the right customer receipt without inheriting later edited pricing, supplier data, scope or terms.

## Finding 2: repeated delivery Activity cache copies

`confirmedQuoteDeliveries` previously returned duplicate Activity objects when CRM cloud/local hydration supplied repeated copies with the same ID. It now deduplicates by **immutable Activity ID**, keeps the latest copy of a repeated ID, sorts by timestamp and still preserves separate confirmed events with distinct IDs. It does not infer delivery from Quote issuance or different revisions.

## Verification and tests

- New `src/services/quoteCustomerReceipt347.test.ts` contains **9 tests** for private-cost and Area scope redaction, hidden included amounts, no-visible-host fallback, excluded charges and information-only notes, fully hidden Areas, negative hidden discounts, revision-specific delivery deduplication, serialized historical frozen-revision restore and protection against later unapproved Draft changes.
- Registered under the existing Cloudflare `test:quick-quote` build gate, alongside prior 80 test files.
- The existing Source, normalized Quote cloud codec, frozen revision and delivery lifecycle tests remain in place. The latest source-level checks were passed, but **this Batch 347a's Cloudflare TypeScript/Vitest/Record/Vite build and real authenticated mobile/browser QA have not yet been verified**.
- No production data, RLS, migrations, external quotes, catalog supplier prices, or historical signed legal receipts were modified.

## Manual authenticated acceptance

1. Create an internal Quote with a visible countertop selling charge, a hidden included Sink/service charge, a manual buying-cost override, source-price snapshots and an excluded alternate. Verify the customer-facing total and receipt sum are identical and that the excluded alternate does not count.
2. Issue the Quote and generate a signed acceptance in a test company. Inspect the **new** accepted snapshot locally and in normalized signature storage. No internal cost, supplier price, source reference, takeoff geometry, or Area scope fields should be present.
3. Check the signed receipt still shows the correct Quote number, revision, scope, customer contact, terms and total. Old receipts remain intact.
4. Create a new draft revision with different selling prices and terms. The accepted first revision must remain unchanged, including after refresh and JSON/cloud rehydrate.
5. Manually confirm delivery for one issued revision. Reload with duplicated Activity cache rows and ensure that confirmation is counted only once. A newly delivered revision is a distinct event, and an issuance-only Activity is not customer delivery evidence.
6. Confirm the appropriate linked Deal's protected Bid submission Task completes **only on customer delivery**, not issuance; external quote submission remains independent.
7. Check desktop/mobile, customer preview, print output, WARM/LIGHT/DARK, and authenticated cross-device persistence. Verify the Cloudflare build is green before treating this batch as deployed.

## Follow-on

Continue Batch 347 with authenticated quote save/reload, customer print/PDF parity and remaining CRM delivery edge cases. Multifamily project Gantt stays deferred.
