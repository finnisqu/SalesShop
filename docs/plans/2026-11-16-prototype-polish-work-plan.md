# SalesShop — November 16, 2026 Prototype & Polish Work Plan

> **Status:** COMMITTED PLAN. This document is the handoff/source of truth for today's short-term development. Update this file **in the same commit** as a completed batch, recording exact files, SHA, Cloudflare result, user/device acceptance, and any failed checks. Do not mark build/browser checks passed from source review alone.
>
> **Product direction:** The CRM core is already useful for day-to-day salesperson activity. Prioritize visible productivity and prototype **working, user-testable slices** of new capabilities. Avoid splitting a meaningful feature into a string of microscopic commits. Preserve data integrity, authenticated permissions, existing Quotes and draft recovery.

## Working conventions

- **One batch = multiple related user-visible improvements**, one reviewable commit when possible. Reuse current components; don't rebuild working functionality.
- **Statuses:** Queued · In progress · Source committed / build pending · Build green / device QC pending · Verified · Blocked · Deferred. An item already implemented should be marked **Existing / verify**, not built again.
- Cloudflare's exact deployed SHA and build output, authenticated browser checks, role preview, mobile viewports, and optional offline/reload checks are recorded separately.
- Source changes on GitHub `main` and Cloudflare's existing `npm run build` gate; do not turn on costly branches or CI/browser automation.
- Never run disposable SQL on the production Supabase project, or make destructive cloud workspace resets. Shared custom fields stay disabled until isolated real RLS negative tests and explicit migration approval.
- **No work can continue unattended.** When the user returns in a new conversation, read this file, GitHub head/commits and their latest Cloudflare result, then continue from the next open row.

## #388b — Focus-aware Gmail OAuth popup completion · November 18, 2026

