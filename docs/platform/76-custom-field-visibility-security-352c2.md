# Batch 352c2 — Custom-field visibility and publication safety

**NO PRODUCTION MIGRATION APPLIED**

Date: November 16, 2026
Branch: `main`
Status: Client-side blueprint and shared-contract groundwork only. Cloudflare build, authenticated browser QA, and disposable database RLS tests pending.

## Goal

The plug-and-play CRM must allow different businesses to define optional data without exposing confidential fields to every member by default. The initial #352c design left the question of per-field visibility unresolved. This batch defines the visibility model **before** field definitions or record values become live cloud data.

## Three visibility levels

| Setting | Organization viewer | Member without CRM edit rights | Member permitted to edit CRM | Owner/Admin |
|---|---:|---:|---:|---:|
| `organization` — Everyone in organization | Read | Read | Read | Read |
| `crm_editors` — CRM editors and admins | Deny | Deny | Read | Read |
| `admins` — Owners and admins only | Deny | Deny | Deny | Read |

All identities outside the organization, including anonymous and signed-in outsiders, are denied for every level. These are **future database rules**, not controls enforced by the client. Existing browser-only #352b blueprints without a visibility setting are normalized to **`crm_editors`**. Unknown or tampered visibility values fall back to the **most restrictive `admins`** level.

The app uses the established organization membership and CRM area-permission model: `private.is_org_member(organization_id)`, `private.can_edit_org_area(organization_id,'crm')`, and `private.is_org_admin(organization_id)`. UI guidance from role state is insufficient for actual access control. Authorization must be checked by the database for each read and write.

## Source implementation

1. `src/services/crmFieldBlueprint352b.ts` adds `CrmFieldVisibility`, visibility labels/descriptions, safe parsing for older drafts, a reusable role-level display predicate, and a pure `setCrmFieldVisibility` action. Visibility is a blueprint property, not a local storage secret.
2. `Settings → CRM Setup` now includes a visibility selector while defining a field and another beside existing field definitions. The interface clearly says these choices only describe **who may see the field once published**; actual privacy requires database enforcement. Owners/admins can edit design drafts; other perspectives stay read-only.
3. `src/services/crmSharedFieldContract352c.ts` adds `visibility` to proposed organization-shared definition rows and carries it through the immutable-key publication plan. Changes from **more restricted to broader** (admins → editors/team or editors → team) appear in `visibilityExpansionsRequiringReview`, requiring explicit confirmation and server-side RLS/metadata review in the future publishing flow. Narrower visibility does not trigger that expansion warning.
4. Thirteen new behavioral/source tests cover legacy draft migration, invalid/tampered values, each role/permission combination, field-scoped edits, privilege widening and narrowing, source integration, and the requirement to test actual RLS. Existing #352b/#352c source and data contract tests were updated for the new visibility property.
5. No new Supabase client adapter, schema, migration, Edge Function, Auth change, field-value write, user invitation, Quote artifact change or live data mutation was made.

## Database security design: both definitions AND values

An organization-owned custom field has two levels of potentially sensitive data:

- **Definition/metadata**: field name, description, type, enumerated options and whether a restricted field exists. For example, an internal pricing category could itself be confidential.
- **Value**: the actual Company, Person or Deal attribute, which may be more sensitive still.

Therefore RLS for proposed `public.crm_field_definitions` **cannot expose all field definitions to every org member** while trying to hide only `public.crm_field_values`. Both tables need visibility-aware SELECT policies based on the same definition visibility, plus organization membership.

Proposed **policy predicates** (illustrative, NOT executable as a migration):

```sql
-- for the matching definition row d; TO authenticated, with RLS enabled
private.is_org_member(d.organization_id)
AND (
  d.visibility = 'organization'
  OR (d.visibility = 'crm_editors'
      AND private.can_edit_org_area(d.organization_id, 'crm'))
  OR (d.visibility = 'admins'
      AND private.is_org_admin(d.organization_id))
)

-- for a custom field value row v; TO authenticated, with RLS enabled
private.is_org_member(v.organization_id)
AND EXISTS (
  SELECT 1
  FROM public.crm_field_definitions d
  WHERE d.organization_id = v.organization_id
    AND d.id = v.field_id
    AND d.record_type = v.record_type
    AND (
      d.visibility = 'organization'
      OR (d.visibility = 'crm_editors'
          AND private.can_edit_org_area(v.organization_id, 'crm'))
      OR (d.visibility = 'admins'
          AND private.is_org_admin(v.organization_id))
    )
)
```

