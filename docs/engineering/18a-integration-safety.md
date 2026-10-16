# Batch 18A — React foundation integration, controlled release

The `architecture/react-foundation` workflow formerly published a GitHub Pages deployment on **every branch push**. That behavior is incompatible with integrating a large development-only PR stack without affecting a live or public Pages site.

## Branch safeguards

`.github/workflows/react-foundation.yml` now:
- Continues to build and test on pushes and PRs targeting `architecture/react-foundation`.
- **Does not configure Pages, create a deployment artifact, or deploy on pushes/PRs.**
- Allows those deployment steps only after an **explicit manual workflow_dispatch**, still subject to the existing `sales-shop-pages` environment controls.
- Has a static Vitest contract asserting the guard remains in place.

## Integration release procedure

1. All latest-source build, navigation, pricing workbook, RLS SQL and comprehensive visual CI must be green.
2. Confirm the stack of PRs #50–#59 is strict fast-forward ancestry from `architecture/react-foundation` (no commits behind or conflicts).
3. Add and verify the deployment guard before the development branch is advanced.
4. Update `architecture/react-foundation` to the reviewed linear head (never to production `main`), then verify it runs only build/QC workflows, **not** the Pages deploy job.
5. **Do not** deploy Supabase migrations: private quote/CRM permission migrations and per-user Deal roles remain staged pending an approved disposable Auth/JWT matrix.
6. Keep Classic Quotes enabled until quote-price and customer-document parity acceptance.
7. Independently inspect any Cloudflare/Netlify external GitHub branch hooks before a public deployment; this GitHub Actions guard cannot control external platform triggers.

**No integration action authorizes a public deployment.** A future production cutover requires explicit approval and separate signed-off release gates.
