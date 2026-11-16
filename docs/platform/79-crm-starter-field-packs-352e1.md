# Batch 352e1 — Optional CRM starter field packs

Date: November 16, 2026
Branch: `main`
Status: Implementation committed in source; Cloudflare build and authenticated mobile/browser checks pending.

## Goal

Make SalesShop plug-and-play without forcing every organization into construction-specific conventions. A new organization still begins with **zero custom fields**. Owners and admins can choose an optional starter pack inside **Settings → CRM Setup**, inspect all proposed fields and add them only to the existing device-local field blueprint.

## Added

- `src/services/crmStarterPacks352e1.ts`: version-1 style static templates for **General Sales**, **Construction & Trades**, and **Professional Services**. Every pack covers Companies, People and Deals, without changing their core identifiers or relationships.
- Explicit per-field preview showing what will be **added**, what **already exists**, and any **incompatible existing type** that will be left alone.
- **Add to local blueprint** is owner/admin-gated, additive, idempotent, and all-or-nothing. Stable template-owned IDs and original blueprint key/type validation protect against duplicates, reserved identifiers and capacity overruns.
- Reapplying a pack never modifies an existing field's label, choices, visibility, paused state or order. Users can pause/re-enable individual definitions using the already existing field controls. Existing manual definitions are preserved.
- Existing sample-record preview (#352d1) immediately reflects newly added fields when switching to the matching Company, Person or Deal target.
- Responsive controls, clear browser-only messaging, source/domain regression tests registered in `test:quick-quote`.

## Strict boundaries

**No shared database changes:** no Supabase schema changes, RLS execution, customer data writes, CRM record changes, new pipeline stages or automatic workflows. Packs only update the device/account-scoped localStorage *definition drafts* from #352b. Sample values remain session-only. There is no team-wide Publish or real-record Save for custom fields.

The SQL kit prepared by #352c3 remains **disposable-only and unexecuted**. Real custom record values and permissions must wait until #352c4 runs the negative RLS matrix against an approved isolated PostgreSQL/Supabase environment.

## Acceptance

1. Open Settings → CRM Setup. Confirm no starter fields are installed by default. Preview each pack and inspect Company/Person/Deal field rows.
2. As an authorized owner/admin, add General Sales. Expect four definitions. Reapply and expect no extra rows. Reload: definitions persist locally; sample values do not.
3. Manually add a field named Lead Source before applying General Sales: the existing definition should be preserved and reported as already present or incompatible, not overwritten.
4. Pause an imported field or set its visibility to Admins. Reapply: no unauthorized re-enable or widening.
5. Reach the 30-definition limit for one target and attempt a pack that adds to it. Expect a clear capacity block and **no partial import**.
6. View as a read-only member or role preview: preview is visible but Apply is disabled. Confirm there are no new CRM record fields or altered Quotes.
7. Check WARM/LIGHT/DARK and phone layout. Run TypeScript + Vitest + Vite, verify the deployed commit and authenticated Settings before calling the build green.

## Next

**#352c4** validate staging RLS in an explicitly approved disposable environment. Until then, safe #352e follow-ons can design template composition, field-pack export/import previews, reversible template revisions and configuration module metadata. Once isolation is validated, proceed with #352d2 real Company/Person/Deal record editing and optional Records worktable fields.
