# Batch 340b — Cloud-save status, retry, and recovery hardening

## Scope

Extend Batch 340's quote-save recovery work to prevent false "Pending" statuses, reject malformed timestamp comparisons, and give the existing CRM and private Notebook recovery paths the same protection. No database migration, new network protocol, or automatic CI/browser checks.

## Quote cloud-save behavior

- **Skip navigation-only writes.** `quoteHasUnsavedContent` compares the signed-in user's quote **record content**, not `activeQuoteId`. When that content is unchanged from the last acknowledged baseline, `cloudSync.ts` does not schedule an unnecessary write or switch the cloud-save indicator to Pending.
- **Do not skip pending work.** The no-op guard is bypassed when there is an existing identity-scoped pending marker or a retryable failure, so an interrupted new quote still retries even when its local document matches the current cached baseline.
- **Avoid phantom markers.** `markPendingQuoteSync` returns no marker for unchanged owned quotes with no earlier pending generation.
- **Cloud wins ambiguous timestamp conflicts.** A malformed timestamp cannot override a valid cloud draft. For existing draft records with equal timestamps, the cloud version wins. A newly created quote with an explicit `createdQuoteIds` marker may still replay equal-timestamp content after a partial INSERT (e.g. parent saved but child lines absent).
- **Retain all existing guards.** Owner IDs, workspace scope, immutable Sent/Viewed/Signed states, archived records, token matching, in-flight serialization, deferred marker clearing, and the manual Retry control are unchanged.

## CRM recovery

- The CRM comparison of local versus cloud `updatedAt` no longer falls back to string ordering when a timestamp cannot be parsed.
- Malformed timestamps on newly created records are also skipped when replaying pending CRM changes.
- Activity corrections require a valid `metadata.editedAt`; an invalid correction cannot overwrite authoritative activity history.

## Private Notebook recovery

- Existing and newly created entries require valid `updatedAt` values to be replayed. Tombstone precedence already uses timestamp comparison and now also requires valid dates.
- Changing the selected/active Notebook page without modifying content does not create a new pending recovery marker. Previously unacknowledged Notebook changes continue to be retained in the marker until confirmation.
- Private owner scope, newer cloud page precedence, new-folder recovery, and protected trash tombstones remain intact. Notebook's normal private-document writes are not disabled; this change only avoids an unnecessary *recovery marker*.

## Regression tests and deployment

- Expanded `quoteCloudRecovery.test.ts`: no-op navigation, other-owner changes, malformed local/cloud timestamps, equal timestamp precedence, and missing-child-row replay for explicitly new quotes.
- Expanded `cloudSyncResilience.test.ts`: no-op Pending banner versus real failed retries, serialized writes and scoped recovery.
- Updated and enabled `crmCloudRecovery.test.ts`: malformed CRM row and activity-correction timestamps, plus current foreground/online retry listener names.
- Updated and enabled `notebookCloudRecovery.test.ts`: page-navigation no-op markers and invalid entry dates.
- All four suites run in `test:quick-quote`, which is part of `npm run build` on Cloudflare. Static/source consistency checks passed, but full TypeScript, Vitest, and browser verification remain pending.

## Manual QC

1. Open a quote, switch to another quote and return without editing. The header should not display a spurious new Pending save.
2. Edit a draft quote while online and confirm Pending → Saving → Saved; repeat while offline and verify the failure state and manual Retry.
3. Interrupt a newly created quote after the parent row reaches the cloud but its child lines do not. Reload and reconnect: the same quote should recover its missing lines.
4. Confirm older/invalid local timestamps cannot replace a more authoritative existing cloud quote.
5. Edit a CRM company or deal offline, then reconnect; an updated local record should recover when newer. Invalid dates must not overwrite server records.
6. Record an Activity correction and confirm the server's latest valid edit history wins over invalid or stale local metadata.
7. Navigate among Notebook pages without edits: no phantom pending recovery marker. Edit a page offline, reconnect, and confirm only newer marked changes are recovered.
8. Verify a private Notebook user's data and another salesperson's quote/CRM permissions stay isolated.

## Next

Finish Batch 340 with Cloudflare deployment feedback and any real save/retry failures it reveals. Then move into Batch 341: consistent Record inspector inline editing and action menus. The Deal Gantt remains deferred.
