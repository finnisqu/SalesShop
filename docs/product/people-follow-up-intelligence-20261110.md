# SalesShop People follow-up intelligence — November 10, 2026

## Delivered
- People directory filter chips, shared by desktop worktable and mobile cards: **All**, **Never contacted**, **Inactive 30+ days**, **Follow-up overdue**. Filters combine with the existing directory search.
- Last-contact index includes actual completed CRM manual/notebook touchpoints, not record-creation or automatic system changes.
- "Inactive 30+ days" means at least 30 local calendar days since the most recent touchpoint; never-contacted people have their own explicit filter.
- Pending follow-up Tasks appear under Last Contacted on mobile Person cards. Earliest dated pending Task is selected; overdue dates are visually distinguished.
- Follow-ups use only the currently selected **personal Task scope** and matching Person associations (including legacy `linked`); completed, canceled and deleted tasks do not surface.
- After tapping a native Call, Text or Email icon in a Person quick preview and explicitly confirming that interaction, optionally select **Create follow-up task** and its due date. **No** still creates neither Activity nor Task.
- Saved follow-up Task shares the linked Person and Company, belongs to the user's personal Follow-ups queue, and is associated by the logged Activity ID. Failure/retry avoids duplicate Activities and follow-up Tasks.

## Scope limits
- No new Supabase schema/RLS or team-wide assignment changes. No Gmail/SMS/telephony integration: native apps launch and user explicitly confirms success.
- Other proposed enhancements—account-wide history aggregation, external quote attachments/revisions, and owning People/Companies—remain for separate batches.
- Regression unit tests: `personFollowUpIntelligence.test.ts`, `personQuickFollowUp.test.ts`, and source integration test `PeopleFollowUpUx.test.ts`.

## Manual QA checklist
1. On People tab check all four filters, alongside live text search. Verify Never vs Inactive 30+ days remain distinct.
2. View mobile Person with pending follow-up due today, future, overdue, and undated. Verify earliest pending due date appears and completed/deleted tasks disappear.
3. Verify non-owned or another workspace's personal Tasks never appear on the card or in overdue filter.
4. Tap call, text, email in Person preview. Close confirmation with No — no Activity or Task should be created.
5. On Yes, log Activity with Create follow-up unchecked — one completed touchpoint only.
6. On Yes + Create follow-up checked, choose date, save, and verify one new personal Task in Tasks/Agenda, linked to Person/Company. Date follows local time and can't precede today.
7. Try a missing task scope, invalid date and save retry. Ensure no duplicate Activity or Task.
8. Test long names, narrow phone widths, light and dark themes, keyboard focus and iOS return from native apps.

## Deployment note
This branch was prepared using GitHub repository connectors. Full TypeScript/Vitest and a signed-in browser pass were not executed in a local clone. Earlier Cloudflare build check runs (PR #80-82) showed failure without detailed logs in GitHub; inspect Cloudflare Workers Build logs if production remains red. GitHub automatic CI was not changed.
