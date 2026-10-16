# SalesShop React → main: release-readiness gate

Prepared October 15, 2026. This checklist is a **preparatory record, not cutover authorization**.

## Immutable prototype recovery reference

- Prior `main` (October 3): `35dbe943b03ca55c5789ff9f6dd4a7e28b297636`.
- Verified retained branch: `backup/pre-react-main-2026-10-15` points to that exact SHA.
- This is a **source-code recovery reference only**. It is **not** a database or uploaded-file backup.
- Preserve this branch through the cutover and only consider pruning after tested rollback and explicit approval.

## React release candidate

- Integration base: `architecture/react-foundation`.
- Quotes Beta Batch 18G: PR #64, fixes compact mobile header, lifecycle vocabulary and customer-document flow. **Do not merge before complete green CI at the exact final head SHA.**
- Required GitHub checks: TypeScript/Vite build + unit, Navigation Smoke, Pricing Schedule Workbook QC, Visual QC (phone 320/390/430, landscape, tablet, desktop), and applicable SQL/RLS security suites. Verify any skipped jobs are intentionally not applicable.
- Preserve Classic Quotes; Beta is not certified for Classic retirement.
- Inspect and resolve all new critical errors before proposing promotion into `main`.

## Deployment control: HOLD until externally verified

- GitHub Pages production steps are manual-dispatch only in `.github/workflows/react-foundation.yml`. A GitHub Pages guard **does not** control Cloudflare Pages or Netlify webhooks.
- Identify the actual production deployment provider for `salesshop.work`, production branch, build settings, custom domain, environment variables, preview handling and any auto-deploy-on-`main` hook **in the provider dashboard**.
- Confirm the `main` merge will **not** unintentionally publish. Temporarily disable live auto-deploy or otherwise guarantee a separately authorized release. Record deploy ID, live commit, DNS/domain and tested rollback procedure.
- Run public unauthenticated page/asset/deep-link smoke. Authenticated and customer-data checks must use approved secure test accounts.
- No GitHub branch merge automatically authorizes a website deployment.

## Data and authorization: HOLD until separately verified

- Production Supabase project was read-only checked during preparation; no migration, new project/branch, Edge Function deployment, Auth change or flag change was approved.
- Confirm a recoverable and tested database restore point and any files/Storage backup **before public cutover**. The old GitHub code backup is insufficient for user data recovery.
- Staged private Quotes/CRM RLS and Deal roles migrations must remain dormant pending an isolated, real-auth JWT/RLS role matrix and coordinated rollout.
- On October 15 the owner deferred billable Supabase development branches. Obtain separate explicit cost approval before provisioning any one; never use production customer data as test fixtures.
- Verify Owner/Admin/Salesperson/Viewer/outsider isolation, invitations, session transitions, quote ownership, direct REST permissions, link/share revocation, historical signed records, cloud sync, and legacy records with *real* synthetic staging accounts. Simulated SQL checks alone do not establish production privacy.
- Review existing Supabase security advisor findings; PUBLIC/SECURITY DEFINER grants must be examined function-by-function rather than changed blindly.

## Functional release acceptance

1. Quote from name → Company/Deal → takeoffs/Areas → pricing → Review → customer Preview → explicit Approve → Issue → Share; no link falsely claims delivered.
2. Pricing parity against the estimating workbook: SF, backsplash, sink cost/sell distinction, material variants, nonzero/zero/negative lines, discounts, tax, different pricing methods and hidden customer costs.
3. Revision identity, immutable historic share/signed snapshots, archive and restore, role access and account switching.
4. Browser back/deep links; mobile touch/landscape; all appearance themes.
5. Back up actual data, dry-run rollback and obtain user acceptance on representative real sales jobs before broad team availability.

## Promotion protocol — requires an explicit later decision

1. Freeze development at a named reviewed commit; rerun release checks for that SHA.
2. Verify external deploy hooks, backups, real-auth acceptance, and approved production maintenance window.
3. Obtain explicit authorization to merge the React candidate into `main`.
4. Merge with expected-head checks; verify `main` SHA.
5. Separately authorize and carry out public deployment; inspect logs and run production smoke before declaring release complete.
6. On failure, restore app code from the protected backup reference; coordinate any data restoration independently and only from a verified database backup.

**Current gate:** Preparing the React branch is allowed; merging `main`, deploying `salesshop.work`, changing production Supabase, or sunset of Classic is **not** authorized by this document.
