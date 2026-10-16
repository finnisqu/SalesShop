# Connections 2.0 — Batch 17B: privacy-first layout and quiet record history

**Base:** `feature/connections-record-pages-batch-1` (`cc297b78`).
**Branch:** `feature/connections-privacy-polish-batch-2`.
**Deployment:** Draft PR only; production `main` remains unchanged.

## Decisions

- Connections starts with **Companies**, then **People** and **Projects**. There is no top-level Overview/Sales Dashboard.
- Old `salesshop-connections-tab-v1` values `overview` and `activity` are migrated to Companies; the activity log never becomes the default landing page. No dashboard data is displayed.
- The old `Dashboard.tsx` and dashboard styles are preserved in source, not rendered or linked; reactivation requires privacy review.
- **Activity history** is retained as a secondary on-demand utility behind a `More` menu in Connections. Its presentation is descriptive, not a request to log more.
- Company pages lead with **Projects and Quotes**; People remain related, and the activity history log is collapsed by default in the secondary column.
- Derived activity-based account-health labels and explanations are removed from the Company record and Connections company directory. Board's existing account pipeline is not modified by this UI-focused batch.
- Read-only Connections browsing no longer displays cross-company workspace totals at the top.

## Privacy boundary — not yet complete

This is a **UI privacy alignment change**, NOT a database authorization fix. It does not change Supabase RLS, normalized CRM cloud reads, cached snapshots, or old grants. `docs/security/02-privacy-first-sales-ownership.md` documents broader owner/admin and team read risks that require a separate authenticated role-matrix rollout before the feature is considered privacy-safe in the security sense.

## Verification

- `src/components/Connections.test.tsx`: primary sections, old session migration, no dashboard render.
- `e2e/connections-privacy-navigation.pw.ts`: 390px / 1280px directories default, secondary Activity access, old session migration.
- `e2e/connections-company-record.pw.ts`: company-centric Projects/Quotes, history collapsed until requested.
- Full TypeScript/Vite, Vitest, and Playwright CI via draft PR.
- Manual theme and phone-landscape review still needed after browser tests.
