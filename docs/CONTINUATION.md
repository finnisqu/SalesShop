# SalesShop — living DEV handoff

## 2026-10-30 — Cloudflare production available; dedicated DEV Worker source prepared

**Owner-verified production:** The user signed in successfully at `https://app.salesshop.work` after configuring the Cloudflare `salesshop` Worker domain. This verifies frontend access and existing login. Do not claim full workflow/security acceptance from that alone.

**Branch roles:** `main` is stable and published on `salesshop`. Day-to-day development is on `architecture/react-foundation`; inspect its live GitHub HEAD before writing any batch. Preserve all unrelated CAD-Lite App and CAD-Lite Classic deployments.

**Implemented in DEV source (source-reviewed, not deployed/test-executed):**
- New `wrangler.dev.jsonc` defines an independent `salesshop-dev` Worker using `./dist` static assets and an always-on Worker-first password gateway.
- `worker/dev-auth-gateway.mjs` adapts the CAD-Lite App password gateway to SalesShop DEV: runtime `SALESSHOP_DEV_PASSWORD` secret, fail-closed 503 without a strong secret, HMAC cookie, CSRF-protected login/logout, host-bound signed cookie, direct asset gate. Source tests ported in `worker/dev-auth-gateway.test.mjs`.
- `docs/platform/07-cloudflare-dev-worker-setup.md` gives exact owner dashboard setup for a dedicated Git-connected Worker, `architecture/react-foundation` branch, `npm run build`, `npx wrangler deploy --config wrangler.dev.jsonc`, runtime secret, `dev.salesshop.work`, and manual acceptance steps.
- `AGENTS.md` establishes CAD-Lite-style continuity, source-reviewed development, isolation/release boundaries and explicit unverified status.
- Six automatic/PR GitHub Actions workflows in **DEV only** now use manual `workflow_dispatch`, preserving job definitions for future quota and release acceptance. Production `main` workflows are UNCHANGED; future `main` pushes may still trigger Actions.
- Existing Cloudflare Workers Builds DEV-branch sandbox switch in `vite.config.ts` keeps the non-main frontend LOCAL and does not construct production Supabase clients. Existing DEV build badge shows `DEV LOCAL` with the embedded SHA.

**Not yet done:** Cloudflare `salesshop-dev` project does not have an independently verified deployment or URL; the DEV gateway secret has not been entered; proposed `dev.salesshop.work` DNS is not connected; Worker tests, frontend build and browser checks have not run for this batch. No Supabase test project or DEV account login exists. **Main branch production was not edited** in this batch.

**Owner's next actions:**
1. Use `docs/platform/07-cloudflare-dev-worker-setup.md` to create **separate** `salesshop-dev` Git-connected Worker on branch `architecture/react-foundation` with deploy command `npx wrangler deploy --config wrangler.dev.jsonc`.
2. In that Worker, enter `SALESSHOP_DEV_PASSWORD` as a runtime **Secret** (unique 20+ character password), not a build-only variable; do not share it in chat.
3. Verify that the new Worker is **Ready**, shows a password prompt, blocks unauthenticated direct JS/CSS asset requests, and shows the new `DEV LOCAL` badge after unlocking.
4. Connect custom domain `dev.salesshop.work` after verifying Worker URL. Once dedicated DEV publishes, disable duplicate preview builds on production `salesshop` if desired.
5. Before retiring the old GitHub Pages publisher, confirm current Cloudflare production works and retain a rollback path; release checks and security gates stay independent.

**Next engineering after DEV URL:** Confirm actual Cloudflare Worker build and gateway tests. Then improve the DEV login experience by provisioning a truly isolated Supabase project with test-only auth and RLS, if owner approves; never point DEV to production for convenience. Only promote DEV to `main` after separate explicit release approval and proper QC.

## Older context

On October 30, the initial `salesshop` Worker build failed with Cloudflare redirect loop (the legacy `public/_redirects` file). It was deleted from both branches; production `main` fix commit was `ccd550b`, DEV fix `b0e8c38`. The user subsequently confirmed Cloudflare production login on the real custom domain. On DEV, the earlier HOME scrolling fix, React foundation, Quotes/Connections improvements and build badge remain unmerged and intentionally do not appear in production until accepted. The source-reviewed engineering process is documented at `docs/engineering/19-source-reviewed-development-loop.md`.
