# Batch 339 — Cross-page Records state isolation and Task completion QA

## Objective

Eliminate high-impact cross-page state contamination and inconsistent Task completion feedback while preserving SalesShop's shared Worktable foundation, local preferences, quote lifecycle and mobile layouts.

## Findings and fixes

### 1. Records directory state could leak across reused table instances

`ConnectionsTable` already scoped saved **sorting** by table key but its other view state was not scoped in the same way. If the component instance was reused when switching Records tabs, the next directory could temporarily see the previous directory's columns, pins, page size or selection. Its persistence effects could also write the previous directory's column or pin state under the new directory's storage key.

**Resolution:** `src/components/useWorktableDirectoryState.ts` adds one reusable scoped state pattern. It exposes the destination directory's loaded value immediately, tags subsequent updates with the initiating directory, and persists values against **the snapshot's own directory key**, never the currently rendered directory key.

`ConnectionsTable` now uses this for:
- Saved visible/reordered columns and pinned comparisons
- Separate stored Records page size and Catalog-mode page size
- Current page index
- Selected row IDs
- Open bulk edit/task dialogs and mobile multi-select mode

Selection and transient modes reset on directory changes. Existing cross-page selection **within a single directory**, sorting preferences, column reordering, pin comparisons and pagination controls are preserved. The existing validated `sortState.tableKey` logic remains unchanged.

### 2. Task bulk completion did not clearly identify unfinished checklists

The Task store already prevents completion with unfinished subtasks and guards generated bid-submission tasks. However, bulk completion previously accounted for blocked bid submissions only. Checklist-blocked tasks stayed open with no explanatory feedback, creating an apparent discrepancy between Task row actions and their stored state.

**Resolution:** `src/services/taskCompletionEligibility.ts` centralizes completion eligibility for the UI, without weakening any store-level safeguards:

- Generated bid-submission tasks must have a confirmed quote delivery or recorded external submission
- All checklist subtasks must be completed
- Already completed or canceled tasks are excluded from bulk completion targets
- Mixed bulk selections complete only eligible tasks and report the number blocked by each reason
- Direct Task row completion, table quick actions and mobile checkbox affordances use the same blocker rules and contextual guidance

## Regression coverage

- `src/services/worktableDirectoryState339.test.ts` — isolation of columns/preferences, directory identity on functional updates, cleared cross-directory selections, scoped persistence, pagination and mobile/bulk modes
- `src/services/taskCompletionEligibility339.test.ts` — protected bid tasks, confirmed submissions, incomplete checklist handling, mixed bulk selections, canceled/completed no-ops and visible UI guards

Both suites are registered in the existing `test:quick-quote` command and will run during Cloudflare's `npm run build`. Source consistency checks passed. Cloudflare TypeScript/Vitest/Vite confirmation and interactive browser checks are still pending.

## Acceptance checks

1. In **Connections → Companies**, customize Columns and pin a record. Navigate to People, Deals and Tasks. Confirm each directory has its own controls, pins and page sizes. Return to Companies and check its preferences are intact.
2. Select rows in Companies and switch to Tasks or Quotes. The selection and bulk edit sheet must not transfer, even if similarly named or identically keyed records are present. Within the same directory, cross-page selection should continue working as before.
3. Toggle **Columns** and pagination repeatedly on Tags/Catalog and standard Records views. The two modes must preserve their appropriate page sizes; no older column configuration should overwrite the other directory's saved configuration.
4. Select a mixture of ordinary Tasks, a protected bid-submission Task, a Task with unfinished subtasks, and already completed or canceled Tasks. Bulk Complete should update only eligible Tasks and identify the blocked groups.
5. In the mobile Task list, a Task with an unfinished checklist should not allow completion via its checkbox. Check the blocked reason/help text and retry after completing its checklist.
6. Confirm a generated bid-submission Task becomes eligible only after confirming an internal quote submission or recording a valid external quote. Its guarded state should remain consistent on refresh.
7. In WARM/DARK/LIGHT modes and mobile/tablet widths, ensure worktable headers, focus rings, filtered datasets, pins and existing Customer Quote snapshots still render unchanged.

## Remaining QA and roadmap

This batch is focused rather than a claim of full end-to-end parity. Continue with cloud-save reliability checks, record inspector inline editing, mobile keyboard/sheet behavior and final cross-page theme consistency. The Deal timeline/Gantt remains intentionally deferred.
