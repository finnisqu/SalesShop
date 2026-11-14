# Batch 345 — First-party CRM relationship creation and partial-save recovery

## Objective

Strengthen Company → Person → Deal → Quote navigation and persistence before authenticated live-device QC. Fix cases where a record was locally created but its relationship could silently fail or be mistaken for a complete save. Preserve native/external quote semantics and keep production data untouched.

## Fix 1 — Contextual Quick Create from Person to Deal

The global/contextual `QuickCreate` previously created the Deal and then **fire-and-forgot** its direct Deal–Person link:

`void links.add(projectId,context.id).catch(()=>{/* Also available under Deal People */});`

That made the new Deal look correctly linked even when the shared relationship was not loaded, the user lacked permission, the network failed, or the remote insert was rejected.

Now the contextual flow:
1. Verifies the originating Person still exists.
2. Determines the account's organization/local link scope using the same `dealPeopleScope` helper as the Record relationship panels.
3. Loads `useDealPeopleStore` **before** creating the Deal, failing visibly if that scope cannot be loaded.
4. Creates the Deal, associates its Company where available, and **awaits** the persisted Deal–Person link before navigating.
5. If the asynchronous link fails *after* the Deal was created, retains the new Deal's ID, displays an error, and offers **Open created record**. A second create request is blocked so the salesperson does not accidentally duplicate the Deal.
6. Locks the Quick Create dialog and its close/drag/submit controls while the asynchronous link is pending, with the existing pending-creation recovery behavior retained.

## Fix 2 — Board Deal quick-create partial saves

The Board's `createDealWithDetails` created a Deal before adding a new Company and its People. If a subsequent Company creation threw, the Board dialog caught only the error message and left the name form available for resubmission, risking a duplicate Deal. Some failed Person creations were not reported; Person link errors used a dismissible `window.alert` after closing the dialog.

Now:
- Board `onCreate` accepts a typed `BoardPartialCreate` containing the **original Deal ID** and a visible warning.
- The Board distinguishes preflight errors (no Deal created, safe to retry) from errors after the Deal ID exists (keep ID and open the existing Deal).
- Optional Company/Person failures return a recoverable partial result; failed Person creation is included in the warning rather than silently skipped.
- The form blocks resubmission, locks the related fields, and shows **Open created deal** to navigate to the same Record. Closing the dialog remains possible.
- Name preflight uses the shared normalized `recordNameKey`, preventing capitalization/multiple spaces from bypassing duplicate checks.
- No new Supabase tables, policies, identities, or quote records.

## Code-based verification

- New `src/services/recordCreateLinkRecovery345.test.ts` contains **6** cases, including a real local-store write/reload of Company, Person, Deal and direct Deal–Person link, duplicate-link rejection, explicit Quote association (not same-name inference), contextual Quick Create pending/error contracts, Board partial-save recovery, and name/Person preflight.
- Existing `QuickCreateActivity.test.ts` was updated for the intentional stronger Board create guard.
- Registered the new test suite under the existing Cloudflare `test:quick-quote` gate, without enabling GitHub Actions or browser checks.
- Targeted source consistency assertions passed. **The new commits' TypeScript/Vitest/Record/Vite build has not yet been confirmed.**

## Read-only live Supabase schema check

On the connected SalesShop project, confirmed (without changing any data):
- `public.deal_people` exists and has RLS enabled.
- Composite primary key `(organization_id, deal_id, person_id)` prevents duplicate organization-scoped memberships.
- Composite foreign keys constrain its Deal and Person to the **same organization**; role length limit is 120 characters.
- `created_at`, `role`, and the IDs match what the client reads and writes.
- Read policy checks organization membership, and insert/update/delete policies require CRM edit rights through the existing `private.can_edit_org_area(...,'crm')` function.
- **This is schema/policy inspection, not authenticated RLS simulation**. It cannot prove a particular logged-in salesperson can successfully insert, nor confirm Cloudflare delivery or cross-device persistence.

## Manual authenticated acceptance (not yet run)

1. In an authenticated organization editor account, open a Person and create a new Deal from the contextual **New** action. After the dialog closes, check the Deal's Direct contacts and the Person's Directly linked Deals.
2. Reload and sign in on a second device/session. Both directions of the Deal–Person link should remain present, and the Deal's Company should be correct.
3. Simulate a failed link (e.g. temporary connection interruption or role permissions). The create dialog should **not** report full success; if the Deal was already created, use **Open created record** instead of creating another.
4. On Board, create a Deal with a new Company, multiple existing/new People, and a bid due date. Verify the Company/People were created/linked exactly once and the deadline appears in the correct salesperson's personal Tasks.
5. If a Board related record fails to save, confirm the original Deal remains available with a recovery message and the form cannot submit it again.
6. Link a new native SalesShop Quote to the Deal, issue it, then confirm customer delivery. Ensure Company/Deal panels and Home show one customer-delivered Quote (issuance alone must not satisfy the bid Task).
7. Record an external builder-portal bid against another Deal; refresh and verify the Quotes register, Home, Activity history and sent-day Calendar share the same evidence without creating a counterfeit native document.
8. Verify cloud account role boundaries: an organization viewer cannot create link memberships; an unrelated organization cannot read or add cross-organization Deal–Person links.
9. Test the creation/recovery dialog on iPhone, Android and WARM/DARK/LIGHT themes, including keyboard, close button, and error-message visibility.

## Next

After Cloudflare confirms green, continue with authenticated browser acceptance and resolve any live connection discrepancies. Next design/functional work is Batch 346 Catalog → Quote pricing-source validation. The multifamily Deal Gantt remains deferred.
