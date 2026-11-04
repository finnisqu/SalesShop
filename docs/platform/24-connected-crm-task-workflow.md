# CRM Workflow B — Complete Task → Log Activity → Follow Up (2026-11-03)

## Workflow
- **Task Quick View** from Home/Calendar or Tasks now offers **Complete + log activity** for active Tasks when CRM editing is permitted. Existing **Mark complete** is still available for work that does not warrant a CRM log.
- The Action opens the existing Log Activity form without changing tabs. The task's CRM relationships and appropriate interaction method are prefilled; **private task notes are not copied into shared CRM automatically**.
- Saving the Activity optionally creates a dated follow-up Task with the same CRM relationships, then marks the source Task completed. Closing or discarding the popup does not complete the Task.
- For a reload after partial progress, a Task-completion Activity uses a stable opaque key derived from the private scope and Task ID and existing records are reused rather than duplicated. The original Task is marked completed only after a local Activity is saved and optional follow-up creation succeeds.
- **CRM Quick Views** (Person, Company, Deal, Quote) now include contextual New Task and Log Activity actions. Related records are preselected; full pages are not required.
- A **single account-scoped Activity composer** is mounted for Home, Calendar, Tasks and CRM previews. It recovers drafts without mounting duplicate listeners. Explicitly starting a task-linked interaction asks before replacing an unfinished Activity draft.
- New Tasks from a CRM record use separate contextual draft identities so they do not overwrite the general unsaved New Task draft. The Tasks page restoration path can recover a contextual draft's identity after a reload.

## Privacy and reliability
- Only roles allowed to edit shared CRM see Log Activity completion and CRM quick actions. Personal Task creation remains available per existing account permissions.
- New Activity notes are entered deliberately. Only the task's CRM associations, not its private notes, are prefilled.
- Activity IDs use deterministic scope-aware hashes, not raw private Task IDs or user scopes, because two salespeople may have identically keyed auto-generated Deal submission Tasks.
- The existing source author, personal task scopes, related CRM permissions, and local-first sync mechanisms are preserved. No database migration was required.
- **Known limitation:** Task + Activity + optional follow-up are local-first writes that synchronize through existing independent stores, not one cloud database transaction. A disconnected client can show pending/error sync until it reconnects. Cross-device acceptance is required before treating the workflow as fully reliable.

## Acceptance checklist
1. Log in and confirm Home Log Activity still opens exactly one popup. Switch to Tasks and back; verify no duplicate listeners or missing draft.
2. Open an active Task with related Person/Deal/Quote. Choose **Complete + log activity**. Confirm method and related records are prefilled, but Task notes are not copied. Close without saving and confirm Task remains open.
3. Reopen, add notes, optionally check **Create a follow-up task** and choose tomorrow. Save: exactly one historical Activity, completed source Task, and one linked follow-up appear on their respective calendar days.
4. Repeat the flow after a simulated tab discard between saving Activity and marking Task complete. Verify the deterministic ID prevents two Activity rows.
5. Open a Person, Company, Deal and Quote Quick View. Check contextual New Task and Log Activity links; verify prefilled CRM chips and return to the original page.
6. Create a general New Task draft, leave it unfinished, and then start New Task from a Deal. Confirm the original general draft is not overwritten.
7. Validate permissions: read-only roles cannot log a shared CRM interaction; role preview does not permit mutation.
8. Confirm Cloudflare's TypeScript, Quick Quote tests, and Vite build. CI remains disabled; live browser and multi-device checks were **not run** during this GitHub source pass.

## Remaining next work
- Explicit Deal assignee/owner persisted server-side with an assignment picker and per-assignee submission-task audience. This requires a deliberate database/RLS migration and ownership/backfill decisions rather than inferring responsibility from creator or quote relevance.
- Atomic or server-coordinated completion workflow for stricter disconnected-client guarantees, and synchronized CRM deletion tombstones for shared-device cleanup.
