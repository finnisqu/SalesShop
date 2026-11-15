# Batch 351d — Idempotent Activity save and partial follow-up recovery

Date: November 15, 2026  
Branch: `main`  
Status: Source changes and tests committed; Cloudflare build and authenticated cloud/browser QA **unverified** for this HEAD.

## Issue discovered

The shared global Activity editor (`QuickActivityLauncher`) already saved its unsent form in a private, account-scoped draft. For Task-completion Activities, it used a deterministic Activity ID and checked the existing CRM state to avoid duplicate interaction logs. For **ordinary manual Activities**, however, it supplied no Activity ID and allowed the CRM store to generate a new one on every submission.

If an Activity log succeeded and the optional follow-up Task creation failed (or a subsequent completion step threw), retrying the same form inserted **another manual Activity** before trying the downstream step again. The existing follow-up deduplication keyed by Activity ID did not help because the ID changed. This was particularly risky for users who frequently log calls and follow-ups against CRM deals.

## Implementation

1. **One attempt ID for every Activity.** Introduced `src/services/activitySaveRecovery351d.ts`. `activityAttemptId` returns the existing task-completion ID for Task-linked interactions, or a unique `activity_manual_` ID for each new manual Activity attempt. It reuses `pendingActivityId` from the form draft on retry.
2. **Durable before side effects.** Extended the existing `ActivityDraft` with optional `pendingActivityId`. The editor writes it synchronously through `writeSavedDraft(draftKey, {...pendingActivityId})` **before** invoking CRM `recordActivity`. The same key continues to be account/organization-scoped via `draftStorageKey`, and the normal effect preserves it across tab reloads and closing/reopening the draft.
3. **Finish pending work, don't re-log.** `recordActivityOnce(activityId,activities,record)` first checks the current CRM collection for that exact ID. If already present, the next submission skips a second `recordActivity` call and proceeds to the existing `createFollowUp` and `completeTask` steps. The follow-up Task still dedupes on `sourceObjectId:'activity-followup:'+loggedId`; the ID now stays stable on ordinary manual retries as well.
4. **Synchronous double-submit guard.** Added `savingRef` before the CRM write to block Enter+click duplicate submission before React commits its `saving` state. It is reset in `finally` even if a later operation fails. The existing error display, Task ownership scope, role permission and bid-submission rules remain unchanged.
5. **Clear partial-save UX.** If the draft's pending ID is already in the CRM state, the Activity sheet shows **Activity already logged**, disables method/date/notes editing and hides relationship-edit/create controls that would imply those saved details are still mutable. The follow-up settings remain available, and the submit action reads **Finish pending work**. Discarding a recovery draft confirms that the logged Activity stays in CRM and may leave the intended follow-up incomplete. To edit already-saved interaction details, users are directed to the Activity's record editor.
6. **Prevent accidental retry reset.** Opening an unfinished manual Activity through the global composer retains its pending ID. Only a confirmed context replacement, switching to a Task-completion workflow, explicit discard, or successful completion clears it. Dismissing the sheet without discarding keeps the scoped draft.
7. **Clarified independent CRM create semantics.** Activity sheet guidance explains that a Person/Company/Deal explicitly created while logging remains in CRM even if the parent Activity is canceled. The staged new-Company selection improvement from #351c still prevents a draft-only Company choice from materializing before its Person/Deal is submitted.
8. **Regression tests.** Ten cases in `src/services/activitySaveRecovery351d.test.ts` cover new manual IDs, distinct attempts, deterministic Task IDs and scope separation, skipping already-logged interactions, first-time logging, failed follow-up then successful retry without duplicate Activity or Task, retry after pre-record error, draft-first order and clear, reopening/context reset, synchronous guard, and locked read-only recovery controls. Registered exactly once in `test:quick-quote`. Source contract checks passed; complete TypeScript/Vitest/Vite execution not confirmed.

## Boundaries and operational caveats

- No Supabase migrations, RLS/Auth or permissions changes, no Quote pricing, signed-document or external Quote submission changes, and no global CRM schema mutation.
- This is **retry idempotency within the current CRM state and account-scoped draft**, not a distributed database transaction. A genuinely concurrent multi-device activity submission before cloud reconciliation, data deleted from the store before hydration, or server-side save uncertainty may require a stronger server-idempotency mechanism. Do not claim global cross-device exactly-once semantics.
- Task creation from the Task editor still writes a CRM record immediately when explicitly requested, but holds its Task association in the recoverable local Task draft until Task Save. Partial Task save recovery beyond that remains a possible follow-up.
- Nothing is sent on the user's behalf by saving a manual Activity; it is an interaction log.

## Acceptance after green

1. Log an ordinary call against a Company or Person with **Create a follow-up task** selected. Confirm one CRM Activity and one personal Task with the expected relationship.
2. Simulate the follow-up Task store unavailable after the Activity is logged. Verify the form remains open and shows **Activity already logged**; retry after restoring the Task store. Confirm **one** Activity and **one** follow-up, and that any Task-completion state is correct.
3. Close/reopen the partial draft or reload the app before retry. Confirm the original attempt ID restores for the same account. Verify a different account cannot see that draft, and an explicit replacement starts a new attempt only after confirmation.
4. Attempt Enter+click repeatedly while saving. Confirm only one interaction is recorded; if a post-log step fails, retries do not append a second.
5. In partial state, verify method/date/notes and related-record creation are not editable, while follow-up date/checkbox remain usable. Verify warning copy, discard confirmation, and the mobile sheet in WARM/LIGHT/DARK.
6. Test Task-linked Log & Complete workflow separately; it must keep its previous deterministic identity, role validation and completion protections.
7. Run Cloudflare `npm run build` and inspect its specific commit: `tsc --noEmit`, `test:quick-quote`, `test:record-gate`, `vite build`. Authenticated cloud persistence and reload must be tested; an empty GitHub combined status list does not confirm deployment green.

## Next

Batch #351e should address any build regression first. If green, audit failure paths for inline-created CRM records when the Task parent save fails, plus stale/duplicate Task/Activity association recovery. The larger roadmap remains #352 customizable record fields/views, #353 Proposed Records and #354 email/BYOS integration; multifamily Gantt remains deferred.
