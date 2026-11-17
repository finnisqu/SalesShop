# Build #371 — Files and Quote Sharing

## Scope

A useful next step in TOOLS → FILES after the user paused CAD-Lite while updating it separately. Reuse the existing browser-local linked-file store; do not introduce uploads, new cloud tables, or quote-share-bearer persistence.

## Feature bundle

1. **Document categorization**: Every new/editable link may be categorized as Drawings, Bid documents, Contracts, Specifications or Other. Legacy links without a category remain valid and display Other, with no rewrite or migration of existing rows.
2. **Record-linked directory**: Tools → Files supports a Record selector and optional **Include files on related records** to show associated Company, Deal and SalesShop/external Quote links. Relationships use stored Company and Deal IDs, never matching names or guessed customer associations. Files may also be filtered by category and searched by provider, title, category, label and URL. New links default to the record selected in the directory; the original source relationship is retained for each link. Existing file forms on individual record pages remain intact.
3. **Customer Quote links**: A compact, collapsed Customer Quote links section offers an explicit **Check current link** for one selected issued native SalesShop Quote (not external quotes). It invokes the existing authorized server-side get action; it checks selected Quote ID and revision and shows only a summary of ready/viewed/signed/revoked/expired/missing state. **Copy customer link** is available only for a usable revision-matched link. **Manage in Quote** routes to the existing Quote Review workflow. No automatic create, revoke, share, issue, delivery confirmation or stored bearer tokens; no background polling.

## Privacy and safety

- File URLs and their link metadata remain in the existing per-browser, per-user/organization store. A file link does not imply an authorized cloud upload, team sharing, provider OAuth or external delivery.
- Customer share bearer tokens remain in temporary component state after a user explicitly requests them; never written into the linked-files store, localStorage, debug logs or CRM history. The server still controls access. Signed links may remain usable after expiry; revoked or expired active links cannot be copied.
- External Quote records remain first-class: attached files and record navigation work through their existing Activity/Deal identities. Native customer Quote links only apply to actual SalesShop Quotes.
- Access checks are repeated after asynchronous link fetch, and after a Quote revision or SalesShop identity change. No changes to customer pricing, quote revision, CAD-Lite, or existing source quote sharing flows.

## Validation

QA in isolated `qa/gmail-363-build` branch using Cloudflare-equivalent Node 24/Bun 1.4.4 build, `tsc --noEmit`, quick-quote regression tests, record gate and Vite. New regression suites `filesWorkspace371.test.ts` and `quoteShareReferences371.test.ts` added to `test:quick-quote`.

Manual acceptance after green: Tools → Files → Record: Deal, include related links and category; save/edit a new drawing/contract link, filter, search, open source record. Check both native SalesShop and external Quote file links. Expand Customer Quote links, select an issued Quote, **Check current link**, verify status and Copy/Manage controls without auto-creating a link; ensure a draft or external Quote is not presented as eligible. Verify no stale link appears after switching users or revisions, and check mobile/WARM styling.

## Next

After user acceptance, begin plug-and-play CRM setup onboarding/configuration: organization-specific optional modules, terminology and starter-pack previews with reversible drafts, not unsafe live Supabase custom-field RLS publication. CAD-Lite remains explicitly paused.
