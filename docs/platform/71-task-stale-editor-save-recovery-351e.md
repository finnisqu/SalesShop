# Batch 351e — Task editor stale-record saves and CRM-link draft recovery

Date: November 15, 2026  
Branch: `main`  
Status: Source and regression suite committed. Cloudflare TypeScript/Vitest/Vite, authenticated cloud sync, and mobile browser acceptance **not verified** for this batch.

## Problem

The November 12 feature roadmap prioritizes universal CRM creation and linking from Activities, Tasks, Quotes and record pages. In #351c the Task editor gained inline Person, Company and Deal creation and kept the link in the recoverable Task draft until Save. A new issue was identified in the Task save path:

`usePersonalTaskStore.updateTask(id,changes)` intentionally returns `void` without throwing if the store is not loaded, the Task has been deleted, or its ID does not belong to the current workspace. But `TasksWorkspace.save` previously treated that no-op as success, closed the editor, showed a success notice, and allowed `TaskEditor` to erase its local draft. A stale Task edit with newly-created CRM associations could silently lose the intended Task link.

## Implemented

1. Added `src/services/taskEditorSave351e.ts` with `saveTaskEditorChanges(expectedScope,taskId,changes,port)`. It preflights the **currently loaded** Task scope against the expected account/organization scope before any create/update. For edits, it confirms the original ID is present, belongs to the loaded workspace, and is **not tombstoned/deleted**.
2. Existing-Task edits call the ordinary Task store `updateTask` and then verify that the same ID remains live in the same scope and has a strictly newer `updatedAt` timestamp. The existing Task store already uses the monotonic `nextTaskEditTimestamp` helper; this check detects no-op writes even when multiple clicks occur in the same millisecond. A missing/unchanged Task throws a user-readable error instead of completing the editor.
3. A new Task still uses the existing `createTask` store path, requiring a valid loaded scope and a returned ID; no new Task table, shadow draft record or server-side workflow is introduced.
4. `TasksWorkspace.save` now routes the actual snapshot/create/update functions through that verified helper. It calls `setEditing(null)` and emits the success notice **only after** `saveTaskEditorChanges` returns successfully. The existing Task editor `try/catch` displays the error and keeps the form open; the same scoped `writeSavedDraft` effect continues retaining title, notes, due date, subtasks and `selectedLinks` (including a Person/Company/Deal created in #351c).
5. Added nine behavioral/source regression tests in `src/services/taskEditorSave351e.test.ts` covering valid creation, unloaded scope, switched workspace, deleted Task, missing/foreign ID, successful updated version, silent no-op update, scope shift during update, and source integration for draft/error/relationship preservation. Registered once in the existing `test:quick-quote` build gate. The source contracts were reviewed; full CI/browser execution is pending.

## Scope / limits

- No change to Task completed/bid-completion rules, generated bid task semantics, CRM create APIs, Quote/pricing logic, Supabase migrations, Auth/RLS, or the user's record permissions.
- A save confirmed in the local Zustand store can still encounter **later asynchronous cloud synchronization errors**. This batch does not implement a two-phase cloud transaction or promise an externally durable write. Existing sync status/error indicators still apply.
- CRM records explicitly created from within the Task form are real CRM records and still remain if the Task is discarded. The Task association is held in the Task draft until a verified Task save; this batch prevents an otherwise silent loss of the draft on a stale target.
- An update with a concurrent, conflicting remote edit is not version-conflict-resolved here; preflight addresses missing/deleted/foreign scope and silent no-ops. A future multi-device conflict strategy may be required.

## Acceptance after Cloudflare green

1. Open a Task, create/link a new Person from within the Task editor, save the Task; verify the new CRM Person exists and its Task association appears in Task Quick View after reopening.
2. Open an existing Task in one browser tab; delete that Task in another tab/account and reload/sync the Task store before pressing Save in the original editor. Confirm the save is refused, the editor **stays open**, and the draft remains locally recoverable; no false success toast.
3. Switch the active account/organization while an editor is open. Confirm the Task save rejects stale scope and does not modify the wrong workspace or erase its draft.
4. Normal new Task creation remains successful when the private Task scope is loaded. Saving while it is unavailable yields a useful error rather than creating a cross-account Task.
5. Verify existing Task due-date, status, protected-bid submission, and other task editing flows are unaffected.
6. Run Cloudflare build for the new commit: `tsc --noEmit && npm run test:quick-quote && npm run test:record-gate && vite build`; perform authenticated WARM/LIGHT/DARK desktop and mobile QA. GitHub combined commit status may be empty even if Cloudflare deploys separately.

## Next

Batch #351f: address any actual build regressions first; then audit stale/removed CRM associations in the Task and Activity relationship pickers, with safe unlink/reselect behavior and clear feedback. After Create & Link parity is stable, resume the November 12 product roadmap with #352 configurable record fields/views, #353 Proposed Records, #354 BYOS/email. Multifamily Gantt remains deferred.
