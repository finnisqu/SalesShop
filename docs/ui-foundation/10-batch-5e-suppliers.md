# UI Foundation — Batch 5E: Suppliers

**Branch:** `architecture/react-foundation`. **`main` remains protected.**

## Converted
- Supplier search now uses the same accessible `Field` as Materials/Sinks/Rates. New supplier controls in the desktop navigator and mobile Tools sheet share a labeled input and shared `Button`. Desktop and mobile keep the exact same value, Enter handler, creation handler and disabled/adding behavior.
- The four supplier freshness filters use shared pressed buttons, preserving current filtering, search, chip removal, and selected-state behavior.
- Supplier profile editor now uses `SupplierProfileFields`, with accessible name, phone, website, pricing cadence, next review date, active status and relationship notes. All state changes go through the existing profile draft, and Save still invokes `upsertSupplierProfile`.
- `suppliers-adapter.css` pairs palette surfaces/foregrounds for the navigator, records, summary, contacts, warehouses, rule cards, source-price-list rules, pricing publications, activity/commitment panels, and form editors.
- Desktop supplier list and record are independently scrollable inside the Catalog host rather than using a hard-coded viewport subtraction. Phone portrait and short touch landscape keep the existing single flowing mobile reference-card layout, with Tools for adding suppliers and a full record underneath.
- Published price-list history and copied source rules retain their existing publication IDs, effective dates, records and handlers. This UI batch does not alter the supplier import pipeline or introduce a second import mechanism.
- Source contracts and React server-rendering tests guard field labeling, old supplier operations, theme coverage and mobile scrolling.

## Preserve and verify
- Supplier creation, tracking/untracked supplier discovery, saving and renamed supplier material labels, merge confirmation, and contact/location/rule CRUD.
- Accurate price publication history, next review dates, provenance, and copying published supplier rules into editable rules.
- Search by supplier/brand, the all/needs-attention/current/missing filters, and clearing search filters.
- On desktop, scroll the supplier navigator while the selected detail stays in its independent pane. On mobile, search-first reference cards can expand, open the supplier record and scroll in the single Catalog host.
- On phone portrait and landscape, Tools sheet opens and closes, input focus does not zoom iOS (16px), and no fixed footer overlays its contents.
- Check Warm, Light, Dark, and High Contrast modes including expandable cards, rule panels, date field, active filter and publisher history. Existing semantic status badge colors may remain meaningful.
- Viewer/Owner Preview route permissions remain unchanged. No database schemas, backend permissions, supplier costs, or quotes are changed.

## After Batch 5E
Catalog's five UI subsections have been covered through 5A–5E (Other is a placeholder). Next is a targeted end-to-end Catalog/mobile/theme QC and cleanup of superseded legacy CSS; do not expand new features before confirming parity.
