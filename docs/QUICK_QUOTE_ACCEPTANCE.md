# Quick Quote acceptance checklist

Scope: Quick Quote only (not Builder Rate Schedules or Plan Pricing). The guided stages remain Deal Details → Build Quote → Pricing Review → Contract Review. Treat build, pricing parity, persistence, preview and printing as release gates.

## Automated verification

From the repository root:

```sh
bun install
npm run build
npm run test
```

The `build` script now runs TypeScript checking, `npm run test:quick-quote` (targeted Vitest regressions), and then Vite, in that order. Any failed stage stops deployment. This uses the existing Cloudflare Pages build, not a new GitHub CI workflow. **Dependency reproducibility is not yet established:** as of November 2, 2026, this repository has no committed `bun.lock` or `package-lock.json`. Generate `bun.lock` with a real `bun install`, commit it, and then configure deployments to use `bun install --frozen-lockfile`. Until then, Cloudflare resolves dependency versions on every build. New targeted tests:

```sh
npm run test:quick-quote
```

Do not claim a release is verified until the current commit passes. Source inspection and successful dependency installation are **not** a substitute for passing build/tests.

## Keyboard and direct edit acceptance (desktop)

- Areas: click the Area name, billable SF and single selling totals; edit and commit on blur. Verify no accidental line is added.
- Focus a supported cell and press **Enter** to edit. Inside the editor **Enter** commits and advances down (when a lower editable cell exists).
- **Tab** / **Shift+Tab** move to the next / prior editable cell. **Arrow keys** move through display cells and skip read-only calculated cells.
- Once editing, arrow keys move the text cursor; they must not change cells or page tabs.
- Focus a display cell and press Ctrl+C (or Cmd+C) to copy its visible value; text inputs keep native copy behavior. Type digits to replace a focused numeric cell, or paste a **single value** with Ctrl+V; invalid numbers must not be committed. Names permit pasted text.
- **Escape** restores the original value instead of saving a partial edit.
- The keyboard must never trigger Delete, Strike out, or an approval action just by traversing cells.
- Repeat on Takeoffs: piece name, length/width/quantity; sink name/quantity/price; extra charge/price; splash height.
- Mobile/touch still opens the same fields by tap; scrolling horizontally must not edit values.

## Pricing parity scenario

Use a fresh 2-Area Quick Quote:

1. Kitchen: 73 × 36 island and 120 × 25.5 perimeter, plus a 120 × 4 backsplash.
2. Bathroom: 68 × 22.5 vanity and 68 × 4 backsplash.
3. Select a material and an SF selling rate. Compare measured SF and billed SF, including rounded-billing modes. Physical costs must remain based on measured SF.
4. Add 3218 kitchen sink × 1 and 1813 vanity sink × 2. Confirm sink totals occur once, not again as Specialty.
5. Add a $90 freight charge under General and a per-Area specialty line.
6. Every time, verify **sum of Area totals + General = quote total = Pricing Review total = customer preview total**.
7. Strike out a splash, a sink and a piece separately. No measurement is deleted; no excluded selling line is charged. Restore each and verify original selections.
8. Confirm a manual selling price is not silently recalculated when geometry is excluded. Pricing Review should require the exclusion decision to be acknowledged.
9. Undo, redo, bulk move, bulk delete, then undo. Check totals after every action.

## Duplicate Areas and Takeoffs (desktop release pass)

- In Areas, hover or focus the Area name; use ⧉ to duplicate that Area next to the original, preserving material selection, measured pieces, sinks, specialty charges and current selling prices. Confirm the original keeps its own IDs.
- Open an Area settings panel and use **Duplicate this Area**. Verify it creates the same result without transferring charges to General.
- Select two Areas with checkboxes and choose **Duplicate** from the existing header. Confirm both copies appear and one Undo restores the original state.
- In Takeoffs, use the per-row ⧉ action on a piece, sink, manual charge and General fee. Verify the new row's pricing and measurements are independent of the source.
- Select a mixed set of rows and choose the header's **Duplicate** action; one Undo should remove all new rows together. Selecting a piece plus its splash must produce only one new parent piece.
- Duplicating a splash by itself must warn that the parent measured piece is copied as well; cancel should make no changes.
- Verify managed live-SF material lines and sink-managed price lines cannot be cloned as ordinary manual charges.
- Check **sum of Area totals + General = quote total** after every duplicate, and ensure existing exclusions/strikeouts are retained.
- Test a quote reload after duplicating, followed by Undo/Redo before and after a save. No duplicate sink charge or stale line ID should appear.
- Desktop first: confirm row action icons don't overlap when the table scrolls horizontally. Plan a dedicated narrow-screen/touch acceptance pass next.

## Catalog-guided pricing and reusable Areas

- Select a material with a captured supplier cost. Verify the company Level recommendation is visible inside the selling-price editor, including SF price and margin only when costs are complete.
- Check a material whose current Catalog cost differs from the quote snapshot. Show the stale-cost warning and keep the existing customer price unchanged.
- Select **Use suggested rate**. Confirm the saved SF rate and snapshot, then Undo; no suggestion is applied merely by opening or closing a panel.
- Test a material without a known cost and an above-threshold slab-priced material. No invented Level rate should appear.
- Click **Copy Area**, select a quote already visible to the salesperson, and copy one Area with selling prices unchecked. Geometry, material selections, sinks and charge descriptions should copy; customer charges must not be retained automatically.
- Repeat with the explicit **Carry over previous selling prices** choice, then review rates and margin before issuing.
- Copy **All Areas** in one operation, then Undo once. The original quote and all of its child IDs must remain untouched.
- Verify a salesperson cannot browse another salesperson's hidden quotes through this picker.

## Persistence and delivery

- Save in cloud. Reload same quote and compare names, measurements, linked rates, exclusions, material/SKU, sink prices and total.
- Review pricing and acknowledge any optional questions. Reopen a changed quote and verify decisions are not silently inherited.
- Open Contract Review. Inspect customer-facing descriptions, columns, notes, date and totals.
- Approve and then change a customer-facing value: prior approval must become invalid. Reapprove the new version.
- Print Preview, Print, and browser Save as PDF: no private costs, editor toolbar or internal notes; long tables paginate and do not clip. Test light/dark theme.
- Issue only after reviewing current revision. Issuing must not send an email automatically.
- Verify Pricing Schedule workflows are unchanged by Quick Quote improvements.

## Deployment gate

- Record Git commit SHA, Cloudflare Pages build status, TypeScript outcome, targeted Vitest test counts, and Vite build output.
- If any check cannot run (offline tooling, no browser or unavailable Cloudflare logs), record it as **not verified**, not as passed.
