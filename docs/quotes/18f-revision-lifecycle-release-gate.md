# Batch 18F — frozen customer revisions, historical documents and signing

**Scope:** harden Quotes Beta/Classic shared lifecycle in development, after 18E; do not change live Supabase or production `main`.

## Behavior and fixes

1. **Historical snapshot captures its own material picks.** Issuing a quote now deep-copies its quote-scoped `projectMaterials` into the existing `QuoteRevisionSnapshot.projectMaterials` field. Later changes to catalog shortlist, Area names, quantities, pricing, terms or appearance do not rewrite issued data.
2. **Historical document view never inherits later optional fields.** The `historicalCustomerQuote` helper rehydrates an immutable customer view using the frozen snapshot. Older snapshots without material/selection fields default to empty/disabled, rather than borrowing choices from the active quote. No live internal notes, newer signed timestamps or active history are included in the viewing copy.
3. **Revision UI tracks a stable revision ID, not sorted row position.** A new issued revision cannot silently change the selected historic document, and opening a different quote closes the old quote's modal. History rows describe their own document type, not the current draft type.
4. **In-person signature is separate from issuing.** A `Draft` or `Ready` quote can no longer be implicitly numbered/issued by the signing service. The salesperson must first issue the customer revision explicitly; signature acceptance requires a frozen matching revision. Archival, declined/expired and missing frozen snapshots fail closed. Existing signed receipts are returned for that same revision without creating a second signature.
5. **Classic affordance matches the safety rule.** The sign action is offered only for an issued nonarchived Sent/Viewed quote; the signature screen no longer promises a one-click draft issue. This keeps customer acceptance distinct from quote preparation, share-link creation and manually confirmed delivery.
6. **Archived quote does not spawn a revision.** Review no longer shows an editable-revision action on archived records. Archiving, restoring and the safe delete-as-archive path preserve the revision history and accepted price.

## Acceptance regression evidence

- `quoteRevisionView.test.ts`: deep frozen materials, customer wording, hidden sink price, original total, two revisions, legacy optional fields, and signed receipt content
- `quoteRevisionArchive.test.ts`: archive/restore and safe delete leave frozen records intact
- `quoteSignatureLifecycle.test.ts`: no Draft/Ready issue as a side effect of signing, refused archived/missing frozen revision
- `quotes-beta-historical-revision.pw.ts`: a disposable browser quote is issued, edited as a newer draft, and the historical modal remains on the original scope/title/price
- Existing quote integrity / customer preview / pricing / signature / visual QC continues

## Release limits

- The browser tests run against a local/demo workspace and do **not** establish genuine JWT/RLS cloud safety, live Edge function rollout, delivery, signature-identity verification or compatibility with every historical customer record.
- The staged 18E `quote-share-admin` Edge function and privacy migrations remain **undeployed** pending approval and isolated Auth staging. No silent cloud changes.
- No Classic retirement, no production `main`, no GitHub Pages publishing. The architecture workflow deploy remains manual-only.
- The signed historical receipt, public link rendering and real signed-in lifecycle should be manually checked against a disposable Auth staging organization before any company-wide launch.
