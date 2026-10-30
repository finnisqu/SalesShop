# SalesShop development loop without CI or automated browser checks

**Adopted:** October 30, 2026  
**Scope:** Day-to-day React work against `architecture/react-foundation`. This is a development-process note, **not** a production release approval or permission to bypass security validation.

## Working model

1. Confirm `main`, `architecture/react-foundation`, existing open PRs, and the files touched by the proposed batch. Start feature batches from the current development head; do not write feature code directly to `main`.
2. Make narrow, named batches. Prefer an isolated `batch/*` branch and an explicit PR back into `architecture/react-foundation`. Keep changes to pricing, quotes, security, and navigation separate when possible.
3. Review the actual source diff, dependencies, routes, state/store actions, data migrations, error states, touch targets, and mobile/dark-theme CSS. Use known reference calculations and static test-case reasoning for pricing. Check no credentials or customer fixtures are added.
4. Record in every delivery/PR what **was inspected** and what **was not executed**. If build, Vitest, Playwright, GitHub Actions, or signed-in browser tests are unavailable, mark them **NOT RUN**; never claim green or production-ready from source review alone.
5. Merge reviewed development batches only after reading the updated head and diff; retain a clear rollback commit/PR. For UI changes, provide a small hands-on QC script the owner can run in their own browser or device when available.
6. Before any `main` promotion, perform a separate release assessment. `main` is the automatically published GitHub Pages source; a development merge is **not** production authorization.

## Practical inspection checklist (no CI/browser required)

- **User workflow:** verify source paths for create, edit, save, reload/hydration, cancel, duplicate, delete, back navigation, and empty/error states as relevant.
- **Data safety:** preserve persisted formats, IDs, quote history and issued/signed snapshots. Do not silently change local/cloud ownership or pricing semantics.
- **UI:** inspect mobile/desktop layout rules, click/touch handlers, overlays, focus/keyboard paths, light/dark theme selectors. Visual appearance remains **unverified** until human/browser review.
- **Pricing:** trace input -> calculation -> stored revision -> customer preview, including zero/negative/blank values, material variants, sinks, SF rates, allowances and hiding/itemization. Pricing behavior remains **unverified** without executable reference scenarios.
- **Security:** do not promote staged RLS, private CRM/quote ownership, signed Shop Outcomes, Auth/invites, flags, or Edge Functions on source-only confidence. The isolated real-user Auth/JWT matrix and approval remain required.

## Test status vocabulary

- **Source-reviewed:** code and diff inspected; no assertion of runtime behavior.
- **Automated checks NOT RUN:** CI/build/unit/browser tests not executed or not available.
- **Manual QC pending:** user-facing interactions need a trusted-device check.
- **Ready for release assessment:** a review candidate, not permission to deploy.
- **Released:** only after an authorized `main` promotion and appropriate deployment verification.

## Important deployment constraint

Existing GitHub Actions may still run automatically. We are **not relying on their results** to do day-to-day source-reviewed development, but we are also **not disabling** them or bypassing branch protections. The `.github/workflows/react-foundation.yml` Pages job currently builds/tests before deploying `main`; if Actions are unavailable, auto-deployment may be blocked. Resolve the release mechanism explicitly before promising a production deployment. Development branches should never auto-deploy to the public app.

## Explicitly deferred

The two existing security PRs (private CRM ownership and verified starter-quote sync) need separate security treatment. Do not create a billable Supabase development branch, migrate production data, flip privacy flags, or deploy an Edge Function without explicit authorization and appropriate staging evidence. Retain Classic Quotes until Beta pricing, issue/share, history, and signed-document parity are accepted.

## Per-batch report template

**Batch / branch / commit:** …  
**Implemented:** …  
**Source review:** exact touched surfaces and cases examined  
**Not run:** build / unit / browser / signed-in staging (as applicable)  
**Known risks:** …  
**Owner's 3–6 manual QC steps:** …  
**Next batch:** …
