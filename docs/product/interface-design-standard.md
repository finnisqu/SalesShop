# SalesShop interface standard — polish pass 1 (November 9, 2026)

## Aim
Preserve the compact, spreadsheet-forward direction that was approved for Connections and Quick Quote. No new business workflows, data model changes, automatic CI, or Project Timeline beta development are in scope.

## Canonical shared components

| Surface | Source of truth | Standard |
| --- | --- | --- |
| Workspace header | `WorkspaceHeader.tsx`, `workspace-header-standard.css` | One height per viewport tier, left title, truly centered tabs, fixed More/Search/Create tools; on mobile a single selected-tab row |
| Page Help | `WorkspaceHelp.tsx` via `WorkspaceHeader.help` | One context-aware, subdued info control at a time: local on desktop, global app bar on phones |
| More menus | `WorkspaceMoreMenu`, `useDismissibleDetails` | Visually always “More” (context stays in aria-label), click-only native details, active option indicated, Escape/outside closes, keyboard focus returns to trigger |
| Table actions | `ConnectionsTable`, `connections-table.css`, `workbookTableDensity` | Compact row density, consistent toolbar control heights, focus-visible feedback, selection and column tools never mutate content |
| Record panes | `RecordPageLayout`, `RecordPreviewDrawer`, `PreviewPanelChrome` | One record information hierarchy and an explicit action row; on mobile use existing bottom-sheet patterns |
| Modal/dialog | `useDismissibleLayer`, `useModalScrollLock`, `PreviewPanelClose` | Preserve invoking focus, Trap Tab within dialog, Escape closes when allowed, lock background scroll and use visible named close action |
| Bulk-edit buttons | `connections-bulk-edit.css` and bulk dialog components | Secondary Cancel first, primary Update last, matching DOM and visual order, consistent height/radius |

## Layout / style token contract

- Default desktop workspace header: 82px; intermediate width 761–1399px: 126px with tabs on second row; phone up to 760px: a single 62px local header.
- Fixed desktop tool slots: More 86px, Search 184px, Create 126px; shared control height 40px. Mobile actions remain 44px square.
- Shared control corner radius 9px; menu 11px; compact row/control 7px; dialog 15px. Scope UI styles through existing `data-sales-theme` and `ss-theme-*` colors.
- Tables must preserve one-line headers, short row heights, visible focus outlines, and compact bulk-selection toolbars. No card conversion for phone tables unless explicitly approved.
- Menus should never open from hover. Disabled actions visibly dim and cannot be activated. Selection states must not depend on color alone.
- Errors, in-progress saves, and confirmation states should be accessible and non-destructive; visual polish must not alter backend persistence or role permissions.

## Audit findings and actions

| Area | Finding | Action |
| --- | --- | --- |
| Tasks, Quotes beta, Catalog, Notebook and Settings | `WorkspaceHeader` accepted Help but discarded the prop | Fixed: desktop contextual Help beside title; retain single global Help icon on mobile |
| Deals Board, Accounts Board and Connections | Page Help was only global, so guidance missed the active section | Fixed: page-specific contextual Help in the shared header |
| Connections and other workspace More menus | Active choices shaded but not always obvious; selected action could drop focus | Fixed: selected check, focus return on selection, uniform menu sizing and disabled style |
| Connections table, reused task table | Toolbar and column controls had disparate sizing; focused rows lacked full-row feedback | Fixed: shared radius, height, column popover limits, keyboard focus/selection styling |
| CRM and Tasks bulk edit | Primary/secondary controls differed from compact action patterns | Fixed: consistent modal fields and buttons; Cancel precedes Update in DOM and appearance |
| Connections quick create | Only the dialog's own keydown handled Escape, so focus could escape the overlay | Fixed: shared focus lifecycle and background scroll lock |
| Project Timeline beta | User requested feature freeze | No changes |

## Still requiring browser verification

- Compare Home, Quotes, Tasks, Board, Connections, Notebook, Catalog and Settings in light and dark themes at 390px, 430px, 768px, 1024px and 1440px.
- On each, compare header height and tool alignment. Open More and Help near narrow viewports; confirm popovers stay in the viewport and do not clip.
- Use only keyboard to open and close controls, change a table column and bulk-edit selected records. Verify visible focus and Tab order.
- Review phone keyboard safe-area behavior, dropdown stacking and drawer/dialog scroll containment, plus disabled states.
- Complete the TypeScript build, the existing Quick Quote regression suite and browser smoke checks in an environment with the full repository checkout.

## Next polish batches (not part of this PR)

1. Contrast and theme parity in popovers, status messages and record preview panels.
2. Table row density parity in Catalog and Quotes; normalize selectable cells and toolbars without changing quote calculations.
3. Mobile sheet and keyboard-safe-area audit of global quick create, record editors and Notebook.
4. Empty/loading/error state copy and interaction audit across all pages.

**Validation note:** This pass is code-driven. No browser screenshots or local `npm run build` were available in the current connector-only environment; no CI was re-enabled.