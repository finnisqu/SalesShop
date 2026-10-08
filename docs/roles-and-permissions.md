# SalesShop workspace roles (initial implementation)

These roles belong to an organization membership, not to a user globally. One user may have a different role in each organization.

| Action | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| View shared CRM, quotes, catalog | Yes | Yes | Yes | Yes |
| Edit shared CRM, quotes, catalog | Yes | Yes | Yes | No |
| Company branding/settings | Yes | Yes | No | No |
| Invite members/viewers | Yes | Yes | No | No |
| Invite/manage admins | Yes | No | No | No |
| Remove/change other members/viewers | Yes | Yes | No | No |
| Personal notebook | Yes | Yes | Yes | Yes |

**What changed in this batch**

- Viewer is a fourth valid `organization_members.role` and an invitation role.
- Supabase read policies still use organization membership; shared-record write policies require `private.is_org_editor` (Owner/Admin/Member).
- The quote-share administrative Edge Function uses a privileged client, so it independently blocks Viewer writes.
- Merge operations and quote-number assignment were updated to require editor permissions even when called via security-definer functions.
- Viewers get a dedicated browsing experience for projects, quotes, companies, and stock materials. They may edit and sync their own private notebook. Other catalog sections (Rates, Sinks, Suppliers) are not yet represented in the Viewer browser.
- Owners/Admins can assign Viewer or Member to existing teammates. Only Owners can assign Admin. No one can change their own role or remove the Owner.

**QC plan**

1. As Owner, invite a Viewer and verify the email and onboarding show Viewer.
2. Sign in as Viewer; check Board, Quotes, Catalog, and Connections render read-only content and normal navigation works on phone.
3. As Viewer, attempt to update a shared quote/company directly via the Supabase API: expect denial, not a database change.
4. As Viewer, edit personal Notebook and reload: content should persist.
5. As Owner, promote Viewer to Member. After the teammate signs in again, shared editing should be enabled.
6. As Admin, confirm Viewer/Member invitations work but assigning Admin is denied.
7. Confirm an Owner cannot demote or remove themself.

Current limitations: category-specific custom permissions (Salesperson, Estimator, Purchasing, PM), quote ownership access controls, export restrictions, and full Viewer detail screens are deferred to later batches. This is intentionally a conservative RBAC foundation.

`main` is not part of this feature branch workflow.
