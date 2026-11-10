# External Quote Sent visibility and cloud save — 2026-11-10

## Root cause verified
- The external quote form already had a required **Bid sent date** field. The missing history was not caused by a missing date.
- Supabase `public.activities` RLS previously allowed generic CRM Activity records only if `quote_id IS NULL` **and** the type did not begin `quote-`, or if a native Quote ID was readable by the user. External submissions are `type = 'quote-sent'`, `quote_id IS NULL`, and `metadata.externalQuoteSent = true` by design, so **they were not selectable by normal signed-in clients**.
- In addition, the form closed immediately following a local CRM write, before cloud synchronization acknowledged the Activity; a failed later write could leave the submission invisible after refresh.
- Historical backfills had `occurredAt` on their actual old send date but no logging timestamp. Home Recents sorted them by send date and pushed them out of recent results. The Home Quotes tab previously showed only native SalesShop Quotes.

## Applied changes
1. **Supabase migration applied:** `20261110190538_external_quote_activity_visibility_20261110.sql`. The existing `activities_read_org` policy now admits only clearly marked **external quote sent** events (`quote_id IS NULL`, `type='quote-sent'`, `project_id IS NOT NULL`, `metadata.externalQuoteSent=true`) under the normal organization membership check. Native Quote and change-order events remain protected by quote-specific access.
2. **Cloud-acknowledged recording:** `recordExternalQuoteSent` is asynchronous. In cloud mode it creates and verifies the normalized Activity before updating the local CRM state or reporting success. The form stays open, shows errors, and only completes linked Submit Quote tasks after confirmation.
3. **Idempotent retries:** One submission ID and logging timestamp are retained across retries. If the insert succeeded but an acknowledgement was lost, the next attempt verifies the existing exact submission instead of recording a duplicate.
4. **Date clarity:** The field is prominently labeled **Date sent**, defaults to today or the selected calendar day, can be backdated, and governs the Quote Sent calendar badge. The separate `metadata.recordedAt` value is the time the user logged the historical event; it drives Recent Activity ordering for new submissions. Closed/lost/completed Deal historical backfills continue to leave original stage, amount, and deadlines untouched.
5. **Home navigation:** New backfills appear at the time they are recorded in Recent Activity. The Home Quotes tab now includes up to two latest externally sent Quotes even for legacy entries without a trustworthy logging timestamp; they remain explicitly labeled `Outside SalesShop · Sent YYYY-MM-DD`. Clicking opens editable-linked Activity details, **not** a fake native Quote.
6. **Correct calendar focus:** Completing the form from the calendar navigates to the actual entered send date and focuses the **Quotes sent** badge, even if the date differs from the calendar's previously selected day.
7. **Activity filters:** Explicitly user-recorded external Quote Sent events appear in the Interactions filter; native Quote lifecycle events retain their system categorization.

## Database verification
- Verified RLS policy in PostgreSQL after migration: only external quote-sent records have the new quote_id-null exception. Supabase Security Advisor reported no new warnings targeting this policy.
- During diagnosis, before the RLS correction, the privileged read returned **zero** external quote rows; a subsequent read found **two** existing external submissions, with actual sent dates September 1 and September 25, 2026. Both rows have a Deal and `recordedByUserId` and neither has a logging timestamp. We **did not** fabricate dates or rewrite these user records. Future confirmed submissions include `recordedAt`.
- The old records should be visible in the September calendar days and the Home Quotes tab after reload. They may still sort by the original send date in historical Activity views because their original logging time was not captured.

## QC checklist
1. Reload a signed-in SalesShop session and inspect September 1 and September 25 in Home Calendar. Confirm **Quotes sent** badges (assuming the relevant organization/user owns those Activities), and open each to its linked Deal/Activity.
2. Open Home → Quotes and find the **Outside SalesShop** entries alongside native quotes; open an external submission to verify recorded date, amount and linked records. Open Activity/Recents and use the default All filter.
3. On a temporary Deal, record an external Quote with **Date sent** set to an earlier date. Confirm the popup remains open until save completes, then inspect the selected historical calendar date, badge count, Activity history and Home Quotes list.
4. Disconnect the network before saving; the form must show a cloud error and **must not** pretend the Quote was sent, change the Deal, or complete Submit Quote tasks. Reconnect and retry the same submission. Verify only one Activity exists in Supabase.
5. If the Deal is Completed, Closed Won, Closed Lost, or Discarded, log a backdated external Quote and verify its final stage, amount, old due date, and task state remain unchanged.
6. Confirm a normal native SalesShop Quote lifecycle Activity is still readable **only** when the signed-in user has access to that native Quote. No broad RLS read permission was added.
7. Check iPhone calendar view and external Quote form, portrait and landscape, dark/light themes, and saved data after refresh.
8. Run `npm run test:external-quotes` manually for targeted Vitest coverage. Verify Cloudflare's production TypeScript + existing Quote tests + Vite build. Browser QC and targeted tests require execution separately.

## Limits
- No additional Date field was required or database table added. No historical logging timestamps were fabricated.
- No automatic GitHub CI configuration was changed.
- A past local-only submission that never reached Supabase may require retrying/re-entering it with its original Date sent; do not silently recreate a record without confirming its ID and ownership.
