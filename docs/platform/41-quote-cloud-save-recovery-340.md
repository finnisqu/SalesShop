# Batch 340 — Quote cloud-save recovery markers and safe replay

## Goal

Prevent stale local Catalog/Quote cache content from being replayed as customer quotes after an interrupted cloud save, without losing a genuinely new draft when a network write fails partway through.

## Behavior implemented

1. **Only changed Quotes are marked pending.** `markPendingQuoteSync` compares each locally owned quote with the last cloud-acknowledged local baseline. Merely viewing the quote list or switching the active document no longer causes every cached draft to become recoverable.
2. **New draft IDs are tracked separately.** A metadata-only `createdQuoteIds` field is persisted alongside `quoteIds`. The actual quote/line contents remain in the existing scoped local quote document; there is no second copy of customer quote content.
3. **Deleted cloud drafts cannot reappear from a stale cache.** When a server record is absent, recovery adds it back only if it was explicitly created after the acknowledged baseline. Existing pending edits can still overlay an existing editable cloud draft when the local edit is at least as recent.
4. **Partial cloud writes recover.** A new quote may have had its parent row inserted before a network failure prevented some line or section rows from syncing. Its creation ID remains in the pending marker across retry generations so reload recovery can re-apply the complete local quote.
5. **Cloud-issued, signed, viewed, archived, and other users' records remain authoritative.** The existing owner, status, timestamp, and scope guards are unchanged.
6. **The saved baseline advances only on acknowledged writes.** `cloudSync.ts` keeps a `baselineQuotes` snapshot separate from the edit stream; it updates only when the latest generation succeeded and its pending marker has cleared. In-flight per-document serialization, retries, and generation guards remain in place.
7. **Backwards compatibility.** Existing pending marker files without `createdQuoteIds` keep their legacy recovery path until the marker is acknowledged, avoiding loss of interrupted drafts during upgrade. New markers use the safer missing-record guard. No database migration is needed.

## Regression tests

- Extended `src/services/quoteCloudRecovery.test.ts`: actual scoped localStorage marker writes/read/clears; new-vs-existing records; remotely deleted drafts; edits to existing drafts; partial INSERT retries; stale marker token safety; unchanged documents; and preservation of issued or unowned quotes.
- Extended `src/services/cloudSyncResilience.test.ts`: asserts acknowledged baselines, retry serialization, scoped replay, and newer-generation safeguards.
- Both suites are now registered under the Cloudflare build's `test:quick-quote` step. Source consistency checks passed, but the actual cloud TypeScript/Vitest/Vite build is not yet confirmed.

## Acceptance checklist

1. Create a new draft quote while offline. Return online and retry; verify the new quote appears with all sections and lines.
2. Interrupt saving after the quote parent was created but before all line items were uploaded. Reconnect/reload; the same quote ID should be recovered without duplicates or lost lines.
3. Edit an existing Draft or Ready quote while briefly offline, then reconnect. When cloud has an older editable version, the newer local edit should be recovered.
4. Delete an *existing* draft in another authorized session, then recover a different pending quote on the first device. The deleted draft must stay deleted instead of reappearing from cached local data.
5. Test with a sales account that can view colleagues' quotes: never replay another salesperson's quote as owned data.
6. Confirm Sent, Viewed, Signed and archived documents retain their authoritative cloud status and frozen history.
7. Change only the selected active quote while offline: switching the current document should not make all unchanged quotes pending recovery.
8. On a failed cloud save, the Quote header should still show the existing failure feedback and manual Retry control; a successful replay should return to Saved.

## Next

Continue Batch 340 with cloud write-status edge cases and the remaining CRM/Notebook recovery checks. Then proceed with Batch 341 — Record inspector inline-edit consistency. The Deal timeline/Gantt remains deferred.
