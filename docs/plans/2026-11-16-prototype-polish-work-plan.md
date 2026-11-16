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
| P1 | Analytics v0.1 | Actual KPI cards/charts for deal value/stages, bids, quotes and activity; owner/date filters using current records | Label approximate metrics and explain data completeness | Queued |
| P2 | Files v0.1 | Store/open/link real file URLs under Company/Deal/Quote, with editable labels; not a mock button | Tenant scope and link URL validation; connected providers later | Queued |
| P3 | Automations v0.1 | Opt-in follow-up on confirmed quote delivery, inactive Deal reminder and won Deal handoff Task; auditable/no duplicate firing | Server-backed execution required before claiming background reliability | Queued |
| P4 | Email v0.1 | Connect one real provider, read conversations, selectively link threads to CRM People/Deals | OAuth and least-privilege; never infer a sent email from a copied link | Queued |
| P5 | CAD-Lite bridge v0.1 | Open a linked CAD-Lite project from Deal/Quote; import manual takeoff export | Technical data owned by CAD-Lite; no implicit repricing | Queued |
| P6 | Slack and QuickBooks | Real Slack notification or authenticated export flow; QuickBooks export first, API sync later | Explicit provider permissions and safe credentials | Queued |

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
| Nov 16 · #353g | `4727e87a5` | One-click planned Meeting Task from Company/Person/Deal, Calendar-ready | Pending Cloudflare | Pending Task/Calendar acceptance | Does not create a fictitious completed Activity |
| Nov 16 · #353f | `844b28d` | Unified Task completion and grouped record ellipsis actions | Pending Cloudflare | Pending phone desktop | Activity drafts and permissions unchanged |
| Nov 16 · #353e | `7dfcef4` | Pricing readiness filters and honest private margin labels | Pending Cloudflare | Pending authenticated Quote workflow | No customer pricing/receipts changed |
| Nov 16 · #353d | `2c1a110` | Task complete/log/plan workflow and personal Deal bid reminders | Pending Cloudflare | Pending device/auth | Confirm follow-up checkbox, repeat reminder, protected submit tasks |
| Nov 16 · #353c | `b9b8b6f` | Board Deal quick-create supports stage/pipeline/value/owner in one save | Pending Cloudflare | Pending device/auth | Confirm owner and associated People on signed-in reload |
| Nov 16 · planning | `00d0f0b` | Committed dated plan and roadmap pointer | N/A | N/A | Continue A, B, C; record every delivery below |

## November 16 release gate / manual acceptance

**Current deployment status:** User confirmed previous `ce229dc` build **green**. No Cloudflare result or authenticated browser QC has been supplied yet for `b9b8b6f` through `4727e87`. New code and regression tests are committed, but this does **not** establish a deployed working UI. Record failures under the exact commit before changing scope.

- [ ] **Cloudflare:** `npm run build` succeeds on exact latest head (TypeScript → quick-quote Vitest → Record gate → Vite). Retain last good SHA and paste failing section if red.
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
- **Next feature after polish acceptance:** Analytics v0.1 using existing Deals, Quotes, Tasks and Activities. Make charts and filters actually work before treating the prototype as delivered.

### November 16 build recovery — Cloudflare 18:09 UTC

- **Observed:** `a709688` passed TypeScript, but the quick-quote test suite failed at `src/services/recordCreateLinkRecovery345.test.ts:107`: **774 passed / 1 failed**. Record gate and Vite bundle were not reached.
- **Cause:** Batch #353c correctly expanded `createProject(name,'Discovery',...)` to `createProject(name,details?.stage??'Discovery',...)`. The older test was searching the removed literal call, returning `-1` despite the correct preflight→create→link order.
- **Fix:** Update the static regression assertion to match the current defaulted-stage creation call while preserving the existing ordering and partial-link recovery checks. No app runtime logic changed.
- **Validation:** Source-reviewed; next Cloudflare build still pending. Mark green only after its exact SHA passes all gates.

## Carry-forward notes for next chat

1. Ask for **Cloudflare errors only if a new build actually fails**. Fix stale test expectations without reverting a deliberately removed feature.
2. After A/B/C, begin prototype P1 Analytics; do not regress into endless low-visibility infrastructure batches.
3. User can revise priorities at any time; record intentional changes in this same file, preserving earlier status and GitHub SHAs.
