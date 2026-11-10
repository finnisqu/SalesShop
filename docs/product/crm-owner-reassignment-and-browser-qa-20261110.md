# CRM owner reassignment & mobile reliability QC — 2026-11-10

## Delivered
- **Admin/Owner reassignment:** Full Company and Person record pages show compact *Assigned to* text and an inline **Change** action for organization owners/admins only. Regular members and viewers can see ownership without changing it; role-perspective previews hide the action.
- **Member picker:** Loads the current organization's member roster; teammates are identified by profile display name where available and stable member labels otherwise. Supports assigning to a teammate or deliberately clearing to Unassigned. No popup layer or additional mobile grab handle.
- **Server-confirmed writes:** `assignCrmRecordOwner` verifies role, authenticated identity, organization, UUID, and current record. It updates the normalized row directly with a compare-and-swap condition against the previous owner. A conflict, permission error, unsynced new record, or identity change leaves the local record untouched and shows a retryable message. Generic CRM document sync still omits owner fields to avoid stale-tab overwrites.
- **Database authorization:** Applied migration `20261110171330_guard_crm_owner_reassignment_20261110.sql` creates a **SECURITY INVOKER** private trigger for `companies` and `contacts` on insert/owner update. New CRM records are attributed to their authenticated creator; subsequent ownership changes require a current organization owner/admin. Existing organization RLS and composite owner-member foreign keys remain in force.
- **Browser regression coverage:** `e2e/crm-owner-reliability.pw.ts` covers 320/390px phones and desktop for local Company/Person record ownership, edits, Suppliers directory visibility, crash detection, horizontal overflow and screenshots. Added pure/source tests `src/services/crmOwnerReassignment.test.ts` and kept `recordOwnershipAndRecovery.test.ts` compatible.
- No Deal timeline/Gantt work and no changes to automatic CI configuration.

## Verified in this session
- Cloudflare marked the preceding reliability release `158d24d` successful before this batch.
- Supabase migration applied. PostgreSQL catalogs confirm **both** trigger definitions and that the guard is *security invoker*, not *security definer*.
- A post-migration count confirms the existing 14 Company and 15 Person rows remain unassigned; none were rewritten.
- Supabase Security Advisor shows no additional warnings specific to the owner guard. Existing independent RPC/auth findings are unchanged.

## Manual browser QC (signed-in, without modifying existing customer records)
1. Open Company and Person records as an owner/admin on iPhone. **Change** should appear next to *Assigned to*. Open/close it repeatedly, scroll with keyboard open, try 320px and 390px widths. The picker must stay within the card.
2. Create a temporary Company and Person; their owner should start as **You**. Select another member and press **Save assignment**; only after confirmation should the label change. Reload and confirm the new owner persists.
3. Open that record as a normal salesperson/member or viewer: no **Change** action. Test a direct unauthorized REST ownership update only in a dedicated test workspace; the database must return permission denied.
4. Try transferring a temporary record while another owner/admin changes the assignment in a second session. The older tab should report a conflict instead of silently overwriting.
5. Choose **Unassigned**, save, reload; then select a teammate again. Verify no change to company/deal/quote associations and no cross-organization people appear.
6. Open Suppliers on mobile while offline or with a single failed network response. Available supplier content should stay visible and **Retry loading suppliers** should be actionable.
7. Force a Quote cloud save error, use Retry, and verify the active Quote remains selected. Confirm success only after cloud acknowledgement. Recheck task and Activity bottom sheets for a single grab handle and usable scrolling.

## How to run the automated local-only tests
- `npm run test:crm-ownership`
- `npm run test:crm-ownership:browser`
- All Playwright tests use `VITE_SALES_SHOP_LOCAL_QC=1` through `playwright.config.ts`, never customer Supabase data. Browser screenshots/traces land in ignored `artifacts/`.
- Run the configured Cloudflare build (`tsc --noEmit && npm run test:quick-quote && vite build`) after merging.

## Explicit limitations
This GitHub/Supabase connector session has no interactive authenticated browser access and cannot execute the full local Playwright suite. The source tests are prepared but **not** claimed executed. Signed-in role checks and visual keyboard testing must be verified interactively.
