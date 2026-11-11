# Batch 14E — salesperson-private CRM (STAGED; NOT DEPLOYED)

Source: `supabase/migrations/20261015162000_private_crm_ownership_gate.sql`
Rollback: `docs/security/rollback-14e-private-crm-rls.sql`
CI: `Private CRM RLS SQL QC` on disposable PostgreSQL 17.
Web compatibility: `VITE_PRIVATE_CRM_RLS=1` **only after the SQL migration is deployed and tested**; default OFF.

## Privacy model
- Four independently owned record types: Companies, People/Contacts, Projects, Activities.
- New records acquire the actual signed-in actor's `owner_user_id`. Pre-migration records remain **NULL/unassigned** and retain no invented ownership.
- Owners/admins can read and manage truly unassigned recovery records, but never another salesperson's attributed information by virtue of rank alone.
- Explicit `crm_access_grants` give READ access to an individual existing member for a single entity; sharing a Company does not automatically share People, Projects, Notes, or Quotes. Editing stays with the owner.
- Activities with a quote link must also satisfy quote authorization. Contacts/projects/activities with related parent entities require the requester to have parent visibility.
- An audited `assign_unowned_crm_record` management RPC only assigns genuinely unassigned rows to eligible CRM editors.
- A trigger rejects direct owner changes for existing attributed rows. Owner-to-owner transfer is a **future separate two-party handoff**, not admin reassignment.

## A privileged bypass discovered in audit

Current `merge_crm_company_identity` and `merge_crm_contact_identity` are SECURITY DEFINER RPCs. They update ALL linked contacts/projects/activities/quotes/signatures after only a company-level CRM permission check, regardless of the owner of those linked records.

To avoid quietly defeating salesperson-private quotes, 14E revokes authenticated `EXECUTE` from both functions. **CRM merge buttons must be disabled/hidden when private mode is enabled, then replaced by a row-authorized, audited merge workflow**. This is an intentional temporary restriction, not a UI error to work around.

## Client behavior

- `ownerUserId` is optional in CRM types for legacy compatibility. New signed-in creations stamp the account that actually created the record.
- The normalized CRM loader reads the owner only when that column is available in responses.
- Cloud sync is currently compatible with existing production tables because the owner column is only sent when `VITE_PRIVATE_CRM_RLS=1`.
- With that flag enabled, cached CRM rows without the active actor's exact `ownerUserId` **are not replayed**, including previously organization-wide admin caches.
- This flag is a compatibility/rollout switch, **not an authorization boundary**. SQL policies enforce permissions.

## Release gates (not yet met)

1. Deploy 14B's quote privacy SQL and quote-client changes as a coordinated staged release; confirm all signed-customer links, issuance, quote ownership, cash/pricing and background-sync flows.
2. Rehearse 14E's SQL and the explicit read-only/owner matrix on a disposable Supabase branch with real signed-in test user sessions and PostgREST queries. CI role simulation alone is not sufficient.
3. Confirm UI hides unauthorized CRM and merge actions and remains navigable on Board, Connections and mobile. Confirm CRM identity merges safely fail with a clear message until rebuilt.
4. Test parent-link access, activity linkage to private quotes, joined team members, different tenants, removed members, and on-device cache switching/revocation.
5. Review legacy NULL rows and decide how they are assigned. Never backfill to managers or the first salesperson. Audit all approved assignments.
6. Complete any remaining SECURITY DEFINER, export, file/share and background job checks for indirect access.
7. Only after authentication, isolation, and rollback rehearsals: coordinate production RLS, Edge Function and app flags.

**No live Supabase migration, no staging project, no production `main` mutation has been performed.**
