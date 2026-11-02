# SalesShop — active development workflow

**Current arrangement (November 2026): the user elected to make routine fixes directly on `main`.** Do not silently create or require a DEV hosting project.

- Production: Cloudflare Worker `salesshop` at `https://app.salesshop.work`. The owner confirmed sign-in after the hosting cutover. Production data remains in the existing Supabase project.
- Source: `finnisqu/SalesShop`, active branch `main`. Inspect its current SHA before writing. Never wholesale-merge `architecture/react-foundation`: that branch has unreviewed extra DEV hosting files, password gateways and local-preview sandbox behavior.
- Process: contained, source-reviewed changes, preferably grouped into one atomic commit to avoid repeated Cloudflare builds. GitHub Actions automatic checks are active again for November; see the rules below. Runtime/browser/security acceptance remains required for high-risk work.
- GitHub Actions: **restored November 2, 2026**. Automatic `SalesShop CI` runs TypeScript/Vite build and all Vitest unit tests on push to `main` and PRs targeting `main`. Navigation smoke, workbook/browser QC, visual QC, and disposable PostgreSQL RLS checks are automatic for relevant changed paths; manual `workflow_dispatch` remains available.
- The `.github/workflows/react-foundation.yml` filename is historical; its workflow now does **checks only**, not GitHub Pages deployment. Cloudflare Workers Git integration still independently deploys `main`. Passing Actions does **not** gate Cloudflare publication; do not call a pushed commit release-accepted until deployment and real-auth acceptance are verified.
- `Supabase Staging Privacy Role Matrix` stays **manual-only**, tied to `sales-shop-privacy-staging` and disposable accounts/secrets. Never auto-run staging against production or provision a billable staging branch without approval.
- Hosting: Cloudflare Workers Git integration performs the Vite build and deployment on `main`. Never add back `public/_redirects` (it caused a Cloudflare redirect loop).
- UI: the build badge reports the **loaded bundle's** branch and short Git SHA, not the latest moving GitHub HEAD.
- Safety: normal fixes can flow directly to production, but changes to Supabase schema/RLS/Auth, private quotes, customer sharing, credentials, or major irreversible workflows require explicit review and an appropriate release gate. Never expose service-role keys in client code.
- Rollback: record the last known good Git SHA and Cloudflare deployment before a risky change. Confirm the new Cloudflare deployment and smoke-test login/Quotes/HOME manually; do not claim runtime QC without evidence.
- Next task: continue addressing specific SalesShop workflow issues on `main`. The October DEV HOME scrolling correction and build badge were selectively brought into main; no DEV sandbox/password settings were copied.
