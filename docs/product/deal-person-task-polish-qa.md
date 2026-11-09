# Task quick-view polish and direct Deal–Person memberships

## Included
- Home Agenda: task rows with subtasks show a subtle `done/total` count; badge is informational, and the whole row still opens its task
- Our Organization: centered under standard Connections workbook width; wide employee/subcontractor columns scroll inside the workbook instead of stretching the page
- Task quick views: redundant Close footer button removed; X/outside-click remain; desktop actions align in one compact row, with mobile wrapping as needed
- Task deletion: individual Delete in the Tasks table and quick views; confirmed **Delete selected** in Tasks bulk-edit, using existing per-user tombstone sync (no hard CRM deletion)
- Deal → People: dedicated **Direct Deal contacts** section. Select an existing Person, assign an optional role, update the role or unlink them without logging an interaction or changing a Quote
- Person → Deals: **Directly linked Deals** with role label and + Link Deal. The existing Quote-based Deals list remains
- Existing Activities, quote-contact relations and private tasks are unchanged

## Database (applied in Supabase)
- Project `SalesShop` ref `pvchgibllozuwickhfqz`
- Applied migration: `deal_people_relationships_20261109`
- Table: `public.deal_people`, composite PK `(organization_id,deal_id,person_id)` and FKs to `projects` and `contacts` with ON DELETE CASCADE
- Optional role up to 120 characters, `created_at` / `created_by`
- RLS read via `private.is_org_member(organization_id)`, edits via `private.can_edit_org_area(organization_id,'crm')`
- Explicit grants for authenticated; anonymous access revoked
- Verified with SQL: RLS on; four policies; two composite FKs; permissions granted to authenticated; unauthenticated/nonmember context returned zero records
- Existing records unaffected; new table initially empty
- For local mode, direct links use device-local storage instead

## Manual QC
1. Open Home → Agenda; verify tasks with 1/3 checkboxes display small `1/3` and those without checklists have no extra label.
2. On desktop and phone, open Task quick view. Verify X and backdrop dismiss; actions don't stagger on desktop; Delete confirmation works.
3. On Tasks, select multiple records → Bulk edit → Delete selected. Confirm once, verify count and Agenda update, reload and verify deleted records do not resurrect via private Task cloud sync.
4. Our Organization width matches Companies/People on desktop; subcontractor Company column stays inside horizontal table scrolling on narrow screens.
5. Deal → People → + Link Person → choose an existing Person and optional role; save. Reload and confirm it persists and can be edited/unlinked without changing Activity history.
6. Person → Deals → + Link Deal; confirm relation appears on the Deal and from a second authenticated team member. Viewer should read but not modify.
7. Unlink a Person from a Deal; verify original Person and Activity/Quote history remain intact.
8. Confirm organization isolation: a second workspace cannot read, assign or delete contacts in the first workspace.
9. Test light/dark themes, compact/wide desktops and iPhone sheet safe areas.

## Important limitations
- New Person creation is still handled by the existing CRM form/Activity path; the direct membership selector links existing People. It does not fabricate a CRM touchpoint.
- Direct relationship is a new shared table, not part of older CRM snapshot documents; it must be present in a destination Supabase database before this UI can save cross-team assignments.
- No work was done on Project Timeline/Gantt.
- Full TypeScript build, Vitest execution, Cloudflare deploy and browser visual checks were not executed in the connector-only environment. GitHub CI remains off.
