# Batch 352c — Shared custom-field storage and tenant-isolation review

**NO PRODUCTION MIGRATION APPLIED**

Date: November 16, 2026  
Status: Read-only production schema/RLS inspection completed; typed client contract and test suite prepared for `main`. No new tables, policies, functions, grants, RLS changes, or customer-field values have been deployed. Cloudflare TypeScript/Vitest/Vite and staging PostgreSQL RLS tests pending.

## Goal

SalesShop should be a plug-and-play CRM: a stable Companies / People / Deals / Quotes / Tasks / Activity core, plus optional business-specific definitions that can eventually be published across an organization. Avoid a company-specific fork of the database or hardcoded countertop-only requirements.

The immediate task is a safe organization-wide *data and policy contract*. The #352b Settings → CRM Setup UI stays a **device-local blueprint** until this schema passes real disposable-DB security tests and is approved for activation.

## What the live read-only audit established

- Existing `public.companies`, `public.contacts`, `public.projects` all use composite primary keys **(organization_id uuid, id text)**, not globally unique record IDs. A plain `record_id` column without a composite FK is unsafe for tenant isolation.
- `public.organization_members` uses **(organization_id, user_id)**; roles are **owner, admin, member, viewer** and departments include general, salesperson, estimator, purchasing, project_manager.
- Company/Person/Deal RLS reads use `private.is_org_member(organization_id)`. CRM writes use `private.can_edit_org_area(organization_id,'crm')`. The private admin predicate `private.is_org_admin(organization_id)` governs organization settings.
- The 3 private functions are already part of SalesShop’s established authorization surface, but they are SECURITY DEFINER and must be audited before relying on them for new policy grants. No new SECURITY DEFINER helper is proposed here.
- Live database security advisories include existing warnings for security-definer endpoints such as invitation preview; these are pre-existing findings, not introduced by #352c. Their remediation should be reviewed independently rather than silently changing sign-in/invite flows.
- No disposable Supabase branch is configured. The production project was inspected with read-only metadata queries only; **no SQL DDL or DML was executed**.

## Proposed organization-wide tables — design, NOT a deployable migration

**Tables:** `public.crm_field_definitions` and `public.crm_field_values`. One set for all industries. Every field belongs to exactly one organization and core record type; values have actual composite FKs to their matching core record table, not a weak polymorphic ID.

**Definition columns**

- `organization_id uuid NOT NULL REFERENCES public.organizations(id)`
- `id text NOT NULL`; primary key `(organization_id,id)`
- `record_type text NOT NULL CHECK (record_type IN ('company','person','deal'))`
- `field_key text NOT NULL` (stable, normalized, <=40 chars, reserved names rejected)
- `label text NOT NULL`, `field_type text NOT NULL` from text/number/date/choice/boolean
- `description text`, `options jsonb NOT NULL DEFAULT '[]'`, `active boolean NOT NULL DEFAULT true`
- `revision bigint NOT NULL DEFAULT 1`, `created_at`, `updated_at`, optional `created_by uuid`
- Unique `(organization_id,record_type,field_key)` and `(organization_id,id,record_type)` for FK matching.
- Immutable once published: `organization_id`, `id`, `record_type`, `field_key`, `field_type`. Rename the label or pause a field, never repurpose its stable key. Type migrations require a deliberate explicit migration rather than an in-place type flip. A choice option removed from a published definition requires checking for existing values first.

**Value columns**

