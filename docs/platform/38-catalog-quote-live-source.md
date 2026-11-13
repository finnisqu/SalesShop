# Batch 337 — Catalog-to-Quote live-source and destination safety

## Scope

Preserve SalesShop's source snapshot pricing model while making new quote insertions reliable when a Catalog record changes after the destination dialog opens.

## Changes

- **Fresh Sink/OTHER source before insert:** `CatalogQuoteInsert` subscribes to the live Sink and OTHER stores while the dialog is open and re-reads the current model/item at the exact insert boundary. The shared pure resolver (`src/services/catalogQuoteLiveSource.ts`) matches by the existing immutable Catalog ID, without changing any variant IDs or customer pricing.
- **Repriced source previews:** If the same item is edited in this client while the chooser is open, its review label reflects current price and the newly inserted quote captures the current internal cost and customer sell price. Previously issued or draft quote lines are never automatically repriced.
- **Removed/inactive sources:** Removed model/item IDs cannot silently use the old dialog source snapshot. An archived product or retired/removed explicitly selected variant cannot be inserted, nor can a missing SKU silently fall back to another active SKU. When a Catalog record disappears, the chooser displays the unavailable state instead of an old price.
- **Consistent defaults:** Both the UI and quote-line builder now reuse the canonical active-default variant functions for Sinks and OTHER; only an unspecified variant may resolve to the current active default.
- **Destination safety:** If a selected quote becomes ineligible or is removed during the workflow, the chooser explicitly marks it unavailable and requires a new selection. It no longer creates a new quote as an implicit fallback. The existing active-quote selection is preserved across quote-store hydration.
- **No data migration:** Existing quote snapshots, Catalog identities and pricing fields retain the same format. Changes do not alter historical quotes or automatic customer repricing.

## Verification

- `src/services/catalogQuoteLiveSource337.test.ts` covers repricing before insertion, archived or removed records, exact SKU matching, default-variant changes, pending hydration fallback, and dialog-level guards.
- Existing Catalog insertion/integration contract tests continue to run; the destination gating assertion was updated to match the intentional guard.
- The new tests are registered under both `test:quick-quote` (Cloudflare build) and `test:catalog-quote`.
- Source/static consistency checks passed; the TypeScript/Vitest/Vite deployment build still requires Cloudflare confirmation.

## Manual QA

1. From Catalog Sinks or OTHER, open **Add to quote** and leave the dialog open. In another application view/tab of the same client, change the selected variant's cost or selling price. After the Catalog state updates, the chooser should reflect the current value; newly created quotes must capture it, while earlier quotes remain unchanged.
2. Archive/remove the selected variant and try to insert. The chooser should block that selection, not substitute a different default. Repeat after archiving the parent item.
3. With no explicit variant preselected, change the active default while the chooser is open. The newly inserted line should use the currently active default.
4. Open the chooser with an existing editable destination, then change the quote's status or remove it. The chooser must require a valid destination instead of creating an unintended new draft.
5. Check both destination creation and existing-quote insertion on desktop/iPhone and WARM/DARK themes. Quote lines must preserve frozen source identity, quantity, customer visibility, cost and selling values.

## Limitation and next

This protects against changes visible in the current app state. It does not implement cross-device real-time synchronization or a server-side atomic inventory reservation. Those require separate cloud synchronization/transaction design.

Batch 338: Shared worktable styling, accessibility and keyboard/mobile QC sweep. Deal Gantt remains deferred.
