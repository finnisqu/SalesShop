# Gmail #394–396 release gates — November 24, 2026

> **NOT AUTHORIZATION TO DEPLOY.** The isolated staging Gmail OAuth lifecycle
> succeeded according to the operator. The main SalesShop production app,
> production Supabase schema, production Cloudflare bindings, and Google
> publishing state have **not** been upgraded.

## What we proved

1. A separate Cloudflare Worker (`salesshop-gmail-396-staging`) talks only to
   dedicated Supabase staging project `lztviymnqplloarwywde`.
2. Anonymously and as signed-in browsers, the credential table denies direct
   SELECT/INSERT/UPDATE/DELETE. Independent SQL tests and a browser audit with
   three users/two tenants passed.
3. With deliberately invalid `reauthorize` dummy ciphertext installed,
   the owning user alone saw the dummy mailbox metadata, could not renew the
   nonexistent grant (409), and neither colleague nor outside organization
   saw that connection. **13/13 browser checks passed.**
4. The dummy ciphertext was removed by exact-match staging cleanup.
5. User reports a successful *real* Google popup consent, short-lived token
   renewal, reload/re-sign-in and saved status in the isolated staging OAuth
   test. Staging SQL independently confirmed a saved AES-GCM ciphertext and a
   later verification timestamp. **At the last staging DB check, one real
   active test grant still remained** — final Disconnect had not yet removed
   it. The staging gateway logs showed no DELETE for this record during that
   test window. The operator should use the test page's **Disconnect this
   staging grant** button and confirm the account is disconnected. Never
   directly SQL-delete this active grant as a substitute for Google revocation.

## Remaining blockers before production

### A. Clean up the real staging grant

- Return to
  <https://salesshop-gmail-396-staging.finnisquick.workers.dev/oauth-test>.
- Sign in with the synthetic staging Owner; click **Disconnect this staging
  grant**; confirm. If Google consent/revocation returns an error, report
  **only the error and the HTTP status**.
- An operator with Supabase management access should verify
  `select count(*) from public.gmail_oauth_connections396;` in staging is
  zero. If it remains one, diagnose the Worker/Google revoke path *without*
  decrypting or printing refresh tokens.

### B. Run the *full application* TypeScript and test build

The staging Worker deployment has no Vite build step, so a green Worker
deployment proves Wrangler bundled **only the API harness**. It does not
prove `npm run build` on the full CRM or the multiple Gmail source tests.

On the **isolated staging Worker only**, Cloudflare →
Workers & Pages → `salesshop-gmail-396-staging` → Settings → Builds,
temporarily set **Build command** to `npm run build`; keep the
**Deploy command** fixed at
`npx wrangler deploy --config wrangler.gmail396.staging.jsonc`
and **Branch** at `feat/gmail-persistent-oauth-396`.
A new commit/brand-new build is required; rerunning an older commit's build
may not use the changed config. The build does not change the production
SalesShop Worker; the staging harness continues to serve only its test API
routes. The TypeScript/test/Vite output is created in the staging build
environment but **not served** by the staging Worker.

`npm run build` executes:
- `tsc --noEmit`;
- SalesShop Quick Quote and Record gates;
- `test:gmail-connection`, `test:gmail-body`, `test:gmail-persistent`;
- `vite build`.

The November 19 Files & Docs tests were already corrected on production
`main`. Their two outdated source assertions were also synchronized into
Gmail branches #134–136 to avoid the same false failure when building
the feature branch. **Do not claim the test suite passes until a new
Cloudflare build shows it.**

### C. Review and merge the stacked Gmail PRs in dependency order

- [PR #134](https://github.com/finnisqu/SalesShop/pull/134):
  popup-first UI and legacy OAuth Cloudflare redirect fix;
  target `main`.
- [PR #135](https://github.com/finnisqu/SalesShop/pull/135):
  forwarded-chain address discovery; currently targets #134 branch.
- [PR #136](https://github.com/finnisqu/SalesShop/pull/136):
  encrypted persistent Gmail OAuth; currently targets #135 branch.

All three are **draft** and their branch comparisons can diverge from
`main` while there are intervening fixes. GitHub's mergeability must be
rechecked after a fresh build and base synchronization. Do not deploy or
merge the combined feature without explicit release approval and a
working rollback. The supported Gmail test remains isolated from production
until the parent PRs are correctly integrated.

The old Worker
`/api/gmail/oauth/exchange` had an additional Cloudflare-incompatible
`redirect:'error'`; that was fixed to `redirect:'manual'` and regression
coverage was added across all three stacked branches. This issue was not
exercised by the new staging `/api/gmail/persistent/*` API.

### D. Production SQL, secrets and tenant authorization

The production schema was inspected **read-only**. Production has the
`public.organizations(id uuid)`, `public.organization_members(
organization_id uuid,user_id uuid,role text)` and `auth.users` structures
that #396 requires. The production
`public.gmail_oauth_connections396` table was **absent** at last check.

Do NOT copy the staging-only organization scaffold into production.
The only prospective table is the
`docs/platform/sql/396-gmail-persistent-staging.sql` credential schema,
after security review and an approved production-specific migration.
Confirm a rollback plan and audit RLS/no browser table grants first.

Production Worker runtime bindings (NOT `VITE_`, NOT build variables):
- `SUPABASE_URL`: existing production Supabase origin;
- `SUPABASE_PUBLISHABLE_KEY`: matching production public key;
- `SUPABASE_SECRET_KEY`: matching production server-only `sb_secret_`
  (or legacy service role fallback, not both);
- `GOOGLE_GMAIL_CLIENT_ID`: exact production browser OAuth client ID;
- `GOOGLE_GMAIL_CLIENT_SECRET`: matching server-only Google secret;
- `GMAIL_TOKEN_ENCRYPTION_KEY`: fresh, safely backed-up Base64 of 32
  cryptographically random bytes, **not the staging key**;
- `GMAIL_OAUTH_ORIGIN`: exact `https://app.salesshop.work`.

In Google Cloud, the production browser's JS origin must match the
production client. No secret values should appear in GitHub or chat.

### E. Google provider and operational constraints

The OAuth Audience currently is **External / Testing**. Google's normal
seven-day refresh-token expiry for Gmail scope explains weekly
reauthorization even when automatic hourly access-token refresh works.
Google `gmail.readonly` is a restricted scope; broad customer-facing
commercial deployment may require OAuth app verification and/or security
assessment. Do not treat a staging consent test as production Google
approval. For a small internal pilot, the team must consciously accept
weekly consent and the testing-user restriction.

After an approved deploy, validate **one internal account** with explicit
consent and then: connect → refresh → browser reload/reopen → disconnect.
Confirm token ciphertext cannot be read by signed-in browser clients,
memberships are checked on each call, and no Google access/refresh token or
encryption key is present in logs/localStorage. Be able to disable the
persistent connector configuration and fall back to a single-session popup
if an incident occurs.

## Status

- [x] Isolated staging database authorization and RLS
- [x] Synthetic saved-credential privacy and blocked renewal
- [x] Real Google popup / saved grant / refresh / reload: **operator-reported**
- [ ] Real staging grant removed via Worker disconnect + verified SQL zero rows
- [ ] Fresh green full CRM TypeScript/Vitest/Vite build from #136
- [ ] PR #134–136 dependency, mergeability and code review
- [ ] Approved production-only migration, secret setup, rollback
- [ ] Google OAuth audience/publishing suitability for intended customers
- [ ] Production deployment or live Gmail change
