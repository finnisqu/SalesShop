# Personal Tasks v1 — 2026-11-01
- Dedicated top-level Tasks screen and /tasks route; compact counts, filters, search, full completed history, edit/reopen/delete, Task type, status, priority, queue, due date/time, in-app reminder and notes.
- Reuses the original Home personalTaskStore and its scoped localStorage keys. Home's My Today list continues using the same records.
- Notebook text selection, objects (Post-it, paper card, business card, image captions, etc.) and sidebar pages can be promoted from a context menu. Promotion **opens a prefilled task editor**; it never removes or alters source content.
- Personal cloud storage uses private_documents with document_key='tasks'. Owner-only RLS is already in place. Additive migration expands the existing document_key CHECK only; no team tasks or new customer-data visibility.
- On cloud load, merge local and remote task versions by updatedAt and keep deletion tombstones. Local storage is retained when offline or cloud save fails. Changes upload in a short debounce.
- Reminders are currently **in-app due indicators** when the app is open; background notifications, email reminders, recurring task scheduling, team assignment, and delegated task queues are future work, not implemented.
- Quote, Deal, Company, Person and Notebook sources use existing navigation links. Promotion creates a private personal task, not a CRM-wide activity log.

## Acceptance after Cloudflare Ready
1. Existing Home tasks appear in Tasks and remain after refresh and cloud round-trip; mark completed and verify history/reopen.
2. Create a task with tomorrow due date, priority, notes, and in-app reminder; check Scheduled, All, Today/Overdue views and refresh.
3. Highlight editor text, right-click, Promote; task editor should prepopulate selected text and Notebook link. Don't interfere with native right-click when nothing selected.
4. Right-click a Post-it, business card or Notebook page and promote; no source object is removed or changed.
5. Test desktop tab, mobile drawer and /tasks reload + Back.
6. Verify account switching and viewer preview do not show another person's private tasks; verify cloud task row owner_id is auth.uid() and Notebook RLS still works.
7. Test 375px, 768px and desktop, dark/light contrast, keyboard Escape for context menus.

Status: source changes and tests authored; build/browser verification pending. Migration must be applied to production Supabase before task cloud sync writes will work.
