# CRM creator ownership and reliability sweep — November 10, 2026

## Verified gaps and fixes
1. **People & Companies creator ownership:** Unlike Deals and Quotes, these normalized CRM tables did not have an assignee/owner column. Add nullable `owner_user_id` to `public.companies` and `public.contacts`, with a **future-inserts-only** `auth.uid()` default and an organization-member composite FK. Existing records remain unassigned (confirmed at migration: 14 Companies, 15 People, all NULL). RLS retains the existing organization-wide policies; owner is attribution, not a new privacy barrier.
2. **Domain and local/cloud round-trip:** New cloud Company/Person objects receive the current authenticated user's ID immediately. Normalize local Person records and hydrate both types from new cloud columns. Importantly, `syncNormalizedCrm` deliberately omits the owner column when upserting later edits, allowing SQL insert defaults while preserving existing owners across teammates or stale browser caches.
3. **Visible confirmation:** Company and Person full record pages and quick previews display **Assigned to: You**, **Assigned teammate**, or **Unassigned · existing record**. Local mode shows **You · local workspace**. Existing Deal assignee selection and private Quote owner fields remain unchanged.
4. **Suppliers partial availability:** Fetch independent supplier datasets with `Promise.allSettled`. A failure in pricing history, contacts, locations, or rules no longer hides successfully loaded profiles. Show a visible failure summary with **Retry loading suppliers** on both directory and record pages; avoid state updates after an unmounted load.
5. **Quote cloud Retry:** The existing retry previously changed the selected Quote to force persistence. It now requests a direct retry of the scoped, locally saved document through the active authenticated Cloud Sync instance. Retains normal debounce serialization, retry/error banners and recovery markers. Does not change the active Quote or silently claim an upload succeeded.

## Migration / release sequence
- Supabase migration **20261110164748** (`crm_company_contact_creator_ownership_20261110`) was applied before this frontend release. Verified both `owner_user_id uuid` columns have `auth.uid()` defaults, and legacy rows remain NULL.
- Committed file: `supabase/migrations/20261110164748_crm_company_contact_creator_ownership_20261110.sql`.
- SQL migration is additive; no existing CRM records were rewritten. Do not retroactively backfill ownership from CRM Activities or the viewing user.
- Supabase Security Advisor ran. No new security notices targeted Companies or Contacts. Existing independent warnings include privileged RPC execution policies and leaked-password-protection setting; review separately rather than changing unrelated auth settings in this release.

## QA
1. In a signed-in organization, create one Company and one Person from Connections. Open each full record and quick preview; **Assigned to** should say **You**. Reload and verify the same label remains after cloud hydration.
2. Open an existing Company/Person: should remain **Unassigned · existing record**, rather than being silently assigned to the viewer.
3. Have two teammates open/edit the same Company; owner must not flip when the second teammate saves metadata. Confirm existing org access is not limited by the ownership label.
4. Create a Deal and a Quote: confirm both still default to the signed-in user. Personal Tasks and Notebook pages remain private-scoped.
5. In mobile Connections → Suppliers, let the directory load and open a record. Simulate a failed network request for one dataset; other supplier records should remain visible with Retry loading. Retry after reconnecting and confirm details restore.
6. In a Quote, simulate a cloud-save failure. Tap **Retry**: verify selected Quote/document is unchanged and banner only says Saved after a confirmed successful upload.
7. On phone test repeated modal opening, scrolling, backdrop dismiss, short-height keyboard, and light/dark themes for Supplier records, Company/Person quick previews, and Quotes.
8. Check Cloudflare build, TypeScript, configured Quick Quote tests and Vite. Source regression coverage is `src/services/recordOwnershipAndRecovery.test.ts`; browser QC remains unverified until manually checked.

## Out of scope
- Changing Company/Person ownership after creation, reassignment dropdowns, individual-record visibility or access policies.
- Backfilling historical records or changing shared organization member permissions.
- Background cloud monitoring or periodic blind retries of permanent server-side errors.
- Full mobile browser automation.
