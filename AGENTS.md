# SalesShop — developer/agent operating instructions

**Active working agreement (October 30, 2026):** Follow the `finnisqu/CAD-Lite-app` DEV workflow: a stable deployed `main`, source-reviewed development on a distinct branch, small auditable commits, an explicit release gate, and living handoff documentation. This document applies **only to `finnisqu/SalesShop`**.

## Read this at the start of every SalesShop development chat

1. Inspect live GitHub `main` and `architecture/react-foundation`, relevant files and open PRs; never assume these example SHAs are current.
2. Read `docs/CONTINUATION.md` for the freshest completed batches, known blockers and next steps.
3. Check `docs/platform/07-cloudflare-dev-worker-setup.md` before changing Worker settings, DNS, build variables or authentication.
4. Keep `main` stable unless the user expressly authorizes a release or production infrastructure change. Ship source-reviewed, contained batches to `architecture/react-foundation`, with precise commit links and honest test/deploy status.
5. After meaningful batches, update `docs/CONTINUATION.md`; update `AGENTS.md` when working rules change.

## Hosting and environment isolation

- **Production**: Cloudflare Worker `salesshop`, hostname `https://app.salesshop.work`, Git branch `main`. The user successfully signed in on October 30, 2026. This verifies access and login, not every feature or every backend authorization policy.
- **DEV (configuration prepared, NOT YET VERIFIED LIVE)**: dedicated Cloudflare Worker `salesshop-dev`, proposed hostname `https://dev.salesshop.work`, branch `architecture/react-foundation`. This worker uses `wrangler.dev.jsonc` and `worker/dev-auth-gateway.mjs`. Set `SALESSHOP_DEV_PASSWORD` as a **Cloudflare runtime Secret**, never a GitHub file, Vite variable or chat message. The Worker deliberately returns 503 when the secret is absent or too short, and protects static assets with `run_worker_first: true`.
- **DEV data**: Cloudflare Workers Builds on any non-`main` branch compiles the frontend in **LOCAL sandbox** mode with live Supabase clients disabled; this is a deliberate interim boundary, not full backend staging. It can exercise application UI without live company data. A separate development Supabase project and test accounts are desirable for login/sync/invite QC but are **not yet created/configured**. Obtain explicit approval before provisioning a project that could incur charges; never point DEV at production by convenience.
- Protect preview/version URLs as well as the custom DEV hostname. The proposed dedicated Worker protects all its assets; any older `salesshop` preview URLs should be inspected independently. A shared password protects the *frontend*, not RLS or per-user authorization.
- Keep real customer data, secret keys, service-role tokens and Resend credentials out of public/test fixtures.

## Source-reviewed development without daily GitHub Actions

- The six routine/PR workflows in `architecture/react-foundation/.github/workflows` are manual-dispatch-only for the October hosted Actions budget; `supabase-staging-privacy-matrix.yml` was already manual-only. The **production `main` workflows are unchanged** and may still run on release pushes. No need for a GitHub Actions run before each DEV commit.
- Cloudflare Workers Builds still must run `npm run build` to deliver a browser bundle. This is hosting compilation, not a successful full functional/browser security QC run.
- Use static source reasoning, small patches, inspect actual data/store/API behavior, preserve undo, stored quote revisions, backend ownership, accessibility, mobile/dark-theme and explicit error states. Avoid broad speculative rewrites.
- Report **source reviewed**, **automated tests not run**, **manual/browser QC pending**, and **Cloudflare deployment status unknown/confirmed** distinctly. Do not assert a green TS/Vitest/Chrome outcome without execution evidence.
- For any promotion to `main` or backend/security change, perform a separate release assessment including actual app login, quote/pricing history, share/signed records, role authorization/RLS, redirects, and rollback. No staged privacy, authentication or data-access migrations until a verified approved gate.

## Daily workflow

1. User requests a contained change; agent inspects live DEV, states a brief batch scope and source reviews.
2. Agent commits reviewed changes to DEV and documents the result; Cloudflare builds the dedicated DEV Worker on a branch push **once the user has connected it**.
3. User opens `dev.salesshop.work`, enters the DEV gateway password and tests with local/demo records, not real customer data. Badge should show DEV/LOCAL/commit.
4. Agent fixes identified issues in DEV. Only after explicit promotion approval and release checks should approved changes be merged into `main`.
5. Production `app.salesshop.work` remains usable during all DEV work.

## Boundaries

- Do not deploy or modify `CAD-Lite-app` or CAD-Lite Classic from SalesShop work.
- Do not disable/replace production authentication or live Supabase, rotate existing keys, change DNS or provision a paid backend without explicit permission.
- Do not silently retire Classic Quotes; quote pricing/customer presentation/history/security parity is a release condition.
- If a Worker gate is introduced or changed, test unauthenticated HTML **and direct JS/CSS URLs**, invalid password, valid password, logout/expiry, and alternate preview hostnames before asserting it is secure.
