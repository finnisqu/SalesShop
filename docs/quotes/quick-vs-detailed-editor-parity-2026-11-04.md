# Quick Quote vs Detailed Editor — parity and retirement gate

Prepared November 4, 2026 from current SalesShop source. This is a code audit, not a verified production acceptance.

## Decision

Keep **Quick Quote** as the streamlined guided editor, and retain the former Classic
builder as a separately named **Detailed Editor**. Both use the same Quote Store,
document identity, CRM associations, revisions and permissions. Switching editors
is a device-local preference and never migrates, copies, issues or reprices a quote.

## Parity matrix

| Feature | Quick Quote | Detailed Editor | Next action |
|---|---|---|---|
| Create/naming, customer and deal associations | Guided Details and template wizard | Document setup and CRM fields | Verify saved links after cloud reload |
| Areas/General, takeoffs, sink & splash quantities | Compact Area tables | Area editor and Takeoffs Lite | Compare fixture totals and ordering |
| Material and rate selection, slab costing | Catalog, pricing panels and shared slab settings | Direct line pricing and QuickMaterialQuote | Verify manual overrides, slab costs and builder levels |
| Allowance, discount, tax, notes, scope, warranty | Add-ons and work tables | General/Area line types | Test customer visibility and negative/zero rows |
| Duplicate, reorder, hide or exclude scope | Area actions and line tools | Drag/drop and manual line tools | Test duplicate/reorder and excluded totals |
| Customer preview, print and issue | Guided Pricing Review, Contract Review, approval | Customer Preview and issue controls | Compare actual customer documents and delivery |
| Revision history and secure customer links | Revision/share workflows | Revision/sign/share controls | Test frozen revision and change order lifecycle |
| Specialist pricing schedule workbook | Separate template and workbook workflow | Workbook view | Keep Detailed Editor until workbook browser QC passes |
| Split customer preview and editor zoom | Different intentional UX | Split view and workspace zoom | Retain specialist Detailed Editor capability |
| Direct in-house signature / signature receipt | Not verified equivalent | Sign now / View signature | **Parity gap: real authenticated acceptance required** |

## Retirement criteria

1. From new Quote to Details, Areas, Materials, Pricing, Contract Review, approval, issue and share, then reopen and revise without lost data.
2. Compare pricing against the legacy editor for sinks, splashes, slab pools, rates, discounts, tax, allowances, exclusions and hidden customer columns.
3. Test internal signing, receipts, revisions, change orders and immutable previously shared customer copies under real role permissions.
4. Verify cloud save and reopen on mobile and desktop, including switching between the editors.
5. Repair stale visual and workbook browser tests rather than disabling them.
6. Verify production backup/recovery and owner/salesperson/viewer privacy with synthetic account fixtures.

**Until every gate passes, the Detailed Editor remains available.** The shared data layer
is not deprecated and existing documents are never converted or deleted to change UI.

## Adjacent workspace priorities

- Connections: modal creation, table selection and fast related-record previews.
- Tasks: one status filter surface, linked CRM context and logging activity.
- Board: touch-first stage movement and compact pipeline actions.
- Catalog: compact browsing/search, rate and sink pickers; reduce redundant headers.
- Notebook and Settings: streamline secondary tools while preserving the agenda/paper model and administrative safeguards.
