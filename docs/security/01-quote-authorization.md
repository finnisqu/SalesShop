# SalesShop — Quote access control hardening

**Scope:** Live SalesShop Supabase (project ref `pvchgibllozuwickhfqz`) and React branch `architecture/react-foundation`. Existing `main` unchanged.

## Implemented live database migrations

1. `202610110002_quote_scoped_rls.sql` — row-level quote scope, explicit per-quote read grants, protected quote numbering RPC, scoped quote line/section/revision/share/signature policies, quote-related CRM activity reads, legacy JSON quote backup.
2. `202610110003_lock_legacy_org_snapshots.sql` — legacy `org_documents` CRM, quotes and signature JSON snapshots are all **admin-only**, since even CRM snapshots can retain quote-related activity metadata.
3. `202610110004_sensitive_quote_artifacts.sql` — only authorized quote editors with issuance rights can retrieve customer-link tokens; signer records require quote editing access.

Existing quote records, statuses, prices, teams, owners, public share tokens, and signed snapshots were not backfilled, reassigned or deleted by these migrations.

## Exact JWT-scoped policy

| Workspace membership | Read quotes | Edit quote | Customer share token | Read signer details |
|---|---|---|---|---|
| Owner/Admin | All in own organization | All in own organization | Yes, if authorized to issue | Yes |
| Member (General/Salesperson/Estimator) | Own; quotes for teams they belong to; explicit grants | **Own only**, if their job function can edit quotes | Only own editable quotes, **if department can issue** | Own editable quotes |
| Viewer | Explicit per-quote read grants only | Never | Never | Never |
| Nonmember | Nothing | Nothing | Nothing | Nothing |
| Legacy unassigned quote | Owner/Admin until explicit assignment | Owner/Admin | Owner/Admin | Owner/Admin |

`quote_access_grants` is an organization-checked join table. Owner/Admin manages grants through **Team Quotes → View details → Additional read-only access**. No blanket organization-wide grant was created.

Quote rows, line items, sections, history snapshots, signed records, share records, and quote-linked CRM activities use JWT-scoped parent checks. Existing broad permissive policies were **altered**, not combined with new policies, which would have retained OR-based access.

**Important:** Team access is read-only unless the employee is also the quote owner. A read grant still gives that employee access to the quote's full permitted row and line-item fields, including fields present in historical snapshots and internal quote data. If future roles require *customer-price-only* access, introduce a separate sanitized API/view and protect internal-cost columns and revision snapshots separately; don't assume a frontend-only hide protects those values.

## Privileged routes

- `quote-share-admin` Edge Function deployed with `verify_jwt=true` and a JWT-scoped `public.can_access_quote` check **before** service-role reads or writes. Reading an existing customer link now requires permission to edit and issue that quote.
- `quote-share-public` remains a bearer-token-validated public link path, using privileged backend access for customers. It was not changed.
- `public.assign_commercial_document_number` validates target-quote edit scope before calling its privileged backend numbering helper.
- The ChatGPT-connected Supabase administrator integration can still administer this database and bypass employee-level RLS by design. This is a distinct administrative privilege; use least privilege and restrict connected-admin access separately.

## App-side defense in depth

- `My Quotes` editors show only work attributed to their signed-in user in cloud mode, including non-admin editors.
- `syncNormalizedQuotes` skips unchanged rows and will not bulk re-upload team-readable records that belong to another employee. PostgreSQL RLS independently guards all writes.
- The old cloud JSON snapshots were rollback-only; the normalized tables remain authoritative.
- Team grant controls update database first, then local UI state upon a successful authenticated response.

## Actual live access verification

Authenticated database role simulations used `SET LOCAL ROLE authenticated`, request JWT claim substitution and `ROLLBACK`. Tested against a real organization containing 11 quotes and one ordinary member:

| Probe | Observed result |
|---|---|
| Ordinary member tries to read 11 quotes owned by somebody else | **0** quotes, **0** quote lines, **0** share rows |
| Same member tries a specific unrelated quote through authorization RPC | Read **false**, edit **false** |
| Same member tries quote/revision/activity/CRM JSON rollback surfaces | **0** |
| Owner of that organization | **11** quotes, **41** lines, read **true**, edit **true** |
| Temporarily simulated Viewer with one explicit quote grant | **1** quote, read **true**, edit **false** |
| Viewer with quote grant containing a customer share | **0** share tokens, **0** signature rows |
| Temporarily simulated member of a quote's reporting team | Quote read **true**, edit **false** |
| Nonmember JWT | **0** quotes, lines, shares, JSON backups |
| Test data after rollback | No test grants, no test teams, no changed memberships |

These SQL tests verify database permission rules. They do not replace browser testing for invitation acceptance, real-device UI, or customer quote signing. No employee user data was permanently altered by the simulations.

## Residual risks and next checks

1. **Previously opened tabs and downloaded data** cannot be recalled by server RLS. Ask current collaborators to refresh/relogin after deployment; a local offline cache may retain previously obtained information until rehydration or browser storage is cleared.
2. **Team view grants full quote data**, including supplier/internal cost fields or revision snapshots present in authorized rows. Add a customer-safe projection if you need to keep costing private from people allowed to view a quote.
3. **Public customer link E2E**: verify opening an existing active link, expiry/revocation, and signing in a real browser after the backend change.
4. **Viewer and estimator E2E**: confirm read-only navigation, authorized quote list, denial of unrelated quotes and appropriate error feedback on role boundaries.
5. **Supabase Security Advisor** flagged leaked-password protection as disabled. Enable it under Auth password settings: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
6. Advisor flagged intentional public invitation-token preview `public.preview_team_invite` and other security-definer APIs. Review their individual authorization and token lifetimes independently; these were not altered in this quote-focused change.

Validation required: GitHub Pages test/typecheck/build + multi-viewport Chromium workflow, plus manual signed-in and customer-share checks. **Do not claim live signed-in browser checks occurred when only SQL-role simulations ran.**
