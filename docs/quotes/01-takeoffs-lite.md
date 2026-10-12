# Takeoffs Lite v2 — quick measurements, splash edges, sinks and customer presentation

## Open from any quote Area

Open an editable Draft or Ready Quote, add/select an Area and tap
**▤ Takeoffs Lite**. A focused modal opens above the quote; on phones it is
full-screen with large labeled fields and a fixed Done action. Escape, Close,
Done and tapping the backdrop dismiss it. Changes save as you edit via
the existing Quote store and cloud persistence, with normal undo/redo.

## Pieces and splash checkboxes

Each piece has:
- optional **Piece name**, blank by default (placeholder identifies the piece;
  existing names auto-select on focus)
- **Length** and **Width** in inches, supporting e.g. `25.5`, `25 1/2`,
  `25-1/2` and `25½`
- **Qty** for repeated identical pieces, default 1
- **Back** (backsplash), **Left**, **Right** checkboxes
- automatically computed SF and Duplicate/Delete controls.

Back contributes the piece's *length* to 4-inch splash LF; left/right
each contribute its *width*. LF is derived from marked complete pieces
and saved in the Area's existing `splashLf` scope field. Countertop SF is
length × width × count ÷ 144; totals are rounded only after summing pieces.
These are geometric quantities, not slab-yield or waste calculations.

## Material / sinks

Enter a material/finish description. Use **+ Add sink** to store optional
sink category (Kitchen or Vanity), model, quantity and an independent
**Price separately?** checkbox.

Unchecked sink prices are **specification only**, not a charge; useful
when the agreed lump sum already covers the sink. Checking Price separately
adds a linked, editable priced quote row (quantity × sell price). Updates
and removal only affect the auto-managed row; existing manually added and
catalog sink rows are never touched. Missing sell prices are clearly
flagged, and price is never inferred from supplier cost.

Sink counts are reflected in the Area Scope. Underlying sink selections
remain inside the original Quote's persisted JSON scope. The managed
quote-line link uses the optional `quote_lines.takeoff_sink_id` field.
No new tenant permissions or RLS policies are added.

## Two quote presentation modes

- **One line · Lump sum**: sets the existing
  `QuoteSection.customerDisplayMode='summary'`. The customer sees one
  aggregate Area price and the material/sink specification string. Actual
  charge is the existing sum of billable Area quote lines, NOT a second price
  calculation, so switching modes never duplicates totals.
- **Area header · Itemized**: sets `customerDisplayMode='detail'`.
  Customer sees an Area heading and its visible material, sink and other
  quote lines. The description also includes selected material/sink specs.

The internal editor still retains underlying detailed lines, snapshots
and full quote history. Public share links receive only sanitized
material/sink descriptions—not private piece dimensions or price
calculation metadata. Those are constructed server-side by the
`quote-share-public` Edge Function and displayed on public quote pages.

**+ Add SF pricing row** creates a live-linked SF rate row when needed, with
no default sell rate. Subsequent dimension changes update only
explicitly live-linked SF or splash LF rows. Manual quantities and legacy
captured quantities remain unchanged. The add button prevents repeated
accidental creation of the same quick SF row.

The prior **Switch countertop SF to manual** control remains, retaining
last quoted SF, splash and prices, and detaching the piece grid only.
Sink selections and their pricing links remain in the Area.

## Boundaries

- Measurements and toggles are rectangular and oriented for quick quoting,
  not CAD Lite geometry or slab optimization.
- Checkboxes represent 4-inch splash edge lengths only, not full-height
  splash areas. The height is not a cut-list instruction.
- Waste, fabrication, installation, waterfall, cutouts and other charges
  remain separately priced unless explicitly included in the Area quote.
- Cloud record updates continue through existing quote/section/line guards.
  No tenant-independent access path or customer-data permission is added.
- Production deploys from `architecture/react-foundation`; frozen
  `main` is untouched.

Migration: `supabase/migrations/202610120003_quote_takeoff_sink_link.sql`.
Frontend tests: `src/services/quoteTakeoffsLiteV2.test.ts`,
`quoteTakeoffsLite.test.ts`, `quoteAreaScope.test.ts`.

## v2.1 — 4-inch splash material SF + catalog picker controls

**Splash arithmetic**: Each checked Back / Left / Right edge includes actual
4-inch-high material area, not only LF. Back uses the piece LENGTH; either
side uses its WIDTH. With length and width in inches, one edge contributes
`4 × edge inches × count ÷ 144` SF. The per-piece displayed SF includes
top and checked splashes; the popup displays Top SF, Splash SF and
**Combined takeoff SF**, with a separate LF reference retained for any
splash labor estimate.

