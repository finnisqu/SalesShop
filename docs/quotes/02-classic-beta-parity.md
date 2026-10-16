# Classic → Quotes Beta: parity and retirement gate

**Status:** Classic remains supported and available. This is a validation plan, **not** a declaration that Beta has feature parity.

## Safe rollout

- Classic remains the default until the Beta feature inventory and end-to-end workflows pass.
- Switch to Beta from the Classic desktop editor selector or the Classic phone View menu. Return from Beta's document and Area screens to Classic; Settings → Beta Features also offers both.
- Both editors operate on the same authorized quote records, quote store, catalog and cloud permissions. The editor preference is device-local. Switching is not copying, converting, or issuing a quote.
- Opening Beta from an active Classic document preserves its quote identity and chooses Build, not an unrelated remembered Area. Navigating away must not imply delivery or change quote status.
- No migration should overwrite signed snapshots, revision history, permissions, public shares or existing customer documents.

## Feature-parity audit (not yet signed off)

Every line requires: (1) functioning Beta UI, (2) identical or deliberately improved business semantics, (3) regression tests on phone and desktop, (4) existing saved/issued records validated, and (5) authorization checks where applicable.

| Workflow | Evidence / questions to validate before retirement | Gate |
|---|---|---|
| Quote creation and templates | New Quick Quote, general lines, Builder Rate Schedule, Community Plan Pricing, custom spreadsheets, template copies and required quote names | Open |
| CRM/customer/project linking | Create/select companies, people and projects; preserve salesperson privacy and explicit sharing | Open |
| Areas and takeoffs | Piece dimensions, backsplash, left/right splashes, sink references, sink counts, area ordering, duplication, deleting, and General takeoffs | Open |
| Pricing | Catalog costs, variant/level pickers, markup/margin/SF/multiplier, allowances, discounts, taxes, rates and manual overrides | Open |
| Quote presentation | Scope/warranty/payment terms, itemization, hidden amounts, selections appendix, customer preview and printable/PDF output | Open |
| Quote controls | Undo/redo, draft copy, archived restore, deletion confirmation, edit protections, responsive zoom/layout | Open |
| Commercial lifecycle | Preview approval, issuing and revoking shares, explicit delivery confirmation, follow-ups, revision isolation and status changes | Open |
| Signing and historical evidence | Signatures, immutable signed records, signed version snapshot and legal/customer evidence | Open |
| Change orders and pricing schedules | Related contracts, revision flow, workbook grid, published-rate rows and export/import | Open |
| Mobile and accessibility | Phone portrait/landscape, tablet/desktop, dark themes, keyboard/focus, screen reader labels and no UI soft locks | Open |
| Security and organization roles | Scoped RLS, owner/admin/member/viewer access, no accidental sharing or hidden private quote leakage | Open |

## Retirement criteria

1. Complete and record the feature-by-feature audit above. Mark a workflow done only after functional and regression evidence.
2. Migrate any remaining Classic-exclusive workflow into Beta; when intentionally removed, document approved replacement behavior.
3. Test both editors against old drafts, already-issued revisions, signed records and quote shares. Reconcile price totals and customer-facing presentation.
4. Keep an independent, restorable backup and a proven rollback route through the cutover window; do not delete historical quote data.
5. Review telemetry only in aggregate for reliability and performance, not salesperson surveillance. Obtain explicit product-owner sign-off before disabling Classic in production.

**Rollback:** Users can switch back to Classic at any time while the feature gate remains open. No separate copy of quote data is created.
