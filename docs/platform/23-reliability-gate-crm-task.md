# Reliability Gate A — CRM and Private Tasks (2026-11-03)

## Scope
- CRM load now retrieves pages of 500 with a stable sort order and ID tie-breaker. A 1000-row Data API cap must not silently hide older Activities, People, Deals or Companies.
- Normalized CRM synchronization now checks cloud Activity metadata before upsert. Historical rows without an explicit later edit are immutable during routine sync; a stale browser's Activity record cannot overwrite a newer `metadata.editedAt` correction. New records still upload; a newer explicit edit may upload.
- Personal Task cloud merge now prefers deletion tombstones when timestamps match and sorts equal-time records deterministically. Cloud sync status and storage behavior remain unchanged.

## Required acceptance checks
1. In two browser sessions, edit a manually logged Activity; revisit an older tab and make an unrelated CRM change. Confirm the corrected note remains after refresh on both.
2. Create more than 1,000 Activity records in a disposable workspace and confirm all load, including older pages. Test that account-scoped privacy still holds.
3. Delete a personal Task on one device while another edits it; confirm the later timestamp wins, or for equal timestamps the deletion wins.
4. Verify Cloudflare's `tsc --noEmit && npm run test:quick-quote && vite build` output and the new Vitest tests. CI remains disabled.

## Known limitations
- CRM upsert guard is read-before-write, not a PostgreSQL atomic compare-and-swap; an extremely narrow cross-device concurrency race remains.
- Hard-deleted CRM records may still need synchronized tombstones to prevent stale devices from recreating them. No destructive migrations were attempted in this batch.
- This is a GitHub source pass; live browser, cloud sync, and full build have not yet been verified.
