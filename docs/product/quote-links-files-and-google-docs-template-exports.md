# Quote links in Files & Bring-Your-Own Google Docs templates

**Proposal — November 16, 2026. Not built, enabled, or connected.**
Related: [November 16 sprint](../plans/2026-11-16-prototype-polish-work-plan.md), [version log](../../CHANGELOG.md), [customer share gates](../quotes/18e-customer-revision-share-gate.md).

## Product intent

A customer-facing SalesShop Quote URL, its related documents, and a generated builder worksheet should all be discoverable from one Files surface. SalesShop owns the commercial source data and delivery evidence; external documents are **output copies**, not competing editable Quote records. Google Docs is the first provider example; do not couple the generic template/export contract to Google-specific terminology.

## Existing product behavior

- Secure customer Quote links **already exist** via `QuoteShareControl` / `quoteShareService`. The server's Quote Share records are the authoritative source; the UI checks the current issued revision, whether a link is usable or revoked/expired, and has separate sharing vs salesperson delivery confirmation.
- Files v0.1 (#357a) stores only **manually entered HTTP(S) file/folder references** in browser-local storage partitioned by signed-in user+organization (and Playground); it does not automatically list customer Quote shares or sync file links across devices.
- **Do not store public Quote bearer tokens inside the Files v0.1 localStorage store.** Do not mislabel link creation/copying as successful delivery; do not display revoked, expired, or old-revision URLs as shareable.

## Candidate #357 — live customer Quote reference in Files

1. Add a distinct, typed Files item `customer-quote` sourced from the *current cloud Quote Share service*, not a copied file URL. It identifies the **native Quote ID and current revision**, not a raw bearer token saved to local storage.
2. Show the item on the native Quote's Files section, and optionally in its Deal/Company Files view via the existing Quote association; do not treat an external bid as if it had an automatically generated SalesShop customer link.
3. The display reads authenticated share status on demand, using existing cloud permission boundaries. Available actions: **Open current customer link**, **Copy link**, **Manage/revoke** in existing Quote Share UI; state: not created, active, expired, revoked, older revision. Never expose a URL from old Quote ID/revision.
4. Only list an actual URL while `quoteHandoffStatus` / `shareMatchesQuoteRevision` say the share is usable; hide bearer token from nonauthorised record views and analytics/search exports.
5. The generated link's existence and `QuoteShare` history are managed centrally, **not in browser-local Files v0.1**. No automatic issue, email, delivery confirmation, or status updates on opening Files.
6. Acceptance: create/share/expire/revoke/regenerate across Quote revisions; alternate user/organization access denial; no link leak from shared record previews; explicit delivery acknowledgment remains independent.

## Candidate #358 — Google Docs template export, BYO SaaS

**MVP user flow:** From a native Quote choose **Export → Google Doc**; connect Google account with deliberately limited OAuth permissions; select an existing accessible Google Docs template, including a customer's/builder's own template if the user is authorized to copy it; preview placeholder mappings and customer-visible data; click Generate; SalesShop copies the template into the user's Google Drive, fills placeholders and repeating rows, returns/open the created Google Doc and **records it as an output file link** on the Quote and related Deal where permitted.

Suggested allowlisted placeholder vocabulary (versioned):
- `{{quote.number}}`, `{{quote.title}}`, `{{quote.revision}}`, `{{quote.date}}`
- `{{customer.name}}`, `{{customer.address}}`, `{{contact.name}}`
- `{{deal.name}}`, `{{quote.total}}`, `{{quote.notes.customer}}`
- `{{company.name}}`, `{{company.phone}}`, `{{company.email}}`
- Repeating sections: `{{#areas}}...{{/areas}}`, `{{#lines}}...{{/lines}}`. These are **SalesShop DSL proposals**, not native Google Docs tags. Implement table-row expansion by reading the Docs structure and inserting rows, not merely calling `replaceAllText` on a multiline placeholder.

**Technical path:** Google Drive API `files.copy` on the accessible template, followed by Google Docs API `documents.batchUpdate` / `replaceAllText` for scalar placeholders; expand repeating table rows with structural Docs API operations. These are official Google documented mechanisms. Do not silently assume access to a customer's private template or scope-wide Drive visibility.

**Commercial safety:**
- Use the Quote's *approved customer presentation* for customer documents: never inject purchasing costs, margin, hidden areas, internal takeoff geometry, private notes or non-customer-visible line items.
- Offer a separately identified, explicitly internal worksheet export only for authorized users. Permission-check and visibly label it; do not mix internal data into a customer template.
- Snapshot the source Quote ID, revision, generated time, template ID/version, and Drive document ID; Google Doc edits do not alter SalesShop's Quote or approved PDF/signed snapshots. Regeneration creates an intentional new copy instead of silently overwriting the old one.
- Exporting a Doc does **not** issue, send, or confirm customer delivery and does not change the protected submission Task.
- Use signed-in user OAuth consent, least privilege, server-controlled token handling, disconnect/revocation, and explicit access checks. If cloud Files link persistence isn't ready, do **not** pretend output links are shared with other reps.

**Suggested prototype sequence:**
1. Testable pure data mapper and customer-safe placeholder preview using existing Quote data (without OAuth).
2. Authenticated Google connect and template selection; **Generate Google Doc** with scalar fields.
3. Repeating Areas/line-item tables + builder-specific layouts.
4. Save the generated Doc URL with explicit source revision in shared Files (after reviewed tenant RLS).
5. Extend generic export adapters to Google Sheets (actual tabular builder worksheets), Word/DOCX, and other BYO formats.

## Release boundaries

This document records **proposed** functionality only. No new OAuth scope, Supabase SQL, customer link token persistence, customer sending, hosted file uploads, or Google document access is introduced by the plan or by the accompanying release-gate test fix.
