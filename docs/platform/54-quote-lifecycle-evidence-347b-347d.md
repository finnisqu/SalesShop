# Batches 347b–347d — frozen Quote receipt and delivery evidence parity

Date: November 14, 2026
Branch: `main`
Release state: source committed; the user confirmed the preceding Batch 347a Cloudflare deployment green. New pushes require a fresh Cloudflare green, TypeScript/Vitest/Record/Vite gate, and authenticated acceptance.

## 347b: signature receipt allowlist for pricing schedules

The original 347a allowlist secured Quote lines and Areas, but `buildAcceptedQuoteSnapshot` still copied `pricingSchedule.customerItems` wholesale. Importers and older serialized objects may carry extra runtime keys that TypeScript's `PricingScheduleItem` interface does not describe. New receipts now call `customerReceiptScheduleItems`, an explicit customer-facing allowlist including public row descriptions, price, display labels, options, color names and details. Array items must be strings. The signed `customerColumns` object is projected with its three known booleans, not copied wholesale.

The full internal pricing workbook, buying costs, and company Quote remain untouched. A signed issued revision uses the **frozen** schedule items, even if the active draft or import changes later. A regression checks the serialized receipt for embedded supplier/cost/source metadata and verifies that an edited live workbook price does not replace the issued price.

## 347c: quote delivery proof correction reconciliation

`confirmedQuoteDeliveries` previously filtered to confirmed evidence *before* deduplicating cloud/cache Activity copies. A newer correction with the same immutable ID that removed `deliveryConfirmed` was ignored, leaving the old confirmed copy active.

`dedupeNativeQuoteActivities` now chooses the newest edited/recorded/occurred copy of each native Quote-related Activity ID before checking delivery proof. When timestamps tie and proofs conflict, the unconfirmed copy takes precedence (fail closed). The same reconciliation is used by the native Quote registry's delivery lookup, protected Deal submission Task checks, Home Quotes Sent badges, and selected-day drilldown. Distinct delivery events with different IDs remain separate. A native delivery must include an explicit nonnegative integer revision; legacy issuance-only events are not evidence. Tests cover corrections in either cache order, equal-timestamp conflicts, revision boundaries, and all four consuming surfaces.

## 347d: historical print and acceptance cannot borrow a later draft

`buildAcceptedQuoteSnapshot` previously combined a frozen issued revision with the live Quote using `??` for optional contact, company, project, change order, document type and pricing-schedule fields. When absent in a legacy snapshot, these could be populated from later, unapproved edits. The function now uses the frozen revision as the exclusive source whenever one exists. Absent optional values remain absent. A legacy snapshot missing `documentType` uses safe default `quote`, not a later document type.

`historicalCustomerQuote`, used for historical customer preview/print, now resets all optional customer identity/project/address/parent fields to the historical snapshot, clears live-only slab pools, and uses the same legacy document-type default. Regressions verify accepted totals and customer terms still match the immutable issue and that later optional fields are absent in historical preview/signature projections.

## Files changed

- `src/services/quoteCustomerReceipt.ts`
- `src/types/signature.ts`
- `src/services/quoteDeliveryLifecycle.ts`
- `src/services/confirmedBidSubmissions.ts`
- `src/services/homeCalendarBadges.ts`
- `src/services/homeCalendarDrilldown.ts`
- `src/services/quoteRevisionView.ts`
- `src/services/quoteCustomerReceipt347.test.ts`
- `src/services/quoteDeliveryLifecycle347c.test.ts`
- `src/services/quoteRevisionView.test.ts`
- `package.json` (test gate)

No migration, Supabase policy, Auth, pricing write, existing historical signature row, or customer sharing permission was changed. Historical receipts already signed before Batch 347a are not rewritten.

## Acceptance remaining (real authenticated, not source-mocked)

1. Confirm the **new** Cloudflare build is green. Check TypeScript, Vitest, Record gate and Vite output; do not infer runtime success from source review.
2. Create a pricing-schedule Quote with a private source workbook, issue it, sign it, and inspect both local and cloud signature payloads for extra private keys.
3. Create a revision with different customer/company/contact, optional change-order/schedule fields and prices. Check the issued historical preview, print/PDF, signature, and cloud reload still use old values and omit absent optional fields.
4. Confirm one delivered native Quote, edit/correct the Activity, reload across two tabs/devices, and compare the Quote register, Home Calendar sent badge, selected day and the Deal's protected submission Task. A correction without proof must not count; separate genuine delivery confirmations retain their audit records.
5. Repeat with an external builder-platform quote, a historical backfill, and a newer issued revision. Verify external submissions remain independent and original Quote issuance is never mistaken for delivery.
6. Check customer preview, WARM/LIGHT/DARK and iPhone print sizing. Manual live login/signature/cross-device QC is not claimed here.

## Next

After deployment green, run authenticated full Quote/cloud persistence and print/PDF acceptance. Only then move toward #348 mobile spreadsheet polish and #349 Catalog/worktable consistency. Keep multifamily Gantt deferred.
