# Batch #352c3 — Disposable-only RLS validation kit for custom CRM fields

**NO PRODUCTION MIGRATION APPLIED**

Date: November 16, 2026  
Branch: \`main\`  
Current execution status: **SQL staged in source, not executed against a database.** Cloudflare TypeScript, Vitest, Vite and authenticated UI testing pending.

## Why this batch

SalesShop needs to be plug-and-play across businesses, while keeping a stable Companies / People / Deals core. #352b prepared device-local field blueprints. #352c designed composite-tenant storage, and #352c2 added three intended field-visibility levels. Before publishing live fields, the organization and record boundaries must be checked with actual PostgreSQL RLS and negative role impersonation tests.

A read-only inspection on November 16 confirmed:

- The production project is the existing SalesShop Supabase project. **No disposable Supabase branch is currently connected**; branch listing returned an empty array.
- Core \`public.companies\`, \`public.contacts\` and \`public.projects\` are keyed **(organization_id uuid, id text)**. \`organization_members\` is keyed by organization and user.
- Existing authorization predicates are \`private.is_org_member\`, \`private.is_org_admin\`, \`private.can_edit_org_area\`, and the last predicate uses actual membership/department permissions, not user-edited JWT metadata.
- There is **no justification to run write experiments on production**. No new branch, project or billable resource was provisioned; no SQL migration, policy or function was applied to Supabase.

## Files prepared

- [Staging-only schema and RLS candidate](sql/352c3-staging-only-schema.sql) — two organization-scoped tables, typed columns, three real composite CRM FKs, active-field validation, same-record uniqueness, admin-only definition publication, privacy-aware SELECT/UPDATE/INSERT/DELETE policies, and a guard requiring an explicit disposable-session flag.
- [Disposable role-test matrix for psql](sql/352c3-disposable-role-matrix.psql) — transaction-scoped impersonation of actual \`authenticated\` and \`anon\` Postgres roles with fake \`auth.uid()\` claims. Tests both definition metadata and values for viewer, CRM editor, admin, and outsider, including blocked privacy widening, cross-tenant references and writes.
- \`src/services/crmFieldRlsStaging352c3.test.ts\` — 15 static source/contract checks registered in the existing quick-quote Cloudflare build gate. These check that security constraints and negative tests are present, but **are not a substitute for running the SQL against a disposable DB**.

The SQL files deliberately reside under \`docs/platform/sql/\`, **not** \`supabase/migrations/\`. They must **never be automatically applied** by Cloudflare or a production deployment pipeline. No CLI migration timestamp was invented. The Supabase CLI v3 release changed local-versus-hosted defaults, so a reviewed migration must eventually be generated using the installed CLI's actual \`--help\` and migration workflow.

## Expected RLS and data invariants

| Actor in organization A | Field definition metadata | Field values | Create/update values | Define/pause fields |
|---|---|---|---|---|
| Anonymous or outsider | Nothing from A | Nothing from A | No | No |
| Viewer | \`organization\` only | \`organization\` only | No | No |
| Member without CRM edit access | \`organization\` only | \`organization\` only | No | No |
| CRM-authorized member | \`organization\`, \`crm_editors\` | Same | Only permitted active fields | No |
| Owner/admin | All three levels | All three levels | Permitted active fields | Yes |

The candidate blocks directly widening an existing field's visibility, including admins-only → everyone. That change would reveal *all historical values*, so it requires a separately reviewed and audited server-side publication mechanism; the current device-only field blueprint has no Publish action.

The SQL also rejects: mixed data types in one value row, wrong field-versus-record type, cross-organization record FKs, duplicate values for one record/field, moving an existing value to another tenant or record, changing a published definition's type/key/identity, removing choice options used by stored values, and writes to paused fields.

Definitions themselves are protected. A field named "Internal Cost Category" or its dropdown options must not be readable merely because the actual values are hidden.

## How to run later — **disposable project only**

1. Explicitly approve a temporary project/branch and any associated cost. Clone the baseline SalesShop database schema and required auth/organization helpers into that environment, **without real customer data**. Verify the target's project reference/hostname is **not** production. Do not test this on the existing live Supabase project.
2. Generate schema migration files through the current Supabase CLI once the final SQL is reviewed. \`supabase --help\`, \`supabase migration --help\`, and \`supabase migration new --help\` must be checked before using CLI v3 commands. The supplied SQL candidate is not a ready-to-deploy migration.
3. In a disposable PostgreSQL session, explicitly set \`app.salesshop_disposable_custom_field_test=yes\`. The SQL candidate checks this setting **before** attempting DDL and refuses to overwrite pre-existing custom-field tables. This is an operator safety check, **not proof of target isolation**.
4. Apply the schema candidate on that disposable target only. Verify all constraints, triggers, grants, RLS flags and policies actually compile. Fix and rerun there; do not promote untested SQL into the main migration directory.
5. Seed **only synthetic staging fixtures**: two organizations (A/B); five auth users (viewer, non-CRM member, CRM-authorized member, admin in A, outsider in B); correctly scoped \`organization_members\` rows; one Company in each org, with distinct text IDs; and three **company/text** field definitions and matching values in A with visibility \`organization\`, \`crm_editors\`, \`admins\`. All three must be active. Ensure no unrelated custom fields/values exist in A.
6. Run the psql role matrix using the fixture IDs as psql variables; an example invocation is shown below. It runs all assertions in a transaction and ends with **ROLLBACK**. Failures cause a nonzero exit. The script also refuses to start without the explicit disposable-session flag. The matrix is not self-seeding because existing Supabase Auth test-user and membership fixtures must be provisioned correctly and safely.
7. Add real-world negative cases for paused fields, duplicate record values, unauthorized choices/typed values, a member without CRM edit permission, role revocation, cross-organization \`UPDATE\` with \`WITH CHECK\`, and export/search/API leakage. Review \`pg_policies\`, \`information_schema.role_table_grants\`, and Supabase security/performance advisors. Test newly generated migrations and their rollback path.
8. Only after the deny/allow matrix is green, prepare the actual versioned migration and separate **explicit production rollout approval**. Roll out storage/RLS first with the application feature gated off, then enable organization field publication, record editors and reports in independent acceptance batches.

The following is an **illustrative command only**, with placeholders for the disposable database and synthetic fixture identifiers. Do not paste a real password/connection string into source control or ChatGPT:

\`\`\`bash
# Target must be a manually verified disposable PostgreSQL database.
export PGOPTIONS="-c app.salesshop_disposable_custom_field_test=yes"
psql "$DISPOSABLE_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f docs/platform/sql/352c3-staging-only-schema.sql

psql "$DISPOSABLE_DATABASE_URL" \
  -v org_a="$ORG_A" -v org_b="$ORG_B" \
  -v viewer_uid="$VIEWER_UID" -v limited_uid="$LIMITED_UID" \
  -v editor_uid="$EDITOR_UID" \
  -v admin_uid="$ADMIN_UID" -v outsider_uid="$OUTSIDER_UID" \
  -v field_org="$FIELD_ORG" -v field_editor="$FIELD_EDITOR" \
  -v field_admin="$FIELD_ADMIN" \
  -v company_a="$COMPANY_A" -v company_b="$COMPANY_B" \
  -v ON_ERROR_STOP=1 \
  -f docs/platform/sql/352c3-disposable-role-matrix.psql
\`\`\`

A real RLS test run is still required on PostgreSQL; this package's static checks are not a substitute. Production execution also requires explicit **manual approval** after staging verification.

## Important limits of the current kit

- **No SQL or RLS has been executed or verified on a disposable database.** Source-level assertions alone cannot confirm policy correctness or absence of a security flaw.
- The existing Supabase project remains unchanged. CRM Setup still uses private, device-local blueprints; field visibility is not active authorization yet.
- The staging candidate is a starting point, **not a production-ready migration**. It may need constraint/trigger/grant refinements discovered during actual Postgres execution, a formal audit log for publication, and performance indexing. Do not assume staged SQL is syntactically or security-verified just because Vitest source tests pass.
- This batch does not enable live values, company-shared field definitions, quotes, exports, filters, automatic updates, or integration with connected systems.

## Follow-on milestones

- **#352c4:** Real PostgreSQL disposable-schema execution and role/revocation matrix once an approved test target exists. Fix issues before any live migration.
- **#352d:** One shared custom-field renderer in Company, Person and Deal record editors, with authenticated, visibility-filtered definitions and correctly scoped typed values; optionally view/select/filter custom fields in Records worktables.
- **#352e:** Optional reusable industry-neutral starter packs, configurable terminology and modules—nothing forced onto all customers.
- **#353 / #354:** Proposed Records approval/merge, then BYOS/email workflows. Multifamily Gantt remains deferred.

## Security references

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase CLI v3 breaking change, November 2026](https://supabase.com/changelog/supabase-cli-v3)
