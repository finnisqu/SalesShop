# Batch 344 — Release readiness: reassigned Deal obligations and private Task merge safety

## Objective

Audit the code-level release gate after Batches 340–343b and fix two concrete risks before the next feature. Keep GitHub Actions/browser QC disabled at the user's request; the existing Cloudflare deployment build remains responsible for TypeScript, registered Vitest suites, the record gate and Vite compilation.

## Finding 1 — Reassigned Deal remained in former rep's Home agenda

**Before:** `personalCalendarSources` used a rep's historical SalesShop Quote or Task associations to add a Deal to the personal calendar, even after `assignedUserId` changed to another rep. This could reintroduce a "Submit quote" Deal fallback on Home or expose unrelated coworker Activity through a project-wide relationship. The newer external-quote submission audience rule already prioritized explicit assignments, leaving Home inconsistent.

**After:**
- The personal Home Deal list now honors the explicit current `assignedUserId` over legacy native quote, personal Task and external quote relationships.
- A former rep's own **historical** SalesShop Quote, external submission, and authored Activity remain visible where appropriate; the new assignee's unrelated Deal Activity is no longer pulled in merely because the former rep had an old linked Task.
- New `personalCalendarTasks` hides an **open, auto-generated** `deal-submit:` Task from Home while that Deal is explicitly assigned elsewhere. It retains the former rep's user-authored personal Tasks and **completed/canceled** Task history.
- `SalesCalendarLauncher` uses that shared helper, so the Home week, month, agenda, outstanding list, and calendar badges all receive the same filtered Task input.
- Existing app-wide private Task reconciliation continues to cancel the former rep's stale automatic submission Task and create exactly one stable Task in the current assignee's personal workspace after cloud sync.

## Finding 2 — Malformed Task timestamps could overwrite a valid cloud record

**Before:** `taskWinsMerge` compared `updatedAt` strings lexicographically if it could not compare two parsed dates. A corrupt local timestamp such as `zzzz-invalid` could therefore take precedence over a valid cloud Task. Equivalent ISO timestamps with different timezone spellings also incorrectly appeared ordered.

**After:**
- A valid parsed date always wins over an invalid version on the same Task ID.
- Valid dates compare by numeric UTC instant, regardless of timezone string formatting.
- On tied or both-invalid timestamps, the existing tombstone precedence applies; otherwise remote ordering remains stable.
- The monotonic confirmed-submission proof and per-user/workspace merge guards remain unchanged.

## Release test coverage

- Added `src/services/releaseOwnership344.test.ts`: **6 cases** for former/current rep calendar visibility, authored and completed Task preservation, native/external Activity history, local/unassigned routing, and cancellation/recreation of the deterministic bid Task without duplicating it across users.
- Expanded the registered `src/services/personalTaskSubmissionMerge330.test.ts` suite to **7 cases** with corrupt clock, valid remote/local version precedence and equal UTC instants under different timezone offsets.
- `package.json`'s existing Cloudflare `test:quick-quote` command now references **77 distinct test files**. All 77 paths were verified in the repository tree and none are duplicated.
- Source assertions and import/wiring contracts checked, but **TypeScript, Vitest, Vite, browser QA, and an actual Cloudflare deployment have not been executed or confirmed in this session**.
- Do not enable any GitHub Actions or automated browser checks without a user request.

## Hands-on release acceptance

1. Create a Deal with a bid due date, assign it to salesperson A, and create a SalesShop Quote and Submit Quote Task. Confirm both Home and Tasks correctly show the obligation.
2. Reassign that Deal to salesperson B before submission. Without an additional page refresh, A should no longer see the Deal's pending bid deadline on Home; A's older personal Quote and authored Activity should remain accessible.
3. After the private Task clouds reconcile, A's automatic Task should be canceled and B should receive exactly one stable Submit Quote Task. Repeat reload and reconnect to check no duplicates.
4. Complete a different historical Task as A and then reassign the related Deal; the completed Task should remain in Recents rather than disappearing.
5. Verify B can see the Deal and associated permitted CRM history but A does not inherit B's later calls merely from the older linked quote.
6. Confirm a native quote's **issue** event does not complete a Task. Customer delivery does; a cloud-acknowledged external builder-portal submission does too. Check historical external backfills stay on their true sent date.
7. Reconnect a device carrying a newer Task edit and older confirmed submission proof: merged notes/due dates must be preserved without losing the proof; only a customer submission can clear the protected obligation.
8. Test another device with a malformed Task `updatedAt`. Valid server edits must not be overwritten; deletion tombstones still win ties.
9. Review WARM/DARK/LIGHT on desktop and phone, then confirm actual Cloudflare build logs are green before treating this release as deployed.

## Next

Use concrete Cloudflare errors or manual QC feedback to clear remaining release blockers, then plan the next feature batch. Multifamily project Gantt remains deferred.
