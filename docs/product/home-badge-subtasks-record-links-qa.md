# Home agenda badge focus, subtasks and CRM record actions

## Intent
Make Home badges navigate within the existing selected-day agenda; add one-level task checklists; expose create and link-existing actions consistently on Company, Person and Deal pages; show the user's own linked Tasks on those record pages.

## Home badges
- Clicking a numeric badge selects that exact day, expands the matching **On this day** disclosure if needed, scrolls the selected records into view, and applies a theme-aware temporary outline. The outline clears on a click inside the agenda or after about 5 seconds.
- There is no secondary badge-only drilldown page; pending Agenda rows and historical On-this-day groups remain the single navigation surface.
- Current badge count logic and date filters remain unchanged. A selected date is preserved when a badge is clicked.
- Detail rows stay directly clickable, opening their original Tasks, Deals, Quotes, People, Companies and Activity inspectors.

## Subtasks
- A Task may have a single-level checklist with an optional title and checked state. No independent due dates, assignees or notifications.
- Add, rename, remove and tick checklist items in Task Editor; tick items from either Task quick preview.
- Parent Task auto-completes when every checklist item is checked; unchecking any item reopens the parent. For a Task with incomplete subtasks, **Mark complete** is disabled and direct store completion is ignored.
- The Task's existing private per-user document stores its checklist; no migration or additional database table. Existing Tasks without subtasks are unchanged.
- A bid-sent event must not automatically complete an authored/automatic submission Task with outstanding checklist items.
- Draft recovery preserves checked items, labels and the unsubmitted new-item text.

## Record-page links and Tasks
- **Company → Deals:** + Add Deal (name-only create) and Link existing Deal. **Company → People:** + Add Person (existing) and Link existing Person. **Company → Quotes:** + New quote and Link existing Quote.
- **Person → Company:** create or link existing Company (except internal roster People, who must use Our Organization to preserve roster classification). **Person → Quotes:** create or link an editable Quote as its primary contact; linked Deals appear when that Quote has a Deal.
- **Deal → Company:** create or link existing Company. **Deal → Quotes:** create or link an editable Quote. Existing New Person / Activity workflow remains unchanged.
- **All three:** Tasks card shows only Tasks linked to this exact record by Task associations, explicitly identified as private; + Task opens the standard editor with the record already linked.
- Existing Quote reassignment is limited to editable Draft/Ready Quotes, protecting issued/signed documents. The UI warns that linking changes the quote's primary contact/company/Deal link.
- Existing record links use the current Company/Person/Deal/Quote state operations and stable IDs; they do not fabricate Activity logs or introduce parallel local relationship stores.

## Important follow-up: true Deal–Person linking
- A direct, additive Person↔Deal membership link (potentially with contact roles like architect, GC PM, subcontractor) requires a dedicated many-to-many relationship stored under organization-scoped permissions. The existing app only represents explicit Deal People via quote contact links or real recorded interactions.
- This batch does **not** create a false activity or reassign a quote contact to simulate a multi-person Deal relationship. This functionality remains a separate data-model change.

## Manual QA
1. Choose a past calendar date with several activity badges. Click an Activities badge, confirm matching date loads, On this day → Activities logged expands and the correct rows are highlighted and scrolled into view. Confirm timeout and clearing on a click.
2. Test Calls, Emails, Quotes sent, Task/Bid due and People-created badges (including dates outside the current month); verify no small badge-only subpage opens.
3. Create Task 'Submit Mill District bid documents' with subtasks W9, COI, Bid packet page 3 signature, Selections Sheet and preliminary drawings. Save, reload, reopen, check items in quick view and verify final checkbox completes Task.
4. Uncheck one subtask; confirm parent automatically returns to Open, without losing notes/due date/associations.
5. Test parent task status under a bid-sent event: an unfinished supporting checklist must remain Open.
6. Company → + Add Deal and Link existing Deal; verify new/existing Deal opens under correct Company and that no unrelated Person/Quote was moved.
7. Company → People → Link existing Person, Company → Quotes → Link existing Draft Quote. Verify linked records appear without duplication. Test Create new Person and Quote paths.
8. Person → Company → Link existing, Person → Quotes → New / Link existing. Verify Person's Quotes and linked Deals through Quotes. Verify internal employees cannot be removed from Our Organization inadvertently.
9. Deal → Company → New / Link existing and Deal → Quotes → New / Link existing. Verify status/amount unchanged.
10. Each record → + Task: confirm Task editor has the record already selected; saved Task appears in that record's Tasks card and is private to the signed-in user.
11. Test Viewer/Owner perspective and quote read-only constraints, mobile keyboard safe area and light/dark themes.

## Validation limits
- Static source/read-back checks and new regression tests were added, but TypeScript/Vitest, browser screenshots and Cloudflare deployment have **not** been verified in the connector-only environment.
- Existing automatic GitHub CI remains disabled, per prior workflow preference.
- Project Timeline beta and Gantt are untouched.