# Parked: live customer Quote references in Files & BYO Google Sheets templates

**Status: DEFERRED (November 16, 2026). Do not implement or connect Google without renewed prioritization.**

## Two related but distinct capabilities

**Live customer Quote links in Files:** SalesShop already has an authenticated cloud Quote Share flow. Its current usable customer-facing URL is tied to an issued, frozen Quote revision, and it can be revoked, regenerated, or expire. Files v0.1 does **not** automatically list these links. A future Files integration should read the existing Quote Share service on demand by Quote ID and current revision, with the same access controls. Do **not** save public bearer tokens to browser-local Files storage; do not equate link creation, copying, or viewing with confirmed Quote delivery.

**Bring-your-own Google Sheets templates:** A SalesShop Quote should be exportable into a builder's own spreadsheet template, without re-entering the scope, materials, measurements, quantities, or approved prices. SalesShop remains the source of truth; the generated spreadsheet is a separately editable output associated with the source Quote and Deal. It should not edit SalesShop's frozen Quote or automatically prove delivery.

## Intended, future user flow

1. Open a SalesShop Quote and choose **Export → Google Sheet** (proposed).
2. Connect an authorized Google account with narrow, consented permissions, or select a previously connected account.
3. Choose an accessible Google Sheets template, including a builder-provided worksheet when the connected user has access to it.
4. Preview mappings from SalesShop fields to **named ranges, mapped cells and repeatable line-item tables**.
5. Generate a **new Google Sheet** in the chosen account's Drive, without modifying the original template. Open the sheet and attach the resulting document URL to the source Quote and Deal.
6. Record Quote ID, source revision, template ID/version, generated time and resulting spreadsheet ID so the provenance remains clear. Later regeneration must be explicit.

Possible mapping labels: `{{quote.number}}`, `{{quote.date}}`, `{{quote.total}}`, `{{customer.name}}`, `{{deal.name}}`, and structured Areas/line-item arrays. These are **SalesShop mapping expressions, not native Sheets functionality**. Cells, named ranges and tables may provide a better spreadsheet-native experience than text replacement.

## Design and security requirements

- Use a provider-neutral export configuration model so other spreadsheets and document formats can be added later. Google Sheets is the first proposed target, **not Google Docs**.
- Prefer a customer-safe export derived from approved customer-visible Quote fields. Never expose internal buying costs, margin, private notes, hidden Areas, private takeoff geometry or internal-only rates in customer-facing exports.
- An explicitly marked **internal worksheet** could include internal fields only with proper tenant and role authorization, separately from customer output.
- Copy authorized templates through Google Drive and fill mapped values/rows with the Sheets API once the user reconnects and consents; keep tokens and provider access out of frontend localStorage.
- Exporting a spreadsheet does **not** issue, send, freeze, sign, or confirm delivery of a Quote, and cannot bypass protected bid-submission task rules.
- Don't claim a generated spreadsheet is shared across the SalesShop team until authenticated Files cloud persistence, organization isolation and RLS are verified.

## Deferred prototype slices

- Pure Quote-to-worksheet mapping and preview using existing Quote data (no OAuth).
- Consented Google Sheets template selection and generation for simple scalar cells.
- Repeatable Area/line tables, builder presets, named ranges and formatting preservation.
- Durable generated spreadsheet links in shared Files only after tenant-safe cloud storage is ready.

**No OAuth scopes, customer data, Google account connections, spreadsheet generation, or schema migrations are enabled by this document.**

Related: [November 16 plan](../plans/2026-11-16-prototype-polish-work-plan.md) · [Version log](../../CHANGELOG.md).