Combined top + splash SF is the quantity that the existing live-linked
`countertopSf` field now supplies to a quote material/SF line. Internal
`takeoffTopSf` and `takeoffSplashSf` keep the breakdown. Sum unrounded
measurements and round only the resulting total to two decimals. Never
silently add the same splash material to another quote line:
independent `splashLf` can still be used for labor or another explicit
pricing choice.

**Compatibility**: Opening a previously saved takeoff with flagged splashes
does not silently modify its priced quantity. When its saved scope is from
the prior LF-only release, the popup offers **Recalculate Area SF**. The
operator approves applying the new combined SF to live pricing. Draft/Ready
editing safeguards still apply; issued quotes are not modified.

**Materials Catalog**: Choose an existing material, active variant,
and—when relevant—a purchase/cost option directly inside the popup.
Search uses the same company catalog store as regular Quote Material lines.
Selection saves the catalog IDs, current source-cost snapshot and
customer-readable material/variant description in the Area's scope.
If the Area has a live SF pricing row, that row becomes a catalog-linked
material line without resetting its selling rate. If the row is added later,
it inherits the Area's current material selection. Free-text materials
remain available and explicitly detach stale catalog selection references.

**Sinks Catalog**: Choose a real active sink model and variant from the
existing company Sink Catalog. Selection saves the variant snapshot,
category, model description and the catalog **selling price**, when
available. It does *not* automatically add an extra charge: the
**Price separately?** checkbox still controls whether a managed sink
line is created. A separately priced linked sink line retains the catalog
snapshot and can be edited in the regular Quotes sink interface. Switching
back to unchecked removes only that managed row, not pre-existing or
manually entered sink rows.

Catalog costs are internal references, not inferred selling prices.
Cloud persistence uses the existing Area `scope` JSON and sink line
`takeoff_sink_id` link; no new schema or tenant permission changes are
needed for these catalog selection fields.

## v3 — Smart Area-first quoting workflow

**Workflow**: Open Takeoffs from the prominent button by General or any
Area title. General's button creates (or reopens) a genuine "General takeoffs"
Area, so everything is still persisted as a standard customer-visible Area
and can later be renamed or split. General's unrelated manual lines remain
unchanged.

New takeoffs begin as **one lump-sum customer Area** by default. Measuring
the first complete piece automatically creates **one** ordinary priced SF
line with live measurement linkage and no assumed selling rate.
Select an SF selling rate directly inside the popup, either manually or
from the same Rate Book store used by normal Quote Rate lines. Source-cost
references never silently become selling prices. If an Area already has a
manually priced material/item row, adding another live SF price is **opt-in**
to prevent an accidental double charge. Legacy quotes are unaffected by
opening the popup.

Material and sink selection are now **searchable input fields**. Tapping
either shows Catalog suggestions (pinned project colors first); typing
filters the Catalog, while continuing to support custom descriptions.
Catalog material variants and purchase options retain their source snapshots;
sink variants retain their catalog sell price and an independent
"Price separately?" decision.

**Project Materials**: Each Quote has its own pinned material list,
automatically populated when a material is selected in Takeoffs or a
standard Material line. You can also add and remove manual entries. The
shortlist is saved in `public.quotes.project_materials` JSONB, scoped to
the existing tenant RLS, not as a company-wide catalog mutation.
The shortlist appears first in both Takeoffs Lite and standard Material
Catalog search results.

**Itemization**: The default lump-sum view presents one customer price
from underlying billable Area lines. Choose "Area header · Itemized" to
show individual prices; each item can be visible or folded into one
"Other included work" remainder row without changing the total. The same
remainder behavior is applied by the public quote-sharing function, and
hidden descriptions are not exposed.

**Split into Areas**: Select any subset of takeoff piece rows and choose
"Move to new Area". A new Area inherits the selected material, contains
only those pieces, and has its own live-linked SF row. If the source
Area had a sell rate, it is copied to the new Area. Source SF updates
atomically in the same quote transaction. You can also move all pieces,
which leaves the source Area with 0 measured SF and preserves its other
items, sink selections and pricing.

**Smart vs Manual**: Smart is intentionally a *source and linkage* for
ordinary quote lines, **not** a replacement for the familiar Manual,
Material, Sink, Rate, and other Quote line types. This avoids a breaking
schema migration and preserves editing, undo/redo, customer visibility,
versions and pricing controls in one coherent model.

This is an incremental, first release of flexible customer
grouping—not a fully recursive arbitrary-depth quote hierarchy.
Nested, repeatable line groups can be added later without destabilizing
the standard Area summary and detailed presentation.
