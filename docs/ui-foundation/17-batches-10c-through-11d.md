# SalesShop — Batches 10C, 10D, 11A–11D

**Date:** October 10, 2026  
**Branch:** `architecture/react-foundation`  
**Main:** remains frozen, no cutover

## 10C — Phone Board, scroll and Quotes contrast

- Both Board lenses use the same 2-column Projects/Accounts segmented control alignment on phones, with Accounts-specific CRM actions below instead of shifting the switch.
- Mobile stage selector adopts the active theme's border, ink and surfaces. 16px selects prevent Safari focus zoom.
- Removed the obsolete floating four-direction Board arrow HUD from both Board and Accounts. Retained normal touch swipe and `MobileBoardStagePicker`, plus independently scrolling stage columns.
- Mobile Board cards shrink to their content instead of imposing extra minimum height.
- Dark Quotes editor overrides are intentionally scoped to internal item editor, material/rate/sink reference cards, pricing placeholders and input states; customer-facing documents are not targeted.

## 10D — Consistent mobile quote actions

- The phone Quotes header now includes the same global Search and Quick Create controls as other tabs, with the existing contextual view selector and tools menu.
- Narrow grids allocate space to title flexibly rather than discarding primary toolbar actions.
- Quick Create always returns to the My Quotes editor.
- Quote owner and role restrictions remain in the toolbar.

## 11A — Optional role simulator

- Owner Role Preview now lives at **Settings → Advanced → Role Preview**, enabled only by an owner in a cloud workspace.
- Default off; desktop header and hamburger drawer no longer reserve space for it.
- Enabling exposes the role picker in Advanced Settings. Starting a preview reveals the simulation banner; exiting or disabling clears it. Session-local UI simulation only, not an RLS/security test.

## 11B / 11D — My Quotes and Team Quotes

- Cloud owners/admins can switch between their own editable Quotes and the compact Team Quotes reference overview.
- Team Quotes shows a read-only searchable list, totals, dates, statuses and drill-down line items, plus salesperson/division/team/status/archived filters.
- Owner/admin can explicitly assign a quote to an org member and reporting group without affecting pricing, scope or signatures. No editing controls in the reference cards.
- My Quotes shows only documents attributed to the currently logged-in user. Legacy documents with NULL ownership remain **Unassigned** rather than being falsely claimed by the owner.
- Team view uses the global phone toolbar; editable view retains its Quotes-specific toolbar.
- Pure filter/assignment behavior is covered by `quoteTeamReporting.test.ts`.

## 11C — Backend foundation (migration applied to SalesShop Supabase)

Migration: `supabase/migrations/202610110001_sales_reporting_groups.sql`

Additive schema:
- `sales_divisions`, `sales_teams`, `sales_team_members` with organization keys and constrained FKs.
- `quotes.owner_user_id`, `quotes.division_id`, `quotes.team_id` nullable, indexed.
- Existing normalized Quote hydration/sync includes these columns; new cloud Quotes record their creator as owner.
- RLS: current organization members read reporting groups; owner/admin controls create/update/delete of groups and membership.
- Server trigger prevents non-admin quote responsibility reassignment and verifies owner belongs to current organization and team belongs to the selected division.
- Existing quote access policies are unchanged. **These reporting groups do not introduce private quote read isolation between organization members.** This would require a distinct access-control product decision and RLS migration.
- Zero backfills: all 12 previously saved normalized quotes remained unassigned at migration time. Owner/admin should review and assign them deliberately.

## Acceptance gates / manual checks

- Production Pages workflow: npm tests, TS check, Vite build, asset verification, GitHub Pages deploy. Check final commit results before calling this green.
- Chromium visual QC workflow: phone portrait 320/390/430, landscape 844x390, tablet, desktop; theme and overlay screenshot checks. These use **local-only** demo mode and do not exercise signed-in owner/admin flows.
- Manually verify the real World Stone owner account: Advanced role-toggle, Team Quotes filters, new division + team creation, membership assignment, legacy quote responsibility, switching back to My Quotes, and price/signature integrity.
- iOS Safari: Projects/Accounts switch stays centered; no D-pad; stage picker matches theme; quote add/search/mode/tools all remain tappable at 320px; dark item text remains legible; Team Quotes scroll and keyboard remain usable.
- Never treat the simulated role picker as evidence of actual permission enforcement.
- **No migration of production `main`;** deploying the foundation preview is the existing branch workflow, while the database schema migration is now live.
