# Batch 14C — signed-only Shop Outcomes UI (off by default)

## What is ready

- `ShopOutcomesWorkspace` is independent of quote, CRM, signature and employee-activity stores.
- It requests signed operational records from the `shop-outcomes` Edge Function, rather than inferring results from cached drafts or team quote totals.
- The client makes a **second allowlisted copy** of returned objects, discarding unapproved/private keys even if the server unexpectedly returns them.
- Switching users or organizations clears previously loaded records and ignores the prior request's delayed response.
- Desktop Classic and Quotes Beta can both show the same signed-only view in place of the existing Team Quotes pane.
- The default flag is off. When off, existing navigation/workflows remain unchanged.

## Enablement

Build with `VITE_SIGNED_SHOP_OUTCOMES=1` **only after** all of the following are complete:

1. Deploy and authenticate-test the `shop-outcomes` Edge Function with JWT enforcement; verify owner/admin vs member, viewer, revoked member and cross-organization results.
2. Complete the salesperson-private RLS migration on quote rows and related artifacts, and finish cloud sync/cache and quote-owner-assignment compatibility work.
3. Finish private ownership of CRM Companies, People, Projects, and Activities or explicitly accept that privacy migration remains incomplete. Do not present the UI as proof of full privacy.
4. Validate signing a disposable customer quote, viewing its signed result in Shop Outcomes, and ensuring an unsigned draft never enters the feed.
5. Confirm browser layouts for owner/admin on desktop and phone, zero-results view, error/retry state and role switching.

The client only displays up to 100 records (the backend's current limit), and labels the amount as the **value in results**, not company lifetime revenue. Add cursor paging and a ledger design before using this for exhaustive management reporting.

## Security properties

The feature flag is strictly a presentation/navigation rollout control, **not** an access boundary. Server checks and database policies remain mandatory. The signed-only screen contains no quote rows, line items, customer contact fields, private activity, employee rankings, or internal pricing.

**Not applied:** No production main changes, no Supabase function deployment, no SQL migration, no real customer record changes.

## Dependencies

- Batch 14A merged: `supabase/functions/shop-outcomes/index.ts`
- Batch 14B PR #36: `supabase/migrations/20261015151800_private_quote_ownership_gate.sql` (staged; not applied)
