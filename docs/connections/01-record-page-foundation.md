# Connections 2.0 — Batch 1: record page foundation and Company

**Base branch:** `batch/16g-home-navigation-journey` (HEAD `6109ac40`).
**Feature branch:** `feature/connections-record-pages-batch-1`.
**Production:** `main` is intentionally untouched.

## Shipped in this batch

- `RecordPageLayout` is the reusable semantic, single-scrollport three-region record shell (properties / activity / relationships).
- Company pages use canonical, shareable URLs: `/connections/companies/:companyId`. Legacy `/board/accounts/:companyId` links remain recognized and keep the original Board editor behavior.
- Existing `openCompany` navigation now lands in Connections. Directory creation and Quick Create open the same Company record.
- Company details include editing relationship/name/annual estimates, alias maintenance, child Contacts and Projects, linked Quotes, and a filtered company Activity timeline.
- Related quotes use explicit company/project IDs; no name guessing. Each Activity is included at most once.
- Browser Back, mobile Back, deep links, missing record handling, theme variables, and responsive layout reuse the existing SalesShop app infrastructure.
- Company account-forecast math, the old Board editor and CRM data structures are reused, not forked.

## Safe scope / intentional follow-ups

- A full Person page and a full Project page are follow-up batches. Existing People editing and Board Project details are unchanged.
- Company phone/address/web properties are not yet in the canonical Company model. Do not fabricate them.
- Contacts can be added on the Company page, but their standalone record-page navigation waits for Batch 3.
- Activity logging for calls, notes and meetings needs a normalized event schema before exposing controls.
- No Supabase migrations, permission changes, quote pricing/calculation changes, or external integrations were made.

## QC

- `src/services/companyRecordView.test.ts`: related quote and activity logic, no name-based links, archived quote exclusion.
- `src/services/appRoutes.test.ts` and `src/store/navigationStore.test.ts`: Company URL and Back navigation.
- `e2e/connections-company-record.pw.ts`: mobile/desktop Company create, edit, relationships, refresh and Back.
- `e2e/home-journey.pw.ts`: updated to Company pages rather than obsolete Board account dialogs.

## Next

Batch 2: harden / polish Company properties and company-linked business files; Batch 3: person record and multi-company affiliation; Batch 4: project record with contact roles and quote revisions.
