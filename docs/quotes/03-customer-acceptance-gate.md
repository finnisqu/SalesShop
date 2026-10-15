# Batch 13 — Quotes Beta: customer acceptance gate

**Scope:** The current React development branch, with `main` left untouched. The goal is a reliable, truthful path from creating a quote to customer acceptance, without retiring Classic or weakening customer data protection.

## Implemented in Batch 13A — link validity

- Customer links are only offered for copying or sharing if the link belongs to the displayed revision and is usable by the customer.
- Active links whose expiration timestamp is in the past are explicitly **Expired**, with a prominent **Create new link** action.
- Expired URLs do not appear in the copy/share controls; a replacement is necessary before delivery.
- Signed receipt links remain usable past their original expiry because the public quote endpoint intentionally keeps signed receipts accessible.
- Revoked links and links for earlier revisions stay unshareable.
- Link creation, copied URLs, delivery attestation, customer views, and signature remain independent states. No user action here auto-attests delivery.

Unit regressions: `src/services/quoteHandoffStatus.test.ts`. App integration: `src/components/QuoteShareControl.tsx`.

## Existing automated evidence

- Quote draft audit, zero/missing price, rate selection, takeoff moves and discounts
- Customer document preview with exact revision acknowledgement and expiration of approval after editing
- Quote issue guard, status transitions, and link handoff text
- Customer-scope visibility and printed customer quote paper
- Classic/Beta entry and exit on mobile and desktop
- Workbook and document library regressions

Automated Chromium QC runs with cloud credentials blank. **These tests do not establish live multi-user or real customer acceptance readiness.** Do not use production customer quotes to perform exploratory signing, revocation, or delivery experiments.

## Remaining signed-in acceptance checks before marking Batch 13 complete

Use a **dedicated test organization**, a salesperson test account, and a separate customer-browser session. Test on desktop and phone. Record pass/fail, environment, screenshots and links to errors without copying signature tokens or private customer URLs into tickets.

1. **Quote creation:** New → Quick Quote → required quote name, customer/contact resolution, Area/General entries and takeoffs. Refresh on both devices; no duplicate or lost rows.
2. **Pricing:** Pick a real material variant and sink, select rates, recalculate SF, test discounts/margin/cost coverage, and compare all totals with the customer-facing output. Missing costs must not silently claim a valid margin.
3. **Review and preview:** Attempt issue before preview (blocked). Preview exact scope, check or change hidden amount/itemization settings, return to Review (stale approval blocked), then reapprove.
4. **Issue:** Issue approved revision. Confirm the quote number and snapshot are frozen; no email, link, or delivery confirmation is claimed merely because the issue step succeeded.
5. **Create link:** Generate a link in the cloud session. Confirm the correct revision and check it anonymously. Copy/share must not count as delivered.
6. **Delivery:** Record a true manual delivery with method. Verify one CRM activity for the exact revision, then repeat confirmation to verify no duplicate or second project-stage advance.
7. **Customer visit and sign:** View as the customer, sign the test quote, and revisit the receipt. Confirm the exact signed revision, recorded identity and accepted total. Verify the seller-facing CRM and quote status after a fresh sync.
8. **Revision isolation:** Create a new revision after the test acceptance where permitted. Old customer link must not appear as shareable for the new revision. Prior signed evidence must remain immutable.
9. **Revocation and expiration:** Revoke a test link and verify anonymous access fails. For expiry, use an isolated test fixture or controlled test data; never manipulate a real signed customer's link. An expired active link must display **Expired** and hide Copy/Share; regenerating yields a usable new link without rewriting the customer quote price.
10. **Mobile and roles:** Repeat draft/preview/issue/share on a narrow phone and landscape; no overlapping fixed footer/popover or trapped navigation. Check owner/admin/member/viewer role access with real separate accounts, including denied access to unauthorized quotes.

## Release gates

- All automated CI checks pass at the exact merge SHA.
- Signed-in cloud tests above are documented as passing.
- No regression to existing active customer links or signed history.
- Classic remains available and production `main` unchanged.
- Privacy-first ownership / server RLS migration (Batch 14) is a separate blocker before broader team rollout.
