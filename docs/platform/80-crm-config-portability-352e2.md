# Batch 352e2 — Portable configuration drafts and module planning

Date: November 16, 2026
Branch: `main`
Status: Source committed. Cloudflare TypeScript/Vitest/Vite build and browser checks pending.

## Scope

SalesShop's plug-and-play CRM remains an empty stable core. Building on #352e1's optional starter packs, this batch makes a *draft configuration* portable between organizations and devices through explicit JSON copy/paste, with preview and non-destructive apply.

### What changed

- New pure versioned bundle helper `src/services/crmConfiguration352e2.ts`. Export includes only whitelisted field-definition properties (labels, types, options, intended visibility, active state and stable IDs) and four optional module *planning intentions*. No organization or account identifiers, CRM record data, actual customer values, sample values, API keys, arbitrary HTML or executable rules.
- Strict 80,000-character JSON import limit; root schema/version and property allowlists; reject unsupported/extra keys, duplicate IDs/keys, malformed choice options, invalid types/visibility and partial corrupt imports rather than dropping data.
- A read-only import review shows per-field add, already defined or conflicting type; compatible preexisting fields remain entirely unchanged (including choices, active state and intended visibility). A colliding field ID for a *different* key is safely remapped. 30-per-record limit is checked before any write.
- Imports merge **additively**: enabled module planning flags can be carried over but a false incoming flag will never silently turn off an existing local plan. No global app feature flags are modified.
- Settings → CRM Setup includes **Module plans · local draft only** with four conceptual future modules (lead intake, pipeline reviews, project handoff and renewal follow-up). These are planning preferences only, not working routes, CRM forms, automations or backend modules.
- Export JSON can be copied to clipboard where browser permissions allow, otherwise manually selected; import uses a paste box and explicit apply button. Read-only roles cannot perform import/export or alter draft module plans.
- Existing #352b definition drafts remain in organization/account-specific browser storage. New module plans use a separately scoped local browser key. Sample preview values and pending pasted import JSON remain memory-only, each scoped to the active workspace/account. Import notices and errors are also scope-isolated.

### Safety boundaries

**No production database access or migration, no published custom fields, no live Company/Person/Deal edits, no shared workspace toggles, no new CRM task automation.** This source change does not make portable JSON a trusted RLS authorization source; security review and disposable database RLS tests (#352c4) remain prerequisites to any cloud publication or record values.

### Acceptance after deployment

1. On a clean workspace, module plans all start off; custom fields remain empty until manually added.
2. Add General Sales starter pack and plan Lead intake. Copy the export JSON; use it in another browser/organization with a blank local blueprint. Preview and Apply should add four definitions and set only Lead intake planning intention.
3. Apply the same JSON a second time: the preview should show already-defined fields, and Apply should disable if no new changes.
4. Change an existing field's type/visibility/choices; importing a template must not overwrite it, widening visibility or unpausing fields.
5. Corrupt JSON, extra `records`/`values` keys, duplicate field IDs, excessive fields and unsupported versions must be rejected with no partial edits.
6. Viewer/perspective mode is read-only. Check on desktop/phone and WARM/LIGHT/DARK themes.
7. Verify actual deployed SHA, Cloudflare build, typed test suite and logged-in runtime. An unpopulated GitHub status list is not evidence of green.

### Next

**#352c4:** execute the prepared #352c3 SQL/RLS negative role matrix on a *disposable* Supabase/Postgres target approved for testing, then review and amend any failures. Only after that can production shared field definitions/values and live record-editor parity (#352d2) be considered. Additional non-DB configuration work may include verified draft import/export downloads, module catalog metadata, or reversible draft change history.
