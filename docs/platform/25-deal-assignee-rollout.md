# Deal assignment rollout — 2026-11-04

## Migration and existing records
Supabase migration `20261104041345 deal_assignee_membership` has been applied.
- Adds nullable `public.projects.assigned_user_id uuid` (no backfill).
- Adds `(organization_id,assigned_user_id)` composite FK to `organization_members(organization_id,user_id)`, `ON DELETE SET NULL (assigned_user_id)`. A user from another organization cannot be assigned; removing a teammate does not remove a Deal.
- Adds a partial lookup index for assigned Deals. No new SELECT/UPDATE privileges are granted. Existing organization-member read access and CRM-editor RLS stay in force.
- Initial verification: 14 Deals remain, all 14 unassigned, and the FK exists.

## UI and saving
- Full Deal details and Board Deal editor offer **Assigned salesperson**, listing owner/admin and member roles whose department is `general` or `salesperson` (users eligible to issue quotes).
- Deal Quick View and full Deal properties display the assignee or an explicit Unassigned label.
- Assignment saves use a dedicated, server-acknowledged `projects` UPDATE with current assignee compare-and-swap and organization-scoped RLS. Failed, stale-tab or cross-company assignments surface an error and do not update the local saved value.
- Local-only mode does not fabricate organization members. CRM sync maps the new column and preserves the server value rather than erasing an accepted assignment from an older browser cache.

## Submission Task routing
- An **explicitly assigned Deal** creates/updates the deterministic private bid-submission Task only for its assigned salesperson, including when the owner or admin has access to all shared Deals.
- **Unassigned Deals** keep the legacy routing based on shop-wide admin queues and member relationships until manually assigned. This preserves existing imminent due-date tasks during rollout and avoids guessing assignees for old Deals.
- Reassignment eventually cancels the former assignee's unfinished auto-created Task and creates the recipient's task on that user's next sync. Already completed private Tasks remain in history.
- The shared Deal's bid due date remains visible independently in the calendar. The assignee owns the private submission obligation.

## Acceptance checklist
1. Open a Deal from Board and its full page: choose an eligible team member, Save; reload and verify assignee persists.
2. Change assignee from A to B: A's auto-created task stops appearing as active on their next sync; B gets exactly one. An owner/admin other than B should not receive a duplicate task.
3. Set assignee back to Unassigned: the legacy routing resumes without changing the Deal's bid due date.
4. Open an old unassigned Deal; its existing legacy tasks remain until it is assigned. Verify there is no automatic migration of old Deals.
5. Try opening two tabs: change assignment in one, then save a stale selection in the other. The latter must report an explicit conflict.
6. Confirm an invalid/cross-organization assignee fails the composite FK, viewer/estimator cannot save CRM assignments, and teammate removal clears assignment without deleting any Deal.
7. Test Board, Deal page and Quick View on narrow mobile, light and dark appearances.
8. Review Cloudflare deployment log: `tsc --noEmit && npm run test:quick-quote && vite build`. Automatic CI remains disabled.

## Verification limitations
The schema and FK were verified with read-only catalog queries and row counts. The source branch has unit test additions. A complete TypeScript/Vite build and live mobile/multiplayer acceptance were **not** performed from this GitHub-only environment. Do not assume Cloudflare deployment passed until its build log is available.
