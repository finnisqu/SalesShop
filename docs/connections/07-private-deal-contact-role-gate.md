# Connections Batch 17G — private Deal contact roles (staged)

Branch: `feature/connections-private-deal-roles-batch-7`.
Based on: PR #56 (Batch 17F), commit `8caa546b`.
Production `main` and live Supabase database: **not changed**.

## What the batch does

- Introduces a simple **My Deal contact roles** card in Deal records.
- For a salesperson, an editable label is offered **only when an existing non-archived Quote they own explicitly contains BOTH the Deal's `projectId` and that contact's `contactId`**. This check is repeated in Postgres RLS independently of the client.
- Supported private labels: Estimator, Buyer, Decision maker, Project manager, Other. A blank selection deletes the user's own annotation.
- Records belong to a signed-in user (`owner_user_id`) and tenant, not a Deal globally, and may differ across collaborators.
- The role card is **fail-closed** until the proposed migration is deployed and server permission is verified. Local mode/developer playground does not pretend a role has been saved to cloud.
- Does not grant quote/Deal/CRM access, log activities, guess relationships from company membership, expose other people's contact annotations, change quote totals or amend customer previews.

## Schema and policy

`supabase/migrations/20261015173000_private_deal_contact_roles.sql` adds an isolated `deal_contact_roles` table and four restrictive RLS DML policies. Policies verify:

1. `auth.uid()` is non-null and equal to the role row's `owner_user_id`.
2. The user is still a valid active member of the same organization with editor eligibility.
3. The user actually owns an existing Quote with matching `project_id` and `contact_id`.
4. Contact and Deal composite foreign keys enforce tenant-scoped integrity.

No `public.projects`, `public.contacts`, `public.quotes` or legacy CRM read policies change. Quote owner and membership cannot be asserted by caller-supplied fields. Role revocation is immediate on loss of membership or quote association via the SELECT policy; orphaned/inaccessible physical rows should be cleaned up only as part of a future audited maintenance migration.

**Warning:** Existing cross-organization CRM read grants and broad Owner/Admin access to drafts in the currently deployed quote policy remain separate unresolved privacy risks. This new private table is defensively isolated, but does not make the entire CRM private.

## Security verification and release gate

- Disposable PostgreSQL: `psql -v ON_ERROR_STOP=1 -f tests/security/private_deal_roles_bootstrap.sql`.
- SQL matrix checks own writes, impersonation attempts, wrong Deal or contact, other salesperson reads/edits, Owner/Admin default denial, Viewer denial, outsider denial and revocation after quote re-linking.
- Pure service tests verify client contact candidates use ID-only owned Quote links, not shared-company or archived quotes.
- Before live application, test with REAL signed-in Supabase Auth JWTs in a disposable staging organization, including a user removed from the organization and a revoked Quote grant. Confirm direct REST requests fail for another user's rows. Review migration interaction with the staged private quote-ownership policy.
- Only then manually deploy SQL through an approved Supabase migration process. The client detects readiness; there is no client-only bypass.
- Do not migrate `projectId` or existing CRM records. Do not promote these personal annotations to operational or shared Deal roles without separate ownership and grants policy.

## Follow-on

After strict least-privilege CRM RLS rollout: model genuinely **shared** Deal contact relationships, with scoped owner-controlled grants and role history. That is a different feature from private salesperson labels and must not re-use this table as organization-visible contact intelligence.
