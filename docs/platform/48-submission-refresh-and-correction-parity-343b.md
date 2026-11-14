# Batch 343b — Submission refresh, cross-page navigation and correction parity

## Scope

Continue Batch 343 after establishing native/external quote submission parity. Fix cases where **server-acknowledged** external submissions or corrections display inconsistently after an account refresh or cloud-cache merge. No schema changes or automatic CI/browser jobs.

## Fix 1: External submissions bring their unassigned Deal into Home

`personalCalendarSources` previously related a Deal to a salesperson only via a SalesShop Quote, the rep's Task, or `assignedUserId`. This could display the rep's own external quote Activity in Home while omitting the unassigned Deal it belongs to.

It now also recognizes a genuine external `quote-sent` Activity (`externalQuoteSent=true`, valid project association, no native quote ID) recorded by the signed-in user. The associated **unassigned** Deal is included in the personal calendar source list. Explicit Deal assignment to a different rep still takes precedence for that Deal list; the original author can retain their factual historical Activity without inheriting the other rep's current bid queue.

## Fix 2: Corrections to external quotes survive duplicate caches

`dedupeExternalQuoteActivities` formerly took the *first* Activity with a repeated external submission ID. During recovery or rehydration, an older cache copy could therefore hide a newer, remotely confirmed correction to amount or sent date in Quotes and Calendar.

Deduplication still preserves the immutable Activity ID and original ordering, but now selects the **most recently updated** copy by valid `editedAt`, falling back to `recordedAt` and `occurredAt`. Native SalesShop quote lifecycle Activity rows are left untouched.

Because the Quotes register, Home Recents, Calendar badges and badge drilldown all use this shared helper, a corrected external quote is represented by **one** row with the latest amount and actual sent date.

## Fix 3: Home Recents reflect an external quote's correction

The main Quotes register already uses `metadata.editedAt` for an external quote's `updatedAt`. Home's recent Quote list and Activity history previously used `recordedAt` even after a confirmed correction. Both now prefer a valid `editedAt` timestamp for an external quote. Historical send dates stay tied to `bidSentDate` and continue to determine Calendar badges.

## Reload and navigation contract

- A SalesShop delivery remains a native `Quote` and opens its Quote preview; a builder-portal submission remains a read-only external `Activity` and opens Activity details from the Home Quotes list and Calendar badge drilldown.
- Private Task cloud merge preserves submission confirmation evidence; the existing App reconciliation replays confirmed CRM evidence after Task sync reaches `saved`. It does not treat native quote issuance as delivery.
- An external correction updates an existing Activity by ID; it never creates a counterfeit SalesShop document or another sent badge.
- Explicit Deal assignment and owner/role restrictions continue to apply to generated personal bid Tasks.

## Regression coverage

`src/services/submissionRefresh343b.test.ts`: **7** new test cases cover external-only unassigned Deals in Home/Quotes/Calendar, assignment precedence, non-submission events, a stale Task copy recovering durable CRM submission proof, latest corrected cache-copy precedence, native-vs-external badge navigation, and duplicate-free reporting after reload.

Registered in the existing `test:quick-quote` build alongside Batch 343, quote delivery, personal Task cloud merge, external correction, and calendar tests. Source consistency checks passed; TypeScript, Vitest, Vite and mobile/browser verification are **not confirmed** until a successful build.

## Manual QC

1. Submit an external bid against an **unassigned** Deal with no SalesShop quote or Task. Refresh Home. The Deal, sent-day Calendar badge, Activity record and external Quotes row should all be discoverable.
2. Assign that Deal to a different rep. The old author should retain historical evidence but no longer inherit that Deal's current submission responsibility.
3. Correct an external submission's amount and date. Reload or reconnect another device with a stale cached copy; Quotes should show one corrected row, Calendar should show **one** badge on the corrected sent day, and Home Recents should reflect the correction time.
4. Open the corrected external quote from Home Recents and from Calendar. Both should open its Activity; the native quote on the same day should open the Quote preview.
5. Restore Tasks from another device with a newer unconfirmed edit and older CRM delivery proof. Once private sync and CRM hydration complete, its protected Submit Quote Task should be completed (if its checklist permits) while retaining the newer notes/due-date edit.
6. Confirm ordinary quote issuance without customer-delivery proof never completes the protected Task or creates a Quotes Sent Calendar badge.
7. Verify historical closed-Deal external backfills show the actual original sent date and don't complete unrelated open bids.
8. Check WARM/LIGHT/DARK and mobile after confirming the Cloudflare build.

## Next

Address any deployment/test failures before moving to the remaining workflow QA. Defer the multifamily Gantt/project timeline as previously requested.
