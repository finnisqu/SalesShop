# Deal assignee permission acceptance — 2026-11-04

## What was hardened
- The Deal assignment picker previously filtered for owner/admin and member departments that can issue quotes. Now the database rejects a **new** assignment to an ineligible teammate regardless of client behavior.
- A trigger in `private` checks `organization_members` for the current organization and the assignee's `role` / `job_function`, using invoker security and a locked search path. This does not widen CRM RLS policies or create public access.
- To avoid breaking normal Deal edits, unchanged assignments remain on a Deal even if the teammate was subsequently demoted. Users see the existing assignment with a warning and can reassign it.
- Automatic bid-submission Tasks now also respect **current quote-issuing permission**, not just the existence of an assigned ID. Removing issue permission cancels that person's active auto-created submission tasks the next time their private tasks synchronize, without deleting historical completions.
- No existing Deal was assigned or deleted; all 14 previously unassigned Deals remain unchanged.

## Database verification
Applied Supabase migration `20261104102047 guard_deal_assignee_quote_eligibility`.
Verified active `projects_validate_quote_assignee` trigger, invoker security, and Deal count (14, assigned 0).
Supabase security/performance advisors still report existing general advisories (including executable security-definer functions, unindexed FKs, and multiple permissive policies); no fresh RLS policy was created for this change.

## Acceptance tests when Cloudflare build log becomes available
1. `npm run build` runs strict TypeScript, Quick Quote regression tests, and Vite.
2. `npm run test -- src/services/dealSubmissionAudience.test.ts src/services/dealAssignees.test.ts src/services/normalizedCrmSyncAssignment.test.ts`.
3. Assign an eligible salesperson and reload both Board and Deal details. Confirm persisted assignee, single private bid submission Task for that person, and calendar due date unaffected.
4. Attempt a non-quote-issuing assignee (viewer, estimator, project manager). The database must reject changes, including direct API attempts, and the UI must show a clear save error.
5. Remove quote-issuing permission after assignment: the Deal remains, the assignee displays as ineligible, the person's automated submission task ceases at next sync, and unrelated Deal edits still work.
6. Switch the assignee while an old tab holds a stale selection; expect server conflict feedback rather than silent overwrite.
7. Cross-device reload/keyboard/mobile styling check; ensure preexisting unassigned Deal deadlines remain visible and no new assignment is inferred.

## Unverified
Cloudflare Pages build completion and real browser testing could not be retrieved from the current connections. GitHub Actions and commit statuses are disabled/unreported, per the chosen workflow.
