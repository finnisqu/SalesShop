# SalesShop — Team beta access gate

Prepared while adding the **Connections** workspace. The current development branch remains separate from production `main`.

## What exists

- Supabase Auth with individual sign-in and a current organization.
- `organization_members` roles: `owner`, `admin`, `member`.
- Organization documents shared within an organization; notebook private documents keyed to user.
- Existing Settings → Team displays members/roles, but does not invite or revoke accounts in-app.
- Most sales records are stored as organization-level documents; quotes, projects, activities do not yet have durable salesperson owner IDs.
- The Connections Overview is consequently **Workspace-only**. The “Mine” control stays disabled until attribution and access rules are real.

## Required before inviting the team

1. **Invitation acceptance lifecycle:** Admin/owner sends a scoped email invite; persist invite token hash, inviter, recipient email, org, role, expiry, status. Accept via authenticated, email-verified recipient. Never trust organization ID or role from client form data. Reject replay/expired/wrong-email links. Handle sign-up trigger that currently creates an owner organization for new users: accepting an invitation must route the new member into the invited organization instead of silently provisioning an unrelated team.
2. **Backend permission enforcement:** Protect invites, member role updates, removals, and organization settings in Postgres RLS / security-definer RPC or server endpoints. Distinguish read access from mutation access. Prevent an owner from being removed/demoted accidentally if they are the last owner. Make membership removal revoke subsequent reads and writes.
3. **Data isolation audit:** Two different organizations must never read or write each other's company/contact/project/quote, files, share links, or price-book records. Test local and cloud sync during account switching. All permissions are checked server-side; hiding a UI button does not constitute authorization.
4. **Ownership attribution:** Define `created_by`, `assigned_to`, and activity actor for project/quote and migrate existing records to explicit owner or unassigned. Only then enable “Mine”, “Team”, and salesperson reporting. Avoid the false assumption that a person who opened a record owns it.
5. **Role matrix:** Owner: all admin plus billing/ownership changes. Admin: invite and manage members, company standards. Member: normal quotes/CRM collaboration. Any read/write restrictions beyond that need agreement before implementation. Keep private notebooks private and financial/internal pricing permissions explicit.
6. **Operational beta checks:** Verify invitations end-to-end, expired/revoked invites, member removal, role downgrade, multiple devices, collision-safe edits, cloud sync recovery, backups/export, and mobile/desktop data parity. Use 2–3 pilot accounts in a test organization before wider rollout.

## Sensible phased rollout

- **Phase A (next):** invite/accept, identity and team management, minimum server-enforced role matrix and cross-org tests.
- **Phase B:** attribution and personal/team dashboards, permissions-aware navigation and reports.
- **Phase C:** 2–3 pilot users; patch data consistency and mobile workflow bugs before expanding to the full team.

**Do not announce team beta readiness solely because the Connections directory and role labels exist.**
