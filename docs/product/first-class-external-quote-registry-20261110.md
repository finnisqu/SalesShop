# External bids as first-class SalesShop Quotes — 2026-11-10

## Product rule
One submitted bid is one quote record, regardless of how it was priced or delivered:
- **SalesShop:** fully editable, revision-aware, customer-previewable native Quote document. Keep the native quoting workflow as the favored full-featured option.
- **External:** valid submitted quote originating in a builder portal, spreadsheet, or other tool. Preserve its amount, actual sent date, platform, owner, and linked Deal/Company without fabricating an editable native Quote, sales contract, revision, or signature.

A quote's *source* describes its authoring tool, not its importance as sales work.

## This batch
- PostgreSQL read-only `public.sales_quote_registry` view combines native unarchived `public.quotes` with explicitly marked external `public.activities` quote-sent submissions. **`security_invoker=true`** means underlying Quote/Activity/Deal RLS is enforced for each viewer; `anon` has no view access. No duplicative copy, invented status, or backfill mutation.
- New `salesQuoteRegistry.ts` derives matching native/external quote records for client UI, with unique `native:` and `external:` keys, source, title, Deal/Company, amount, date, status, salesperson and platform. Native totals remain calculated by the existing quote pricing model; external totals use the submitted contract amount.
- **Primary Quotes workspace:** external entries now appear in the standard All and Issued document table and responsive cards, searchable by Deal, customer, platform and amount. Clicking an external entry opens its existing CRM Activity detail modal. The normal native template builder and editor remain unchanged. External records cannot use native Archive/Delete actions.
- **Connections → Quotes directory:** one searchable and sortable table shows both sources. External quote rows link to an Activity detail modal; native rows retain native quote metadata previews. Bulk follow-up task creation uses the linked Deal when the quote is external rather than inventing a native quote ID.
- **Company and Deal records:** both sources appear under a single Quotes section, counted together and clickable. Company/Deal list counters include external submissions once per submission ID.
- Home Activity, calendar quote-sent badges, and successful external cloud acknowledgement remain as implemented in the previous release; no Gantt/timeline work or automatic CI configuration changes.

## Database verification
- `sales_quote_registry` view migration applied and inspected. In this environment, querying the view after migration returned existing external submissions; `public.quotes` currently has zero normalized native rows, so native branch cannot yet be exercised against live data.
- Security Advisor reported no new findings referencing `sales_quote_registry`.
- Migration on GitHub should be named `supabase/migrations/20261110192526_sales_quote_registry_20261110.sql` to match the applied Supabase migration.

## Focused QA
1. Open **Quotes → All** on phone and desktop: external submissions are in the same table/card list as native documents, identified **External · [platform]** and **Sent**. The **Issued** filter includes them; Drafts and template-specific builder tabs do not show them.
2. Open external record: it should show the recorded amount, original date sent and linked Deal; it should **not** open a bogus empty quote editor or offer native Archive/Delete.
3. Open **Connections → Quotes** and search by builder name/platform. Follow external row into Activity details; follow native into native preview.
4. Open the Deal and Company pages and quick previews. Quote counts should include all linked external submissions. Clicking either should open its details.
5. Create a follow-up Task from a selected external Quote record. The Task should link to the actual Deal, never a nonexistent native Quote ID.
6. Record a fresh external quote using a temporary Deal and a historical Date sent; verify cloud acknowledgement, quote registry presence, calendar badge at Date sent, Home Recents at logging time, and count changes. Verify no duplicate record after retries.
7. Verify existing native Quotes still edit, issue, revise, share and archive exactly as before. No migration altered their original rows.
8. Run `npm run test:quote-registry` manually for registry parity/regression tests, plus `npm run build` and signed-in mobile browser QC.

## Next parity work — deliberately not part of this batch
A richer external submission detail editor can add external portal reference/URL and linked supporting PDF or screenshot, ownership reassignment, multiple submitted alternates, outcomes and follow-up reminders. These are future improvements; never infer that a builder-platform bid has SalesShop-generated revision/audit/signature data.
