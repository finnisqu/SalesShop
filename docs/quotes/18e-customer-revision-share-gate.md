# Batch 18E — customer revision, issue and link safety

This batch hardens the shared Classic/Beta quote issuance boundary; it does **not** implement automatic email sending, require a new Supabase project, or deploy Edge functions.

## Why

Before this batch the Classic/legacy share action could call `recordSent` while creating a customer URL for an otherwise-complete draft. That silently bypassed Beta's **Preview → Approve → Issue → Share** flow. "Send Quote" in Classic also only issued the internal document; it did not email anyone.

## Safeguards added

1. **No implicit issue from link creation.** `customerShareCreationBlocker` accepts only non-archived `Sent`, `Viewed` and `Signed` revisions. `quoteShareService` no longer calls `recordSent` as a side effect of link creation. Both Classic and Beta can still explicitly issue, then create a link.
2. **Server authority.** The staged `quote-share-admin` Edge function also checks authoritative current quote `status` before using service-role permissions to create/regenerate bearer links, alongside its existing membership, quote ACL, department, current revision and frozen snapshot checks.
3. **Revision race.** Recheck local status/revision around asynchronous CRM sync and after the server returns a link. Reject mismatches rather than returning an old-revision bearer URL.
4. **No stale link on screen.** Clear the link on quote/revision changes; render a URL and actions only if the link's quote ID **and** revision match the currently open document.
5. **Approval collision protection.** The ephemeral approval key now also binds customer document fields, Areas, priced lines, visibility and terms; a content edit made within the same millisecond invalidates approval, even if `updatedAt` did not tick. Do not persist or store approvals in CRM.
6. **Copy clarity.** Classic now says **Issue Quote / Issuing…**, with tooltip that it freezes a revision but sends neither link nor email. Review continues to say issue, approval, share and delivery are separate milestones.

## Validation

- `quoteShareReadiness.test.ts`: draft/ready/declined/expired/archived vs issued statuses
- `quoteDeliveryApproval.test.ts`: customer/price/terms changes with identical timestamps invalidate approval
- `quoteCustomerShareRelease.test.ts`: production code + staged Edge status gates cannot issue drafts implicitly
- Existing unit and Playwright: Beta Review/Preview/Approve/Issue; customer document and frozen revision regression; public link must remain secure; delivery confirmation is always manual
- Pricing Schedule Workbook QC includes release-boundary checks

## Gate — staging remains deliberately deferred

Edge function changes are **repository-only** until a future approved, isolated, genuine-Auth staging validation and manual deployment. The production `quote-share-admin` function cannot be presumed to enforce the new status gate until separately deployed. Client protections are defense-in-depth, not a substitute for live server cutover.

No production `main`, Supabase schema, Edge function deployment, or customer data was touched. The development React branch has GitHub Pages deployment guarded by manual workflow dispatch; integrations must not trigger production publication.

Classic Quotes stays available. Issued PDFs, customer-visible snapshots, revision history and signed receipts must pass realistic device + real Auth acceptance before Classic retirement.
