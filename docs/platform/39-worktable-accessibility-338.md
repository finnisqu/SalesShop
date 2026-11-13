# Batch 338 — Shared Worktable accessibility, heading and mobile polish

## Scope and design constraints

Improve the shared Worktable foundation without creating separate tables, forked state, or page-specific layout variants. The primary surface remains `WorktableSurface` and the shared controls remain in `WorktableChrome.tsx`. The canonical rounded corners, warm/dark header fill, filters, pagination and horizontal scrolling are preserved.

## Changes

### Mixed select-all behavior, shared across Records and Catalog

- `WorktableSelectPageCheckbox` owns the native indeterminate checkbox state with a matching `aria-checked="mixed"` announcement.
- **ConnectionsTable** now uses it for its current-page select-all control, retaining its existing cross-page selection model, row-selection actions and pin tools.
- **Catalog Sinks** and **Catalog OTHER** use the same primitive while editing. Their selection still remains page-scoped (Batch 336), cannot act on stale/hidden records, and retains disabled select-all on an empty page.
- The current-page checkbox reflects a partial selection as *mixed*, not visually unchecked.

### Column headers and sort announcements

- Records column headers, checkbox, pin and quick-action columns now explicitly use `scope="col"`.
- Sinks and OTHER headings likewise use `scope="col"`, including checkbox columns.
- Where the Catalog sort dropdown corresponds to a visible column, its heading exposes `aria-sort="ascending"` to assistive technology. OTHER's cost and customer price sorts participate, and Sinks' category, model and brand sorts participate.

### Accessible pagination and focus

- The shared page counter retains its compact visual `2 / 3` while announcing a complete label, *Page 2 of 3*, in a polite live region.
- `worktable-chrome.css` now owns consistent accent-colored keyboard-focus rings across shared worktables, pagination, filter/action menus and bulk actions.
- Shared checkbox dimensions are standardized; coarse/mobile layouts receive a larger 26×26 px checkbox control. Filter fields use 16 px text at mobile sizes to avoid iPhone focus zoom.
- Focus styles do not add toolbar scroll containers, sticky-cell masks or row-wide shadows that could interfere with existing pinned/frozen rows.

## Tests and verification

- New `src/services/worktableAccessibility338.test.tsx` verifies mixed/checked/disabled selection markup, accessible page announcements, reuse in Records/Sinks/OTHER, column sort semantics and shared CSS contracts.
- The Batch 336 source contract was updated to recognize the new shared checkbox; bulk lifecycle behavior remains unchanged.
- `test:quick-quote` registers the new tests in the standard `npm run build` Cloudflare pipeline. Source consistency checks passed; the full TypeScript/Vitest/Vite build and interactive browser QC remain pending external verification.

## Manual acceptance checks

1. In Connections/Tasks/Quotes Records tables, select one row. The select-all checkbox should look partially checked; selecting it selects the current page, not just that row. Change page and verify previous cross-page selection behavior still works.
2. In Catalog → Sinks and OTHER, enter Edit mode and select one of several rows. The select-all checkbox should show a native mixed state. Selecting all must affect only the current page; bulk Archive/Restore should preserve quote snapshots.
3. With a screen reader, verify the page counter announces *Page N of M* and the select-all checkbox announces partially checked when appropriate. Confirm semantic heading and active sort announcements.
4. Keyboard-only: tab to Filters, Actions, Columns, pagination, selected rows and inline action buttons. Visible focus should be clear in LIGHT/WARM/DARK and Escape should still dismiss menus.
5. On a phone, rotate and scroll wide tables horizontally, test checkbox tap targets and filter text inputs; menus must remain bounded without introducing nested vertical scrolling.
6. Confirm pinned comparisons, table header rounded corners and the existing warm-theme header color have not shifted.

## Next

Batch 339: broader cross-page SalesShop QC; check worktable persistence, quote lifecycle, mobile keyboard, and remaining task/record panel inconsistencies. Deal timeline/Gantt remains deferred.
