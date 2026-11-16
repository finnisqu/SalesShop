# Batch #352d1 — Reusable custom-field controls and sample record preview

Date: November 16, 2026  
Branch: `main`  
Status: Source prepared and reviewed. Cloudflare TypeScript/Vitest/record-gate/Vite and authenticated browser/mobile QA pending.

## Product direction

SalesShop should be usable immediately for any organization, with optional business-specific fields that don't fragment the underlying Companies, People and Deals objects. #352b created device-local field definitions; #352c/#352c2 defined shared storage, tenant safety and visibility; #352c3 prepared a **disposable-only** RLS validation kit. No disposable DB is yet connected, so live field writes and shared-publishing must remain disabled.

Instead of claiming a schema that has not passed staging, #352d1 introduces the **reusable field controls** and a realistic **sample record preview** in **Settings → CRM Setup**. Owners/admins can verify the structure and behavior of their designs before production activation.

## Implementation

1. `src/services/crmFieldEditor352d1.ts` shares typed, pure helpers: `activeCrmFieldsForRecord`, `parseCrmFieldInput`, `formatCrmFieldInput`, `applyCrmFieldInput` and `validateCrmFieldForm`. The input adapter converts HTML values to the existing #352b field validation contract and strips values for removed, paused or wrong-record definitions before future saves. Clearing a value deletes its draft key, rather than writing untyped null rows.
2. Added `src/components/CrmCustomFieldEditor.tsx`, a controlled, persistence-free renderer for **Text, Number, Date, Single choice, Yes/No** fields. It respects field IDs, current options, descriptions, active status and intended visibility; shows inline validation errors; handles true/false/unset separately; and supports keyboards, screen-reader labels, focus, disabled mode, and independent draft display for intermediate numeric input. The renderer does not open its own modal or create nested HTML forms.
3. Settings → CRM Setup now includes a **Sample Company / Person / Deal record preview** following the selected category. It shows only the currently active blueprint fields in the current order. Owners/admins can try values and press **Clear sample values**, but there is deliberately no Save to CRM or Publish button.
4. Sample values are kept only in the React session (via directory-scoped local state without a persistence callback), separated by field target and signed-in account/organization scope. Reloading SalesShop discards them; swapping organizations or accounts does not borrow the previous user's sample. Existing field **definitions** still use the separate device-local blueprint preference storage from #352b.
5. The preview clearly states: **Preview only — fictional sample values; nothing is stored in CRM, synced to Supabase or saved to this device**. Non-admin role/perspective sessions see disabled sample controls. No inline credentials or sensitive customer data are requested.
6. `src/crm-blueprint-settings.css` adds theme-token-based responsive styling, 2-column desktop sample fields, 1-column mobile, 44px mobile input/control targets and visible error states.
7. Added 15 behavioral/source/SSR tests in `src/services/crmFieldEditor352d1.test.tsx` and registered them once in the existing `test:quick-quote` Cloudflare gate. Test topics: active target filtering, strict numeric/choice/boolean/date/text validation, clearing and stable IDs, paused field safety, ignoring stale/foreign field values, server-side markup/accessibility, account-scoped ephemeral preview, Settings integration and responsive styling. Source contract checks are a prerequisite, **not** proof the deployed app is green.

## Deliberate boundaries

- **Preview is not a live CRM field:** definitions are still local browser blueprints, sample values are ephemeral and no shared custom values have been written to Supabase. Sample visibility copy is illustrative; actual field privacy requires database RLS and approved migration.
- The renderer can be reused when real record pages are connected, but the future parent form must wire the `onValidityChange` callback and validate the complete form before saving. Client-only checks are defense in depth, not authorization.
- No Supabase migrations, RLS/Auth, production customer data, Quote pricing, signed documents, bid Task completion, external submissions or user membership changes.
- The #352c3 staging SQL under `docs/platform/sql/` remains a **candidate**, not a production migration, and must be executed on an approved disposable PostgreSQL environment before a release claims shared custom field persistence.

## Acceptance after Cloudflare green

1. Settings → CRM Setup: create Company fields of each supported type. Confirm Sample Company displays them with realistic input controls and no unrelated industry fields.
2. Enter text, negative/decimal number, real date, dropdown choice, Yes/No and unset. Invalid values should display a message without updating the typed sample.
3. Pause a definition and verify it disappears from the sample; re-enable and verify its control returns. Switch Companies → People → Deals; only fields for the selected category should display.
4. Press Clear sample values. Confirm values reset. Reload the app and confirm no sample values survive while the field **definitions** remain in device-local storage.
5. Switch organization/account without a page reload. Confirm sample values don't bleed into another user's view.
6. View as a Viewer/nonadmin perspective. Confirm sample controls are read-only, and the UI accurately explains field visibility is future DB-enforced policy.
7. Verify WARM/LIGHT/DARK themes, portrait mobile, keyboard-open view, focus and 44px input targets. Verify no nested submit of the New Field form.
8. Run `npm run build` (`tsc --noEmit`, quick-quote Vitest including this suite, record-gate Vitest and Vite). Check deployed SHA and authenticated smoke testing. Do not treat an empty GitHub status response as a green Cloudflare build.

## Next

If build green, validate the staged PostgreSQL RLS kit on an explicitly approved, disposable target (#352c4). **Only then** consider enabling organization-wide field definitions/values and using these same controls on real Company/Person/Deal records (#352d2). Meanwhile, safe opt-in starter field packs (#352e) can move forward without changing customer data. Future plans remain Proposed Records (#353) and BYOS/email (#354), with multifamily Gantt deferred.
