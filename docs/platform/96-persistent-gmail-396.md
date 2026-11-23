# #396 — Persistent Gmail authorization (staged)

**Status: DRAFT DEVELOPMENT WORK.** Never deploy the SQL or credentials directly to production from this document. This branch stacks on Gmail PRs #134 (popup-first) and #135 (forwarded-chain matching). It does not change existing production Supabase data.

## Goal and architecture

- The **Connect Gmail** button retains a Google popup. When the authenticated backend capability check succeeds, Google Identity Services uses `initCodeClient({ux_mode:'popup'})`, returning a one-time **code**, not a long-lived secret.
- SalesShop's authenticated browser sends the code, its current Supabase access JWT and organization ID to `POST /api/gmail/persistent/connect` on the first-party Cloudflare Worker.
- The Worker validates the request origin, the custom `X-Requested-With: XMLHttpRequest` header, the current JWT with Supabase Auth **/auth/v1/user**, and independent membership in `public.organization_members`. It does not trust a client-provided user ID or JWT metadata for organization authorization.
- The Worker exchanges the Google code with its **server-only** Google secret and the origin as `redirect_uri` (Google's code popup default), then verifies the actual Gmail address through Gmail's profile API. Gmail permission remains strictly `gmail.readonly`.
- The Worker encrypts the Google refresh token with a random 32-byte AES-GCM key and 12-byte nonce, binding ciphertext to the specific organization+user via authenticated additional data. Only encrypted ciphertext, nonce, mailbox, scope, status, verification timestamps and version are stored in Supabase. **No Google refresh token or encryption key reaches the browser.**
- A user's next SalesShop sign-in invokes `GET /api/gmail/persistent/status`, then `POST .../refresh`; the Worker decrypts the saved refresh token and obtains a new short-lived access token. This short-lived token stays in the current browser memory, consistent with the current direct Gmail API readers. The client renews on focus, shortly before expiry, and before search when needed.
- **Disconnect** sends an authorized Worker request to delete the saved connection and *attempt* Google's revocation. If Google's revocation endpoint is temporarily unavailable, removing the SalesShop credential still prevents future refreshes from this integration; revocation may need manual follow-up at Google's account permissions page.
- On account or organization changes, the browser drops current Gmail access without revoking the *persistent* Google grant. Pending OAuth results are checked against the latest identity generation.
- If the persistent service is **not fully configured**, the currently working temporary token popup remains available, with the UI labeled `Session only`. There is no silent localStorage persistence of Google credentials.

### Data and authorization boundaries

Staging SQL: [`docs/platform/sql/396-gmail-persistent-staging.sql`](sql/396-gmail-persistent-staging.sql).

Table `public.gmail_oauth_connections396` is **not in automatic migrations**. It has one connection per (`organization_id`, `user_id`) and foreign keys into `public.organizations` and `auth.users`. It has RLS enabled **with no anon/authenticated policies**, all public/anon/authenticated grants revoked, and the minimal explicit service-role table access required by the Worker. The table has a strict single-scope check and no stored OAuth access tokens or Gmail messages. Browser calls never query this table, and provider secrets never use a `VITE_` variable.

Membership is independently checked at **every** credential action. A changed or removed membership immediately denies access to the saved connection even if a user's former encrypted row remains in the database. Organizational shutdown and user deletion cascade-delete their rows. A single-person Gmail grant is **not** a team-shared mailbox integration.

### Required Cloudflare Worker secrets and configuration

Configure the deployment's **Worker runtime**, not Vite build variables, and do not print secret values in build logs:

| Variable | Purpose |
|---|---|
| `GOOGLE_GMAIL_CLIENT_ID` | Public Google OAuth Web client ID, identical to `VITE_GOOGLE_GMAIL_CLIENT_ID` |
| `GOOGLE_GMAIL_CLIENT_SECRET` | Server-only Google OAuth Web client secret |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | Server-only base64 encoding of 32 cryptographically random bytes; generate securely and store in a secret manager |
| `SUPABASE_URL` | Production/staging HTTPS Supabase project origin, no API key in the URL |
| `SUPABASE_PUBLISHABLE_KEY` | Public Supabase publishable key for verifying the browser JWT with GoTrue |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** privileged key; never bundled or exposed to browsers; Worker uses only for membership checks and the locked-down encrypted-token table |
| `GMAIL_OAUTH_ORIGIN` | Exact first-party app origin, e.g. `https://app.salesshop.work` |

Cloudflare Worker scripts are served through `worker/index.ts`, and `/api/*` is configured in `wrangler.jsonc`. Google OAuth authorized JavaScript origins must include the exact deployed origin. Code popup uses the page **origin** as the token-exchange redirect URI, not `/gmail/callback`. The existing full-page redirect is a separate legacy path.

**Never publish the Worker service-role key, Google client secret, or encryption key as a build variable with a `VITE_` prefix.** The encryption key must be backed up securely: losing it makes existing refresh ciphertext irrecoverable. Changing it requires an approved decrypt/re-encrypt migration or deliberate reauthorization; simply changing the Worker key breaks saved connections.

### Google requirements

- Use an appropriate OAuth Web client, Gmail API, and the Google consent screen with `gmail.readonly` (a **restricted** scope).
- Before customer rollout, confirm OAuth publishing, verification, domain policies and any applicable restricted-scope security assessment. External apps in **Testing** may issue refresh tokens that expire after seven days. A refresh token can also be revoked or expire for other reasons.
- Google may not return a new refresh token on every code exchange. The Worker only preserves an earlier token if the same verified mailbox is already saved as an active connection; otherwise it asks for renewed offline authorization. Never invent persistence from an access token alone.
- The Google popup uses the authorization **code model** with a custom-header + same-origin anti-CSRF check, not the temporary access-token model. The backend exchange uses Google's documented popup origin as `redirect_uri`.

## Endpoints (all deny cross-origin requests and use no-store responses)

| Route | Method | Response |
|---|---|---|
| `/api/gmail/persistent/status?organization_id=UUID` | GET | Configured/connected/needsReconnect boolean plus verified mailbox, **no token** |
| `/api/gmail/persistent/connect` | POST | Exchanges one-time code; returns short-lived access token, mailbox and expiry |
| `/api/gmail/persistent/refresh` | POST | Returns a new short-lived access token and expiry; refresh token remains server-only |
| `/api/gmail/persistent/disconnect` | POST | Deletes saved record, attempts Google revoke |

Every route verifies current Auth JWT and organization membership. POSTs additionally require `Origin`, `X-Requested-With: XMLHttpRequest`, JSON, bounded body lengths and valid UUIDs. Errors do not return Google responses or ciphertext. Optional persistence reports `configured:false` until every required Worker secret exists; deployment is additionally blocked on SQL/table tests.

## Isolated staging release checklist — NOT YET COMPLETED

- [ ] Run `npm run test:gmail-persistent` and existing `test:gmail-connection`, `test:gmail-body`, TypeScript and full Vite build.
- [ ] Apply staging SQL in a disposable *non-production* Supabase project and validate RLS/column grants: anon/authenticated cannot read ciphertext; a service-key Worker can access only with verified user identity+membership.
- [ ] Exercise two synthetic organizations, two users, unauthorized and viewer roles, login/logout, expired JWT, concurrent OAuth attempts, cross-origin and CSRF requests. Test swapping a ciphertext row between users/orgs cannot decrypt.
- [ ] Test actual `initCodeClient` Google popup on deployed preview origin with registered OAuth client, receipt of refresh tokens, authentication after reload, automatic refresh after expiry and expired/revoked grants.
- [ ] Test frontend Gmail searching/reading after restoration, Person/Deal email links, and privacy (no tokens/bodies in storage, logs or network responses beyond the short-lived access token in the browser).
- [ ] Test Google disconnect/revoke, deleted membership or user, deleted organization, error handling, mobile and multiple browser tabs.
- [ ] Security-review secret deployment, key rotation/backup, Google restricted-scope compliance, rate limits, alerting and operational rollback.
- [ ] After all gates, intentionally deploy the migration and runtime Worker bindings. Expect existing temporary connected users to need one new Gmail consent to create their first saved refresh credential.

**Rollback:** Disable/remove `GMAIL_TOKEN_ENCRYPTION_KEY` or the Worker secrets to return to the proven temporary popup without modifying the data table. For a permanent rollback, revoke affected Google grants where needed, securely remove encrypted credentials via an approved administrative process, then consider dropping the staging-created table. Never expose stored ciphertext to browser clients for rollback.

## Sources

- Google Identity Services authorization code popup: https://developers.google.com/identity/oauth2/web/guides/use-code-model
- Google OAuth offline access and refreshing: https://developers.google.com/identity/protocols/oauth2/web-server
- Supabase Auth server verification: https://supabase.com/docs/reference/javascript/auth-getuser
- Supabase server-side session guidance: https://supabase.com/docs/guides/auth/server-side/creating-a-client
