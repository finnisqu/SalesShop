# SalesShop private Deal roles — real-auth staging release runbook

Updated October 15, 2026. **No production access-control migration has been applied.**

## Stage readiness

The connected Supabase project list currently exposes **only** SalesShop's production project (`pvchgibllozuwickhfqz`). Its development-branch list is empty. The previously discussed Supabase development branch was deferred. No staging project can therefore be safely assumed or silently provisioned. The staging workflow has deliberately **not** been dispatched.

The real-auth suite is written for a **separate** isolated project and explicitly refuses the known live host:
`scripts/security/staging-role-matrix.mjs`, launched only via
`.github/workflows/supabase-staging-privacy-matrix.yml` on a manual `workflow_dispatch`.

## Minimum safe staging preparation (needs separate project)

1. Choose/approve a separate Supabase project and organization. Do **not** link production customer data, clone secrets, or restore a production dump.
2. Apply the *reviewed* quoted-private ownership, CRM-privacy, operational outcome and private role migrations in the intended sequence to that isolated environment. The private role migration (`20261015173000_private_deal_contact_roles.sql`) is **not self-sufficient** to make the existing CRM tables salesperson-private.
3. Provision disposable test users: Owner, Admin, Salesperson A, Salesperson B, Viewer, and an outsider in a second organization. Seed private, shared and signed test records with no real customer identities.
4. Seed **exactly one** row in `deal_contact_roles` for Salesperson A with `deal_id=STAGING_PRIVATE_PROJECT_A`, `contact_id=STAGING_PRIVATE_CONTACT_A`, `owner_user_id` matching Salesperson A's test Auth user and role `Estimator`. The underlying quote must have the same IDs and be owned by Salesperson A. No other seeded role row should exist on that deal.
5. Populate all `STAGING_*` secrets already defined in the protected `sales-shop-privacy-staging` GitHub environment. Never publish test passwords or session JWTs in logs.
6. Dispatch `Supabase Staging Privacy Role Matrix` manually only after the project and environment are independently verified. All tests execute through genuine Supabase Auth identities and direct PostgREST/Edge requests. The script is **read-only**.
7. Observe the role matrix: Salesperson A sees one Estimator role; Salesperson B, Owner, Admin, Viewer and outsider see zero. Direct reads of the other person's quote, CRM records and signed-outcome projection must remain restricted. Execute cross-user mutations and revoked-member tests separately in an isolated **write-enabled** staging job before production readiness.
8. Record immutable action logs, migration hashes, results, role matrix outcomes, cache and rollback plan. An approval to merge UI code is **not** permission to deploy SQL.

## Required post-staging gate

- Authenticated cross-user INSERT/UPDATE/DELETE and stale-role revocation.
- Removed organization member and revoked quote access in a fresh JWT session.
- Existing signed customer documents and public shares still usable.
- Full browser responsive/keyboard regression, including HOME↔Quote Beta and Deal records.
- Verify live CRM/quotes privacy policy rollout separately; account membership alone is not an acceptable authorization boundary.

**Deployment remains blocked** until these tests and human cutover review pass. No branch, table, migration or operational customer record was modified in the connected production Supabase project by this work.