- `organization_id uuid NOT NULL`, `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `field_id text NOT NULL`, `record_type text NOT NULL`
- Nullable `company_id text`, `contact_id text`, `project_id text` — **exactly one** is set, matching `record_type`.
- Nullable typed `value_text text`, `value_number numeric`, `value_date date`, `value_choice text`, `value_boolean boolean` — **exactly one** is set. Clear is a DELETE of the value row; no “unset” JSON objects are written.
- Foreign key `(organization_id,field_id,record_type)` → `crm_field_definitions(organization_id,id,record_type)`.
- `FOREIGN KEY (organization_id, company_id)` → `companies(organization_id,id) ON DELETE CASCADE`
- `FOREIGN KEY (organization_id, contact_id)` → `contacts(organization_id,id) ON DELETE CASCADE`
- `FOREIGN KEY (organization_id, project_id)` → `projects(organization_id,id) ON DELETE CASCADE`
- Partial unique indexes by (organization_id, [correct record ID], field_id) guarantee one value for a field on each record.
- Database-side **SECURITY INVOKER** write validation is required: correct typed column for the published field; text length, finite numbers, valid dates and allowed choice values; row cannot be modified to reference a different tenant/target; reject writes while a definition is paused. All constraints/validators must be installed in the same migration as the tables. The TypeScript layer alone is not sufficient.

Illustrative **constraint pattern** (not yet a complete migration):

```sql
-- Proposed shape only; DO NOT run this snippet against production.
CONSTRAINT one_target CHECK (
  (record_type='company' AND company_id IS NOT NULL AND contact_id IS NULL AND project_id IS NULL)
  OR (record_type='person' AND company_id IS NULL AND contact_id IS NOT NULL AND project_id IS NULL)
  OR (record_type='deal' AND company_id IS NULL AND contact_id IS NULL AND project_id IS NOT NULL)
),
CONSTRAINT one_typed_value CHECK (
  num_nonnulls(value_text,value_number,value_date,value_choice,value_boolean)=1
),
CONSTRAINT tenant_and_definition_fk
  FOREIGN KEY (organization_id,field_id,record_type)
  REFERENCES public.crm_field_definitions(organization_id,id,record_type),
CONSTRAINT company_tenant_fk
  FOREIGN KEY (organization_id, company_id)
  REFERENCES public.companies(organization_id,id) ON DELETE CASCADE,
CONSTRAINT contact_tenant_fk
  FOREIGN KEY (organization_id, contact_id)
  REFERENCES public.contacts(organization_id,id) ON DELETE CASCADE,
CONSTRAINT project_tenant_fk
  FOREIGN KEY (organization_id, project_id)
  REFERENCES public.projects(organization_id,id) ON DELETE CASCADE
```

**Why not one JSONB column on each CRM record?** Shared typed definitions would be harder to validate, index, migrate, filter and expose securely, and could accidentally fold business-specific fields into the invariant core. Typed value rows also preserve cross-organization FK integrity when records carry text IDs.

## Proposed RLS and Data API grants — review before activation

New `public` tables must have RLS **enabled before exposure**, and explicit grants should revoke automatic `anon`/PUBLIC privileges. The policy model should reuse existing membership/area predicates, with scoped `USING` **and** `WITH CHECK` on updates.

| Action | Field definitions | Field values |
|---|---|---|
| Signed out / anon | Deny | Deny |
| Signed-in outsider | Deny | Deny |
| Viewer in organization | Read | Read, subject to future per-field privacy policy |
| Member in organization | Read | Read; edit only if `private.can_edit_org_area(organization_id,'crm')` |
| Owner / admin | Read, create, update/pause (no ordinary hard delete) | Read; edit/delete under existing CRM edit predicate |
| Same user, other organization | No cross-tenant access | No cross-tenant access |

Policy intent (NOT a complete executable policy migration):

```sql
-- RLS select: member-only for each NEW table, TO authenticated
USING (private.is_org_member(organization_id));

-- Definition INSERT: only an organization admin, TO authenticated
WITH CHECK (private.is_org_admin(organization_id));

-- Definition UPDATE: admin, both USING and WITH CHECK
USING (private.is_org_admin(organization_id))
WITH CHECK (private.is_org_admin(organization_id));

-- Value INSERT: CRM editor, TO authenticated
WITH CHECK (private.can_edit_org_area(organization_id, 'crm'));

