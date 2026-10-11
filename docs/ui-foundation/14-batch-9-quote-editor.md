# UI Foundation — Batch 9: Quotes estimating editor

**Branch:** `architecture/react-foundation`. **Main remains unchanged.**

## Scope and findings

Batch 7 standardized the Quotes navigator, mobile toolbar and outer app chrome, but editor-owned controls still used independent legacy labels, input sizes and cream surfaces. Batch 9 brings the *internal quote editor* into the shared design-system contract in a small, reversible set of changes.

- Added `src/components/QuoteEditorFields.tsx`, using shared accessible `Field` for **Document status, document date, revision/option label, customer notes, and private internal notes**. The Quotes parent still owns every `updateQuote` action. No quote field names or persistence format changed.
- Maintained existing status guards: a new quote cannot directly select Sent/Signed from document setup, and Signed remains locked. Issuing still uses the existing authorized Send handler.
- The document/project/visibility buttons now expose `aria-expanded` and `aria-controls`, with stable matching panel IDs, and the Quote title and Area name inputs have accessible labels.
- Added `src/design-system/quote-editor-adapter.css` after earlier design-system CSS. All new styling is under `.sales-app.view-quotes`, scoped to **internal** quote form fields, named areas, setup popovers, pricing popovers, line panels and notes. Customer notes and internal notes are visually distinguished; customer notes still render normally on the customer document.
- Popovers have bounded, independently scrollable content on small screens and **short touch-enabled landscape phones**, while input sizes avoid iOS 16px autozoom. The existing immersive quote hamburger, Edit/Customer/Workbook view buttons and footer remain unchanged.
- Preserve the intentionally blue Sink / red Rate action buttons. No blanket nested text/element selectors.
- Regression tests in `src/design-system/quote-editor-adapter.test.tsx` verify labels, controlled values, allowed status options, note privacy, handler wiring, setup disclosure IDs, customer paper isolation, and original pricing/revision/sending/signature flows.

## Explicitly unchanged

- Pricing math, line amounts, taxes, totals, source material/sink/rate snapshots, takeoff quantity linking, row drag/drop, undo/redo, sections, or material level pricing.
- Customer document preview and print/PDF styles, share links, public quote signing, or signature requirements.
- User/department permissions, quote RLS, or cloud persistence.
- Mobile Quotes navigator and tool menu; quote editor and customer view continue to switch without losing navigation.

## Device/browser QC required

1. **Phone portrait & landscape:** Quotes Edit, Document setup and Project details popovers, one scroll owner; date/select controls and revision label, no clipped Done/menu actions.
2. **Internal notes:** Enter different customer and private notes, refresh, confirm both persist separately. Verify **only customer notes** appear on the customer preview.
3. **Desktop:** New status/date fields, revision label, customer visibility toggles; named Area renaming, drag/drop, add Material/Sink/Rate/Line/Scope, undo/redo and totals.
4. **Mobile quote lines:** open source material/sink/rate selectors, switch quantity/cost pricing, use issue coachmarks, ensure form inputs do not zoom and snapshots are unaffected.
5. **Roles:** Owner Preview, real Estimator/Viewer, Salesperson, and General Member. Estimator may prepare drafts but not send/issue; read-only roles retain a navigation escape.
6. **Appearance:** Warm, After Hours (Dark), High Contrast, alternate company palette; editor label and popover contrast. **Customer document must remain unchanged**.
7. Check TypeScript, Vitest and production Vite build green, then finish visual QC with actual phone screenshots.

**Next:** Batch 10 should finish specificity cleanup only after device parity, especially older Quotes setup and notes selectors now superseded by the shared Field components.
