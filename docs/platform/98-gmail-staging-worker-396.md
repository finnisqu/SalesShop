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
  no client policies; server-only privileges. As of the saved-visibility test,
  **one deliberately invalid, reconnect-only staging fixture is present**.
  There are no real Google refresh tokens or active grants.
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

## Nov 24 staging audit troubleshooting: three early failures

A first browser run revealed three independent issues:

- A **400** on test-role sign-in: Supabase rejected the email/password combination.
  A role is identified by its **Auth user UUID**, not by the label chosen on
  the test form. Check the expected UUID suffix shown next to each form;
  when in doubt inspect staging Authentication → Users. Never share passwords
  or session tokens.
- **A valid sign-in returned 503 for own-company status:** the Worker used
  `redirect:'error'` on outbound `fetch()` calls. Cloudflare Workers
  **explicitly do not implement** redirect error mode: this throws
  `TypeError` before any Supabase request is sent. This was the backend
  cause, not a Supabase schema or credential problem. The fix changes all
  five Worker outbound requests to `redirect:'manual'`; **3xx is then a
  normal unsuccessful response, not followed automatically**. Staging health
  diagnostics use manual mode as well.
- A **signed-in user mismatched the chosen test role:** the synthetic
  account corresponding to each role's UUID had been entered in a different
  form. The updated audit page shows a UUID suffix for each role; do not
  change the fixture memberships to match a guessed email ordering.

