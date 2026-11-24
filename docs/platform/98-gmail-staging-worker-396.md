# #396 — API-only Gmail Staging Worker (not a SalesShop app deployment)

**Status (Nov 24, 2026):** Operator reports the Cloudflare staging Worker build is green at
`https://salesshop-gmail-396-staging.finnisquick.workers.dev`. The Worker URL
is now pinned as a safe, public `GMAIL_OAUTH_ORIGIN` value in
`wrangler.gmail396.staging.jsonc`. This status is based on operator confirmation;
we have not independently verified the live endpoint or configured private
runtime secrets.

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

## Easier setup: Cloudflare dashboard (no terminal required)

**This is the recommended option for the operator.** The code is in an unmerged
GitHub feature branch, not GitHub `main`; simply clicking the repository's
Code button on `main` will not show the staging configuration. Use
[the exact branch](https://github.com/finnisqu/SalesShop/tree/feat/gmail-persistent-oauth-396)
or let Cloudflare select it during Git import.

1. Open [Cloudflare Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
   and choose **Create application** → **Import a repository** (under Workers,
   not Pages). If the wording differs slightly, choose the option that deploys
   a GitHub repository as a Cloudflare Worker.
2. Connect/select the existing GitHub repository **`finnisqu/SalesShop`**.
   You are creating a **new Worker**, not editing or reconnecting the existing
   SalesShop production deployment.
3. Set the Worker/project name to **`salesshop-gmail-396-staging`**.
4. Choose the Git/production branch **`feat/gmail-persistent-oauth-396`**,
   **not `main`**. This is the production branch of the *isolated staging
   Worker*, not of SalesShop.
5. Keep the **root directory** at the repository root (empty or `/`).
   **Build command**: leave empty (this API-only Worker needs no Vite/static
   app build). **Deploy command**: enter this exact command:
   ```
   npx wrangler deploy --config wrangler.gmail396.staging.jsonc
   ```
   This explicit `--config` is essential: the repository's default
   `wrangler.jsonc` belongs to SalesShop production.
6. Select **Save and Deploy**. The result should be a new Worker with a URL
   of the form `https://salesshop-gmail-396-staging.<your-account>.workers.dev`.
   Copy that complete HTTPS URL. Do **not** set up a custom domain or route.
7. Visiting the bare Worker URL deliberately shows **Not found** (HTTP 404);
   it hosts only the API, not a frontend. Before private bindings are added,
   `/api/gmail/persistent/status?organization_id=68af5ab1-aa83-43c9-b442-93b0f3bb7ca7`
   should show an unavailable response (HTTP 503). This is expected.

**Stop here initially** and share only the new `workers.dev` URL. The next
stage adds Worker-scoped secrets privately through **that Worker's Settings →
Variables and Secrets**, with no secrets written to GitHub or ChatGPT.
Cloudflare's Workers Git integration supports custom deploy commands and
repository branches:
<https://developers.cloudflare.com/workers/ci-cd/builds/configuration/>.
If you cannot select the feature branch or edit the deploy command, stop
rather than deploy with defaults; use the CLI fallback below or share the
non-secret setup screen.

## Troubleshooting: Wrangler config file not found (ENOENT)

If the Cloudflare build logs show
`Could not read file: wrangler.gmail396.staging.jsonc` or
`ENOENT ... /opt/buildhome/repo/wrangler.gmail396.staging.jsonc`,
the build was most likely cloned from **`main`**, not from the Gmail feature
branch. This config file is intentionally present **only** on
`feat/gmail-persistent-oauth-396` until the stacked PRs are approved.

For the **separate** `salesshop-gmail-396-staging` Worker only:

1. Navigate to **Workers & Pages → salesshop-gmail-396-staging →
   Settings → Builds → Branch control**.
2. Set the **production branch** of this *staging Worker* to the **exact**
   `feat/gmail-persistent-oauth-396` branch (not `main`). In this context
   Cloudflare's "production branch" is simply the branch deployed as the active
   version of this isolated testing Worker.
3. Inspect the failed build's Git branch / commit metadata. Builds already
   queued or running before the branch change retain their original checkout;
   rerunning such a build may reuse the older revision.
4. After saving Branch control, **start a new build for the feature branch**
   (e.g. a new commit on that branch), rather than retrying an old `main`
   build. Confirm the new build reports the expected branch/commit.
5. If the log still reports `main`, check whether you edited **this staging
   Worker's** branch control rather than the existing SalesShop Worker.
   Do not move, copy or overwrite the default `wrangler.jsonc`.

The staging deploy command remains
`npx wrangler deploy --config wrangler.gmail396.staging.jsonc`.
Do **not** "fix" this by dropping `--config`, as the repository default
Wrangler file configures a different Worker.

Cloudflare docs:
<https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/>.

## Alternative — deploy from your local checkout (CLI)

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

## Step 2 — Add five secrets in the Cloudflare dashboard

Your **staging** Worker URL is
`https://salesshop-gmail-396-staging.finnisquick.workers.dev`.
`SUPABASE_URL` and `GMAIL_OAUTH_ORIGIN` are already public variables
in the staging Wrangler config. They **do not** need dashboard secrets.

Open **Cloudflare → Workers & Pages → salesshop-gmail-396-staging →
Settings → Variables and Secrets → Add**. For each name below choose
**Type: Secret** (not Plaintext), enter the exact value privately and
select **Deploy** to apply. Never enter these as *Build variables*.

| Worker Secret | Where to get value |
| --- | --- |
| `SUPABASE_PUBLISHABLE_KEY` | **Sales Shop Staging** Supabase project → Project Settings → API Keys → Publishable `sb_publishable_...` key |
| `SUPABASE_SECRET_KEY` | **Same staging project** → Project Settings → API Keys → Secret `sb_secret_...` key (create one if needed, server-only) |
| `GOOGLE_GMAIL_CLIENT_ID` | Google Cloud → Google Auth Platform → Clients → dedicated **Web application** staging client ID (`...apps.googleusercontent.com`) |
| `GOOGLE_GMAIL_CLIENT_SECRET` | Secret belonging to the **same dedicated staging Google client**; never use the production secret |
| `GMAIL_TOKEN_ENCRYPTION_KEY` | New, securely generated, base64-encoded **32 random bytes**; save a safe recovery copy in a password manager, do not reuse a production key |

**Supabase source project must be `lztviymnqplloarwywde`, never
`pvchgibllozuwickhfqz`.** Google OAuth Audience can remain Testing;
add any test Gmail account under Google Auth Platform → Audience → Test users.

For the Google Web application staging client, register
`https://salesshop-gmail-396-staging.finnisquick.workers.dev` (without
trailing slash) as an **Authorized JavaScript origin**. The staging Worker is
API-only and hosts **no browser OAuth popup**: when we subsequently create
a staging frontend, its *actual* browser origin must also be registered and
the frontend must use that same client ID. There is no `/gmail/callback`
route in this API-only Worker.

Generate the 32 random bytes on **your own device**, never in chat.
For example, in Chrome's DevTools Console on a trusted HTTPS page,
enter the following one-liner, then privately copy the output directly to
Cloudflare's secret field (do not publish it):

```js
btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
```

After saving all five secrets and deploying the new Worker version,
visit [the unauthenticated staging status test](https://salesshop-gmail-396-staging.finnisquick.workers.dev/api/gmail/persistent/status?organization_id=68af5ab1-aa83-43c9-b442-93b0f3bb7ca7)
in your browser:
- `503` and `{"configured":false,"connected":false}` = a value is
  still missing/invalid, or the deployed version did not load secrets.
- `401` and `{"error":"Sign in to SalesShop again"}` = all required
  backend values passed the configuration gate, and the API correctly
  requires an authenticated staging JWT.
- A plain `Not found` at the Worker **root** URL is normal (API-only).

**Do not send secrets, API keys, passwords, browser tokens or the random
encryption key in chat.** Only report whether the unauthenticated status
test returns `401` or `503`. The next stage will use synthetic staging
users for real authenticated server-side tenant-isolation tests.

## Step 3A — Browser-based user isolation test (easiest)

The dedicated staging Worker now also serves a **static, read-only test
page** (it is not a SalesShop frontend):

<https://salesshop-gmail-396-staging.finnisquick.workers.dev/audit>

After the branch's latest Cloudflare build is green:

1. Open the exact `/audit` URL above in a browser.
2. In **Owner — Company A**, enter the **synthetic staging Auth user's**
   login email and password for the first test user and click **Test Owner**.
3. In **Colleague — Company A**, use the second test user's **staging-only**
   email and password and click **Test Colleague**.
4. In **Outsider — Company B**, use the third test user's **staging-only**
   email and password and click **Test Outsider**.
5. Each role should report four PASS checks: anonymous rejection (401),
   access to its own company (200 and not connected), cross-company denial
   (403), and no direct read of private credential data.
6. Report **only the PASS/FAIL summaries**, never actual email addresses,
   passwords, access tokens or API keys. The page does not use localStorage,
   sessionStorage or persistent tokens; passwords are sent directly by your
   browser to *staging* Supabase Auth. No backend endpoint collects passwords.

The page is restricted to the staging Worker host and staging Supabase URL,
with a strict Content Security Policy. The public publishable key is the
*only* key it can retrieve; it cannot fetch a privileged secret, Google
client secret, encryption key or Gmail message. It never inserts a credential
and never initiates Google OAuth. It refuses real production organizations
because they are not among its three fixed staging fixtures.

If a role says **staging sign-in failed (400)**, check that the correct
synthetic staging account has an email/password login and a confirmed email
in Supabase Authentication. Do not reset actual production users.

This UI provides a practical **read-only live Worker authentication and
isolation test**, complementing the already executed rollback-only
database-level write-denial audit. It does not replace the broader synthetic
credential owner-versus-colleague test below.

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
The Worker has no CRM frontend. For the command-line audit, the script obtains
staging JWTs using synthetic credentials in the operator's private runtime.
For a simpler read-only browser check use the /audit page above.

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
