# November 2 — Acceptance and hardening: Notebook + Quotes Beta (Batch 5)

## Notebook split history
- Split-pane non-text history snapshots only ink strokes and objects, rather than whole Notebook pages. Undoing an object or stroke does not roll back text, title, folder, paper, or other page metadata changed after the object edit.
- Undo/redo restores a new page timestamp to preserve the change through the existing Notebook persistence path.
- Page/folder structural edits and global full-document undo/redo invalidate the page-specific stacks, preventing stale history from crossing page removal or restoration.
- Undo/Redo button enabled state now subscribes to changes on the active page, so it refreshes after split-pane drawing/object updates.
- Added focused tests for text preservation on page undo/redo and clearing old history after a full-document undo.

## Quotes Beta multiplier mode
- Scope changes affecting shop cost, installation cost, target margin, or fractional purchased slab quantity no longer trigger multiplier customer-price recalculation.
- Explicit slab selling-basis changes (slab yield, area, whole count, or slab cost) retain the existing multiplier selling-price behavior; an explanatory note makes that relationship visible.
- The helper identifying selling-basis edits has focused tests for both sets of fields. Financial equations, saved quote data shape, public previews, delivery state and permissions were not changed.

## Runtime acceptance still required
1. Notebook: create objects on left/right, type text after object edits, undo objects on one page, verify text and the other pane remain untouched, then redo. Verify both toolbar states.
2. Notebook: alter title/paper, delete/restore pages and use global undo. Confirm no stale per-pane history, and split layout restores after reload and account change.
3. Quotes: in multiplier mode record the customer quote price; edit shop/install, target margin and purchased fractional slabs. Verify selling price remains unchanged. Then edit slab basis and verify the intended multiplier calculation. Check other selling modes and historical revisions.
4. Check source/build compilation, Vitest, laptop/tablet/phone UI, light/dark theme, authenticated cloud sync, and Cloudflare loaded SHA. Do not claim these checks passed without runtime evidence.

Deployment follows the existing automatic `main` process; no backend migrations or changes to private quote access are included.
