# Takeoffs Lite — Quick Rectangular SF for Quotes

## User workflow
1. Open **Quotes → an editable draft/ready quote**.
2. Add a named **Area** if needed, e.g. Kitchen, Vanity or Unit A.
3. In the Area header tap **▤ Takeoffs Lite**.
4. Tap **+ Add Piece** and enter Piece name, Length (in), Width (in) and Count.
   Examples: `96`, `25.5`, `25 1/2`, `25-1/2`, `25½`.
5. Each complete rectangle calculates length × width × count ÷ 144. The
   Area totals all valid pieces and rounds once to two decimal SF.
6. To quote from that measurement, click **+ Quote SF line**. This adds a
   `quantity-rate` line to the same Area with measured SF as its quantity
   and no preset rate. Enter the selling rate, or keep using normal material/
   rate rows and select **Qty source → Countertop**.
7. Linked lines from Takeoffs Lite are marked **live from Takeoffs Lite**.
   New dimension changes update their quantity and corresponding price.
   Existing manually entered quantities and legacy Area Scope captures do
   not change automatically.
8. Duplicate, remove, or adjust pieces as needed. **Switch to manual SF**
   intentionally removes takeoff detail but preserves the last measured
   Area SF and the priced quantities (converting live links to snapshots).

## Storage / integrity
Takeoff data is stored under `QuoteSection.scope.takeoffPieces` in the
existing `quote_sections.scope` JSONB column. No new table or migration
is required. Existing quote persistence, normalized cloud sync, undo/redo,
revision snapshot, and quote owner permissions continue to apply.

An individual piece holds:
`{id,name,lengthIn?,widthIn?,count}`.
Each quote-area calculation is internal-only; customer documents continue
to display priced quote lines, not private piece dimensions. The quantity
source retains a captured measurement and may opt into `syncMode:'live'`;
legacy snapshots with no `syncMode` remain snapshots.

A change to Takeoffs Lite is atomic in the quote store: the area scope
SF and any explicitly live-linked lines update together. Existing
`quoteIsCommerciallyEditable` guards block changes to sent/signed/
archived quotes. Any change is included in quote undo/redo history.

## Limitations (intentional for Lite)
- Rectangles only, not connected CAD geometry, L-shape optimization,
  seams, cutouts, slab yield or waste factors.
- Measured SF is not automatically marked up. Selling rate, waste,
  labor and custom pricing remain explicit quote choices.
- Missing dimensions contribute 0 SF; pieces must be complete and
  positive to count.
- Lengths and widths are inches; no feet/millimeter switch yet.
- Maximum 500 pieces per Area, with integer count 1–1000 each.

This document structure is a starting point for future CAD Lite transfer:
CAD-generated rectangular piece measurements can map to the same Area
scope calculation without requiring the user to reenter figures.
