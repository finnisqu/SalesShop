# Daily Notebook + Linked Agenda (2026-11-04)

## Design
SalesShop's Home Notes now uses **real daily Notebook pages**, not new Post-its. The Notebook page's `dailyDate` marker is an ISO local calendar date. A page is created **only on the first saved capture** and subsequent captures for that day are appended as escaped rich-text paragraphs. Opening the + menu or closing an unsaved draft creates nothing. The page title reflects its calendar day and existing rich-text, ink, objects, paper styles, split view, and undo remain available.

A new Notebook sidebar **Daily** filter lists these pages newest first. Home's **Notes** tab shows dated pages and permits quick capture/review; the daily Quick View provides **Open in Notebook** for full editing. Capturing in the quick popup never rewrites the entire Tiptap document.

## Legacy preservation
Existing Notebook Post-its are preserved intact in their original private Post-it inbox, still accessible in the Notebook and a labelled legacy section of Home Notes. No migration of user text or destructive cloud rewrite is performed. Legacy Note Quick Views and existing Post-it → Task flows continue to work.

## Linked Agenda
`NotebookEntry.agendaItems` is a separate optional array of `NotebookAgendaItem`, **not an object on the paper canvas**. This preserves Notebook drawing and object coordinates. The collapsible Linked Agenda appears outside the paper sheet in both primary and companion editing panes. An agenda item has type **calendar-date** or **task**, title, source excerpt, source page, date, optional time, optional annual recurrence, and optional taskId.

A selection in Tiptap shows a small **Add to calendar / Create task** toolbar. The existing text context menu also includes both actions. Nothing removes the original selected text.
- Add to calendar: opens the standard themed date popup. Saving appends a calendar-date item to the source Notebook page.
- Create task: opens the existing Task editor with selected text and Notebook association prefilled. Only after successful Task creation is a Task item added to the source page's Linked Agenda.
- The Task entry reflects live Task completion / due-date metadata when available. A retry with the same Task ID does not create duplicate agenda links.
- The original Notebook text and canvas are unchanged.

## Home Calendar
A date with a Notebook calendar-date record receives **one subtle hollow dot** on the Home calendar (including annually repeating dates). Selecting that day shows a separate **On the calendar** section, with individual clickable date events. Calendar dates do not create Tasks, become overdue, inflate Task/Bid counts, or appear as completed Activities. Calendar date editing/removal is available from the event popup and leaves its original Notebook text unchanged.

## Privacy and safety
- Daily pages and Linked Agenda records live in the existing account-scoped private Notebook document. No new shared CRM table, RLS, or company-wide exposure.
- New daily page IDs are deterministic by day within the existing per-account Notebook storage; same-tab duplicate capture reuses the existing page. We do not silently claim full cross-device transactional safety with whole-document cloud synchronization.
- User-provided quick-capture text is escaped before inserting rich-text HTML.
- Captures and selected text avoid automatic CRM matching or shared records.
- Existing notes, normal pages, attachments, and Post-its are preserved.

## Acceptance checklist
1. Open Home → Notes → +, type a sentence, then close without saving: **no dated Notebook page** exists. Save it: exactly one Daily page is created with today's date.
2. Capture another note that day: the same Daily page is appended, original content and drawings are intact. Tomorrow, a new capture creates tomorrow's page.
3. Open the dated item in Home Notes. Use **Open in Notebook**, verify rich-text, ink, object selection, existing toolbar, split editor, and Daily sidebar filter.
4. Highlight `Aaron's birthday`, choose **Add to calendar**, select a date and annual recurrence. The page Linked Agenda lists the item; Home calendar has one hollow dot and **On the calendar** row, but today's Task count remains unchanged. Edit/delete the date and verify original text remains.
5. Highlight `Send Aaron a happy birthday text`, choose Create task, then cancel: no linked Task or agenda item. Save: linked Task appears in Notebook agenda and Home outstanding Tasks on its due date. Complete it: Home Task count decreases and Notebook agenda shows completion.
6. Open an old Post-it from Home Notes. Edit or promote it: verify it still exists in Notebook's original Post-it inbox.
7. Test multiple open Notebook panes, iPhone rich-text text selection, keyboard selection, date popup, safe-area layout, and dark/light appearances.
8. Reload the app; verify daily page markers, Linked Agenda dates, and text persist. In a second account, verify no cross-user visibility. Test an invalid date and duplicate same-day capture.
9. Run `npm run build`, `npx vitest run src/services/notebookDaily.test.ts src/store/notebookStore.test.ts`, and visual browser acceptance on Cloudflare after deployment. Automatic CI stays disabled.

## Not included
Team-shared calendar dates, Google/Apple Calendar sync, recurring weekly events, automatic customer birthday extraction, or an atomic multi-device Notebook merge. These can be added deliberately later.

**Verification boundary:** Source review and regression test cases were prepared. Full TypeScript/Vite build, Cloudflare deployment, and cross-device visual acceptance were not executable from this GitHub-only development pass.


## Hardening follow-up — November 4, 2026
A separate focused batch addressed edge cases without any schema migration or automated tests being enabled:
- **Exact date validation** now rejects invalid days such as February 30, February 31, and April 31 in the quick capture, Linked Agenda store, edit popup, and Home date lookup. A true February 29 remains valid in leap years and can now repeat annually; the event appears only in leap years.
- **Mobile text selection:** when iOS reports an empty native selection rectangle, Tiptap's document coordinates provide a fallback. The floating action menu is clamped to the visible viewport, uses finger-sized controls, and keeps touch taps enabled instead of cancelling them.
- **Private Task scope:** a Notebook Linked Agenda only resolves Task details if the active private Task collection belongs to the current account. During a workspace transition it won't display the previous user's Task details.
- **Stale links:** Notebook Task links have a separate remove-link control. Unlinking affects the Notebook entry only; the Task is never deleted or marked complete. The Post-it inbox does not show nonfunctional Linked Agenda controls.
- **Draft recovery:** closing after a successful Daily Note save no longer triggers an empty-text state update that could recreate an unwanted recovery draft.
- **Dependency isolation:** the Notebook date helpers no longer pull in the CRM calendar module while Notebook state is hydrating.

### Additional acceptance cases
1. Enter invalid dates (including April 31 and non-leap February 29) when creating or editing an event; confirm they cannot save and leave the original event untouched.
2. Create an annual February 29 reminder; confirm it appears in leap years, not on February 28 or March 1 in other years.
3. Highlight text in iPhone Safari with the on-screen keyboard open. Confirm the action toolbar stays on-screen and both Add to calendar and Create task remain tappable.
4. Remove a Task link from a Notebook's Linked Agenda. The Task must remain in Tasks; remove a link to a deleted Task to clear the orphaned row.
5. Switch accounts/workspaces and verify the Linked Agenda never shows Task details loaded for a different account.
6. Verify the legacy Post-it inbox still opens, edits, and preserves existing Post-its without displaying an unusable Linked Agenda.
7. Run `npm run build`, `npx vitest run src/services/notebookDaily.test.ts src/store/notebookStore.test.ts`, and Cloudflare/browser acceptance before calling the release fully verified.

**Status:** The source changes and regression cases are committed; the build, test execution, Cloudflare deployment, and device acceptance remain unverified in this connector-only workflow.
