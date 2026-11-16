# Batch 352c4 — Custom-field RLS execution runbook (disposable only)

Date: November 16, 2026
Branch: `main`
Status: **Prepared, NOT EXECUTED. No production data or schema changed.**

## Environment audit (read-only)

- Only the existing **SalesShop production** Supabase project is available to the connected account. The list of development branches is empty.
- Request to provision a branch was blocked by Supabase's cost-confirmation gate. A branch costs **$0.01344/hour** for this organization (subject to actual compute/usage). **Cost approval is required** before creation. No branch was provisioned and no charge has been authorized.
- No local `psql`, PostgreSQL server or Docker engine was present in the execution environment, so actual database authorization tests cannot be claimed as passed.
- Read-only introspection on production verified the expected composite organization foreign keys and `private.is_org_member`, `private.is_org_admin`, `private.can_edit_org_area` predicate signatures. They use membership stored in `public.organization_members`; the latter uses `job_function` to determine CRM editing rights.
- The live `auth.users` insert hook creates a profile and initial organization for a new user. The disposable fixture deliberately anticipates this behavior; it must not be run on production.

## Added execution assets

1. `docs/platform/sql/352c4-disposable-run.psql`: manually invoked psql runner, operator affirmation required, includes the schema, fixtures and matrices in order.
2. `docs/platform/sql/352c4-disposable-fixtures.psql`: deterministic fake auth users, two test organizations, membership roles (viewer, purchasing-only, CRM salesperson, admin, outsider), Company/Person/Deal placeholders, three visibility-scoped definitions/values. No customer identities or records. This installs fixtures only on the explicitly selected **disposable** database.
3. `docs/platform/sql/352c4-disposable-negative-matrix.psql`: read-only RLS/grant assertions, positive editor/admin controls, negative hidden-field writes, cross-target/type/choice/immutability/uniqueness checks, paused-field writes, and revocation based on the actual membership table. The matrix wraps all temporary writes in a transaction and rolls them back.
4. Existing `352c3-disposable-role-matrix.psql` still covers read visibility for viewer, non-CRM member, editor, admin, outsider and anon; plus visibility widening and cross-tenant FK rejection.
5. `src/services/crmFieldRlsExecution352c4.test.ts`: static contractual guards, registered in the existing quick-quote build gate. **These do not execute Postgres and must never be reported as a successful RLS validation.**

## Operator run sequence (after explicitly approving the branch cost)

1. Create a **fresh disposable Supabase branch**, receive its new branch `project_ref`, and verify it differs from the production ref. The Supabase branch is schema-only; production customer records should not be copied.
2. Verify expected migrations/columns/roles on that branch, including `public.organizations`, `public.organization_members`, `public.companies`, `public.contacts`, `public.projects` and the three `private` authorization functions.
3. Connect `psql` using **branch-only credentials**, under an operator with permission to seed disposable `auth.users`; never put a database password in source control.
4. Run the SQL scripts from the repository root:
   ```bash
   psql "$DISPOSABLE_DB_URL" -X -v disposable_confirmed=1 -f docs/platform/sql/352c4-disposable-run.psql
   ```
   **DO NOT** use a production connection URL. The operator flag is a safety reminder, **not a cryptographic proof of isolation**.
5. All SQL assertions must exit successfully and the negative matrix must report rollback. A failure means **STOP**; revise the candidate schema only in `docs/platform/sql/` and reset the disposable branch before retrying.
6. Check database advisor output, table grants, actual RLS policy SQL, authentication contexts, and verified execution logs. Document observed PASS/FAIL, branch reference, disposable status and test date.
7. Delete the disposable branch when testing is complete to stop charges. **Do not merge/rebase it into production.**

## Release hold

The candidate `352c3-staging-only-schema.sql` is not in `supabase/migrations/`. No application code should expose live custom-field writes, field publication, or data exports based only on client display permissions. The next release gate requires:
- Explicit authorization of test-environment charges.
- Actual disposable Postgres role and negative tests passing.
- Security/performance advisors reviewed and any findings resolved.
- A separately reviewed production migration and staged rollout.
- Successful TypeScript, Vitest, Cloudflare build and authenticated mobile/desktop runtime tests.

Until then, #352c4 is **staging test preparation**, not a passed security gate.
