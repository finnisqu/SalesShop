# Batch 352b — Plug-and-play CRM field blueprint foundation

Date: November 15, 2026  
Branch: `main`  
Status: Source/typed schema and settings draft prepared. Cloudflare build and browser QA pending. **No shared CRM data migration or cloud writes.**

## Product direction

SalesShop should be useful out of the box and expandable for different organizations. We should not make construction/countertop-specific metadata a permanent assumption across all customers. The invariant is **stable core objects and relationships**, with optional organizational configuration layered on top.

**Stable core:** Companies, People, Deals, Quotes, Tasks, Activities, Notebook and the links between them.  
**Configurable layer:** optional custom record fields, named views, record labels, workflow/pipeline templates, per-organization defaults, optional modules and permissions.  
**Future portability:** well-versioned field/module definitions, templates, import/export, organizational migration and controlled deployment.

## Work implemented in #352b

1. Added `src/services/crmFieldBlueprint352b.ts`, a typed, versioned `CrmFieldBlueprint` schema for custom `company`, `person`, and `deal` fields. A field has a stable ID, normalized key, display label, target, type, optional description, optional permitted options, and active state.
2. Supported field types: **Text, Number, Date, Single choice, Yes/No**. A reusable typed `validateCrmCustomFieldValue` validates values for eventual shared record storage. Dates require a real YYYY-MM-DD date; numbers must be finite; choices must match defined options; text is capped at 500 characters; nullable/blank values are allowed. No arbitrary JavaScript formulas, custom SQL, markup execution, or external requests.
3. Safety and schema evolution: built-in CRM identifiers are reserved, custom keys are generated from labels and must be unique within each target object, all IDs/keys remain stable when a field is disabled, single choices require at least two distinct options, up to 20 options per field and 30 custom definitions per target. Normalization rejects malformed/stale device data, unsupported schema versions, conflicting keys and duplicate IDs.
4. Added **Settings → CRM Setup** via `CrmFieldBlueprintSettings`. A business can choose Companies/People/Deals, draft a named field definition, select type/options, see existing definitions, adjust order, and **Enabled/Paused** state. Clear explanatory copy stresses that this is a **design draft**; it is not yet a live field on a customer's CRM record.
5. Owner/admin guard: editing uses Settings' existing `canEditCompany` condition (including local mode and role-preview protection). Others see a read-only configuration preview; there are no client-originated Supabase role/authorization mutations.
6. Persistence is **localStorage and scoped to the current organization/account** using `crmBlueprintStorageKey`. This isolates local drafts across users/organizations on a shared browser. **It does not sync across teammates/devices** or activate custom record values; no false claim of shared configuration.
7. Settings UI uses established theme tokens, cards, label controls, keyboard semantics and 44px phone touch/input sizing. The existing Settings navigation and Company/Branding, Team, Appearance, Quote Beta and Data sections remain unchanged.
8. Added 14 domain/source regression cases in `crmFieldBlueprint352b.test.ts` for empty defaults, account/org separation, key generation, reservation/duplicate rejection, per-target reuse, capacity, valid choices, immutable ID/reordering/pausing, typed values, malformed/stale schema recovery and integration with protected Settings. Registered once in `test:quick-quote`.

## Intentional limitations: not yet a shared custom-fields release

- The UI says **Design draft — This device only**. No custom field values can be recorded on live CRM records yet, and the app does not pretend they can. This avoids telling users that a device-only configuration is shared with their sales team.
- No Supabase table/schema, RLS/Edge, Auth, quote pricing, signed documents, automatic bid submission, CRM core migrations or external integrations changed.
- Production cloud persistence of definitions AND values requires explicitly reviewed organization isolation, ownership, and field lifecycle. We should not place unguarded `customFields` JSON into synchronized customer records merely to produce a visible UI.
- No field is mandatory by default; company-specific requirements, display rules or automations should be opt-in modules or templates instead of universal checks.
- Enabled/Paused in this draft governs the *blueprint's intended activation*, not actual record visibility; current records continue using existing built-in data.

## Plug-and-play rollout design

**#352c: Shared organization configuration, after approval/review.** Define schema-v1 tables or equivalent for `organization_field_definitions` and typed per-record custom values, with composite organization/record IDs, scoped RLS, viewer vs admin boundaries, exact validation, concurrency/history and disaster recovery. Test in a disposable staging environment before touching production. Explicitly separate *personal views* from *organization-owned field definitions*. No silent migrations.

**#352d: Record editor and worktable parity.** Render active fields in Company, Person and Deal editors/inspectors using one shared field renderer, display/sort them as optional Records columns, add search/filter and export with permission and type safety. Preserve partial information.

**#352e: Optional templates.** An empty workspace stays clean; business templates may opt into field packs, pipeline stages, terminology, page sections, lead qualification steps, quote defaults, and workflow automations. Templates should be additive and reversible, with idempotent imports and stable IDs, not tenant-specific forks. Decide individual/team visibility for each module.

**Later:** configurable object labels, forms, workspace-level navigation/modules and BYOS/email integrations; do not redesign the Quote domain or multi-family Gantt before current CRM customization is verified.

## Acceptance once this commit's Cloudflare build is green

1. Settings → CRM Setup on desktop and mobile. Create a **Text** Company field `Territory`, a **Single choice** Deal field `Project Type` with at least two options, and a **Date** Person field. Confirm each category maintains independent fields.
2. Reload Settings, switch between Companies/People/Deals, reorder Company fields, pause and re-enable one; verify stable key and ID, and no live record changes.
3. Try built-in names `Name`/`Email`, duplicate names with punctuation/case differences, empty labels, and a single choice with only one option; verify validation blocks invalid definitions.
4. Sign in as different cloud users/organizations in the same browser and verify drafts don't cross scope. A viewer or owner in role preview cannot edit the blueprint. On another device, the draft is absent (by design).
5. Ensure users see the explicit notice that definitions are **device-local and do not yet affect records**. Editing a normal Company/Deal/Person still operates normally.
6. Verify WARM/LIGHT/DARK settings and mobile keyboard interaction; confirm no native browser form accidentally submits another Settings panel.
7. Run `npm run build` for the commit: TypeScript, `test:quick-quote`, `test:record-gate`, Vite. Verify Cloudflare deployed SHA and authenticated Settings/Records runtime. Do not claim green from a blank GitHub status list.

## Next

First fix any Cloudflare error for #352a/#352b. Then design #352c **real shared custom field storage and role policy** for explicit user review before implementing any Supabase security-sensitive migration. Only after that connect custom values to record editors and Records worktables. The strategic goals remain #353 Proposed Records and #354 BYOS/email. Multifamily Gantt is still deferred.
