# Batch 14B — private quote RLS: deployment gate (NOT APPLIED)

**Source:** `supabase/migrations/20261015151800_private_quote_ownership_gate.sql`
**Manual rollback:** `docs/security/rollback-14b-private-quote-rls.sql`
**Status:** Code staged in GitHub only. No SQL execution on the live SalesShop project.

## Live preflight inventory, 2026-10-15 (counts only)

11 quotes; 0 unassigned quotes; 0 team-linked quotes; 0 explicit quote access grants; 3 signatures; 10 companies; 3 contacts; 15 projects; 49 CRM activities.

The connected Supabase account currently lists only the live SalesShop project, not a disposable staging environment. Therefore the role matrix cannot be claimed as complete; no production SQL was applied.

The new quote policies will hide *owned* drafts from other company owners/admins, not just ordinary members. Each existing quote keeps its existing `owner_user_id` — **no backfill or reassignment**. Signed documents are available to management only through the separate Shop Outcomes signed-only API, once that API is deployed and verified.

## Exact behavior of staged SQL

- `private.can_read_quote`: current owner with an editable role, explicit read grant, or owner/admin reviewing a truly unassigned legacy quote.
- `private.can_edit_quote`: current owner with the Quotes department permission, or owner/admin for a truly unassigned legacy quote.
- No access via `sales_team_members` alone; being owner/admin does not override a salesperson's ownership.
- Inserts attribute their creator; no self-service reassignment of someone else's quote.
- Quote access grants remain explicitly read-only. Staff can intentionally grant access to a quote they can edit; management cannot silently give itself access to a colleague's private quote.
- Quote-activity insertion must be authorized for the referenced quote. Quote children (lines, sections, revisions, signatures, links) continue to inherit quote-level authorization through existing policies.
- Legacy `org_documents` JSON keys `quotes`, `signatures` and `crm` become unreadable and unwriteable via authenticated Data API; the existing raw records are left intact for database-level recovery.
- `assign_unowned_quote` is an owner/admin-only **compare-and-set** action that works only on quotes without an owner and records an audit entry. It cannot transfer an owned quote.

## Blockers before applying to live data

1. Make a staging Supabase project or isolated test environment with the same policies and Edge Functions. The connected account currently exposes only the SalesShop production project.
2. Create a disposable test organization with two salespeople, an owner, an admin, a viewer, and a nonmember account. Do not test signing or revocation on existing customer records.
3. Confirm the full JWT-context read/edit/insert matrix below via **PostgREST as each actual logged-in user**, the `can_access_quote` RPC, `quote-share-admin`, `shop-outcomes`, and the browser. SQL policy inspection alone is insufficient.
4. Adjust the quote-owner assignment UI: currently `TeamQuotesWorkspace` writes `owner_user_id` directly. With 14B, legacy recovery must call `assign_unowned_quote` and normal owner-to-owner changes require an explicitly approved handoff, not admin reassignment.
5. Confirm the cloud quote and CRM sync tolerate filtered results and cannot upload a previously cached copy of another user's now-private record. Audit cache clear on sign-out or account swap.
6. Audit `companies`, `contacts`, `projects`, activities without a quote, supplier/campaign documents, other SECURITY DEFINER RPCs, and exported files. Their policies **still have broader organization read access** and require their own privacy migration.
7. Capture policy definitions and record counts, rehearse the SQL transaction and rollback in staging, review EXPLAIN/RLS behavior, then schedule the live migration and coordinated UI/Edge deploy.

## Required JWT-role tests

| Subject | Own draft | Another's draft | Explicitly granted quote | Signed outcome list | Unowned legacy |
|---|---|---|---|---|---|
| Salesperson A | read/edit | denied | read only | denied | denied |
| Salesperson B | read/edit | denied | read only | denied | denied |
| Owner / Admin | own read/edit | denied (unless granted) | read only unless owner | signed-only projection | read/edit & audited recovery |
| Viewer | denied unless granted | denied | read only | denied | denied |
| Removed member | denied | denied | denied | denied | denied |
| Different organization | denied | denied | denied | denied | denied |
| Anonymous | denied | denied | denied | denied | denied |

Also verify that old public customer URLs still display their exact frozen/signed revisions after RLS changes (the customer-facing Edge Function is separately token-authorized); revising one quote does not expose another; in-person signing remains owner/authorized-editor only.

## Cutover stop conditions

- Never apply this migration while the role matrix and mobile/desktop smoke tests are unverified.
- Never claim **Salesperson privacy complete** until CRM entity ownership, Board/Connections queries, caches and legacy exports are similarly scoped.
- Never remove the Classic editor before the separate Beta parity approval.
- If any signed customer link, quote numbering, preview, or authorized edit fails, halt the rollout and use the reviewed rollback. Preserve recovery audit history.
