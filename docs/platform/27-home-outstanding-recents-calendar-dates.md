# Home: outstanding agenda, recent history, and future calendar dates — 2026-11-04

## Shipped scope
- A day badge counts **only outstanding Tasks and Bids**. Follow-up Tasks use the standard Task counter, not a fourth color. Manual Activity history never increments a calendar badge.
- Completed, canceled, or deleted Tasks no longer appear in the agenda. When the user completes an auto-generated bid Task, its original Deal deadline does not reappear as an extra raw bid entry. Deals in `Bid Sent` or later stages also stop advertising an unsent bid.
- The selected day's header shows `N remaining`, including `0 remaining`, and an empty day says `All caught up for this day.`
- The Home **Recents** tab combines personally relevant logged CRM interactions with completed Tasks, sorted by actual completion/interaction time. Clicking either item opens its corresponding Quick View; Quote recents retain their own tab.
- Completion through the **Task → Log Activity → Complete** workflow produces only the logged Activity in Recents, not a duplicate completed Task row. This uses the existing deterministic task-completion Activity key and private task scope.
- When a Task is reopened, it leaves completed Recents and reappears as outstanding on its due date.
- The agenda + menu now offers **New task** or **Log completed activity** for past/today; dedicated Follow-up creation is no longer listed. The Task editor still permits selecting Follow-up, and logging an Activity can still create a linked follow-up Task.
- Legacy scheduled quote follow-up records remain in the outstanding **Task** category until cleared. A real personal follow-up Task for that quote/day takes precedence, including if it has been completed. This preserves old schedules without inventing duplicate badges.
- Small count pills are streamlined for mobile; the red urgent ! only appears while urgent work is unfinished.

## Manual acceptance checks
1. On November 4 with Tasks, a bid, a planned follow-up, and previously logged Activities, confirm **no Activity or Follow-up badge**. Only Task and Bid counts remain.
2. Complete each pending Task in its Quick View: the agenda count and urgency marker decrease instantly. Open **Recents**: the completed Task appears. Reopen and confirm it moves back into the agenda.
3. Complete a bid submission Task while the Deal is still in an unsent stage: confirm it does not reappear as a separate raw Deal deadline.
4. Change the Deal stage to `Bid Sent`: outstanding raw Deal deadline disappears. Do not mutate previous Task completion history.
5. Use **Complete + log activity**, optionally creating a follow-up Task: Recents should show a single Activity entry for the completion, while the new follow-up appears only on its future due date and counts as a Task.
6. Log an Activity for today with no outstanding work: the calendar shows `0 remaining`. The interaction appears only under **Recents**.
7. Verify `Show N more` on iPhone counts outstanding items only, uses the correct reduced total after completion, and does not duplicate entries.
8. Verify account-scoped privacy and that unowned CRM Activities do not leak onto a salesperson's Home. Check browser refresh and cross-device syncing.
9. Run `npm run build` and `npx vitest run src/services/salesCalendar.test.ts` when a build environment is available.

## Recommended next feature: Calendar Dates
A **Calendar Date** should be a standalone scheduling record, *not* a Task, Activity, or quote document. Examples: installation window, material delivery, customer meeting, birthday, inspection, or company holiday.

Proposed minimal fields:
- Title, category (Install / Delivery / Meeting / Milestone / Personal / Other), date or date range, optional start/end time, all-day flag, optional description.
- Optional CRM links (Deal, Company, Person, Quote), optional reminder but **no required assignee, completion state, or overdue nagging**.
- Visibility: Private (default) or explicitly shared with the company, controlled by existing CRM edit/read permissions. Personal/birthday events must not be silently visible to coworkers.
- Optional annually repeating date (for birthdays/anniversaries); defer complex recurrence rules, external sync, and automatic assignment.

Proposed presentation:
- Calendar month/week tiles continue showing two **outstanding-work count pills** (Tasks, Bids), plus **one subtle hollow dot** if the date has non-task events. Do not add a separate count badge for each event category.
- When choosing a day, a small **On the calendar** group appears *separately from* the **Outstanding** agenda, with relevant time/date context. Scheduled dates never inflate remaining-work totals and never move to completed Recents simply because their date passed.
- The Home + menu gains **Calendar date** only when the end-to-end record/editor/storage path is implemented; the existing Task and Activity actions remain.
- Scheduling an installation on a Deal can optionally create a Calendar Date, but must not silently create a Task; users can explicitly create a related Task if they need an action.

## Verification
GitHub source and regression cases have been updated. Automated CI remains disabled, and Cloudflare TypeScript/Vite and live browser tests have not been confirmed by this batch.
