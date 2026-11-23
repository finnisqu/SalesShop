# #396 — API-only Gmail Staging Worker (not a SalesShop app deployment)

**Status:** source committed; Worker NOT deployed, and no Google or Cloudflare runtime
secrets have been configured through this workflow.

## Verified environment

- Supabase project: **Sales Shop Staging**, `lztviymnqplloarwywde` (not production).
- Three synthetic Supabase Auth users verified.
- Company A fixture: `68af5ab1-aa83-43c9-b442-93b0f3bb7ca7`.
  - Synthetic Owner: `owner`.
  - Synthetic Colleague: `salesperson`.
- Company B fixture: `1d3ddc50-070f-4bff-9dec-111136e9da14`.
  - Synthetic Outsider: `owner`.
- Each of the three users has exactly one membership and no cross-company membership.
- `public.gmail_oauth_connections396` exists; RLS enabled, no client grants,
  no client policies; server-only privileges. Zero real or fake credentials remain.
- A rollback-only SQL security test under
  `docs/platform/sql/396-gmail-staging-db-audit.sql` inserted a synthetic
  fake ciphertext, switched to `authenticated`, verified the SELECT was
  denied, rolled back, and was followed by a zero-credential count check.

This staging DB is **only a synthetic OAuth fixture**, not a full CRM schema.

## Step 1 — Deploy an isolated Cloudflare Worker

Use the **feature branch** `feat/gmail-persistent-oauth-396` in a local
repo checkout with dependencies installed. DO NOT deploy the default
`wrangler.jsonc`: that is SalesShop's production Worker config.

```bash
npx wrangler deploy --config wrangler.gmail396.staging.jsonc
```

The separate Worker config uses:

- Worker name: **salesshop-gmail-396-staging** (never `salesshop`)
- Entrypoint: `worker/gmailStagingHarness396.ts` (Gmail persistent API endpoints
  only; all other paths return 404)
- Public `SUPABASE_URL`: `https://lztviymnqplloarwywde.supabase.co`
- `workers_dev: true`, no production routes or static assets

It refuses any other Supabase project and refuses both SalesShop production
origins even if somebody misconfigures a secret. It also refuses every request
until the exact `GMAIL_OAUTH_ORIGIN` is configured. Record the actual URL
reported by Cloudflare, e.g.
`https://salesshop-gmail-396-staging.YOUR-SUBDOMAIN.workers.dev`.

## Step 2 — Add private, Worker-scoped bindings

For each secret, run this from a secure local shell and enter the value
interactively when prompted. Cloudflare supports the `--config` option:

```bash
npx wrangler secret put GMAIL_OAUTH_ORIGIN --config wrangler.gmail396.staging.jsonc
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --config wrangler.gmail396.staging.jsonc
npx wrangler secret put SUPABASE_SECRET_KEY --config wrangler.gmail396.staging.jsonc
npx wrangler secret put GOOGLE_GMAIL_CLIENT_ID --config wrangler.gmail396.staging.jsonc
npx wrangler secret put GOOGLE_GMAIL_CLIENT_SECRET --config wrangler.gmail396.staging.jsonc
npx wrangler secret put GMAIL_TOKEN_ENCRYPTION_KEY --config wrangler.gmail396.staging.jsonc
```

Values:
- `GMAIL_OAUTH_ORIGIN`: exact HTTPS URL of **this** deployed staging Worker,
  without a trailing slash. This is a non-secret configuration value but kept
  out of the file because Cloudflare assigns an account-specific hostname.
- `SUPABASE_PUBLISHABLE_KEY`: public key from **the staging project**.
- `SUPABASE_SECRET_KEY`: staging project's server-only `sb_secret_...` key
  from Project Settings → API Keys. **Never use the production key.**
- Google client ID and secret: a **dedicated OAuth Web application client**
  for this staging hostname, in the Google Cloud project's testing audience.
  Authorized JavaScript origins must include the exact Worker origin. Never
  paste the Google client secret into chat, GitHub, `wrangler.jsonc`, or `VITE_`.
- `GMAIL_TOKEN_ENCRYPTION_KEY`: new, cryptographically random **32-byte key
  encoded as Base64**; keep it in the Cloudflare secrets manager, backed up
  securely. Do not reuse a production encryption key.

Avoid shell commands that put raw secret values in shell history or logs.
The `SUPABASE_URL` non-secret is already pinned in the Wrangler config.
If credentials are missing, the Worker intentionally reports
`{configured:false,connected:false}` with HTTP 503.

## Step 3 — Verify synthetic, authenticated Worker isolation

Run `scripts/security/staging-gmail-396.mjs` using your **three synthetic
staging users'** usernames/passwords and the fixture organization IDs.
See `docs/platform/96-persistent-gmail-396.md` for all environment-variable
names. Do not send user passwords, access tokens, Google client secrets or
any secret material through chat.

The script checks:
- Server can read/write a **synthetic fake** encrypted credential.
- Browser cannot SELECT, INSERT or UPDATE saved credentials directly.
- Company A Owner sees only their own saved mailbox status.
- Company A Colleague cannot see Owner's mailbox.
- Company B Outsider cannot see Company A and *can* access B.
- Anonymous status requests cannot leak a connected mailbox.
- Synthetic credential rows are removed even if assertions fail.

No live Google authorization is needed to run the status test.
The Worker has no CRM frontend and cannot itself sign in browser users; the
audit obtains staging JWTs using the synthetic accounts.

## Step 4 — Future Google popup testing

We still need a **separate test frontend** or isolated deployment with the
full SalesShop auth/schema configuration to exercise Google's actual
`initCodeClient` popup. This Worker is intentionally API-only and
is **not sufficient alone** to test popup success, token expiry, UI renewal,
or contact matching. Those are release gates before merging #396.

Because the Google OAuth app is currently External/Testing, `gmail.readonly`
refresh tokens generally expire after **seven days**. During those seven days,
automatic hourly renewal/reload recovery should work; a fresh consent around
day seven is an expected provider policy, not an app defect.

Useful docs:
- <https://developers.cloudflare.com/workers/wrangler/configuration/>
- <https://developers.cloudflare.com/workers/wrangler/commands/workers/>
- <https://developers.google.com/identity/protocols/oauth2>
