# Materials Foundation v1 — Freeze & QC Checklist

Materials is now treated as **quote infrastructure**, not an open-ended feature branch. New feature work should move to Quotes unless a Materials defect blocks pricing accuracy, supplier usability, or catalog integrity.

## Frozen contracts

### Material identity
Canonical material identity is:

**Brand + Material Family + Material Type + Color / Product Name**

Supplier is purchasing metadata and is intentionally **not** part of material identity.

Examples:
- MSI · Engineered Surfaces · Quartz · Sparkling Black
- Vicostone · Engineered Surfaces · Quartz · Sparkling Black

Those are separate materials.

### Material taxonomy
Top-level families:
- Natural Stone
- Engineered Surfaces
- Other

Natural Stone may use the specific geology when known. If the source confirms natural stone but geology is uncertain, use:

**Natural Stone → Natural Stone**

Do not guess geology.

### Supplier pricing import
Current canonical workbook: **SalesShop Material Import Template v1.1**.

v1.0 remains supported and derives Material Family from Material Type.

Import philosophy:
- **Stage broadly**
- **Review exceptions**
- **Publish narrowly**

Recoverable row/material conflicts stage as **Needs Attention** issues. Publish stays blocked until every blocking issue is resolved, ignored deliberately, or the material itself is ignored.

### Supplier-import safety
Supplier publishing must never silently overwrite management-owned fields such as:
- STOCK / Non-stock program assignment
- Builder pricing level
- slab / close-up images
- product URL
- internal management notes
- legacy internal cost

A supplier file that omits an existing physical spec must not delete that spec.

Replaced supplier prices must retain price history/provenance.

### Quote-facing cost contract
Quotes should consume material cost through the shared material helpers, not reimplement price selection.

Expected behavior:
- Explicit selected variant/program wins.
- Otherwise active defaults are used.
- Supplier-listed $/SF wins when present.
- Unit/slab price may derive $/SF only when a physical area is known and the basis supports it.
- Each-priced items do not invent $/SF.
- Slab cost can derive from $/SF × slab area.
- Legacy internal cost is fallback only when current variant pricing cannot provide $/SF.

### Supplier reverse CRM
Supplier profiles are first-class organization records. Catalog materials and publication history remain authoritative pricing sources.

Supplier records support:
- pricing cadence and next-review date
- phone and website
- contacts
- warehouses / branches / showrooms
- editable working rules
- source price-list rules
- notes / activity timeline
- supplier merge

Commercial commitments are intentionally **not part of the salesperson-facing Materials UI**. For now, pricing promises, potential reductions, and negotiation context belong in supplier Notes / Activity. A more structured commitments workflow may return later for a dedicated purchasing/inventory role.

Supplier rename and merge must keep material supplier labels and pricing-publication history synchronized.

## Manual regression checklist

Run this checklist before a major Quotes integration change, before merging architecture work to production, or whenever Materials/import logic changes.

### Catalog
- [ ] Open **Materials → Catalog** in reference mode.
- [ ] Search by color, brand, supplier, family, and material type.
- [ ] Filter by Material Family and Material Type.
- [ ] Open a material and verify variants, thickness, finish, format, availability, and purchase programs.
- [ ] Confirm the Catalog scan order reads Brand → Name → Type and Variants is the far-right action.
- [ ] Click the material name and confirm it opens/closes Variants.
- [ ] Pin and unpin a variant from the expanded row; confirm the clicked row/button stays in the same viewport position.
- [ ] Compare at least two materials and confirm displayed supplier costs match the selected variant/program.
- [ ] Confirm pinned cards show Brand + Type without redundant Material Family when Type is known.
- [ ] Confirm same-name colors from different brands remain separate.
- [ ] Enter edit mode, make a harmless test change, save/exit, refresh, and confirm persistence.
- [ ] Verify inactive variants/purchase programs are not accidentally used as defaults.

### Import staging
- [ ] Upload a known-valid v1.1 workbook.
- [ ] Confirm valid rows stage without intervention.
- [ ] Confirm a material-level conflict appears as **Needs Attention** rather than rejecting the entire workbook.
- [ ] Confirm source row numbers and competing values are visible.
- [ ] Resolve a flagged material-level value and confirm **Mark ready** unlocks.
- [ ] Confirm a bad but identifiable row can be accepted as skipped.
- [ ] Confirm a row with no safe Brand + Family + Type + Color identity still blocks staging.
- [ ] Confirm an unresolved blocking issue prevents Publish.

### Import publishing
- [ ] Publish a safe test/import batch.
- [ ] Verify New / Updated / Ignored counts.
- [ ] Confirm existing STOCK status and builder level remain unchanged.
- [ ] Confirm existing images/product URL/management notes remain unchanged.
- [ ] Confirm missing supplier specs were not deleted.
- [ ] Confirm a replaced price appears in price history with its prior source/provenance.
- [ ] Refresh after publish and confirm the catalog reflects the published values.
- [ ] Reattempt the same publication/session and confirm it recovers idempotently instead of duplicating records.

### Supplier workspace
- [ ] Open **Materials → Suppliers** and confirm the left navigator / right supplier record layout.
- [ ] Search/filter suppliers by status.
- [ ] Confirm Current / Due soon / Pricing due / No pricing status is sensible.
- [ ] Track an auto-discovered supplier if needed.
- [ ] Edit supplier phone, website, pricing cadence, next-review date, and notes; Save Supplier should close the edit panel.
- [ ] Add/edit/delete a supplier contact.
- [ ] Add/edit/delete a warehouse/location.
- [ ] Add/edit/delete a curated supplier rule.
- [ ] Confirm imported source rules remain visible separately from curated editable rules.
- [ ] Log a note/activity and confirm it appears in the timeline alongside pricing publications.
- [ ] Record a pricing conversation or potential reduction as a normal supplier note and confirm it is easy to find later.
- [ ] Merge only a safe duplicate; verify contacts, locations, rules, activity, materials, and pricing history remain under the kept supplier.

### Navigation / persistence
- [ ] Refresh while on **Materials** and confirm SalesShop returns to Materials.
- [ ] Refresh while on **Materials → Suppliers** and confirm the Suppliers subtab remains selected.
- [ ] Confirm the selected supplier is remembered.
- [ ] Verify mobile Catalog keeps Brand / Name / Type / Cost / Variants readable without requiring desktop-width scanning.
- [ ] Verify expanded mobile variants remain readable and Pin stays at the far right/top action position.
- [ ] Verify mobile layout still allows independent supplier-navigation and record scrolling without page-level overflow regressions.

## Automated regression coverage

Run the focused Materials suite with:

`npm run test:materials`

The Vitest suite must protect at least these invariants:
- canonical Brand + Family + Type + Color identity
- same color name across different brands stays separate
- v1.0 template backward compatibility
- material family/type validation
- permissive staging of recoverable conflicts
- unresolved structured issues block publishing
- supplier-owned fields update without overwriting management-owned fields
- omitted supplier specs do not delete existing catalog specs
- historical price/provenance retention
- stale/colliding publish protection
- active/default variant and purchase-program resolution
- slab area and cost derivation rules
- no fabricated $/SF for unsupported pricing bases
- legacy internal cost remains fallback only

## Change-control rule

After this freeze, a Materials change should normally require one of:
1. a pricing/cost accuracy defect,
2. a supplier-import integrity defect,
3. a supplier-record usability defect that blocks sales work, or
4. a concrete Quotes requirement that the existing Materials contract cannot satisfy.

Any change to material identity, price resolution, import publishing, or supplier merge behavior should add or update a regression test in the same batch.
