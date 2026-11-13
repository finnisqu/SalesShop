# Batch 335 — Catalog lifecycle clarity and restore parity

## Shipped

Catalog → Sinks and Catalog → OTHER now use a shared `CatalogLifecycleStatus` component so both worktables show the same **Active**, **Archived**, and active **Default** indicators on model/item summary rows and variant lines.

### Archive and restore without losing the editor

- The Catalog filter uses **Include archived** in both viewing and editing modes. Archived models/items are hidden by default but can be found without first entering edit mode.
- Archiving a model/item automatically enables **Include archived**, so the row stays on screen and its **Active in catalog** checkbox can restore it. Its helper text changes from "Uncheck to archive" to "Check to restore."
- An expanded record shows inactive variants whenever the editor is active, even if the archive filter was previously off. This prevents a just-archived variant from disappearing during editing.
- Each variant has an explicit **Archive variant** / **Restore variant** action alongside **Duplicate variant** and **Delete variant**. The archival action updates the existing active flag and does not delete or replace the variant ID.
- Parent and variant status are independent. An archived parent blocks quote insertion even if a variant is active. Inactive variants never launch new quote selections. Restoring a variant does not override the current active default unless the model/item otherwise has no active default.
- An archived parent's expanded details explain that restoration is required before adding its variants to new quotes.

### Worktable and responsive parity

- Sinks and OTHER now share status badges, action wording, subtle restore emphasis, and consistent mobile wrapping for the variant headings and operation buttons.
- Both preserve existing pinned comparisons and their historical quote snapshots. No new schema fields or migrations are required.

## Regression coverage

Extended both existing build-registered Vitest suites:

- `src/services/catalogVariantWorkflow333.test.ts`: archived rows and variants remain findable, shared statuses, archive/restore entry points, normal default guard, quote insertion gates, and mobile wrapping style
- `src/store/catalogVariantManagement333.test.ts`: actual archived/restored Sink and OTHER store states, stable variant IDs, default reassignment behavior, unchanged historical quote costs and prices, and local persistence

The standard `npm run build` includes these suites under `test:quick-quote`. Commits are source-checked but should not be described as a green Cloudflare build until the deployment reports success.

## Acceptance checks

1. In **Sinks → Edit sinks**, archive the parent and verify its expanded row stays visible with **Archived** status. Check **Active in catalog** to restore it; the label changes to **Active**.
2. Archive the default variant. Verify it stays visible with **Restore variant** and the default status moves to another available variant. Restore the old one; it should not automatically take back the default.
3. In **OTHER → Edit items**, repeat the parent and variant archive/restore flow. Check that both sections use identical badge names and operation labels.
4. Leave edit mode. Use **Include archived** to find retired records without accidentally enabling quote selection. Pinned cards remain present, while their quote launcher is absent for archived sources.
5. On WARM/DARK themes and mobile widths, inspect badge contrast, focus indicators, wrapped action buttons and no clipped expanded editor content.
6. Open an existing quote referencing a formerly active variant; it should retain its original snapshot, cost and selling price.

## Next

Continue Batch 336 with shared Catalog search/filter/sort behaviors and careful bulk-operations design. Keep the Deal timeline/Gantt feature on hold.
