# CRM connections, Account status and external quote backfill — QA

## New workflows

**Record external quote** is visible from Connections → Deals directly above the table, from Connections More, from Connections → Quotes metadata, and from the Detailed Quotes sidebar. It opens a searchable Deal picker. If the Deal is not yet entered, add a minimal Deal from within the picker before entering its quote.

**Historical quote guard:** Closed Won, Completed, Closed Lost and Discarded Deals can receive a quote-sent history event with a past sent date and amount without changing their stage, final amount, bid deadline or task completion. For active Deals, the existing bid-submission transition and task completion behavior remains. No SalesShop quote document is created.

**Prospect vs Customer:** Company classification now reads Prospect, Customer, Partner / other, or Unclassified. Existing `customer`-kind rows are explicitly **Unclassified** until changed; no sales status is inferred from quotes/deals. New Companies created from the Connections Company action or Accounts Board default to Prospect. Internal roster companies remain separate.

**Bulk company links:** From Connections → People select rows and choose Bulk edit → Connect to company. From Connections → Deals select rows and choose the same property to assign or clear the shared Company. The choice affects only the selected records and does not silently migrate linked quotes, contacts or activities. Companies bulk edit changes Prospect/Customer/Partner classification.

**Future customizable properties:** `docs/product/custom-entity-properties-plan.md` is a design specification, not an implemented feature. There are no new custom-field tables, defaults or attachments in this release. Direct stand-alone Deal↔Person relationships also require a dedicated data model and are not faked as Activity history.

## Manual checks after deployment

1. Open Connections → Deals on desktop without opening a Deal. Confirm a **Record external quote** button appears above the table.
2. Open Detailed Quotes. Confirm **Record external quote** is visible in the sidebar. Verify it also appears if there are no Quotes.
3. Pick a Completed test Deal, enter a past date and amount, save. Confirm Activity History gets an external quote, but stage/amount/due date/touchpoint/tasks remain unchanged.
4. Pick an active test Deal in Bid Development, enter a past quote, save. Confirm Bid Sent stage, submitted amount and due date/task behavior.
5. Create a missing Deal in the picker, then record a quote for it. Confirm search and selection remain usable on mobile.
6. In Connections → Companies, create a Prospect then classify it Customer. Check filter, table label, mobile card, full record, Accounts Board and preview all agree.
7. Reclassify an older legacy Company. Confirm Unclassified is offered as a filter but never used as an editable status option.
8. Select several People → Bulk edit → Connect to company. Select several Deals → Bulk edit → Connect to company; then clear the connection. Verify only intended links change.
9. Ensure the internal Our Organization records do not show up as candidate customer Companies or Board Accounts.
10. Revisit a Company with aliases. Confirm hidden CRM metadata markers are not presented as user aliases or included in duplicate-company name matching.
11. Verify mobile sheets, focus/keyboard, all themes, edit role restrictions and no layout overflow.

## Not verified here

Full `npm run build`, Vitest, Cloudflare deployment and browser visual QA were not run in this connector-only environment. GitHub CI remains disabled by the user's preference.