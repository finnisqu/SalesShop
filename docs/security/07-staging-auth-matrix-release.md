# Batch 14F — production-safe staging test and cutover plan (NOT EXECUTED)

**Status:** Security test script and manual GitHub Actions workflow committed; no Supabase branch created, no live SQL applied, no test logins provisioned, no Edge Function deployed.

## Cost / permission gate

The connected SalesShop Supabase organization reports a **development-branch cost of $0.01344 per hour** at the time of the check. A Supabase branch may accrue charges while it exists. Before creating the branch, ask the workspace owner to acknowledge the cost and select the existing SalesShop Supabase organization (`zwlgeicjqtvxfbldvrvh`) and project (`pvchgibllozuwickhfqz`), then use the Supabase tool's actual cost confirmation flow. Never treat a broad "continue development" message as approval for a billable recurring resource.

The GitHub Actions workflow is `workflow_dispatch` only and uses the protected `sales-shop-privacy-staging` environment. GitHub generally requires workflows to be registered on the repository's default branch before manual UI dispatch; **do not alter frozen `main` just to expose the workflow**. Until it can be registered through an approved workflow, run `node scripts/security/staging-role-matrix.mjs` in a trusted CI/staging environment with the same environment variables.

## Staging setup steps, after cost consent

1. Create a Supabase **development branch**, not a duplicate in the live database. Check it's active, empty of customer rows and has its own URL/API keys. The authentication script explicitly rejects the production host `pvchgibllozuwickhfqz.supabase.co`.
2. Inspect migration history and apply 14B staged private quote ownership first, then 14E private CRM ownership. If the branch inherits newer migration history, don't rerun duplicate DDL blindly. Preserve a schema comparison and confirm both RLS helper function bodies.
3. Deploy `shop-outcomes` **to staging only** with JWT verification enabled; verify `quote-share-admin` and `quote-share-public` staging flows separately.
4. Make disposable seeded test companies, contacts, projects, activities, quotes, one real immutable signed revision and a separate unsigned draft. Give `salesperson_b` a deliberate READ-only grant for a separate A-owned quote, not the private A draft.
5. Create staging-only verified Auth accounts for Owner, Admin, Salesperson A, Salesperson B, Viewer, and a different-company Outsider. Use no real employee/customer login or personal content.
6. Supply all `STAGING_*` values expected by the test script through secret management (never in source or shell history). Set `STAGING_RELEASE_ACK=disposable-auth-fixtures` only for this isolated test.
7. Execute `node scripts/security/staging-role-matrix.mjs`, assert all authenticated PostgREST and Edge Function checks succeed. Also test denial after removing a member, quote-share expiration/revocation, new signed snapshots, email confirmation, and session switch on two browsers.
8. Run Classic and Beta mobile/desktop smoke tests: new draft, estimate, issue, signed receipt, unsigned draft remains invisible to leadership, Board and Connections show only explicitly authorized CRM, legacy unassigned recovery, and restricted company/contact merge messaging.
9. Switch the cloud client to private CRM mode (`VITE_PRIVATE_CRM_RLS=1`) **only in staging**. Ensure the view defaults only to signed Shop Outcomes (`VITE_SIGNED_SHOP_OUTCOMES=1`) after staging API proves available.
10. Review database advisors, migration and rollback plans, subscriptions/realtime/export paths, cache purges, RPC grants, and verified join/invite/removal cases. Only then schedule a coordinated live release.

## Exact smoke-test roles

| Role | Own quote | Another salesperson draft | Explicit read grant | Own CRM | Someone else's CRM | Shop Outcomes |
|---|---|---|---|---|---|---|
| Salesperson A | Read/edit | Deny | Read-only | Read/edit | Deny | Deny |
| Salesperson B | Read/edit | Deny | Read-only | Read/edit | Deny | Deny |
| Owner / Admin | Own | Deny | Read-only | Own | Deny | Signed-only |
| Viewer | None unless granted | Deny | Read-only | None unless granted | Deny | Deny |
| Removed member | Deny | Deny | Deny | Deny | Deny | Deny |
| Outsider | Deny | Deny | Deny | Deny | Deny | Deny |

Historical unassigned CRM/quotes are an explicit admin-only recovery category; never attribute those records automatically.

## Read-only staging matrix implementation

`scripts/security/staging-role-matrix.mjs`:
- fails before calling any service unless all fixture values exist;
- refuses invalid hostnames and the exact live SalesShop Supabase hostname;
- signs in through six **real** staging Auth users, not simulated `auth.uid()` transaction roles;
- directly checks PostgREST visible rows and `can_access_quote` read/edit RPC;
- checks signed-only Shop Outcomes membership and response allowlist;
- reports only PASS or role/field assertion names, never customer details, access tokens, or credentials;
- does not mutate records.

The initial test does **not** automatically verify removal/revocation across sessions or full public customer signing; those need a separate seeded integration suite and explicit checks in steps 7–10.

## Known prerequisites still blocking live activation

- Staging branch cost approval, creation, seed users and signed test fixtures.
- CRM identity merge/duplicates are currently intentionally restricted under the 14E SQL; UI needs an approved secure replacement before that workflow is re-enabled.
- The RLS rollouts and UI/client flags must be atomic or coordinated to prevent failed sync and misleading visibility.
- Legacy browser caches may need an explicit purge/rehydration action when switching from broad admin reads to owner-only policies.
- A final product review must resolve whether sales leadership requires any *non-private* additional operational metrics. Do not bring draft quotes or staff activity back into Shop Outcomes just to populate management dashboards.

**Do not cut over without staging success and a user-authorized live change window.**

## Immediate next action

Obtain consent for the Supabase development branch's hourly charge; then create the isolated branch and execute real Auth tests. No work on Classic/Beta parity (Batch 15) until the user shares their upcoming feature ideas.
