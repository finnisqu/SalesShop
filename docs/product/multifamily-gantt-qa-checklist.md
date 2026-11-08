# SalesShop — Gantt feature release checklist (PR #67)

**State:** Draft-only; production table has NOT been modified, and frontend cloud feature flag stays OFF.

## Automated commands to run from a checked-out repository

```sh
npm ci
npm run build
npm run test:timeline
npm run test:calendar
npm run test
npm run test:visual
```

These commands are **not verified as passing** in the current connector-only environment. The GitHub connector permits code review and commits, but not repository shell execution; the current execution container cannot resolve GitHub to check out the private repository. Do not call this branch green until a real build and test log exists.

## Blocking correctness checks

- [ ] Compilation: TypeScript parses the deduplicated `dealScheduleEditing.ts`, and no new module imports are unresolved
- [ ] Phase templates: start once, add/import more buildings, delete a middle phase and add another, verify unique IDs/names
- [ ] Dependencies: removing an import unlinks buildings without deleting their installation and invoices
- [ ] Planned vs. actual: reverse dates rejected; real finish overlays planned finish; no default date or deposit values invented
- [ ] Device scope: sign out and sign in as a different user/organization, verify no previous user's device draft in UI
- [ ] Role preview: viewer/estimator/purchasing cannot write CRM execution schedules; salesperson/PM/owner can when actual role permits
- [ ] Home: dates appear in collapsed **On this day → Project milestones**, not added to pending Tasks/bid counters
- [ ] Follow-up Task: opt-in only, linked to correct Deal, no duplicates when clicked twice or merged across devices
- [ ] No changes to quick-quote, deal stage, activities, existing calendar preferences, or other CRM records when editing a timeline
- [ ] Theme contrast: light/dark, focus ring, select/date-input text, mobile keyboard not clipped

## Manual desktop and iPhone viewport matrix

- [ ] Desktop 1440 and 1024 widths: Deals header stays one height in List/Timeline; milestones scroll horizontally within Gantt, not the entire application
- [ ] Phone 390 and 320 widths: defaults to compact milestones, imports/buildings/closeout initially collapsed; sections expand without scrolling sideways
- [ ] Group row supports **expand/collapse** and separate **Edit** action with keyboard focus
- [ ] Date and amount inputs stay inside screen at narrow widths and with iOS date picker open
- [ ] Scrolling and sticky phase names keep bar labels aligned; Today line is visible only when date lies within chart range
- [ ] Calendar squares remain at established compact Home height; project indicator does not overlap urgent or other badge dots
- [ ] Return from individual timeline to Deal record preserves navigation and existing search
- [ ] No duplicate calendar or Task items from repeated page opens

## Staging database security / concurrency matrix

**Only run these after provisioning an explicitly approved isolated Supabase staging environment, at known cost.** Do not apply the staged SQL to the production project.

- [ ] Verify `deal_execution_schedules` is inaccessible to unauthenticated users
- [ ] Nonmember with known organization and Deal ID cannot SELECT, INSERT, UPDATE or DELETE
- [ ] Member with CRM read-only permission can SELECT, not mutate
- [ ] Authenticated CRM editor can insert only under an existing Deal in their organization
- [ ] Cross-organization FK insertion fails even for a legitimate Deal ID in another organization
- [ ] `updated_by` spoofing rejected by RLS
- [ ] Simultaneous edits from two browser sessions: first revision wins, stale revision raises conflict, remote version reloads, local unsaved edit is not silently published
- [ ] Older device-only draft is **not** imported until user explicitly chooses Publish; existing shared schedule is never replaced
- [ ] Reload browser, sign out/in, switch users and verify tenant separation and all rows survive
- [ ] Delete synthetic Deal and confirm only its own schedule cascades
- [ ] Check Supabase security advisors, rollback procedure and logs before release

## Release gate

1. Keep PR #67 a draft while tests and security checks remain unverified.
2. Run tests/build in a checked-out workspace, record exact results in the PR.
3. Obtain explicit approval for an isolated staging database if it incurs cost.
4. Validate the SQL, run auth matrix and two-browser concurrency in staging.
5. Only after fresh production approval: formal migration, secure RLS verification, then independently enable `VITE_DEAL_SCHEDULE_CLOUD_ENABLED`.
