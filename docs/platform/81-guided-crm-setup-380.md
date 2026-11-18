# #380 — Guided CRM Setup (browser-local prototype)

**Scope:** Settings → CRM Setup, November 2026. Source delivered for build review; Cloudflare and authenticated browser checks are separate acceptance gates.

## What a user can do

1. Start from **Blank**, **General Sales**, **Construction & Trades**, **Real Estate**, or **Professional Services**.
2. Customize labels for the shared Company, Person and Deal *concepts*, a draft sales pipeline and its 2–9 ordered stages, Table/Board preferences for Companies and Deals, and which record sections appear in the preview and in what order.
3. Select optional Lead Intake, Pipeline Reviews, Project Handoff and Renewal Follow-up **planning intentions**.
4. Preview record sections and stages with fictional examples, and inspect exactly which optional field definitions would be added, preserved or skipped due to type conflict.
5. Save a reviewed configuration to this browser's organization/user scope; reopen and edit it later, or restore the last saved version.

The guide is deliberately layered over **existing** `CrmFieldBlueprintSettings`, `crmStarterPacks352e1` and `crmConfiguration352e2` — not a second CRM store. An opt-in Real Estate pack adds four optional field definitions. It never installs itself on a new workspace.

## Persistence, privacy and integrity

- The existing field blueprint and module plans retain their original scoped localStorage keys. A third scoped `crm-guided-setup-v1` key stores *only* display-name terminology, stage labels, preferred views, panel presentation and opt-in module intentions.
- Save is preflighted using existing additive and all-or-nothing starter pack helpers. Existing custom field IDs, options, visibility, active flags and order are preserved; incompatible types are skipped. Existing planned modules are never silently turned off.
- A best-effort multi-key storage write checks and rolls back browser storage when a key cannot be written; React state changes only on a successful write.
- The guided wizard's unsaved edits, feedback and examples are session-only; the component is remounted on workspace scope changes to prevent one organization's draft being shown in another.
- Only Settings owners/admins may save. Viewers can preview. Authorization in the UI does **not** substitute for cloud database policies.

## What this does NOT enable

This is a **configuration design and preview**, not a new tenant-wide schema. Record terminology, stage options, default views and panel layout do **not** currently mutate live Records. Optional field definitions are not visible or writable on real CRM records yet. Module checkboxes do not create workflows, tasks or background automation. No Supabase schema, RLS, authorization policies, production data, existing quotes, pipeline stages or CAD-Lite integration are changed.

Shared custom-field activation (#352c4/#352d2) and organization-wide pipeline publishing require an explicitly approved disposable test database and negative role/tenant RLS checks first. Do not provision billable resources or apply a migration as part of this UI batch.

## Acceptance checklist

- [ ] Cloudflare TypeScript, quick-quote/Vitest, record gate and Vite complete green for the exact commit.
- [ ] Fresh owner workspace: Blank selected; no optional custom fields installed until **Save local setup draft**.
- [ ] General Sales → customize names, add/remove/reorder stages, adjust layout for Company and Person, choose optional module. Review and save; return to settings/reload to verify the profile and additive field definitions persist.
- [ ] Reapply identical template; verify no duplicate fields. Existing manually modified field visibility, paused state and choice options survive.
- [ ] With a conflicting field type or full 30-field target: observe conflict summary or blocked save, without a partial install.
- [ ] Viewer/perspective: preview works, inputs/save blocked. Switch account or organization and confirm no saved draft leaked.
- [ ] Confirm currently active CRM pages, stages, custom values, automation and user permissions remain unchanged.
- [ ] Test WARM/LIGHT/DARK at 1440, 1100, 820, 760, 390 and 320px for wrapping, dialogs and focus order.

## Next after #380

After device acceptance, prioritize **personal application of saved view defaults** using the existing Records view system and allow opt-in per-user presentation changes without claiming organization-wide publishing. Team-shared custom fields/stages remain blocked on isolated database tests. Gmail v0.1 should be verified with the exact Google OAuth origin; CAD-Lite stays paused.
