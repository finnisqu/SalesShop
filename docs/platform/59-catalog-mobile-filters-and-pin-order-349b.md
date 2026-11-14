# Batch 349b — Catalog mobile filter visibility and comparison-board reorder

Date: November 14, 2026
Branch: `main`
Status: Source changes, tests and roadmap committed. New Cloudflare build, authenticated desktop/mobile UI and physical-device acceptance pending.

## Entry gate: repair the 349a build

The user supplied a Cloudflare log showing `tsc --noEmit` succeeded and Vitest ran 512 tests: 511 passed, 1 failed. The failure was a stale Batch 338 accessibility **source-contract assertion**, not a new runtime failure: the test expected both Sinks and OTHER expanded rows to span `selecting?8:7`. Batch 349a correctly added two Sink pricing columns; Sinks now spans `selecting?10:9`, while OTHER still spans `selecting?8:7`. Updated `worktableAccessibility338.test.tsx` to assert both explicit column counts. No catalog layout or pricing behavior was reverted to satisfy the old test.

## 349b implementation

1. **Visible, independently removable mobile filters for Sinks and OTHER.**
   - Shared pure `catalogProductFilterChips` returns labels and targeted clear callbacks for Catalog header search, worktable Find search, selected category, Include archived, and non-default sort.
   - The two text searches are logically independent; the chips are separate even when the query text is identical, matching the existing `matchesCatalogSearch` conjunction.
   - Both worktables now render `MobileCatalogActiveFilters` using the same existing Materials component on phone-sized screens. The existing Filters popover remains the single location for search, category, archived and sort controls.
   - Filter badge counts derive from the actual chip count, so simultaneous Catalog/Find queries are counted independently. The shared Reset filters & sort control still clears everything and does not mutate pins or Catalog records.
   - Chips have a horizontal, theme-aware, keyboard-focusable phone strip with accessible per-filter removal. The strip is hidden on desktop.

2. **One guarded comparison-board reordering contract.**
   - Sinks and OTHER use the same pure `reorderCatalogPins` for drag/drop and `shiftCatalogPin` for left/right card buttons.
   - Dragging an unknown or stale source, dropping on a nonexistent target, or dropping onto itself returns the original order unchanged. This prevents the former Sink drag handler from recreating a deleted/stale pinned key.
   - Arrays and catalog products are not mutated. Existing per-company pin persistence, clear-all, unpin and Add to Quote rules are preserved.
   - Left/right buttons remain available for keyboard and touch users who cannot drag cards.

3. **Build coverage.**
   - Added `catalogProductMobileFilters349b.test.ts` (six tests) for default state, independent searches, trimming, category/archived/sort removal, and both source integrations/CSS.
   - Added `catalogComparisonOrder349b.test.ts` (four tests) for valid/invalid reorders, left/right bounds, no mutation and source integration.
   - Both suites are included exactly once in Cloudflare's existing `test:quick-quote` gate. The corrected 338 test remains in the gate once.

## Manual acceptance after green

- On a phone, open Sinks and OTHER; set both the Catalog page search and the table Find box, then remove one chip. The other search must continue filtering results.
- Apply Category, Include archived and Customer price sort simultaneously. Each chip should remove only its own constraint; Clear all restores default filters/sort.
- Confirm active-filter badge count and horizontal chip scrolling at narrow iPhone width and landscape. WARM/LIGHT/DARK colors, keyboard focus, and screen reader button labels should be usable.
- Pin multiple Sink and OTHER variants. Try left/right buttons and drag/drop to reorder. Remove a pin during a drag, then drop; no deleted pin should come back.
- Verify archived pins still show their state and cannot launch new Quotes. Existing Quote prices and live Catalog records must not change.
- Confirm the new Cloudflare build passes TypeScript, Quote tests, Record gate, and Vite; no authenticated browser run has yet been performed.

## Boundaries and next

This is Catalog presentation/filter and transient pin-order logic only. No Supabase/Auth/RLS, cloud schema, pricing data, issued Quote receipts, or new Gantt functionality changed.

After Cloudflare green: #349c can handle Catalog Materials compare-board / Sinks/OTHER pin-style parity and any mobile issues observed during actual use.
