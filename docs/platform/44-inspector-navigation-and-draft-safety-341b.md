# Batch 341b — Task and Activity preview navigation and safe editing

## Objective

Unify linked-record navigation across Task and Record previews, preserve Activity drafts across record/workspace changes, and keep Task completion/save feedback consistent with the existing guardrails.

## Changes

### Task → related Record → Task

- The global Task preview stays in state while a related Company, Person, Deal or Quote is inspected. The Task view is temporarily **unmounted** so only one modal owns focus, Escape and touch interactions at a time.
- Closing the nested Record preview returns to the originating Task instead of unexpectedly returning to the Board, calendar or directory. The nested Record shows **Back to Task**; if another related Record has been opened inside that preview, Back first traverses the local related-record trail.
- Opening a separate new Task request clears the old nested preview and its external-quote dialog, preventing cross-task navigation leaks.
- Notebook links intentionally navigate to their actual Notebook page rather than pretending to be a Record preview.
- Related link conversion now lives in the tested `taskLinkedRecordPreview` helper.

### Task completion and save feedback

- The Task quick-view Complete button now reuses `taskCompletionBlocker`: unfinished checklists, unconfirmed bid submissions and canceled Tasks cannot be completed through a different entry point. The optional Complete + Log Activity action is hidden for blocked Tasks.
- `TaskModalHost` throws a specific error if a Task creation returns no ID, the personal Task workspace changed, or the edited Task disappeared or was deleted. The existing Task editor catches the error, displays it and **does not clear its locally recoverable draft**, because draft cleanup happens only after `onSave` returns successfully.

### Activity draft and permission safety

- Activity editor state is bound to the exact identity-scoped `draftStorageKey` where editing began. Switching Activity ID, cloud organization or user account prevents older unsaved fields from being written under the new draft key.
- The same origin-key check prevents a stale Activity edit form from saving to the newly selected record.
- If CRM edit rights or the current role perspective become read-only, the editor switches back to preview without deleting the original unsaved draft.
- Explicit Discard and confirmed Save still clear only the corresponding scoped recovery draft. The existing nested Activity return path through Record previews remains intact.
- The pure `activityEditorCanUseDraft` helper makes these origin and permission checks directly testable.

## Tests and verification

- `src/services/recordPreviewNavigation341b.test.ts` adds 8 cases covering all related Task link types, Notebook routing, one active modal, return-to-Task controls, Activity draft identity, permission changes, Task completion blockers, and failed Task saves retaining drafts.
- Registered with `test:quick-quote` in the normal Cloudflare build; no extra CI or browser jobs were enabled.
- Source consistency checks passed. The full TypeScript/Vitest/Vite/Cloudflare build and visual mobile confirmation are pending.

## Manual QC

1. From Tasks, open a Task associated with a Company. Tap Company. Confirm **Back to Task**, then close/return to the original Task rather than the directory.
2. Follow Task → Company → Person or Deal. Confirm Back returns to Company and the final return to Task works.
3. Open a Task's linked Quote and return; check both Task preview and Quote metadata actions remain separate. Notebook links should open the Notebook page.
4. Tap a Task's Complete action with unfinished subtasks; it should be disabled with a checklist explanation. Repeat for canceled Tasks and protected bid submissions.
5. Attempt a Task creation while its personal Task workspace is unavailable. A failed create should show an error **without erasing the typed Task draft**.
6. Edit an Activity, change to a different Activity or account without saving, and reopen the first Activity. Its draft must not appear under the second record/account.
7. Switch to a read-only role perspective while editing an Activity. The edit form should become unavailable but the original scoped recovery draft should remain.
8. On iOS/Android and desktop, inspect nested dialog focus, Escape, background scroll and return actions; verify no double-modal focus trap.

## Next

Batch 342: mobile panel and keyboard safety, including draggable sheet behaviors, sticky action controls, and narrow-width record editing. Deal timeline/Gantt remains deferred.
