# Home Notes Quick View — November 4, 2026

## Purpose
Add a lightweight **Notes** tab beside **Quotes** and **Activity** in the Home sidebar. Notes are a personal capture surface, not unfinished work. Writing "Aaron's birthday" should not make a Task or an overdue calendar item; any action is opt-in later.

## Backing store and scope
Home Notes reuse Notebook's existing **private Post-it inbox** (`NotebookEntry.isPostItInbox`, `PostItObject`). This keeps them in the existing per-user cloud-aware Notebook document and the global Quick Notes panel without adding a second notes database or shared CRM table. Other Notebook pages' Post-its do not leak into the Home Notes list.

## UX
- Home sidebar: **Quotes | Activity | Notes**. Activity continues listing logged interactions and completed Tasks; Notes is an independent tab with its own small + button.
- New Note: one editable multi-line text field, no mandatory title, date, contact, or assignment. Saving creates a private Notebook Post-it. The first meaningful line becomes the list title; all text is preserved.
- Selecting a Note opens a centered Task-style Quick View (iPhone bottom sheet), displaying full text, modified date, Edit, Delete, **Create task & keep note**, and **Convert to task**.
- Editing is explicit. Unsaved text is recovered by account-scoped draft key; Cancel edits discards that recovery, Close keeps it. The save path refuses to overwrite a note changed in another editor.
- **Create task & keep note** opens the existing Task editor with note text already copied into Notes and an association to the Notebook Post-it inbox. The Task's `sourceObjectId` records the source note ID. A Task Quick View can reopen the original note.
- **Convert to task** uses the same editor. Closing/canceling it leaves the note untouched. On successful local Task creation, the original Post-it is deleted from Notebook; the content already exists in the Task, and Notebook undo can restore the source. If the source text changed while creating the Task, the note is kept rather than overwritten or discarded.
- Deleting a note requires confirmation. No new calendar badge, overdue status, or Activity is created merely by writing a note.

## Acceptance checks
1. On Home, open Notes and click +. Enter `Aaron's birthday\nSend a happy birthday text` and save. The note appears sorted by updated time with the first line as heading. No Tasks or calendar badges appear.
2. Click the note. Verify centered Quick View on desktop, bottom sheet on iPhone, full text wrapping, edit mode, Save, Discard, and account-scoped unsaved recovery after closing.
3. In the note Quick View, **Create task & keep note**. Task editor must prefill title, content, and a Notebook association. Cancel: note remains. Save: note still appears, and Task Quick View offers **Open source note**.
4. Reopen note; choose **Convert to task**. Cancel: note still exists. Save: new Task created and original Post-it removed only afterward. Task notes retain text. Notebook Undo can restore deleted Post-it.
5. Edit original note elsewhere after beginning conversion: Task creation must not delete a newer version of the note.
6. Create more than three Notes on an iPhone: Notes list scrolls and no hidden older rows. The Quotes and Activity tabs preserve their previous behavior.
7. In a second signed-in user/workspace, verify Home Notes don't show another user's private Notebook data. Verify role-preview mode doesn't expose writable Note modal.
8. Check Cloudflare build `tsc --noEmit && npm run test:quick-quote && vite build`; run `npx vitest run src/services/homeNotes.test.ts`. Automatic CI remains disabled.

## Not implemented
Calendar Dates, recurrence, date-specific note badges, shared team Notes, or automatic Person matching. Those remain separate opt-in enhancements. This batch makes no database schema changes.

## Verification
Source changes and focused tests have been committed to GitHub. Full TypeScript/Vite, Cloudflare deployment, and device acceptance are unverified until build and browser results are available.
