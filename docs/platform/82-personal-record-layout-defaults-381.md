# #381 — Personal Records Table/Board defaults from CRM Setup

**Scope:** Browser-local user experience, November 2026. Cloudflare build and authenticated browser validation remain separate acceptance checks.

## Behavior

- **Settings → CRM Setup** still saves a design profile using the existing account- and organization-scoped browser key.
- **Records → Companies and Deals** now consult the reviewed profile's `views.companies` and `views.deals` when determining the initial Table/Board presentation.
- If there is no saved profile, Companies still defaults to **Table** and Deals to **Board**.
- Clicking Table or Board in Records (desktop or mobile) creates a **personal manual override** for that directory, which takes precedence over later Setup changes.
- In the Records navigation **More → View**, **Use my CRM Setup default** clears that directory's manual override; subsequent Setup changes again control its default.
- Companies and Deals are independent. Saved table columns, sorts, named views, pagination, pipeline filters and actual CRM records are untouched.
- The previous browser-wide layout preference is migrated only in offline/local mode, never silently imported into cloud identities where its original owner cannot be proven. The migration writes a scoped `{}` marker on reset so a legacy override does not reappear after reload.

## Isolation and guardrails

A new layout-overrides key is scoped by backend mode, authenticated user and organization ID, plus the existing developer-playground namespace. The existing reviewed Setup draft is also read using its exact original scoped key. Corrupt, absent and unsupported JSON values fail closed to built-in defaults. No shared Supabase data, stage schema, permissions or cloud settings change.

**Important:** Only the selected **personal Table/Board defaults** have been activated from the #380 guide. Custom terminology, stage names, record-panel arrangements, optional module plans and custom-field values remain local design/previews and are **not** applied to live CRM records or shared with teammates.

## Acceptance checks

- [ ] Cloudflare TypeScript, quick test suite, record gate and Vite succeed for the exact commit.
- [ ] Owner/user A, org A: save a Setup profile with Company=Board and Deals=Table. Navigate to Records; verify both choices without needing another click.
- [ ] Manually switch Deals to Board. Reload: Deals remains Board, Companies follows the Setup preference.
- [ ] In Settings, change Deals to Board, then back to Table. Manual override should still win. In Records → More → View choose **Use my CRM Setup default**. Deals changes to Table and follows subsequent saved Setup changes.
- [ ] Switch organizations and accounts; their saved choices remain separate; no global override crosses tenants.
- [ ] Without a saved Setup, default to Companies Table and Deals Board; existing local-only browser layout can migrate without losing a manual selection.
- [ ] Test desktop and mobile layout toggles, warm/light/dark themes, and narrow desktop widths. Check old saved table views, filters and pipelines remain unchanged.
- [ ] Role/viewer changes cannot write shared CRM data as a side effect; no Supabase migrations or new external permissions are introduced.

## Next

After authenticated UI review, consider optional **personal** display aliases or a limited per-user panel layout, but only after designing how they coexist with current record sections. Organization-shared configuration and real custom-field data still require an approved disposable staging environment and negative RLS tests (#352c4). Do not run cloud migrations from this batch.
