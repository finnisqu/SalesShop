# Calendar planning, bid obligations and Catalog Tags — 2026-11-03

## Calendar event semantics

- **Task** (blue): a personal to-do, call, email, or meeting task on its explicit due date. Tasks without due dates remain in Tasks, not the date grid.
- **Bid** (orange): a Deal due date; a linked Submit Quote task is the actionable record. The Deal date and automatic task are rendered as **one** calendar event/badge. Existing manually authored linked "Submit quote" tasks on the same date also prevent a duplicate.
- **Activity** (green): a completed interaction on its actual timestamp (past/today). Log Activity now rejects future timestamps; scheduled future work belongs in Task/Follow-up.
- **Follow-up** (purple): either a personal Task with type "follow-up" or an existing scheduled quote follow-up. Saving a completed Activity can optionally create a follow-up Task with the same CRM relationships and a user-chosen due date.
- **Urgent !** (red): an additional alert on days containing an unfinished Task with priority "urgent". It does not increment the event count.

## Deal → Submit Quote task

- One stable task identifier `task_deal_submit_<deal id>` per personal scope. Reconciliation is idempotent across reload, activity refresh, and cloud task merge.
- Created only for pre-bid Deal stages Discovery, Intent to Bid and Bid Development with a valid due date.
- Due-date changes update the same auto-task. Deleted/cancelled tasks remain user overrides; they are not recreated or reopened automatically.
- Moving a Deal to Bid Sent / Negotiation / Closed Won / Completed completes a still-open auto-task. Closed Lost, Discarded or removing a deadline cancels unfinished auto-work. Completed submissions remain historical.
- No separate "bid due" row is counted when the linked submission task already exists. Task preview links to the Deal and to any matching accessible Quote.
- In cloud, a member receives tasks for Deals they created (on newly attributed activity), that are linked to their owned quotes or to existing personal tasks. Owners/admins retain an all-shop due-date queue. This is an interim responsibility rule until Deals gain explicit assignment. Existing Deal creator history without attribution cannot retroactively establish authorship.

## Home workflow

- Selected-day **+** offers New task, Follow-up task, and (only for past/today) Log completed activity. Task creation/preview/edit stays in a modal over Home.
- + Quick Create's Task action also uses the global modal. Quote creation and explicit "Open related record" still navigate into their workflows.
- Desktop and mobile Home support 7-day/Month toggle; desktop defaults Month, phone defaults 7 days. Preference persists on device per signed-in user/company.
- Period arrows are grouped next to the month/year, with a separate icon-only Today control.
- Quote-only Recents use compact rows, no personal Task or Notebook cards.
- The desktop global + creation dialog uses the same centered modal presentation as Log Activity. Mobile keeps its separate slide-up styling for now.

## Catalog Tags

- A new Catalog → Tags tab lists tags from material.features and variant.features (and defined unused tags) with count of distinct Materials, count of assigned Variants, and a company-wide description.
- Click a row to inspect/edit in a right-side panel. Rename updates Material and variant feature tags in the existing stock_materials data; collisions are blocked and a change affecting materials requires confirmation.
- "View materials" navigates to Materials filtered by the selected tag.
- Shared descriptions live in `public.organizations.material_tag_definitions`, a new JSONB column under existing organization access rules. The additive migration was applied to SalesShop's connected Supabase project and its schema presence verified. The migration SQL is committed at `supabase/migrations/20261103225600_add_material_tag_definitions.sql`.
- Cloud editing is exposed only to owners/admins in this first pass; other cloud roles can inspect the directory. Local mode remains editable.

## Verification checklist (for future Cloudflare/browser QA)

1. Deal with a due date in Bid Development creates one "Submit quote" Task, linked to that Deal, with one orange bid badge. Changing due date moves the same task; a matching manually entered submission task does not cause a second.
2. Changing stage to Bid Sent completes auto-task; cancel/delete overrides remain respected. Check cloud task sync on a second device.
3. Each user's private calendar shows only relevant Deal submission tasks, not unowned coworker work.
4. Log Activity with Person/Company/Deal/Quote links, choose "Create follow-up task" and a future date: save one Activity dated today and one purple linked follow-up Task for the selected future day. Dismiss without saving and verify draft recovery.
5. An urgent Task makes its date show one red exclamation mark without increasing total colored badge counts.
6. Home day + on today/tomorrow, create or edit Tasks, close modal and confirm Home's selected date and scroll position remain. Confirm desktop 7-day/month choice survives reload; same for phone.
7. Check month/year arrows, separate Today icon, calendar popover placement, Show more on mobile and light/dark contrast.
8. Quick Create desktop centered modal parity with Log Activity. Quote workflow still enters the guided template selector.
9. Catalog Tags counts, search, sort, pagination, preview, description save/reload, rename to new value, duplicate-name rejection and View Materials filter. Verify cloud permissions and changes from another browser.
10. Review fresh Cloudflare logs for TypeScript, Quick Quote suite, Vite output and successful deployment.

## Next enhancements

- Explicit Deal owner/assignee (rather than creator/quote relevance inference), optionally a per-Deal submission reminder lead time.
- Scheduled meeting/appointment entities separate from historical Activities and planned Tasks.
- "Complete + log interaction + schedule next follow-up" as one guided workflow.
- Optional calendar workload/conflict alerts for heavy bid days.

A GitHub source review and regression tests were added. Full TypeScript/Vite, deployed cloud rendering, browser acceptance and cross-device sync **have not been independently verified** in this pass.
