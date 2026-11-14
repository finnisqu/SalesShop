# Batch 350c — Compact shared mobile Filters and horizontal-scroll cues

Date: November 14, 2026  
Branch: `main`  
Status: Changes, five new regression tests, and roadmap committed. This batch's Cloudflare build and authenticated browser/device acceptance are pending.

## Background

The shared WorktableChrome already provided bounded, keyboard-dismissable Filters popovers used by Catalog and Records. Sinks and OTHER kept their worktable filters in one panel, but search, archived visibility, category and the new ascending/descending controls ran together as an unstructured list. Phone users also lacked a one-tap Done action. The generic filter panel's input-width rule could stretch the archived checkbox; that control should remain a normal checkbox, not a full-width field. Records had a horizontally scrollable WorktableSurface, but only Sinks and OTHER displayed a sideways-scroll hint.

## Implementation

1. **One shared semantic grouping primitive.** New `WorktableFilterSection` in `WorktableChrome.tsx` renders a labeled, keyboard-accessible section inside the *existing* native-details Filters popover. Sinks and OTHER group their unchanged controls into **Find**, **Visibility**, and **Sort**. The two sort selectors (field and ascending/descending direction) share a two-column desktop grid. Distinct section headings and subtle dividers improve scanning; they do not duplicate menus or create new filter state.
2. **One optional touch dismissal.** The existing `WorktableFilterMenu` supports the opt-in `mobileDone` prop. On narrow screens, an accessible `Done · View results` button at the panel bottom closes the existing details element and restores keyboard focus to its summary trigger. Sinks, OTHER and Records all opt in. Desktop menus remain unchanged; outside click and Escape dismissal still use the existing `useDismissibleDetails` behavior, while `useViewportBoundDetails` continues bounding the popover in visual viewport/keyboard changes.
3. **Targeted style repair.** The shared CSS makes the archived Sinks/OTHER checkbox a normal 18px, theme-accent checkbox instead of inheriting a full-width input rule. Mobile filter search/select fields use 16px fonts to avoid browser focus zoom, and the Done control has a minimum 44px touch target and a sticky footer within the *existing* single popover scroll area. Section content remains in normal flow and theme variables cover WARM/LIGHT/DARK.
4. **Records horizontal navigation parity.** For Records directories with more than three visible data columns, the same `WorktableHorizontalHint` used by Sinks and OTHER appears before the existing `WorktableSurface` on phones. The hint is hidden at desktop sizes and on sparse tables, keeps the single horizontally scrollable spreadsheet, and changes no row/column values or pagination.
5. **Regression coverage.** New `worktableFilterGroups350c.test.tsx` has five cases covering semantic sections, optional Done/no duplicate scroll, Sinks/OTHER grouping and reset behavior, Records reuse and hints, and preservation of viewport/dismissal logic and phone styling. Registered once in the existing `test:quick-quote` Cloudflare build gate. Source-contract checks of the committed files passed; the full automated test run was not available in the session.

## Safeguards

- No new state for catalog queries, sorting, pricing, or Quotes. Existing independent Catalog/Find searches, mobile chips, pagination, pin comparisons, bulk selection, RLS/Auth, cloud schemas and issued Quote snapshots remain untouched.
- The WorktableSurface remains the only table scrolling region. Menus remain siblings above table surfaces, avoiding an additional clipping parent.
- No browser/device testing or Cloudflare success is claimed for this push.

## Manual acceptance after green

- On iPhone and Android, open Sinks and OTHER Filters: sections should show in order Find, Visibility, Sort. Choose a category, include archived and change sort direction. A visible Done button should close the menu and return focus to Filters, leaving all selected constraints intact.
- Confirm the archived checkbox stays small/aligned and tapping the Find field doesn't zoom the phone viewport. Scroll a tall filter panel and verify the Done control is reachable above keyboard/safe area.
- Open Records/Tasks/Connections filters on phone: same Done behavior. Confirm the existing Columns menu and More menus still close via outside click or Escape.
- For Records with at least four visible data columns, confirm the sideways-scroll hint appears and the existing table scrolls. Hide columns until three remain; the hint should disappear. Check Sinks/OTHER still show their own mobile hints.
- Check narrow portrait and short landscape with WARM, LIGHT and DARK themes for popover clipping, keyboard safe areas and table/toolbar alignment.
- Verify Cloudflare `tsc --noEmit && npm run test:quick-quote && npm run test:record-gate && vite build` passes on the HEAD commit.

## Next

Batch #350d: fix any Cloudflare regression first, then complete focused mobile QC and shared worktable filter/column interactions from observed UI feedback. Multifamily Gantt remains deferred.
