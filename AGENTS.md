# SalesShop — active development workflow

**Current arrangement (November 2026): the user elected to make routine fixes directly on `main`.** Do not silently create or require a DEV hosting project.

- Production: Cloudflare Worker `salesshop` at `https://app.salesshop.work`. The owner confirmed sign-in after the hosting cutover. Production data remains in the existing Supabase project.
- Source: `finnisqu/SalesShop`, active branch `main`. Inspect its current SHA before writing. Never wholesale-merge `architecture/react-foundation`: that branch has unreviewed extra DEV hosting files, password gateways and local-preview sandbox behavior.
- Process: contained, source-reviewed changes, preferably grouped into one atomic commit to avoid repeated Cloudflare builds. GitHub's seven Actions workflows are **manual only** because hosted minutes are exhausted; this is not a substitute for full release/browser/security tests.
- Hosting: Cloudflare Workers Git integration performs the Vite build and deployment on `main`. Never add back `public/_redirects` (it caused a Cloudflare redirect loop).
- UI: the build badge reports the **loaded bundle's** branch and short Git SHA, not the latest moving GitHub HEAD.
- Safety: normal fixes can flow directly to production, but changes to Supabase schema/RLS/Auth, private quotes, customer sharing, credentials, or major irreversible workflows require explicit review and an appropriate release gate. Never expose service-role keys in client code.
- Rollback: record the last known good Git SHA and Cloudflare deployment before a risky change. Confirm the new Cloudflare deployment and smoke-test login/Quotes/HOME manually; do not claim runtime QC without evidence.
- Next task: continue addressing specific SalesShop workflow issues on `main`. The October DEV HOME scrolling correction and build badge were selectively brought into main; no DEV sandbox/password settings were copied.
