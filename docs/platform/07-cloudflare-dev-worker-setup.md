# SalesShop DEV — Cloudflare Worker setup (CAD-Lite App pattern)

**Prepared:** 2026-10-30. **Production WORKING as reported by the owner. DEV deployment and password gate NOT yet live-verified.**

## Architecture

| | Production | Development |
|---|---|---|
| Git repository | `finnisqu/SalesShop` | same |
| Branch | `main` | `architecture/react-foundation` |
| Cloudflare Worker | `salesshop` | `salesshop-dev` (to create) |
| Hostname | `app.salesshop.work` (verified sign-in) | `dev.salesshop.work` (proposed) |
| Build command | `npm run build` | `npm run build` |
| Deploy command | current production command | **`npx wrangler deploy --config wrangler.dev.jsonc`** |
| Frontend access | existing Supabase Auth | Worker password gate |
| Data | production Supabase | **local-only sandbox until separate test project** |

## User steps in Cloudflare (do NOT alter the existing `salesshop` Worker)

1. **Workers & Pages → Create → Connect to Git**; select GitHub repo `finnisqu/SalesShop`. If Cloudflare offers an existing project, **create a separate Worker**, rather than switching production's branch.
2. Set Worker name **`salesshop-dev`** and production branch **`architecture/react-foundation`**. Confirm the project is connected to that branch, not `main`.
3. Configure in **Settings → Build**:
   - Root directory: `/`
   - Build command: `npm run build`
   - **Deploy command: `npx wrangler deploy --config wrangler.dev.jsonc`**
   - Preview command, if enabled: `npx wrangler preview --config wrangler.dev.jsonc`
   - Use Node 22 if Node selection is offered; do not add GitHub Actions.
4. First deployment may succeed while serving **503** until the password secret exists. This is deliberate: the gateway denies all asset requests without the secret.
5. **Workers & Pages → salesshop-dev → Settings → Variables and Secrets → Add**. Set name exactly **`SALESSHOP_DEV_PASSWORD`**, type **Secret**, unique strong random value **at least 20 characters**. Keep it in a password manager, not GitHub, browser Vite variables or chat. Save; deploy/redeploy if prompted. Confirm the secret is a **runtime** Worker secret, not a build-only variable.
6. Go to **Domains → Add → Custom Domain**. Enter `dev.salesshop.work` (the desired DEV host); follow Cloudflare's prompts. Do not modify `app.salesshop.work` or CAD-Lite domains. If a DNS record for `dev` exists, inspect it before changes.
7. Optionally turn **OFF preview builds for production Worker `salesshop`**, now that DEV has its own Worker. This avoids duplicate Cloudflare builds. Keep automatic production builds from `main` and automatic DEV builds from `architecture/react-foundation`. If preview builds are enabled for DEV, independently check that the password gate covers every generated preview URL.

## First DEV acceptance test

- Confirm the **actual** `salesshop-dev` deployment in Cloudflare shows **Ready** at the expected Git SHA; distinguish it from the production Worker and GitHub Actions.
- Open `dev.salesshop.work` in a private browser window; it must show the **Worker DEV password prompt**. Without the secret, it must return HTTP 503.
- Wrong password is rejected. Correct password unlocks the app.
- In another unauthenticated/private window, open a direct JS or CSS `/assets/...` path from the deployment; it must return **401**, not the bundled script.
- Verify logout and reauthentication; test a second hostname/preview URL separately. Cookies are hostname scoped.
- App badge should show **DEV LOCAL** plus the committed SHA. The DEV app must not request the production Supabase API; use only fictional/demo records.
- Do not test real customer accounts, invitations, team actions or sync in LOCAL sandbox. These need an isolated Supabase test project and additional acceptance testing.

**Not executed by the authoring session:** Wrangler deploy, Node Worker gate tests, `npm run build`, browser QC, direct asset access test, Cloudflare deployment verification.

## Code layout and safety notes

- `wrangler.dev.jsonc` configures **only** `salesshop-dev`, with `main: "./worker/dev-auth-gateway.mjs"`, assets from `dist`, `ASSETS` binding, SPA fallback and `run_worker_first: true`. A distinct config filename is intentional: the already-working `main` build has no default Wrangler file and must remain unaffected.
- `worker/dev-auth-gateway.mjs` adapts the same private, host-bound password-cookie gateway used by `finnisqu/CAD-Lite-app`. It uses HMAC-signed HttpOnly/Secure/SameSite cookies, short-lived CSRF tokens, no-store/private responses, forced HTTPS, and a fail-closed missing-secret check. This is a shared development password, **not company account authorization** and not a substitute for Supabase RLS.
- `worker/dev-auth-gateway.test.mjs` ports the CAD-Lite gateway's Node-only tests for wrong credentials, invalid tokens, direct assets, logout, and hostname boundaries. Run `node --test worker/dev-auth-gateway.test.mjs` on a trusted development checkout before accepting the gate for sensitive use.
- The Vite build checks `WORKERS_CI_BRANCH` and `WORKERS_CI` (value `1`) and sets non-main Cloudflare builds into local-only mode, so it does not construct clients for the live Supabase project. Do not remove this in favor of a production backend URL. Future DEV account testing will require an explicit separate Supabase project with its own URL, public key, schemas, RLS and test users, plus new fail-closed build selection.
- `public/_redirects` was removed earlier because Cloudflare's SPA routing detected a loop. Do not add it back.

## GitHub Actions and releases

All regular automated GitHub workflow triggers in DEV were converted to manual `workflow_dispatch` for the hosted Actions quota. The existing **main** workflow triggers are still present and could consume minutes on future production pushes. After confirming Cloudflare's production domain and rollback, separately retire/disable main GitHub Pages automation **without changing the active production Worker**. Security/RLS release checks remain mandatory where relevant, even if they must be run manually later.

Cloudflare documentation:
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- https://developers.cloudflare.com/workers/static-assets/binding/