-- Value UPDATE: CRM editor, both USING and WITH CHECK
USING (private.can_edit_org_area(organization_id, 'crm'))
WITH CHECK (private.can_edit_org_area(organization_id, 'crm'));
```

Table grants should give authenticated **SELECT** for definitions and values, INSERT/UPDATE for definitions, and INSERT/UPDATE/DELETE for values; exclude ordinary definition DELETE, TRUNCATE, REFERENCES and privileged operations. Revoke public/anon access explicitly and avoid broad default grants.

**Privacy design decision before release:** The existing organization-wide CRM read policy lets all organization members read all ordinary Companies/People/Deals. If custom fields might contain confidential values (e.g. payroll or internal pricing), design a field-level visibility model *before* broadening read access; “custom field” must not automatically mean globally visible. Until that is decided, only general non-sensitive custom fields should be enabled, or release should remain blocked.

## Client contract now prepared

`src/services/crmSharedFieldContract352c.ts` defines:
- `SharedCrmDefinitionRow`, `SharedCrmValueRow` matching the proposed scoped typed columns.
- `planSharedCrmFieldPublication` to preview creates, updates, unchanged fields and choice-option removals needing value reconciliation; never automatically deletes published fields absent from a local draft.
- `buildSharedCrmValueOperation` to validate type, active status and target, then prepare exactly one typed column or a scoped delete operation.
- `decodeSharedCrmValue` to reject wrong organization/record/field/target and mixed typed columns.

All are **pure helpers** without Supabase calls. `CrmFieldBlueprintSettings` continues to store only device-local drafts. No publish or customer-field editing button is enabled.

## Required disposable-environment authorization tests

Before approval, generate a migration using the version-appropriate Supabase CLI (CLI v3 changed defaults in November 2026), run it only on a disposable DB, and add automated SQL/RLS tests including:

1. Anonymous and unassigned authenticated users cannot SELECT or WRITE either table.
2. Org A member cannot read Org B definitions/values, even if record IDs and field IDs match.
3. Viewer can read permitted fields but cannot INSERT, UPDATE, DELETE values or definitions.
4. Regular CRM editor cannot change field definitions; owner/admin can publish and pause.
5. A user who changes `organization_id` on UPDATE is rejected by policy AND immutable-identity constraint.
6. Cross-tenant record assignments fail composite FK, even with a valid authenticated account.
7. Person field cannot be attached to a Deal row (definition composite FK / one-target constraint).
8. A deleted Company/Person/Deal cannot leave an orphan custom value.
9. One field cannot have two values on one record; no mixed text/number/date/choice/boolean row.
10. Choice values outside permitted options, invalid numeric/date/text, and writes to paused fields fail at the database boundary.
11. Removing an option used by saved values fails or produces a review plan; never silently remap customer data.
12. Revoked org membership/role change is enforced from DB membership, not stale client JWT or user_metadata.
13. Check GRANT exposure and RLS with `supabase test db` and security/performance advisors; test selective UPDATE visibility.
14. Re-run authenticated CREATE/READ/UPDATE/DELETE smoke tests for existing CRM, Quotes, Tasks, and invite/ownership workflows before deployment.

**Rollback:** Preserve a backup and tested restoration path. Do not drop field tables or definitions during an urgent rollback if they contain customer values; disable application activation first. Changes must be additive and backwards compatible with clients that know nothing about custom fields.

## Release criteria

- User approves the proposed policy and storage semantics.
- Disposable testing environment is available and SQL allow/deny matrix passes, including a negative cross-tenant test.
- A real migration file is generated through the current Supabase CLI workflow and code-reviewed; migrations, explicit GRANTs, RLS, validation functions/triggers and indexes ship together.
- Supabase advisors and TypeScript/Vitest/build gate pass.
- New tables are first deployed without enabling client writes, then gated UI publishes definitions and editors record typed values in a separately reviewed release.

Until these conditions are met, **#352c is schema review and contract groundwork, not a live custom-fields feature**. #352d can then connect verified fields to record editors, filters, table columns and exports. #352e remains optional business template packs.

## Sources

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Securing the Data API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase CLI v3 breaking-change notice](https://supabase.com/changelog/supabase-cli-v3)
