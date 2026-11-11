# Legacy sink pricing protection — November 10, 2026

A historical draft must not change totals merely because it is viewed in Quotes Beta or switched between editors.

## Behavior
- No automatic conversion on editor mount. The existing sink pricing flag and saved managed-line inclusion remain authoritative.
- Previously specification-only sinks stay uncharged. On all visible Beta editing surfaces, the seller can deliberately toggle billable inclusion. Before saving, the confirmation shows the **current** and **proposed** customer quote totals and the difference.
- Warn when the selected sink has no selling price, and if another manual sink price exists in the Area (potential double charge).
- Editing an existing excluded managed sink must not make its charge billable. New Beta sink rows retain the intended default; setting a zero sell price is distinguishable from a missing price.
- Frozen signed/issued records remain read-only through existing quote store guards.
- External bid cloud acknowledgment now confirms that a retry is for the original recording user and logging timestamp, not merely a matching project, date and amount.

## Verification
Run `npm run test:sink-parity`, `npm run test:quote-registry`, `npm run test:external-quotes`, and `npm run build`. Test Classic-to-Beta draft switch on a seeded legacy quote, confirmation cancel/accept on phone and desktop, a manual sink line alongside a managed sink, and refresh/undo after opt-in.

## Access testing boundary
Live Supabase has one membership in each of three separate organizations; it is not an isolated two-user test fixture. Verified current security-invoker view and source RLS read-only, but did **not** run live two-user sign-in or create billable staging infrastructure. Auth-based cross-user/RLS testing remains gated by a disposable staging environment.

## Additional cloud-line safeguard
An existing managed sink line keeps its original ID as an inactive line when the seller removes its charge. This prevents a stale priced line being recreated after sync, while a deleted sink still removes its line entirely.

## Verified build and manual browser release gate — November 11, 2026

- The JSX brace error was corrected on PR #95. The later preview deployment failure was caused by missing `previews` configuration, not a failed application build.
- `wrangler.jsonc` now declares SPA assets and `"previews": {}`. The release-candidate Cloudflare check passed, including the TypeScript build, default Quick Quote tests, sink-parity unit tests and preview deployment.
- Added `e2e/legacy-sink-pricing-qc.pw.ts`: synthetic $630 saved quote including an unbilled legacy sink ($225) and separately priced builder sink allowance ($150). Browser acceptance checks that confirmation **cancel** preserves pricing, **approve** adds exactly $225, opt-out subtracts only the managed charge, refresh retains the inactive managed line ID and further opt-in does not duplicate it. A sent quote's checkbox and sell-price editor must be disabled.
- Browser verification is **manual-only** and does not use Cloudflare production or customer Supabase. From GitHub Actions, choose **SalesShop Navigation Smoke**, select the **`batch/legacy-sink-guard-qa-20261110`** branch then click **Run workflow**. The branch version runs legacy sink QC first, followed by existing navigation smoke tests. This is optional/manual and does not reactivate CI on pushes.
- Alternatively on a local checkout: `npm run test:sink-parity:browser` (requires Playwright Chromium).
- Merge of PR #95 remains blocked until that manual browser run succeeds and human review confirms acceptable desktop/phone presentation. Do not use customer quotes to conduct this test.
