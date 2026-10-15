# Batch 14A — Shop Outcomes read boundary (staged, not deployed)

## Purpose

The current SalesShop database permits organization owners/admins to read other salespeople's unissued quotes; team-linked quote reads and ordinary CRM tables are also broader than the privacy-first target. Hiding Team Quotes in React **does not** close those database access paths.

This batch stages a **separate signed-only operational read endpoint**. It does not change RLS or deploy anything to the live Supabase project.

## What's in the code

- `supabase/functions/shop-outcomes/index.ts` (Edge Function, NOT deployed)
- `src/services/shopOutcomesService.ts` (cloud-only client, NOT mounted in any visible screen)
- `src/services/shopOutcomesApiContract.test.ts` (structural safeguards)
- Existing pure model: `src/services/shopOutcomeProjection.ts` and its data-minimization tests

The endpoint:
1. Requires a JWT and resolves the user through Supabase Auth.
2. Checks **that user** against organization membership from the database and denies non-owner/admin roles.
3. Only after authorization, reads up to 100 immutable signed evidence records from `signatures` for that organization.
4. Constructs a strict allowlist: signed document ID, quote ID/number, revision, type, title, project ID, company name, acceptance timestamp, accepted total.
5. Never serializes the accepted snapshot, signature strokes, names/emails, private CRM activities, drafts, line items, source costs, or margin calculations.
6. Returns no-store responses, and does not echo SQL exceptions.

Owner/admin access to this signed-only projection is intentional. The API is **not** a replacement for stronger RLS on quote, CRM, share grant, legacy JSON or background sync paths.

## Next gate: staged RLS design and test accounts

Before a public/client UI switches from Team Quotes to Shop Outcomes:

1. Inventory every SQL policy, security-definer RPC, Edge Function, sync read/write, search path, cache, export and legacy JSON path involving quotes, companies, contacts, projects, activities and public shares.
2. Introduce explicit creator/collaborator ownership for salesperson-private company/contact/project/activity data. Existing records with unknown ownership must become **unassigned**, not assumed to belong to whoever opens them.
3. Define least-privilege explicit sharing with separate customer-safe and edit scopes. Replacing quote grants must preserve current customer share tokens and signed revision history.
4. Add JWT-context integration tests for owner, admin, salesperson, viewer, removed member and a different organization. Verify access via direct PostgREST and privileged RPC/Edge Function requests, not just UI.
5. In a **test organization**: deploy `shop-outcomes` with JWT verification enabled. Seed one real signed test quote and one draft. Owner/admin may see only the signed allowlisted record; member/viewer/nonmember see 403. Test cross-org requests, revoked membership, missing JWT, and no customer token leakage.
6. Back up live policies and counts, create a reversible reviewed migration, then move quote and private CRM access to least privilege. The migration must be executed deliberately and tested against a representative workspace; do not apply unreviewed RLS live.
7. Replace Team Quotes with a server-fed **Shop Outcomes** view and remove team draft totals, salesperson ranking, and privileged cached draft references. Check that previously downloaded caches clear on identity changes.
8. Restore/remove old team-wide client affordances only after the backend protects every path.

## Boundaries

- Does not change production `main`, database schema, customer records, invitations or active public links.
- No endpoint deployment occurs merely by merging the branch into the React development branch.
- The endpoint has a 100-record first-page limit; add cursor pagination once signed-outcome UX is defined.
- Unit/contract tests are **not** proof of real role isolation or browser signing.
- Keep existing Classic/Beta support and Batch 13 signed-in acceptance gate separate.

**Stop condition:** Never declare the salesperson privacy migration complete while `private.can_read_quote` still grants Owner/Admin access to private drafts or ordinary company/contact/project reads remain organization-wide.