**Status: Source prepared / Cloudflare and real-Google acceptance pending.** User confirmed popup remained active after account selection while SalesShop showed error. Replace premature 800-ms popup-close rejection with a focus-aware, 4-second grace once SalesShop regains focus, leaving 90-second total timeout, explicit denials and Gmail read-only scope unchanged. Add safe memory-only OAuth event sequence to Tools → Email diagnostics. See [#388b acceptance](../platform/90-gmail-focus-aware-oauth-388b.md).

## #388a — Gmail popup connection diagnosis and recovery · November 18, 2026

**Status: Source prepared / Cloudflare and real-Google acceptance pending.** Fix a user-reported failed Google popup flow (OAuth `popup_closed`) by allowing a bounded late callback and adding an on-demand live header/origin/library/client-ID diagnostic in Tools → Email. Stop treating every popup close as proof of origin mismatch; show actionable Cloudflare/Google configuration checks. Preserve read-only scope, ephemeral tokens, no Gmail writes or background jobs. See [#388a recovery notes](../platform/89-gmail-oauth-recovery-388a.md).

## #387 — Proposed Records and Smart CRM Suggestions · November 18, 2026

**Status: Source prepared / Cloudflare and authenticated browser acceptance pending.** Tools → Suggestions contains an opt-in decision inbox. Deterministic hints from **current user's** manual Activity summaries and notes (including Notebook-origin touchpoints) propose explicit new People, unique-email Activity→Person links and explicit YYYY-MM-DD follow-up Tasks. Review/Edit/Accept/Dismiss, account-scoped dismissal, stale-evidence rejection, CRM permission checks, private Task sync barrier and cloud-confirmed Activity/Person mutations. Read-only until Accept; no full Notebook scanning, inferred relative dates, Gmail automation, AI service, server scheduler, or cloud schema changes. See [#387 acceptance notes](../platform/88-proposed-crm-suggestions-387.md).

## #385b — Reviewed Deal–Person relationship import · November 18, 2026

**Status: Source prepared / Cloudflare and authenticated browser validation pending.** Extend Tools → Import with a relationship mode for existing Deal and Person records. Import CSV/Excel, map native SalesShop IDs or unique email/Deal-name-plus-Company matches, review row status and select specific Ready relationships, optionally assign a role, and create through `useDealPeopleStore.add` with scope/permissions checked before and during each sequential save. Existing links remain unchanged; failures are shown as partial, never atomic. See [#385b acceptance guide](../platform/87-crm-relationship-import-386.md). No new schema, external-ID mapping, bulk record creation, or automated merges.

## #385 — CRM Data Import v0.1 · November 18, 2026

**Status: Source prepared / Cloudflare and authenticated device QC pending.** Tools → Import supports CSV/Excel Company, Person and Deal migration with source-field mapping, previews, duplicate/ambiguous flags, exact Company links, explicit confirmation, and additive core CRM creation using existing permissions and cloud sync. See [#385 acceptance guide](../platform/86-crm-data-import-385.md). No shared custom fields, SQL migrations, Quote writes, or auto-overwrites. Import Companies first; People and Deals link to existing Companies. Cloud partial-confirmation errors are disclosed, not silently retried.

## #384 — Reusable custom workflows · November 18, 2026

**Status: Source prepared / Cloudflare and device acceptance pending.** Extend the existing Automations v0.2 with an opt-in **My workflows** editor for up to eight independent stage-to-Task rules. Templates: Blank, Bid Follow-up, Negotiation, Won Deal Kickoff, Discovery. Rules start disabled and support edit, duplicate, delete with confirmation, private Task preview, per-rule idempotency, scope and role guards. Keep all four existing built-ins; no Gmail or server writes. See [#384 acceptance notes](../platform/85-custom-workflows-templates-384.md).

## #383 — Configurable stage-triggered Task automation · November 18, 2026

**Status: Source prepared / Cloudflare and device QA pending.** Add a fourth opt-in rule to Tools → Automations: choose an existing live Deal stage, Task name and offset; preview event-backed matches; create a private Task through the existing safe executor. Keep current ownership and role scope, idempotency, browser-only config, 20-task automatic cap and no external messaging. **No changes to production Supabase, Quotes, stage definitions, or background workers.** See [implementation and testing notes](../platform/84-stage-task-automation-383.md).

## #380 — Guided plug-and-play CRM Setup · November 2026

**Status: Source prepared / Cloudflare and device QA pending.** Add a three-step Setup flow to Settings → CRM Setup: choose optional starter, customize draft terminology/workflow/stages/record-panel presentation/module intentions, review idempotent field changes, and save the profile locally per user/organization. Includes optional Real Estate starter field pack and rollback on browser storage failure. Does not publish custom fields or change live pipelines. Use [implementation acceptance guide](../platform/81-guided-crm-setup-380.md). Exact GitHub SHA and latest Cloudflare status should be recorded after the build. CAD-Lite remains on hold; production RLS/staging untouched.

## November 17 — final Gmail refinement and next work area

**Build #370 (email wrap-up):** Configurable private reply-review age windows (1–7 day minimum; 7/14/30 day maximum), option to suggest replies only for existing CRM People, four one-click Gmail query presets, and explicit batch Mark reviewed / Snooze 3 days actions with confirmation. Preferences and review choices remain scoped to a single SalesShop user/Gmail mailbox and stored only in that browser. They are not email writes, automatic Activities, Tasks, notifications, or background Gmail monitoring. Build/check status and real-account acceptance are tracked separately.

**After #370 (re-prioritized November 17 by user):** Pause Gmail feature expansion except bug fixes, and **explicitly HOLD P5 CAD-Lite integration** while CAD-Lite is being updated independently. Do not touch that repository, shared formats, deep-link contracts or quote takeoff imports until resumed.

**Build #371 · Files & Quote Sharing:** Expand existing browser-local linked-file prototype with categorized drawings/bids/contracts/specifications, exact-ID related Company/Deal/Quote filtering, and on-demand **read-only current-revision** native customer Quote Share lookup. An external Quote remains a linked file target but is never given a fictitious SalesShop Share token. No new database, provider uploads, quote issuing, customer delivery confirmation, token persistence or pricing modification. This is the current working batch; Cloudflare and user acceptance are separate release gates.

**Next after #371:** Pursue guided **plug-and-play CRM Setup**, reusing existing sample-field blueprints, starter packs and local configuration while preserving cloud-field security hold until disposable RLS tests pass. Later return to automations or analytics once Files and onboarding work are validated.

## November 17 — coordinated UI cleanup #372

**User-prioritized design polish:** Screenshot-backed fix to Deal quick-preview buttons wrapping within viewport; remove redundant external-quote capture shortcut from quick preview (full Deal retains first-class external quote form). Introduce contextual working Quote draft tab on desktop plus mobile navigation shortcut; Draft status popover uses existing guarded delete confirmation, never deletes issued/revised Quotes. Reorganize Company/Deal/Person 3-column Record pages into tabbed resource and CRM Connections panels and move Quotes/Activities/History into right-column Recents. Restore Deal People row legibility, Tools selected tab feedback, default new Task due date Today (preserve explicit/recovered dates), and bordered global calendar popover squares. **Source staged for build #372; Cloudflare and device acceptance separately verified.**

**Safety boundaries:** CAD-Lite remains paused. Do not change Quote integrity/persistence, priced lines, customer delivery, CRM RLS/Auth, file links, or existing Task associations. Use current Draft deletion eligibility and confirmation. No new server schema or external provider integration.

## November 16 polish batches

| ID | Feature / acceptance target | Starting point | Status | Blockers / evidence |
| --- | --- | --- | --- | --- |
| A1 | Board +Deal More details: Company, People, due date plus stage, pipeline, amount and assignee before Save; preserve partial-create recovery | Company/People/due date existed | Source committed / build pending | #353c adds pre-bid stage, pipeline override, amount, owner; full role/device QA remains |
| A2 | Standard record `…`: delete/archive/unlink as appropriate; clear actions and confirmations | Menu exists on Company/Person/Deal | Partially polished / verify | #353f groups Connections vs Record actions. Archive not modeled for ordinary CRM records; no invented deletion semantics |
| A3 | Less disruptive About editing and consistent inline properties | Inline edit rows exist | Existing / verify | Device visual check |
| A4 | Task/Company/Person/Deal/Quote unlink parity and protected relationships | Shared RecordUnlinkAction and Task links exist | Existing / verify | Role and history boundaries |
| A5 | Prospect/Customer/Partner classification and bulk edit parity | Company classification and bulk editing exist | Existing / verify | Normalized fields vs compatibility alias |
| B1 | Task: Complete → Log Activity → optional next follow-up in one guided flow | Complete + Log Activity and optional Activity follow-up exist | Source committed / build pending | #353d opens existing Activity with next follow-up preselected; protected bid task guard unchanged |
| B2 | Optional pre-bid reminders with clear lead-time and opt-in | Automatic bid-due task exists | Source committed / build pending | #353d offset selector in Deal Tasks card; private Task editor, reopens matching pending reminder |
| B3 | Agenda/Task quick-view record context, mobile Calendar polish | Much functionality exists | Existing / verify | Real device QA |
| B4 | Distinguish scheduled meetings from logged historical Activities | Planned Tasks exist; no dedicated appointment model | Source committed / build pending | #353g adds Schedule meeting from Company/Person/Deal Tasks panels using existing dated Meeting Task; Activity remains separate after meeting |
| C1 | Quote pricing: private fully-loaded margin vs known-cost spread, missing inputs and direct Calculator navigation | Calculations and coverage exist; UI wording ambiguous | Source committed / build pending | #353e labels partial spreads correctly, filter Areas by cost/selling readiness, jump to Materials or Calculator |
| C2 | Legacy sink repricing opt-in/confirmation from PR #95 | Old drafts protected on main; PR remains draft | Blocked on integration review | Must reconcile PR's old-editor navigation tests with #353b single-editor UI |
| C3 | Next unresolved Area + reusable Area presets | Some functionality exists | Partially addressed / verify | #353e triage filters and next-cost jump; reusable Area templates already exist, advanced gallery pending |
| C4 | Worktable menus, WARM theme, mobile popover visual parity | Shared chrome exists | Existing / verify | Screenshots/device acceptance |

## Working-prototype queue (after A–C, not an invitation to spend days on invisible groundwork)

| Order | Prototype | Minimum **working** user outcome | Risk / boundary | Status |
| --- | --- | --- | --- | --- |
| P1 | Analytics v0.1 | Actual KPI cards/charts for deal value/stages, bids, quotes and activity; owner/date filters using current records | Date range is a Deal creation cohort; cloud quotes use the same private visible index as Records | Source committed / build pending (#354a) |
| P2 | Files v0.1 | Store/open/link real file URLs under Company/Deal/Quote, with editable labels; not a mock button | Browser-local per user/tenant and developer-playground namespace. No cloud sharing or provider access yet | Source committed / build pending (#357a) |
| P3 | Automations v0.1 | Opt-in follow-up on confirmed quote delivery, inactive Deal reminder and won Deal handoff Task; auditable/no duplicate firing | User-scoped browser configuration + private Task source identity, manual Run and auto-run only while app is open. Server scheduler / atomic multi-device uniqueness deferred | Source committed / build pending (#358b) |
| P4 | Email v0.1 | Connect Gmail read-only with explicit OAuth consent; search/list real threads, read plain text on demand, suggest related People/Deals and explicitly link them | Public Google OAuth Web client ID and restricted-scope verification needed; temporary in-memory token; thread reference only in scoped browser storage | Source committed / build pending (#359a–b) |
| P5 | CAD-Lite bridge v0.1 | Open a linked CAD-Lite project from Deal/Quote; import manual takeoff export | Technical data owned by CAD-Lite; no implicit repricing | Queued |
| P6 | Slack and QuickBooks | Real Slack notification or authenticated export flow; QuickBooks export first, API sync later | Explicit provider permissions and safe credentials | Queued |

### New BYO document-export idea (user proposed November 16)

- **P2b · Customer Quote link references:** In Files, surface existing live cloud Quote Share status/actions by native Quote ID and current revision. Do not persist share bearer tokens in the browser-local link store.
- **P7 · DEFERRED — BYO Google Sheets builder worksheets:** Copy an accessible Google Sheets template, map approved Quote fields into cells/named ranges and repeating Area/line-item tables, then link the newly generated spreadsheet back to the Quote/Deal. Source Quote remains authoritative, no automatic issue or delivery. See [parked design note](../product/quote-links-files-and-google-sheets-template-exports.md). **Not built; do not start until reprioritized.**
- Default order remains Files → Automations → Email → CAD-Lite/provider expansion; reprioritize Docs after user chooses a prototype slice.

## Longer-term work intentionally **not** lost

- Shared custom-field activation (#352d2) needs real disposable PostgreSQL/RLS testing (#352c4). Local draft designer, starter field packs and JSON configuration portability already exist.
- Proposed Records/AI-assisted relationship matching; native imports of CSV/Excel/JSON to a new cloud account; safe test-account reset; custom pipelines/terminology; external-quote attachments.
- Multifamily execution Gantt remains paused (draft PR #67, cloud permissions and schedule persistence not released).
- Notebook paper/binder ideas, Color Sheets, standalone Calculator, Knowledge Database, advanced reporting and provider integrations remain in long-term roadmap.
- Old GitHub PRs and issues are *not* merge-ready by default; reconcile with current main.
- Source of historical phase roadmap: [ROADMAP.md](../../ROADMAP.md).

## Change log / deployment results

| Time / release | Commit | User-visible change | Build | Browser/device QA | Issue / next action |
| --- | --- | --- | --- | --- | --- |
| Nov 16 earlier · #353b | `b3e899a` + `ce229dc` | Old quote editor removed from user navigation; stale test repaired | **Green per user** | Not separately confirmed | Don't restore the old editor |
| Nov 16 earlier · #353a | `bac74a2` | Local Playground import/preview/reset | Build included in later green; sample import worked per user | More edit/reload/reset scenarios unconfirmed | No production account data import |
| Nov 16 · #354a | `fbc9f62` | Analytics v0.1 · working accessible Records More dashboard, filters and external/native quote parity | Pending Cloudflare | Pending device/auth | No production schema; read-only; verify permission scope |
| Nov 16 · `6135e84` | `6135e84` | Records source regression gate updated for configurable Deal creation | **Green per user** | Device QA pending | 775/775 prior tests and release gates cleared |
| Nov 16 · #353g | `4727e87a5` | One-click planned Meeting Task from Company/Person/Deal, Calendar-ready | Pending Cloudflare | Pending Task/Calendar acceptance | Does not create a fictitious completed Activity |
| Nov 16 · #353f | `844b28d` | Unified Task completion and grouped record ellipsis actions | Pending Cloudflare | Pending phone desktop | Activity drafts and permissions unchanged |
| Nov 16 · #353e | `7dfcef4` | Pricing readiness filters and honest private margin labels | Pending Cloudflare | Pending authenticated Quote workflow | No customer pricing/receipts changed |
| Nov 16 · #353d | `2c1a110` | Task complete/log/plan workflow and personal Deal bid reminders | Pending Cloudflare | Pending device/auth | Confirm follow-up checkbox, repeat reminder, protected submit tasks |
| Nov 16 · #353c | `b9b8b6f` | Board Deal quick-create supports stage/pipeline/value/owner in one save | Pending Cloudflare | Pending device/auth | Confirm owner and associated People on signed-in reload |
| Nov 16 · planning | `00d0f0b` | Committed dated plan and roadmap pointer | N/A | N/A | Continue A, B, C; record every delivery below |

## November 16 release gate / manual acceptance

**Current deployment status:** User confirmed Cloudflare build **green** on `6135e84` (November 16). TypeScript, 775/775 quick-quote tests, Records gate and Vite bundle cleared by that confirmation. Authenticated UI/mobile acceptance remains unchecked. Subsequent analytics source commit awaits its own Cloudflare build.

- [x] **Cloudflare:** `6135e84` build green per user (TypeScript → 775 quick-quote tests → Record gate → Vite).
- [ ] **Analytics #354a:** Confirm Records → More → Analytics, date/owner/pipeline filtering, stage bar values, external/natively delivered bid parity and private Tasks. Recheck the new head's Cloudflare build.
- [ ] **A / Deals:** From Records → Deals Board, click `+ Deal → More details`. Pick stage, pipeline, value and assignee; select/create Company and People; set bid date. Save and reload. Verify every value, no duplicates and correct submission Task ownership. Repeat with a simple name-only Deal and an intentionally unassigned pipeline.
- [ ] **A / Menus:** On Company/Person/Deal, `…` shows separate Connections and Record categories when deletion is permitted. Unlink keeps the related record and history; deletion still requires confirmation and relationship safety.
- [ ] **B / Task flow:** Open a normal Task from Home and Tasks → `Complete · Log · Plan next`. Confirm Activity opens with linked record and next follow-up prechecked; uncheck if not needed. Saving creates exactly one Activity and finishes the eligible Task. Protected Submit Quote Task remains blocked without confirmed proof. Retry after a partial follow-up failure without duplicates.
- [ ] **B / Bid reminders:** Open a pre-bid Deal with future deadline. Choose 1/3/7 days ahead; ensure past reminder days are unavailable. Save a prefilled private Task, then click again to reopen the existing pending reminder. No changes to Deal deadline, submission proof or autogenerated Submit Quote obligation.
- [ ] **B / Meetings:** Open Company/Person/Deal Tasks → Schedule meeting; specify due date/time. Verify it appears as a planned Calendar Task; do not treat it as a completed CRM Activity until deliberately logged.
- [ ] **C / Quote pricing:** Measured Area with missing material cost should link to Materials; missing fabrication/install should link to Calculator. Test All / Needs sell price / Missing internal costs / Ready for review filters. Partial known-cost spread must **not** be labeled fully loaded margin. Customer total, revisions, signed receipts and issue gate are unchanged.
- [ ] **Mobile:** Check iPhone-sized layout, dialog keyboard scrolling, date/time inputs, tap targets and WARM/LIGHT/DARK contrast. Resolve observed failures in consolidated fixes, not disconnected cosmetic commits.

### Known blockers and deliberate omissions

- Custom field RLS scripts are **prepared but unexecuted**; never run on production Supabase or enable shared custom-field publication prematurely.
- Legacy-sink conversion preview from draft PR #95 remains **unmerged** and needs integration with the new single-editor UI. Don't claim that #353e implemented that conversion.
- Record inline-editor polish, bulk prospect classification, remaining visual worktable QC and richer Area-template gallery remain in the polish backlog. Existing foundations should be tested before rewriting.
- Meeting planner v0 deliberately uses a personal Meeting Task, **not** a new shared appointment database.
- Bid reminder v0 is a one-time, user-confirmed Task. It doesn't automatically move if the Deal due date changes; the Task explicitly reminds the user to review it.
- New configuration/cloud-RLS features remain outside these polish commits.
- **Analytics #354a is now source-implemented** under Records → More. Confirm real filters, data interpretation and scope after Cloudflare. Do not call it released until build and hands-on checks pass. Next prototype after Analytics: Files v0.1.

### November 16 Analytics build recovery — Cloudflare 18:38 UTC

- **Observed:** `a3c12c0` passed TypeScript and 781/782 quick-quote tests, but one new Analytics test failed: `uses actual delivered date, never a mere issued native document` expected 2 and received 3. Records gate/Vite bundle did not run.
- **Cause:** The test described a quote sent on October 1 as historical/excluded, even though October 1 falls **inside** the November 16 90-day report window (beginning August 19). The Analytics date filter correctly counted it.
- **Fix:** Use July 1 as the out-of-window fixture. Add a separate regression test proving October 1 **is included** in the 90-day view but excluded from the 30-day view. No production Analytics logic or data changed.
- **Validation:** Source-reviewed; Cloudflare must confirm the new head. 782 previous tests were attempted, 781 passed. Authenticated Analytics owner-scope and mobile QA still pending.

### Analytics #354a acceptance and date-window correction

- Analytics is **source committed** under Records → More: owner/pipeline/30–90–365-day/all-time selectors, current Deal-stage cohort charts, confirmed external/native quote counts, activity trends and direct record navigation.
- Calendar-week trend now builds the actual list of Mondays intersecting the selected period. On November 16 a 90-day filter requires 14 week buckets, and 30 days requires 6; no early days are silently omitted from the chart.
- Company Prospect/Customer/Partner bulk editing and About inline editing already exist; don't duplicate them just to mark polish complete. Device screenshots and authenticated cross-account checks are still needed.
- **New analytics build:** pending Cloudflare confirmation for latest head; do not mark prototype QA complete just from source checks.

### November 16 build recovery — Cloudflare 18:16 UTC

- **Observed:** `ffd08e8` passed TypeScript and **775/775** quick-quote and regression tests, then failed `npm run test:record-gate` with `Board Deal relationship persistence changed` at line 43. Vite did not run.
- **Cause:** `e2e/record-page-redesign-gate.mjs` still searched for the old `createProject(name,'Discovery'` call. The current live creation code accepts `details?.stage??'Discovery'`; existing Company/People/due-date links remain.
- **Correction:** Check the current initial-stage and amount/pipeline behavior, and explicitly verify the preflight → Deal creation → Person linking order plus typed partial-create recovery. This retains stronger relationship safeguards, rather than dropping the gate.
- **Status:** Source corrected; next Cloudflare build **pending**. Manual authenticated and mobile QA remain unchecked.

### November 16 build recovery — Cloudflare 18:09 UTC

- **Observed:** `a709688` passed TypeScript, but the quick-quote test suite failed at `src/services/recordCreateLinkRecovery345.test.ts:107`: **774 passed / 1 failed**. Record gate and Vite bundle were not reached.
- **Cause:** Batch #353c correctly expanded `createProject(name,'Discovery',...)` to `createProject(name,details?.stage??'Discovery',...)`. The older test was searching the removed literal call, returning `-1` despite the correct preflight→create→link order.
- **Fix:** Update the static regression assertion to match the current defaulted-stage creation call while preserving the existing ordering and partial-link recovery checks. No app runtime logic changed.
- **Validation:** Source-reviewed; next Cloudflare build still pending. Mark green only after its exact SHA passes all gates.

### November 16 user-approved polish after Analytics green

- Cloudflare Analytics `446e5a5` **green per user**, Analytics page manually confirmed working. Do not conflate build green with the remaining detailed device QC.
- User reported and requested: Quote FILTERS popover layout, calendar weekend tint and first-open top-left flicker, calendar badges obscuring dates, browser-zoom header collisions on Notebook/Records/Catalog, duplicate Board +Deal/Company and their redundant board toolbar, Settings header mismatch, quote creation bypassing template/title, Task preview due controls, Home Outstanding Task "today" shortcut, and clearer Follow Ups intent.
- **#355a source implemented:** Calendar initial anchored positioning before paint; weekend tint and badge/date separation; two-column layout for Quote Filters on all viewports; reschedule in Task Quick View behind disclosure; Follow Ups copy; shared zoom layout CSS. Build/device confirmation pending.
- **Changelog created:** `CHANGELOG.md` is the rear-view release history; `ROADMAP.md` and this plan continue to track future/open work. Update changelog in each implementation commit; explicitly record deferrals.

### November 16 #355b — record and HOME workflow corrections

- Deal and Company "Add new Quote" now call guided Quote creation with context instead of creating a premature draft.
- Home Outstanding Tasks exposes a one-click Today action for personal ordinary Tasks, never protected generated bid obligations.
- Settings uses only the shared workspace header and shared SectionTabs for its quick views, removing the duplicated PageHeader title.
- Cloudflare and authenticated/mobile verification pending.

### November 16 #355c — Board header consolidation

- Embedded Deal and Company Boards no longer show the duplicate internal toolbar; only the Records header shows + Deal/+ Company.
- Header Board options exposes pipeline/relationship filters and Compact Cards toggle.
- Board quick create retains the original link preflight, partial-create recovery and dialog; embedded instances listen for one header-launch event and keep the launch button hidden.
- **Deferred:** Table-mode + Deal still has its existing form. Both modes now display one consistent header button but detailed form parity needs a focused follow-up to avoid copying sensitive Deal/People save logic.
- Source committed, Cloudflare and device QA pending.

### November 16 #355d — one Deal creation flow

- `createDealFromQuickCreate` in Board.tsx is now shared by Records Table and the embedded Board. It preserves Company/People prevalidation, pipeline defaults, initial stage/value/owner and typed partial-create recovery.
- Table + Deal uses the same `BoardQuickCreate` UI as Board + Deal; the obsolete parallel form/state was removed.
- The release gate must continue to enforce the preflight → creation → linking order, and `recordCreateLinkRecovery345.test.ts` should remain green because the underlying code and order are unchanged.
- Cloudflare, table/board UI and authenticated links must be checked before marking verified.

### November 16 #355e — last layout guard before cloud check

- The old 1400px+ Records absolute-centering CSS was more specific than the shared zoom fix and could still overlap right-hand actions at 125% desktop zoom. Added an exact override that keeps navigational tabs in the full-width second header row at CSS viewports 761–1599px.
- Floating calendar day cells now reserve a larger two-row badge area, separate from the date.
- Settings More sections no longer falsely mark Company selected in the header when another section is open.
- Quote Views menu says "Customer follow-ups" to distinguish it from task reminders.
- Source committed; authenticated browser QC and exact Cloudflare green still pending.


### November 16, 2026 — #355f release-gate repair

- Cloudflare on #355e (ad2a059) completed TypeScript and ran 798 quick-Quote release-gate tests: 796 passed, 2 failed. No Vite bundle was produced because Vitest exited nonzero.
- `worktableChrome130.test.ts` was asserting the old `Follow-ups` menu label. The product now says `Customer follow-ups`; update the source contract to reflect that deliberate wording change.
- `externalQuoteCloudConfirmation330.test.ts` case "waits for both Activity and Deal acknowledgement..." exceeded the default 5000 ms timeout under Cloudflare's highly parallel test run (reported 16.08 s). The other five scenarios in that file passed. Increase the wall-clock limit **for that first case only** to 30 s, retaining all remote Activity and Deal acknowledgement assertions, stage/amount/deadline checks, and safe failure/duplicate handling.
- Source committed to main; Cloudflare and authenticated smoke checks still pending. A repeated timeout beyond the new threshold requires further investigation, not bypassing the test.

### November 16 #356a — screenshot follow-up

- Confirmed screenshot from `48a7fb4`: desktop headers growing to two rows at 100%+, Quote Filters overlapping, Settings grid jumbled, inconsistent native Deal fields, oversized Today button and wrapping Quick View actions.
- Replaced the 126px two-row zoom override with an 82px single-row layout and independent intro/tabs/tools grid tracks; uses compact controls below 1100px.
- Corrected the higher-specificity `display:contents` rule in `worktable-chrome.css` that defeated Quote Filters grid layout; Settings header is now a sibling above the sidebar grid.
- Themed advanced Deal inputs including select, number, and assignee, scrollbars; Today uses calendar icon; Quick View bottom buttons stay on a horizontally scrollable row.
- New static regression tests in the build gate. **Cloudflare and authenticated visual QA pending for #356a**.

### November 16 #356b — last pre-Files touchups

- Quote Filters markup is one full-width Document type and a six-field two-column form. Removed nested .qmb-library-extra-filters-content from runtime; desktop and mobile share the same layout.
- Task Quick View actions use short labels ("Open Deal", "Open Quote", "Log external bid", "Quote required", "Complete + Log"). Guided completion still preselects optional follow-up; proof guard is unchanged.
- Source committed; latest Cloudflare and authenticated visual check pending. Proceed straight to Files v0.1.

### November 16 #357a — Files v0.1 live-link library prototype

- Records → More → Files is a real searchable library: create labeled file/folder URLs, choose Company/Deal/native Quote/external Quote, open external URLs, edit label/link/type or remove only the SalesShop reference (not the source file).
- Company, Deal and native Quote metadata pages include the same Files manager, contextualized to their saved CRM record. External bids appear in the Files directory as external Quote targets.
- Browser localStorage is uniquely scoped to **org + signed-in user** in cloud mode, with a separate Developer Playground namespace. Missing cloud identity disables saving. Do not claim org-shared sync, mobile-device sync or file uploads.
- URL validator allows only http(s), rejects embedded usernames/passwords and unsafe schemes. Links open with noopener+noreferrer; records list is constrained to currently accessible CRM targets.
- Seven Vitest tests cover URL/scope/provider/persistence and view integration; registered in quick-quote release gate.
- **Next stage:** authenticated shared link table with verified negative RLS and provider connection, or proceed to opted-in workflow automation prototype #357b (no claim of background execution without scheduler).
- Pending exact Cloudflare build and manual browser QA for links, editing/removal, native & external Quote linkage.

### November 16 #357b — release gate, customer links, BYO Docs

- User-shared Cloudflare log for #357a (`0174f55`): TypeScript passed; **807/812 tests passed**, five failed solely on stale source-string contracts in `worktableChrome130` (2), `worktableParity126` (1), `bidSubmissionTaskGuard` (1), and `november16Polish355a` (1). Existing Files 7 tests and external Quote cloud-confirmation cases passed.
- Updated those four test files to reflect actual **one-grid Quote Filters** and shorter Task Quick View labels while retaining all business guard assertions. New head's exact Cloudflare build remains unverified.
- Customer Quote links are already authoritative **cloud Quote Share** resources, but not automatically in Files v0.1. Design a *dynamic* reference to the current usable share; never copy bearer tokens to browser-local Files.
- User corrected the BYO SaaS idea to **Google Sheets** rather than Google Docs, and explicitly deferred it. Intended future output: builder spreadsheet templates with mapped Quote fields and repeatable Areas/line items, preserving customer-visible data protections and Quote provenance. See `docs/product/quote-links-files-and-google-sheets-template-exports.md`. **Docked; no OAuth/cloud implementation committed.**
- Next prototype stays **Automations P3**; Google Sheets integration is explicitly deferred.

### November 16 #357c — external Quote source contract follow-up

- Reviewed the committed #357b test against both real Quick View components before build. They use distinct callbacks (`recordExternal` in TaskModalHost vs inline `setExternalDealId(...)` in TasksWorkspace). Updated common static assertion to require actual recorder state activation in both paths instead of the callback name used by only one. All other protected bid submission checks remain.
- Next Cloudflare check should cover #357b's five stale expectation fixes and #357c's callback-contract adjustment. Pending; no green claim.

### November 16 #357d — Google Sheets clarification and prototype priority

- User clarified the BYO export target is **Google Sheets**, not Google Docs. Explicitly **docked/deferred**; do not spend development time on it now. Kept a historical redirect from the earlier Google Docs design filename.
- Current next prototype remains **P3 Workflow Automations v0.1**, after exact-head Cloudflare green: quote delivery → follow-up, inactive Deal → reminder, Won Deal → handoff. First version must be consented/opt-in and duplicate-safe; never claim unattended background execution without an actual scheduler.
- The last user-supplied log for `0174f55` showed five stale assertion failures; #357b/#357c source fixes committed but their Cloudflare result is still unknown.

### November 16 #358a — centered creation dialogs

- Files v0.1 Create/Edit link form now opens in a body portal centered modal, with independent background, theme-matched styling, Escape/backdrop dismissal, focus capture and background-scroll lock; existing browser-local persistence unchanged.
- Our Organization +Person and editing existing team directory records use the same modal. The existing roster membership/group/role validation, duplicate checks and save path were kept.
- Added static regressions to quick-quote gate. Pending Cloudflare and authenticated/mobile QA.

### November 16 #358b — Automations prototype

- Records → More → Automations now exposes three off-by-default workflows: confirmed native/external Quote delivery → private follow-up, inactive open Deal → private reminder, and logged Closed Won stage change → handoff checklist Task. Configurable 1–60-day delays, preview, manual Run, history and optional automatic run while SalesShop is open.
- The app-level AutomationRuntime uses the existing authoritative CRM/Quote stores and user-visible native/external bid registry. No server-side scheduler, unattended task execution, email/SMS sending or external accounting integration is claimed.
- Each task has a stable sourceObjectId and is not recreated after completion/deletion/cancellation. Existing private Task store, role preview guard, workspace-user scope, and explicit quote delivery evidence are preserved.
- Automation config + log are per-user browser localStorage (not shared team rules). 20 new Tasks maximum per execution cycle. Without server transactions, cross-device simultaneous execution is not globally atomic; this is still a prototype.
- New tests exercise default opt-out, delivery proof, date math, idle window, owner checks, won stage evidence, and integration. Exact Cloudflare build and authenticated functional checks pending.

### November 16 #358c — automation cloud-safety pass

- The user's last confirmed build before #358a was green; Files manually verified. Source #358a and #358b need a new Cloudflare result.
- Added mandatory `private_documents` Task sync-state **saved** gate before both manual and app-open automatic rule execution in cloud mode. Early cached local Tasks must not create automation suggestions before remote Task rehydration is confirmed.
- Automations UI only allows enabling and executing rules when team role has CRM editing authority, and while a valid private Task scope is hydrated. Rule previews remain read-only otherwise.
- No server-side scheduler, shared rules, or atomic multi-device idempotence yet. Tests document these boundaries.

### November 16 #358d — automation cross-rule test and catch-up cap

- A realistic Quote follow-up fixture also qualified for an inactivity reminder. Updated tests to assert the specific `quote-delivered` rule rather than incorrectly assuming that no other rule would match.
- Added a 20-Task app-open execution budget per workspace session, even through multiple task store sync renders. Manual preview/execution remains opt-in and capped at 20 per click.
- No proof guards, send actions or cloud schema changed. Exact new Cloudflare build remains pending.

### November 16 #358e — modal focus finish

- File dialog's + Link launcher remains mounted behind the overlay so focus can return on Escape/cancel; both File and Our Org modals start focus in the first meaningful text field rather than the close icon.
- User confirmed the previous Files page build **green** and working; new #358a–#358e changes still require their own Cloudflare build. All new automation rules remain off until explicitly enabled.

### November 16 #358f — usable automation history and header

- Created Task history entries provide an **Open Task** action through the existing private Task Quick View. Automations page no longer displays a misleading generic Records search box.
- All three rule families, scope and role restrictions remain unchanged; pending exact-head Cloudflare validation.

### November 16 #358g — Cloudflare TypeScript build repair

- User-supplied Cloudflare build from November 16 20:40 UTC stopped during `tsc --noEmit` on two parser errors before any Vitest runs:
  - `src/components/FileLinksManager.tsx:70` had a stray closing `}` after the permanently mounted File launcher div (previously conditional). The create/edit portal remains conditional on `showForm` and focus can return to the mounted launcher.
  - `src/store/automationStore.ts:16` used an unnecessarily complex asserted `Object.fromEntries` rule initializer. Replaced with explicit typed default rule keys and removed the unused AUTOMATION_IDS import.
- Added static regression checks in the existing gate. **Committed source; next Cloudflare build result not yet confirmed.** Do not mark green until new log confirms TypeScript, tests and Vite.

### November 16 #358h — automation test fixture selection

- In the default all-rules-on fixture, the original Deal also qualifies for inactivity; `automationCandidates` sorts it ahead of the Quote follow-up. The duplicate-prevention test incorrectly selected the first candidate before asserting the Quote had been suppressed.
- Test now explicitly selects the `quote-delivered` candidate by rule ID, verifies it exists, and uses its stable source key for the deleted Task tombstone. No production automations or customer behaviors changed.
- Source committed; still waiting for exact-head Cloudflare green.

### November 16 #359a–b — connected Gmail prototype

- User confirmed previous Cloudflare release `e537042` green and asked to begin Email v0.1 immediately.
- Added browser-only Google Identity Services token client (read-only Gmail scope), Gmail API thread list/search/metadata and explicit user-requested full plaintext read, with per-user session token **in memory only** and reset on SalesShop identity change/disconnect/reload.
- Records → More → Email shows actual connected mailbox, search, thread summaries, conversation reader, exact email participant suggestions and explicit links to CRM People and Deals. Both full Deal and Person pages show linked conversations with on-demand Gmail fetch.
- Minimal link persistence: only Gmail mailbox, thread ID, CRM target ID/type and timestamp in current browser `localStorage` partitioned by SalesShop organization+user. No OAuth token, subject, body, recipients, generated Activities, fake deliveries, or team-shared sync.
- OAuth client ID `VITE_GOOGLE_GMAIL_CLIENT_ID` must be configured in Cloudflare Pages after Google Cloud OAuth Web client, Gmail API and authorized UI origin setup. Gmail readonly is a restricted scope; Google verification/testing-user restrictions apply. UI displays real setup instructions if unconfigured. Setup runbook in `docs/product/gmail-connection-359a.md`.
- No production database or permissions changes; no provider sending. Added functional parsing, matching, tenant-scoping and UI contract tests registered in the Cloudflare quick-quote gate.
- **Pending:** Cloudflare exact SHA green, real Google test account consent, mailbox switching, scoped link persistence and authenticated phone/role QA. Do not describe this as persistent provider connection or supported background sync.

### November 16 #359c — Gmail lifecycle and tests

- Added API-mocked Gmail metadata/full request tests (verifies bearer token remains in request header and full content fetched only when explicitly requested).
- Corrected new UI contract test to check the actual `This did not log an email Activity` copy.
- Gmail session and linked references now reset on App unmount or SalesShop identity handoff. Record email detail resets when mailbox changes, and role preview blocks fetching/private content.
- No provider credentials configured from this chat; Cloudflare build remains pending.

### November 16 #359d — email security finishing pass

- Role-preview change now clears cached record-level subject/body state via the same effect that reacts to token/mailbox changes and will not render a selected message without an active, non-preview Gmail session.
- User's previous #358h release explicitly confirmed green. New Email batch still requires its own Cloudflare green and authenticated Google OAuth setup/consent.

### November 16 #360a — Tools becomes a top-level navigation destination

- User confirmed Email prototype build green and requested a temporary top-level **TOOLS** tab while development continues.
- Desktop main header now reads **Home · Records · Catalog · Notebook · Tools**, preserving Shift+1–4 and adding Shift+5 for Tools. Mobile hamburger includes Tools with a distinct icon.
- Tools is a real `/tools` route with the standard `WorkspaceHeader`, desktop segmented section tabs and mobile dropdown for **Analytics / Files / Automations / Email**. Existing components were moved rather than duplicated. Analytics retains personal Quote registry and scoped Tasks; Files uses current CRM records; Automations and Email keep their original safeguards.
- Records More now retains operational directories (Suppliers / Pages / Activity / Our Organization) without duplicate Tools links. A previous Records tool selection is recognized as the initial Tools selection for legacy sessions.
- No database migration, customer Quote rules, Gmail credentials, message sending or Task execution modes were changed. Navigation regression tests were updated and added to Cloudflare quick-quote gate.
- **Cloudflare exact-head and authenticated browser/device QA pending #360a.** Check role-preview/viewer restrictions, mobile picker and zoom without header wrapping.

### November 16 #360b — stale test and Gmail setup guide

- User's Cloudflare build on November 16 at 22:03–22:05 UTC passed TypeScript and 833/834 tests. One failed source assertion expected Analytics under Records More; intentional Tools move made that requirement obsolete.
- Test now asserts Analytics is under `ToolsWorkspace` and absent from `RecordsSectionNav`. No production Analytics behavior changed.
- Gmail documentation updated to **Tools → Email**, exact SalesShop browser origin (no assumed `app.` subdomain), and no redirect URI for the Google browser token flow.
- Source pushed; **new Cloudflare build pending**. To make email work, enable Gmail API, configure Google Auth platform OAuth consent with restricted `gmail.readonly` scope, create Web application OAuth client with authorized JavaScript origin, add testing account, set `VITE_GOOGLE_GMAIL_CLIENT_ID` in Cloudflare production build variables, and redeploy.

## Carry-forward notes for next chat

1. Ask for **Cloudflare errors only if a new build actually fails**. Fix stale test expectations without reverting a deliberately removed feature.
2. After A/B/C, begin prototype P1 Analytics; do not regress into endless low-visibility infrastructure batches.
3. User can revise priorities at any time; record intentional changes in this same file, preserving earlier status and GitHub SHAs.
