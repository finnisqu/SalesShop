# Batch 351f — Unavailable CRM links in Task and Activity editors

Date: November 15, 2026  
Branch: `main`  
Status: Source updates and thirteen regression cases committed and registered in the Cloudflare build gate. Cloudflare build, authenticated browser and mobile QA remain unverified.

## Goal

Continue the user's November 12 Universal Create & Link roadmap after #351e. When People, Companies, Deals, Quotes or Notebook records are removed, archived, moved outside the user's access, or still loading, saved Task/Activity association chips must not silently appear valid or be dropped without user consent.

The existing `TaskAssociationsField` was shared by Task editing, new Activity logging, and manual Activity corrections. Previously, the selected relationships displayed identically regardless of whether they were present in the currently selectable records. Saving could preserve an ID that was no longer resolvable in the user's workspace, and the editor offered no clear replacement workflow.

## Implementation

1. **One typed integrity service:** Added `src/services/taskAssociationIntegrity351f.ts` with `unavailableTaskAssociations`, `unavailableAssociationSaveError` and `replaceTaskAssociation`. It compares each saved association by **type + exact ID**, never by matching a name. Deduplicates missing warnings and preserves all unchanged links in their existing order. No new database tables or link mirrors.
2. **Hydration-aware verification:** The shared field accepts optional `verifiedTypes` for Person, Company, Deal, Quote and Notebook. Missing records are only identified once that type's collection reports initial hydration. TaskEditor passes `useCrmStore.hydrated`, `useQuoteStore.hydrated` and `useNotebookStore.hydrated`; Activity log and correction forms pass CRM/Quote hydration. A temporarily empty/unhydrated list is not treated as evidence of deletion. *Caveat:* Initial hydration does not prove that all cloud sync reconciliation has completed.
3. **Visible, non-destructive recovery:** Affected chips retain their original name/ID and show **Unavailable**. The shared field displays an explanation: the record may have been removed, archived or become inaccessible. Users can **Unlink unavailable records**, remove a single link, or **Replace** a specific link. Replace opens the existing searchable picker narrowed to the same record type and only swaps the old ID once the user selects a real available record; cancel/Escape/outside click leave the draft unchanged. No matching-name or implicit merge logic. Keyboard focus returns after dismissal without trying to focus a temporarily disabled selector.
4. **Task save protection:** `TasksWorkspace` checks `selectedLinks` against current, hydrated selectable options before invoking `onSave`. If any verified links are unavailable, the Task editor shows a clear error and keeps its locally recoverable draft, including #351c's inline-created CRM links and #351e's stale Task safeguards. Saving a Task with no relationships remains supported.
5. **New Activity save protection:** `QuickActivityLauncher` checks selected relationships before recording a new interaction; an inaccessible reference must be unlinked or replaced. When an Activity has **already been logged** and is recovering a failed follow-up or Task completion, the check is skipped to preserve #351d's ID-stable retry path and immutable saved history.
6. **Existing Activity correction protection:** `CalendarActivityPreview` applies the same integrity check to editable manually recorded interactions before saving relationship edits. External Quote corrections retain their existing specialized corrections path; no bid-submission proof or Quote snapshot is mutated.
7. **Mobile/theme-safe controls:** Scoped styles use established SalesShop theme tokens and work with WARM/LIGHT/DARK themes. The `Replace` button has an explicit override for the Task chip's generic `!important` button reset and 44px mobile touch height; the user-visible warning wraps on small screens without a second modal.
8. **Regression suite:** `src/services/taskAssociationIntegrity351f.test.ts` has thirteen tests for hydration uncertainty, deleted/unselectable links, exact identity, Quote/Notebook independence, deduplication, order-preserving replacement, canceled replacement, actionable error wording, visible recovery, Task guard/draft preservation, and new vs already-logged Activity editing. Registered once in `test:quick-quote`. Source-contract checks performed; Vitest/TypeScript/Vite build success is not yet confirmed.

## Scope and limitations

- **Unavailable means not selectable from this view**, not necessarily permanently deleted. An archived or permission-hidden Quote may be flagged even when the original data still exists elsewhere. Users should confirm the correct replacement before unlinking.
- This is client-side verification of hydrated, selectable options. It does **not** resolve multi-device cloud races, prove remote authorization or guarantee server-side foreign-key integrity. RLS/Auth/SQL are unchanged.
- Draft links are never automatically removed by hydration, validation, or unsuccessful save. Explicit user action is required for unlink/replacement. The Activity's historic associations are not retroactively deleted, and a logged Activity's follow-up can still finish without editing its immutable interaction record.
- No changes to signed Contracts, Quote prices/snapshots, external Quote submission tracking, bid Task completion policy, or the deferred multifamily Gantt feature.

## Acceptance after Cloudflare green

1. Start a new Task and link a Person and Deal. Delete or make the Person unavailable before saving, then verify **Unavailable**, **Replace** and **Unlink** options, no false success, and recoverable Task draft.
2. Replace the unavailable Person by searching for another existing Person. Confirm the new ID occupies the former position and the Deal association is unchanged. Cancel a different replacement to confirm no mutation. Verify keyboard Enter, Escape, outside click, focus and mobile touch behavior.
3. In a new Activity draft, select two CRM records; remove access to one and attempt Save. Confirm a clear error and no Activity insertion. Unlink/replace, then save once. Test a different account and hydrated/unhydrated state.
4. Open a previously logged manual Activity and correct its participants. Confirm unavailable links are identified without silently rewriting its stored history until Save is explicitly performed.
5. Recover an Activity already logged but with a failed follow-up. Make one historical related record unavailable and verify **Finish pending work** still retries the existing log ID and does not create a duplicate Activity.
6. Check archived/permission-hidden Quotes: the warning should say **unavailable here**, not assert permanent deletion. Check Notebook references in Tasks; Notebook hydration should be respected.
7. Confirm mobile portrait and keyboard-open layouts, WARM/LIGHT/DARK themes, no clipped controls, ≥44px Replace control and no nested popover unintended dismissal.
8. Run actual Cloudflare `npm run build` (`tsc --noEmit`, `test:quick-quote`, `test:record-gate`, `vite build`) and verify the deployed SHA and authenticated CRM/Task/Activity persistence. A blank GitHub commit status does not confirm Cloudflare success.

## Next

After this #351f, prioritize Cloudflare regression fixes and authenticated relationship QA. If stable, return to the larger November 12 requests: #352 user-configurable record fields/views, #353 Proposed Records (approve, deny, merge) and #354 BYOS/email integration planning. Do not initiate multifamily Gantt work without new authorization.
