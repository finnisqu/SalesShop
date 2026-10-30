# SalesShop: migrate frontend hosting from GitHub Pages to Cloudflare

> **Update — October 30, 2026: Cloudflare Workers (static assets), not Cloudflare Pages.** The user's Cloudflare build log shows `npx wrangler deploy`, worker name `salesshop`, and auto-generated `assets.not_found_handling: "single-page-application"`. The Vite build succeeded, but Worker deployment failed with error 100324 because `public/_redirects` contained `/* /index.html 200`. This file was deleted from both `main` (commit `ccd550b`) and DEV (commit `b0e8c38`). Workers serves SPA fallback natively and rejects the looping redirect. These new commits are source fixes; Cloudflare deployment success still needs verifying.
>
> **For the existing Workers project**, use Workers & Pages → **salesshop** → **Deployments** → **View build history** to check the new main build and active deployment. Check **Settings → Build → Branch control**: production branch `main`, **Enable Preview Builds** for DEV. On current Workers Builds, the preview command is `npx wrangler preview`; preview URLs appear under the Worker's **Previews** section. Use **Access → Protect this Worker behind Access → Previews only** to protect the dev deployment before testing with any accounts; the dev frontend still uses the live Supabase backend unless separately isolated. Check the actual assigned preview URL rather than assuming `pages.dev`. Reference: https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/ and https://developers.cloudflare.com/workers/configuration/cloudflare-access/.
>
> **Decision — public previews without Zero Trust (October 30):** The owner chose to skip Cloudflare Access. Preview URLs must be treated as **public**. The DEV branch now reads `WORKERS_CI_BRANCH` and `WORKERS_CI_COMMIT_SHA` (Cloudflare Workers Builds' actual predefined variables). When `WORKERS_CI=1` and the branch is not `main`, the Vite bundle embeds `__SALESSHOP_PREVIEW_SANDBOX__=true` and **does not construct the Supabase cloud or Playground identity clients**. It opens the app in local-only mode and displays `DEV LOCAL <commit>`. DEV changes and sample data remain confined to the browser origin; no Supabase Auth, live company data, team sync or email/invite flows can be tested in this public preview. Never enter real customer information there. The production `main` branch remains connected to its existing live backend. This does **not** constitute secure staging for authentication/RLS testing; maintain the existing security release gates.
>
> **Cloudflare navigation:** the screenshot confirms **Settings → Builds → Previews Base** has preview builds enabled with `npm run build`, `npx wrangler preview` and root `/`. No Access subscription is required for basic public previews. On a successful push to DEV, retrieve the actual generated Preview URL from **Deployments → Previews** or **View build history**; do not assume a Pages hostname. Cloudflare docs: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/ and https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/.
>
> **The setup guide below documents the Pages alternative and should not be followed for the already-created Worker.** Do not create a second Pages project just to remedy this error. Keep the current GitHub Pages host live until Workers production is verified, then coordinate `app.salesshop.work` cutover.


**Prepared:** October 30, 2026  
**Status:** Setup instructions only. **Cloudflare project, preview URL, DNS cutover, and production switch are NOT yet confirmed.**

## Existing facts

- Git repository: `finnisqu/SalesShop`.
- Existing production application hostname: **`https://app.salesshop.work`**, not the apex `salesshop.work`.
- Existing deploy job: `.github/workflows/react-foundation.yml`. It publishes **main only** to GitHub Pages, and writes `app.salesshop.work` to `dist/CNAME`.
- Development branch: `architecture/react-foundation`; changes on it do not reach the live app until promoted.
- Site: React/Vite SPA; `npm run build` makes `dist/`; `public/_redirects` already contains `/* /index.html 200` for client-side navigation.
- Cloudflare exposes `CF_PAGES_BRANCH` and `CF_PAGES_COMMIT_SHA` while building. `vite.config.ts` already embeds those into the DEV/MAIN build badge on the development branch.
- The current Supabase URL and browser publishable key have application defaults in `src/lib/supabase.ts`. A **preview build will still connect to the current Supabase project** unless isolated deliberately; frontend previews are not backend staging.

## Phase 1 — set up Cloudflare Pages without changing production

1. Sign into the appropriate Cloudflare account at https://dash.cloudflare.com. Go to **Workers & Pages** and choose **Create** > **Pages** > **Connect to Git** (wording may vary). If a Pages project is already linked to this repository, inspect its existing branch and DNS settings instead of creating a competing project.
2. Authorize Cloudflare's GitHub integration for `finnisqu/SalesShop`. Use the repo itself, not an uploaded `dist` ZIP.
3. Select **main** as the **production branch**. Give the project a distinct name if `salesshop` is already taken.
4. Configure the build:
   - Framework: React (Vite) / Vite.
   - Root directory: repository root (`/`).
   - Build command: `npm run build`.
   - Output directory: `dist`.
   - Node.js: version **22** (`NODE_VERSION=22` if required by Cloudflare build settings).
   - Optional: `VITE_BASE_PATH=/` (the default is already `/`).
   - Do **not** run the old GitHub Pages artifact upload, `CNAME` injection, or `404.html` copy in this Cloudflare build.
5. In **Settings > Environment variables**, configure appropriate `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values if necessary, separately for production/preview. These are **browser-visible** public configuration values. Never enter a Supabase service-role/secret key or Resend API key into a `VITE_*` variable.
6. Deploy to the generated `<project>.pages.dev` URL first. Confirm the successful build logs, HTML/assets, routes, app login and data access. **Do not** change `app.salesshop.work` DNS or disable the old GitHub Pages workflow yet.

Cloudflare build docs: https://developers.cloudflare.com/pages/configuration/build-configuration/  
Cloudflare Git connection docs: https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/

## Phase 2 — development preview

1. In the Pages project, go to **Settings > Builds > Branch control** (some versions call this **Builds & deployments**).
2. Keep **main** for production. Under preview branch control choose **Custom branches** and include only `architecture/react-foundation` for routine development builds. This is automatic **build/deploy** on commits, not a mandatory test/Playwright/CI gate.
3. Find the preview URL in **Deployments**. Do not guess the hostname. Note that the actual branch preview URL may be a generated `<id>.<project>.pages.dev` address and is distinct from the production root URL.
4. In **Settings > General**, enable a **Cloudflare Access policy** for preview deployments. Preview URLs are **public by default**; restrict them to approved testers before using them with SalesShop accounts.
5. Since the preview frontend currently connects to **live Supabase** by default, use synthetic/test data only and avoid edits to real customer records. A genuinely isolated Supabase environment remains deliberately deferred and would need a separate approval.
6. For preview email confirmation, password reset and invitation testing, review **Supabase Auth > URL Configuration**. Add only the exact preview callback URL(s) you intend to support to allowed redirect URLs. Preserve the production application URL `https://app.salesshop.work`. The UI redirects are origin-derived by `appAbsoluteUrl('/');` in `src/store/authStore.ts`.
7. Confirm the badge shows **DEV** and the commit SHA from **that loaded preview deployment**, not the moving GitHub branch head.

Cloudflare preview docs: https://developers.cloudflare.com/pages/configuration/preview-deployments/

## Phase 3 — production cutover (after both environments are verified)

1. Compare `main` production on the new Pages `<project>.pages.dev` URL against the current GitHub Pages `https://app.salesshop.work`. Verify login, refresh/deep links, existing Quotes/Connections/Notebook/Catalog, mobile, and customer-facing quote links. Check browser console for asset/route errors. The main site is intentionally still the last approved main release; **do not deploy DEV features by accident**.
2. In the Pages project, open **Custom domains** > **Set up a domain** and add **`app.salesshop.work`**. Follow Cloudflare's prompted CNAME/DNS change from the GitHub Pages target to the Pages project. If the old CNAME conflicts, coordinate replacement; do not blindly delete other DNS records or touch MX/SPF/DKIM/DMARC/Resend configuration.
3. Confirm HTTPS, login/auth redirect, invite and recovery flows, customer links, cached assets and SPA deep-link reloads at the canonical hostname.
4. Once verified, retire the existing GitHub Pages deploy job in `.github/workflows/react-foundation.yml` and disable GitHub Pages publishing as appropriate. **Do not** disable before the switch is proven; the existing GitHub Pages site is the rollback path.
5. Preserve rollback information: previous DNS record target, GitHub Pages workflow, last known-good `main` commit, and Cloudflare Pages deployment ID. If the new host fails, restore the previous DNS target and GitHub Pages publishing.

Cloudflare custom domain docs: https://developers.cloudflare.com/pages/configuration/custom-domains/

## Current development process and safety notes

- Routine source-reviewed development on `architecture/react-foundation` may continue **without requiring separate CI, Vitest or Playwright gates**; Cloudflare still needs a successful *static Vite build* to publish. The recommended `npm run build` currently includes TypeScript checks (`tsc --noEmit && vite build`). Do not describe unexecuted tests as passed.
- The Supabase privacy, private-quote RLS, signing and Shop Outcomes staging gates remain unchanged. **This hosting move does not authorize database migrations**.
- Do not expose staff/customer data on unrestricted preview URLs.
- Migrating hosting is **not** equivalent to merging DEV into `main`. Leave production unchanged until a separate release decision.

## Owner QC checklist

- [ ] Cloudflare GitHub integration connected to `finnisqu/SalesShop`
- [ ] `main` build successful at actual generated production `pages.dev` URL
- [ ] Only the intended development branch gets preview deploys
- [ ] Preview deployment protected by Cloudflare Access
- [ ] DEV badge shows expected branch/commit after refresh
- [ ] Supabase Auth redirects reviewed for actual hostnames
- [ ] Production domain `app.salesshop.work` cut over and manually verified
- [ ] Previous GitHub Pages publisher retired only after verification
