# Batch 334 — Safe Catalog duplication and reversible archiving

## What changed

Catalog → **Sinks** and Catalog → **OTHER** can now duplicate an entire model/item while editing its expanded worktable row. The action resets search, category, archived visibility and sort restrictions, then opens the duplicate on its correct pagination page. Existing comparison pins remain untouched.

- **Fresh Catalog source identities:** Each copy receives a new model/item ID and new variant IDs. The source record and old quote snapshots are left unchanged.
- **No duplicate SKUs:** The new Sink model code, variant codes, OTHER item SKU and OTHER variant SKUs are blank so the editor can supply distinct values before selling.
- **Specification and price template:** Variant dimensions, materials, colors, finishes, ADA flags and current costs/prices are copied. Default-variant invariants are normalized; the new top-level record is active, while individual variant active/inactive flags are preserved.
- **Sink audit history:** A model copy does not inherit price-version IDs or past pricing events belonging to the original source. Its variant histories and effective dates start blank, while current amounts are retained. Subsequent edits create history on the new source.
- **Reversible archive:** The model/item's `Active in catalog` toggle archives without deletion. The archived row remains accessible through **Edit** → **Show inactive** and can be reactivated. Existing quote snapshots remain unchanged.
- **Honest comparisons:** Sinks pinned comparison displays `—` for unspecified prices instead of implying a real $0 price.

No new database columns or Supabase migrations were required. Normal local/cloud Catalog persistence continues to store these records.

## Regression coverage

The existing build-included Vitest suites were extended:

- `src/store/catalogVariantManagement333.test.ts` verifies duplicating Sink and OTHER records, fresh variant identities, cleared SKUs, source isolation, pricing, default invariants, archived-source behavior, missing-ID no-op and historical quote snapshots.
- `src/services/catalogVariantWorkflow333.test.ts` verifies both user-facing duplicate actions, visibility reset, archive guidance and missing-price placeholders.

## Manual acceptance checks

1. Open Catalog → Sinks, enter **Edit sinks**, expand a model, choose **Duplicate model**. Confirm the new editable row appears with copied specifications/prices, a blank model code/variant codes and a unique record identity.
2. Repeat in OTHER using **Edit items** → **Duplicate item**. Verify item and variant SKUs are blank and pricing/specifications are copied.
3. Archive each original by unchecking **Active in catalog**; enable **Show inactive** to find and restore it. Ensure existing quotes retain historical snapshots. Compare pinned variants before and after.
4. Repeat with global search, sort, category and inactive filters applied; the new duplicate must still become visible, and comparison pins should remain intact.
5. On mobile widths and WARM/DARK themes check expanded-row controls wrap without clipping.

## Verification status

Code and regression tests have been committed. Cloudflare's build (TypeScript, quick-quote tests, record gate, Vite) remains the authoritative verification; browser/cloud persistence QA is still manual. Do not interpret a committed change as a verified deployment.

## Next

Potential next compact batch: unify archived-state badges in the Catalog summary rows and provide per-variant restore affordances without deleting historical source identities. Continue parity with the Materials worktable; keep Deal timeline/Gantt on hold.
