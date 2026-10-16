# SalesShop department permissions — v1 foundation

Departments are **assignments within Member**, not new organization role values. Existing Owner/Admin/Member/Viewer roles and existing General Member privileges are unchanged.

## Editing matrix

| Role / department | Edit CRM & projects | Edit quote drafts | Issue customer quotes | Edit supplier records |
|---|---|---|---|---|
| Owner / Admin | Yes | Yes | Yes | Yes |
| Member · General | Yes | Yes | Yes | Yes |
| Member · Salesperson | Yes | Yes | Yes | No |
| Member · Estimator | No | Yes | No | No |
| Member · Purchasing | No | No | No | Yes |
| Member · Project Manager | Yes | No | No | No |
| Viewer | No | No | No | No |

All authenticated organization members may **read** shared records as before. Updating company identity/rates through `organizations` remains restricted to Owner/Admin. Publishing supplier price imports remains Admin-only under the existing RPC.

## Implementation

- `organization_members.job_function` (default `general`) persists department per organization; assignment via `set_team_job_function` validates the current user's role and the target member. Admins can assign Member departments but cannot change other admins or Owners.
- `private.can_edit_org_area` protects data writes by area with RLS for normalized CRM, quote and supplier tables; `org_documents.document_key` is also scoped. Existing non-member private notebooks are unchanged.
- First-issuance of Sent/Viewed/Signed quotes, quote numbering, and customer-share generation require additional server authorization (`private.can_issue_org_quotes`).
- Invites can specify department through `create_team_invite_with_department`; acceptance stores it on the new Member membership. Invitations for Owner/Admin/Viewer do not carry a Member department.
- The app routes noneditable areas to a read-only browsing surface and hides global quick-create for specialized departments. Purchasing users can return to editable Suppliers from the catalog reference view.
- Resend invitation email includes the department name when the invite is for a Member.

## Not yet a secure capability: internal-cost confidentiality

Costs are present in `organizations.stock_materials`, quote line references, and other currently shared documents. Hiding a cost field from the UI **would not prevent an authenticated member from retrieving it** through shared data APIs. We must separate restricted cost data into protected tables or server-composed, redacted views before creating a trustworthy per-department `view_internal_costs` permission.

## Not yet implemented: multi-step quote approval

The `can_issue` permission stops Estimators from marking a quote Sent or creating a customer share. It is **not** a submission / review / approval queue. A later batch should introduce distinct Prepare, Submit for Approval, Approve/Reject, and Issue actions with immutable audit rows and server-side checks.

## QC to run with controlled test accounts

1. Confirm GitHub Pages Build and Deploy both pass for `architecture/react-foundation` and load `https://app.salesshop.work`.
2. As Owner, update an existing Member's department in Settings → Team. Sign in again as that account to refresh the UI.
3. As Salesperson, edit a customer and a quote, and verify supplier changes are rejected by the database.
4. As Estimator, edit a quote draft and attempt to Send; expect a clear permission error with no Sent state.
5. As Purchasing, open Suppliers and create a supplier record; verify changing CRM or issuing a quote is denied.
6. As Project Manager, edit a project, confirm quote editing is disabled, and ensure direct write API calls fail.
7. Invite a new Member directly into Estimator or Purchasing; verify the invitation text and membership assignment.
8. Confirm existing General Members still edit their previous shared data, and Viewer remains read-only.
9. Validate on mobile, especially a Purchasing user's return path from the read-only catalog to editable Suppliers.

`main` remains frozen; this is a React foundation development branch migration.
