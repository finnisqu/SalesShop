# Batch 349c — Materials comparison-board parity

Date: November 14, 2026
Branch: `main`
Status: Source committed and regression suite registered. This batch's Cloudflare build and authenticated device QC remain unverified.

## Objective

Bring the Materials pinned comparison board into line with the Sinks and OTHER boards without removing its existing high-precision pointer-drag behavior, product data, or pin persistence.

## Changes

1. **Unified safe pin ordering.** Materials now uses the same pure `reorderCatalogPins` / `shiftCatalogPin` implementation as Sinks and OTHER. The shared reorder helper also supports Materials' existing before/after drop indicator, while preserving its default before behavior for Sinks and OTHER. A stale/unknown drag key or target cannot resurrect a removed pin.
2. **Touch/keyboard comparison controls.** Each pinned Material card now shows explicit Move left, Move right, and Unpin buttons with descriptive accessible names. Boundary buttons disable at first/last card. The original pointer-drag handle, target highlighting, pointer-cancel cleanup, and ArrowLeft/ArrowRight keyboard behavior remain available. All Catalog pin boards now use consistently sized controls; minimum 44 px on phones and short landscape layouts.
3. **Visible lifecycle status.** Material comparison cards show the same `CatalogLifecycleStatus` (Active/Archived and active Default) as Sinks and OTHER. The status reflects the combined material/variant active flags, so a pin referring to a retired parent or variant is not mistaken for a currently sellable SKU.
4. **Quote eligibility in comparisons.** A variant with a nonempty supplier purchase-program list but no active program now shows a note instead of an Add to Quote launcher on the pinned card. The normal Material browser already used this guard. Legacy material variants with no structured purchase programs continue to allow manual-pricing Quote insertion. Retired material and variant sources remain nonquotable. Existing saved Quote selections, actual catalog costs, and supplier programs are not mutated.
5. **Regression tests.** `catalogComparisonMaterial349c.test.ts` covers before/after ordering, stale pins, arrow movements, source integration across three boards, touch controls and lifecycle/quote eligibility. It is registered exactly once in `test:quick-quote`. Existing Batch 349b tests cover Sinks and OTHER using the default before-drop behavior.

## Manual acceptance when the new build is green

- On desktop: pin several Materials variants, reorder with the drag handle to the left and right half of target cards, and use keyboard arrows; verify no missing or duplicated cards.
- On phone: move pinned Materials with the larger left/right buttons, unpin, horizontally scroll the comparison strip, and ensure touch controls do not overlap the drag handle.
- Pin a retired variant, a variant with retired supplier purchase programs, and one with no programs. Archived must be labeled; retired programs must show an explanation instead of Add to Quote; the legacy no-program variant must still permit manual pricing.
- Confirm Sinks and OTHER pin dragging and keyboard/touch controls still reorder correctly after the shared helper gained an optional `after` position.
- Confirm WARM, LIGHT, DARK themes, Safari and Android layout, and that archived suppliers or variants cannot be newly quoted.
- Confirm Cloudflare `tsc --noEmit`, `test:quick-quote`, `test:record-gate` and Vite build are green for the new commit. This completion is not claimed until verified.

## Boundaries and next

No Supabase schema/RLS/Auth, Catalog price write, quote price calculation, customer preview, or issued document changes. Multifamily Gantt remains deferred.

Next **#350a**: complete remaining Catalog/Records worktable visual consistency and focused authenticated mobile QC, or fix any Cloudflare failure from this batch first.
