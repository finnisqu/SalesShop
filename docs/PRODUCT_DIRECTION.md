# SalesShop — Product direction
**Captured:** November 12, 2026 · Working product backlog (not all items implemented)

## Core product principles
1. **Home is the workflow hub.** Surface things that require attention now: due and overdue tasks, agenda, today's calendar entries, recent activities and quotes. Make each item an actionable drill-down. Do not recreate the entire database on Home.
2. **Records describes work we do.** Prospecting, companies, people, deals, quotes, tasks, and activities belong under Records. **Catalog describes things received from others** (materials, sinks, rates, suppliers, etc.) and deserves its own primary workspace.
3. **Four main destinations:** Home · Records · Catalog · Notebook. Records tabs: **Companies · People · Deals · Quotes · Tasks · More**; More contains **Suppliers, Pages, Activity, and Our Organization**. Keep the full Quote workspace/editor functional, not the legacy metadata-only view.
4. **Work from anywhere, including within a form.** Any record picker should offer an inline option to create a missing record while preserving draft work and linking all selected records. Starting with Deal, Person, or Company must be equally viable.
5. **Visual consistency by shared primitives, not repeated patches.** Common headers, toolbar rows, buttons, tables, column behavior, pagination, pin boards, selection, bulk actions, menus, and mobile responsiveness should feel identical throughout the app. **Use Records worktables as the visual baseline.**

## Execution sequence

### Phase A — immediate usability and consistency (next)
- **Consolidated Quotes navigation**: Records owns the real Quote library. Existing deep links, drafts, Quick Quote, builder schedule, detailed editor and quote-specific filters remain functional. *(Batch #123)*
- **Records worktable foundation**: reusable table frame with pagination, row sizing, single toolbar/count row, pin board, selected rows, and consistent sort/filter/column menus; refactor Catalog to use the same frame and Records visual tokens. Add bulk edit for pinned selections where appropriate.
- **Records header one-row pass**: remove redundant rows over record-count/selection bar in People, Deals, Our Organization; place controls in that existing bar.
- **Activity directory parity**: convert Activity history into the same Records worktable pattern with common toolbar, search/filter, pagination and record previews.
- **External quote flow**: put *Record external quote* next to *New SalesShop quote* in every + New Quote entry point; remove duplicated shortcuts from More menus. Preserve equal treatment of native/external quote records.
- **Home calendar parity**: use a consistent layout for 'On the calendar' items, badges and selected-day highlighting. Make dated non-task entries clickable and match month/week badge placement and behavior.
- **More menu simplification**: context actions should be grouped clearly. Use an ellipsis trigger for tool menus; keep the explicit **More** label for Records sub-navigation because it reveals additional tabs.

### Phase B — record creation without navigation friction
- Expand the existing Deal **name / More Details / create linked Company or People** pattern to Person, Company, Quote, Task, Activity and other relevant forms.
- Use a shared record-picker/creator allowing existing lookup, quick creation by name, and full-detail expansion without discarding unsaved data.
- Protect against duplicates, failed partial saves, and incorrect cross-company links; ensure a Deal can link multiple People/Companies as supported by CRM relationships.
- Enable actions on a pin board: bulk edit selected/pinned records, create a Task or other linked record from selected entities where meaningful, and preserve user permissions.

### Phase C — customization foundations
- Per-user table column order, visibility, density and sort; per-organization optional custom CRM fields (typed, validated, permissioned and migratable).
- Choose Records/Catalog subtab visibility and order while retaining discoverability and stable deep links.
- Company/browser favicon support: default SalesShop mark and optional organization logo, scoped and cached safely.

### Phase D — storage and communications integration
- Define **BYOS** scope (e.g. files/attachments versus complete CRM storage) and implement secure provider abstraction with migration and backup/recovery paths.
- Add email provider integration for sending/receiving, thread links, permissioned sync and explicit consent.
- **Proposed Records** inbox for discoveries from email (especially new People): approve, reject, or merge with existing; choose additional Company/Deal links; display provenance, source email and duplicate candidates. No uncontrolled automatic CRM creation.

### Phase E — security, cross-app work and additional tools
- Explore an optional inactivity **app lock/PIN** as a local UX privacy screen; it is not a replacement for Supabase authentication, server-side session expiration, device encryption or MFA.
- Independently restore open pages, drafts and record context with account-scoped, permission-aware state; do not assume an inactivity PIN can preserve browser data.
- Start CAD-Lite integration with shared project/deal links and quote-to-layout references; design a stable exchange contract before embedding editing or pricing.
- Notebook visual refresh (functional today; lower urgency).
- Optional workspace calculator, analogous to CAD-Lite.
- Preserve as feature placeholders pending specification: **Color Sheets** and **Knowledge Database**.

## Design guardrails
- Every new control should have an obvious default location; avoid adding extra header rows for special cases.
- Preserve keyboard navigation, accessible mobile selectors, theme tokens, and scroll-owner behavior.
- Don't confuse due, overdue and **external dependency** shifts; retain original deadlines and revision provenance.
- Keep outside quotes first-class Records, not a second-class workaround.
- Release small batches with targeted regression tests and inspect build logs; automatic GitHub CI may remain disabled.

## Implementation status
- **Already implemented before this backlog:** Home agenda/Recents with Outstanding Tasks; non-task calendar entries; Records consolidation of Tasks/Activities/Our Organization/Pages; Catalog pagination and worktable pins; original/current deadline history.
- **Batch #123 scope:** Four primary app destinations; Records subnav order and More; existing Quote library accessible as Records > Quotes without changing Quote editing routes; updated navigation checks. All other points above remain proposed work.
