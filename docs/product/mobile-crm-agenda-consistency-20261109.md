# Mobile CRM / Agenda consistency — November 9, 2026

## Implemented on feature branch
- Home Agenda + Add floats in a document-body portal, viewport-clamped on mobile and independent of agenda row count. The menu says **Log Activity** and includes **Record external quote** with the selected calendar date prefilled.
- Phone Tasks rows mirror the compact Agenda: checkbox, single-line title, due date and trailing **…** opening the existing full Task quick preview. Bid submission Task checkboxes are disabled until confirmed submission proof.
- Mobile Deal full page uses the same preselected external quote popup as the quick preview; desktop keeps its embedded form.
- Mobile Company record cards no longer include an inline Prospect/Customer/Partner select. Relationship is displayed and can be edited from record details/bulk editing.
- Our Organization uses the standard Connections worktable on desktop (columns, sorting, pinning and Edit), and common record cards on mobile. Edit form scrolls into view; no custom clipping container.
- Mobile Suppliers has a real directory card list instead of a hidden desktop-only table.
- New cloud Deals default to the current signed-in salesperson through the existing `assignedUserId` field. New Person creation activities are stamped with the actor, and calendar personal sources retain assigned Deals.
- Recent Activity includes touchpoints, quote sent events and record creation/system history, each with a matching method/gear icon.
- External quotes use existing `quote-sent` CRM events with `bidSentDate`, so the Home calendar **Quotes Sent** metric uses the selected send date. Email messages sent outside SalesShop are *not* automatically imported: they must be recorded explicitly.

## Known limitations / intentional deferrals
- **Companies and People currently have no owner/assignee column.** Full cross-record default assignment and ownership-specific filters require a reviewed normalized data-model/RLS change; no such migration was applied in this UI batch. The current scope is Deal assignee and actor attribution, not a claim of universal record ownership.
- The build/TypeScript result and signed-in mobile browser QC must be checked at release; no automatic GitHub CI was reenabled.
- No Supabase schema, RLS, login permissions, or existing record assignments were changed.

## Release smoke checklist
1. Home: open November 9 calendar Agenda on dates with 0, 1 and multiple items. + menu stays in viewport, both New Task and Log Activity are visible, outside tap closes.
2. Home: Record external quote with the selected date and a Deal. Confirm CRM Activity history `quote-sent` and the **Quotes Sent** calendar badge. Change the metric slots if that badge is not currently selected.
3. Mobile Tasks: due date appears beside each title, no extra metadata/controls visible. Tap … for full preview, including Edit/Delete and guarded submission actions.
4. Connections → Deal full page: on mobile, Record external quote opens a popup with Deal selected; desktop still works.
5. Connections → Companies: cards show relationship but no dropdown; full record and bulk edit still work.
6. Our Organization: desktop standard workbook; mobile card list, Edit person scrolls and Save works on iOS with keyboard.
7. Connections → Suppliers: iPhone/820px view contains supplier cards and tapping opens a navigable supplier record; Back returns to directory.
8. Create new Deal while signed in, refresh and confirm assigned salesperson. Verify that cross-org assignments still require separate explicit workflow.
9. Home Activity recents: phone, email, text, video/in-person, external quote and record creation have the proper icons and open previews.
10. Verify mobile dark/light styling, remote cloud persistence and browser back/forward.

## Regression tests
`src/services/salesCalendar.test.ts` exercises owned Deals and external quote visibility, recent Activity system classification and method metadata. Existing `homeCalendarBadges.test.ts` and `externalQuoteBackfill.test.ts` exercise the recorded sent date and historical Deal nonmutation.