After a new **green staging-branch Cloudflare build**, open the
[Worker connectivity check](https://salesshop-gmail-396-staging.finnisquick.workers.dev/audit/health).
Expected statuses are typically `authEndpointStatus:401` (anonymous
GoTrue user lookup correctly requires a token) and
`privateMembershipReadStatus:200` (staging Worker can read an empty,
server-authorized membership query). A zero status means a network
request failed before receiving an HTTP response; `-1` means a
binding is absent. The endpoint returns **only two numeric statuses**,
never keys, user records, tokens or provider response bodies.

Then rerun the Owner, Colleague and Outsider tests at the
[staging audit](https://salesshop-gmail-396-staging.finnisquick.workers.dev/audit)
using the synthetic identities matching the UUID suffixes. **Do not run
the old cached Worker version or change production credentials.**

Cloudflare runtime reference:
<https://developers.cloudflare.com/workers/runtime-apis/request/#options>

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

## Nov 24 — troubleshooting partial results in saved-fixture browser test

A follow-up run of `/audit?fixture=saved` showed:

- **Outsider (Company B): 4/4 checks passed** including own-company 200,
  Company A forbidden 403 and no browser access to private credentials.
- **Colleague (Company A): Supabase Auth returned HTTP 400 at sign-in.**
  Staging SQL confirmed the expected Colleague user exists, belongs to Company
  A, and has confirmed email. This is a staging test credential/sign-in issue
  rather than a CRM membership/RLS failure. Check or reset **only** the
  Colleague's staging password in Supabase Auth, not production.
- **Owner (Company A): generic browser "Failed to fetch" after Supabase Auth
  had accepted a password sign-in (HTTP 200 in the staging gateway logs).**
  The failure could be one of the following browser requests (anonymous
  status, own status, POST refresh, direct table probe), and the old audit page
  discarded successful earlier checks. No exact step can be inferred from
  that original screenshot alone.

The staging audit UI now wraps each browser request with a stage-specific
failure label and displays the PASS checks accumulated before the failure.
This is strictly **test diagnostics**, not a Gmail authorization logic
change. When the latest staging branch rebuild is green, retry the Owner
and Colleague using their existing synthetic staging accounts. If the Owner
fails again, report only the stage/error message and previously listed PASS
checks, not passwords/tokens. Do not change production settings.

The dummy credential remains deliberately `reauthorize` and is present
only in staging until the three-role test succeeds or we explicitly clean it
up. The exact-match cleanup file is
`docs/platform/sql/396-gmail-saved-fixture-cleanup.sql`.

## Step 3B — Owner-only saved credential visibility (current test)

**Status (Nov 24, 2026):** The following staging-only SQL was applied to
`lztviymnqplloarwywde`:
`docs/platform/sql/396-gmail-saved-fixture-staging.sql`. A follow-up database
query verified **one exact synthetic row, zero active grants, and three
unchanged company memberships**.

The row belongs only to the synthetic Company A Owner account and contains
`gmail396-owner-fixture@example.invalid` as the obvious dummy mailbox.
Its bogus ciphertext is not a Google credential; its status is
**`reauthorize`**, so the Worker must return HTTP **409** rather than try
to decrypt or refresh it.

After the **latest feature-branch staging Worker build is green**, open:

<https://salesshop-gmail-396-staging.finnisquick.workers.dev/audit?fixture=saved>

Use the same three **synthetic staging** email/password accounts as before
(in the correct Owner / Colleague / Outsider form):

- **Owner — Company A:** expect PASS for anonymous 401, *owner-only saved
  dummy mailbox metadata* 200 with `needsReconnect=true`, blocked refresh
  409, other-company denied 403 and direct browser credential read denied.
- **Colleague — Company A:** expect PASS for anonymous 401, own mailbox
  remains **null** (the Owner's saved credential is not shared), foreign
  company denied 403 and direct browser credential read denied.
- **Outsider — Company B:** expect PASS for anonymous 401, own mailbox
  remains **null**, Company A denied 403 and direct browser credential read
  denied.

This extends the original empty-table audit with a **nonempty** credential
table. If any test fails, send the **error summary only**, not any account
password, access token, secret, or personal email.

**Cleanup is required after this test.** The exact-match deletion script
`docs/platform/sql/396-gmail-saved-fixture-cleanup.sql` removes only the
dummy `reauthorize` row, with all organization, user, mailbox, ciphertext
and nonce fields matched. When the operator reports results, execute it
against staging via the Supabase connector, then verify zero rows. **Never
run that script on production.** The dummy row is intentionally persistent
between the three role tests; it is not a background task or real grant.

## Step 4 — Real Google OAuth code popup (optional, explicit opt-in)

**Updated November 24, 2026:** The Owner/Colleague/Outsider dummy saved
credential check passed all **13/13** expected browser checks. The
`gmail396-owner-fixture@example.invalid` row was then removed using the
exact-match staging cleanup script. A real staging SQL query verified
**zero credential rows**, with all three memberships and both synthetic
organizations intact. Production's `gmail_oauth_connections396` table
remains absent.

A new **standalone Gmail OAuth popup test** is available on the separate
staging Worker after the feature branch's next green deployment:

<https://salesshop-gmail-396-staging.finnisquick.workers.dev/oauth-test>

The `/oauth-test` page is separate from the read-only `/audit` page, and
does not host SalesShop's full UI. It serves its own local JS/CSS, loads
the official `https://accounts.google.com/gsi/client` authorization
library, and has `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
The CSP allows only the exact staging Supabase origin plus Google's
identity domains. `/oauth-test/config` exposes only the *public*
`sb_publishable_...` key and Google **client ID**, never a Google client
secret, Supabase server secret or AES encryption key.

**Google Cloud prerequisites (no credentials in GitHub):**
- In Google Auth Platform → Clients, use the distinct staging **Web
  application** OAuth client whose ID and secret were configured in this
  Worker. Add the exact origin
  `https://salesshop-gmail-396-staging.finnisquick.workers.dev` to
  **Authorized JavaScript origins** (no trailing slash). Google code popup
  uses the *origin* as the code exchange `redirect_uri`; it does not
  require a custom callback page.
- In Google Auth Platform → Audience (External, Testing), add the Google
  account you intend to authorize as a **Test user**.
- Enable the **Gmail API** in that Google Cloud project if not already
  enabled. Confirm the OAuth consent screen and restricted Gmail scope are
  configured for testing. Do not bypass any unexpected safety warning.

**Steps, all in the browser:**
1. Open `/oauth-test` on the **staging** Worker, after the new Cloudflare
   build is green. This test is optional and does **not** connect a Gmail
   mailbox automatically.
2. In Step 1, sign in with only the **synthetic Company A Owner** Supabase
   staging credentials (user UUID ending `64a99`). This is *not* your
   Google login and not your live SalesShop login. The page clears the
   password field immediately and keeps the session JWT in JS memory only.
3. Click **Check saved status**; it should report not connected initially.
4. If you want to test real Gmail consent, click **Connect test Gmail
   (read-only)**. Choose a Gmail test account you control and confirm the
   explicit `gmail.readonly` scope. Only proceed if you trust the Google
   client and its consent screen. The browser forwards Google's one-time
   code to the staging Worker; it never receives the refresh token.
5. If connect succeeds, expect a connected mailbox message with a
   short-lived access-token issuance indication (the token itself is never
   printed). The Worker verifies the actual Gmail mailbox via Google's
   profile endpoint and encrypts the refresh credential in staging.
6. Click **Test token renewal**. It should return a new short-lived token,
   without another popup. Click **Check saved status** again.
7. To check persistence across browser reload, reload the page, sign in
   again using the same **synthetic staging Owner** credentials, then click
   **Check saved status** and **Test token renewal**. No Google popup
   should be needed while the provider refresh grant is valid.
8. When finished, click **Disconnect this staging grant**, explicitly
   approve the confirmation, and check that the connection is gone. If
   disconnect errors or the browser closes, tell the developer so the
   test-only row can be inspected and safely cleaned up. Do NOT send any
   OAuth token, browser session token, API key or password.

The Worker keeps Google refresh tokens AES-GCM encrypted, keyed to its
staging-only user and organization. Neither the page nor the status
endpoint returns them. Although this page does not read Gmail messages,
**gmail.readonly allows reading them**; use a disposable or explicitly
chosen test mailbox rather than confidential mail.

Because the OAuth app is in Google **Testing** status, refresh grants for
Gmail scope usually expire after **seven days**. We can validate initial
connect/reload/hourly refresh now; this staging check cannot prove a
connection survives a week. The separate production release and Google
OAuth verification process remains a later gate.

References:
- <https://developers.google.com/identity/oauth2/web/guides/use-code-model>
- <https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid>

## Later release gate — full SalesShop UI and longer-term reauthorization

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
