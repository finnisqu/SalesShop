# Batch 343 — Lead → Deal → Quote submission → Task and Activity history QC

## Goal

Test native SalesShop quote delivery and external builder-platform submission as first-class, equally discoverable quote records, without conflating internal issuance with customer delivery or allowing unassigned Deals to land in the wrong salesperson's bid queue.

## Code change: submission audience parity

`visibleSubmissionDeals` previously inferred ownership of unassigned legacy Deals from a SalesShop Quote created by the user or from the user creating the Deal. It **did not** infer that a rep involved in a Deal had sent a confirmed external quote using the builder's platform.

The function now also recognizes an external `quote-sent` CRM Activity whose `externalQuoteSent` marker is true, which has a real Deal ID, no native `quoteId`, and whose `recordedByUserId` equals the signed-in rep. An ordinary SalesShop quote issuance Activity without proof is not enough.

The existing precedence remains:
- Explicit `assignedUserId` takes priority over creator, native quote and external Activity inference.
- Users with no quote-issuance permissions, viewers and unauthenticated members receive no submission tasks.
- Local workspace still sees its own full list. Personal Tasks remain account-scoped.
- Only pre-submission stages with a valid bid deadline create an automatic Submit Quote task; a previously sent/closed Deal should not generate a new Task.

## Test coverage

**New and expanded**
- `src/services/leadQuoteWorkflow343.test.ts` (6 cases): native vs external quote audience, assignment precedence, issuance vs confirmed delivery, unified Quotes registry, Calendar badge on actual sent date, historical Recents timing, assigned-Deal external quote visibility.
- `src/services/dealSubmissionAudience.test.ts` (now 10 cases): new external Activity audience and safeguards against native-issued/nonexternal Activity inference and assignment violations.
- `src/services/externalQuoteCalendarPersistence.test.ts` (10 cases): re-enabled after updating its source contract to the current duplicate-click and already-recorded guard `if(savingRef.current||recorded)return`.

All three test files are now registered under Cloudflare's existing `test:quick-quote` command. Existing `salesSubmissionWorkflow329.test.ts`, `salesQuoteRegistry.test.ts`, `bidSubmissionTaskGuard.test.ts`, and native quote delivery tests continue as complementary coverage.

## Manual end-to-end acceptance checklist

1. Create a new Person, Company and Deal. Assign a salesperson, set a bid deadline and confirm **Submit quote** appears in that salesperson's personal Tasks/Home agenda, not in a coworker's.
2. Create a SalesShop Quote and issue it. Confirm the document is in Quotes, but issuance **alone** does not complete the Submit quote Task or count as a customer-delivered Quote on Home's calendar.
3. Confirm delivery of the issued revision to the customer. Verify a revision-specific `quote-sent` Activity, the native Quote's delivered/sent date, Deal stage progression where appropriate, Calendar's Quotes Sent badge, and completion of the correct linked submission Task.
4. Create a separate Deal and record an external bid from a builder portal. Enter an actual date sent, amount and optional platform. Confirm a single external Quote row exists in Quotes, with **read-only Activity details** rather than a counterfeit editable SalesShop document.
5. Confirm the external Quote also appears under its Deal, in Home Recents and under the actual submitted calendar date. Both native and external records must be counted once even if sync/retry caches duplicate an Activity.
6. Verify the external submission does not complete the bid Task or update the Deal until the server Activity **and** required Deal changes are acknowledged. Retry an interrupted submission: its immutable Activity ID must prevent duplicate records.
7. Log a historical external quote against a closed Deal. The sent date should appear in historical Calendar/Quotes, while Recents reflect when it was logged. Historical backfill must **not** complete or mutate unrelated current bid Tasks.
8. In an unassigned legacy Deal, confirm a rep who owns the native quote **or has a verified external submission** sees the associated work; non-owners do not. Assign that Deal explicitly to another rep and confirm the assignment overrides both inference paths.
9. Edit/correct an external quote. Confirm the existing external Activity/Quotes record updates in place (amount/date) rather than generating a second submission. Recheck cross-device account permissions.

## Verification and next step

Changes and regression suites committed to `main`. Source consistency checked. The live Cloudflare build, full TypeScript/Vitest/Vite run, and browser-based end-to-end execution have **not** been confirmed here. Do not claim green until deployment feedback arrives.

Next: respond to any build feedback and continue Batch 343 with the cross-view navigation and save-state QC; then begin the remaining roadmap items after the workflow gate is verified. The Deal timeline/Gantt remains deferred.