Because the proposed field definition table would itself use RLS, the `EXISTS` check operates within the caller's accessible definitions. Privileged functions are **not** added to bypass it. The final policy needs review for index support, recursion, timing and correct behavior with `SELECT` policies, then disposable-database execution with role impersonation.

**Write policy separation:** Field definitions should remain owner/admin-managed. A CRM editor can update a custom value only if the field is visible to that editor, the definition is active, the target record matches its composite organization FK, the typed value validates server-side, and the current CRM area edit policy permits it. For an `admins`-only field, a non-admin CRM editor **cannot** write it merely because they have general CRM edit permission. A `viewer` cannot write any values. UPDATE requires its matching SELECT policy and both `USING` and `WITH CHECK` constraints; organization IDs and definition foreign keys must remain immutable.

**Privacy downgrade (widening)**: Changing a field from `admins` to `organization` would make *all existing values* more widely readable. A publishing UI must require explicit admin confirmation, show the count of affected values and projected audience, ensure RLS deployment is verified, and write an audit event. The pure contract flags such changes but **does not authorize or execute them**. Narrowing a field's visibility should immediately reduce read access after RLS enforcement.

**Export and search**: Worktable columns, search indexes, filters, quick views, activities, generated documents, API exports, CSV/Excel downloads, dashboards and automations must fetch only fields authorized for the current account. Never count on hiding a CSS element after downloading unauthorized values. Client caching must be partitioned by organization/user and cleared after role changes.

## Negative security tests required before activation

A disposable Supabase database (no staging branch was connected at #352c) must run the matrix with actual PostgreSQL roles and auth contexts:

1. Anonymous and nonmember cannot SELECT field metadata **or** field values, regardless of visibility.
2. Viewer can read only `organization` definitions and values, but no writes.
3. Ordinary member with no CRM edit rights is treated like viewer for field reads; no writes.
4. Authorized CRM editor can read `organization` and `crm_editors` values, **not** `admins` values or hidden definition metadata.
5. Owner/admin can read each visibility level and manage definitions; changing another org's field is denied.
6. A CRM editor cannot INSERT/UPDATE an `admins` field even if guessed field and record IDs are supplied.
7. RLS refuses UPDATE attempts that move a value or field to a different organization or record type; composite foreign keys prevent cross-tenant references.
8. Paused fields remain readable to the appropriate audience but reject new value writes.
9. A visibility widening from `admins` to `organization` requires a deliberate review path and cannot happen as a side effect of copying a local blueprint.
10. Revoked memberships and narrowed CRM rights take effect from database membership, not stale client `user_metadata` or JWT role guesses.
11. Field values/metadata do not leak via export, search, autocomplete, CSV, quote previews or network requests.
12. After permissions change, cached field values for a previously authorized user are invalidated, and a new user session cannot read them.
13. Verify GRANTs, RLS enabled on both tables, SELECT/UPDATE policies, `WITH CHECK`, and database advisers before release.

## Rollout and constraints

The long-term schema remains additive: `crm_field_definitions` and `crm_field_values` with composite `(organization_id, id)` relationships to Companies, People and Deals. No live CRM table should grow arbitrary tenant-specific columns.

**Release gate:** First pass Cloudflare TypeScript/Vitest/Vite; then provision/attach an approved disposable DB, generate the migration with the current Supabase CLI, run the full deny/allow RLS suite, and review privacy policy and rollback plan. Only then activate shared definitions, values and CRM editors under a separate gated feature release.

Until then, CRM Setup remains **device-local design drafts**, and field visibility is **not a live access-control feature**.

See also [#352c shared custom-field storage design](75-shared-custom-fields-design-352c.md) and the project's `AGENTS.md` for the main-first workflow.
