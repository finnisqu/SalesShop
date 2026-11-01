# Quotes Beta — scope-first Areas and quote-wide Materials & Pricing

Main-first Batch B, November 2026. This is a presentation/navigation update only. Quote math, takeoff synchronization, issued snapshots, Supabase, RLS, sharing and approval are unchanged.

## Experience
- New Quick Quote still begins at Project Details.
- Areas opens with a scope introduction and Area cards first. General charges remain directly editable below, and a General-only flat-fee quote requires no measured Area.
- The top tracker Materials & Pricing now opens a quote-wide read-only overview, not one arbitrary Area. The desktop rail and mobile Quote tabs also link there.
- Area rows show material description, measured SF, sink count, total selling price and canonical audit issue counts. Existing Area Materials/Pricing editors remain responsible for all edits.
- General lines are summarized separately. Shared quoteTotal and quoteLinesTotal functions drive amounts.
- Clicking pricing issues navigates to the same canonical audit destination used by Review. Review never issues/sends a quote automatically.
- Saved Beta location parser now recognizes the quote pricing tab. Pricing Schedule remains Editor/Details/Preview without the quote-specific Pricing tab.

## QC pending
- General-only $175 quote can be priced with zero Areas.
- Kitchen and Bath with one missing selling rate: no duplicated Area and correct issue route.
- Phone portrait/landscape and desktop; themes; browser Back; reload into Pricing tab; existing Classic functionality.
- Issued and signed revisions remain read-only; no RLS/Auth changes.

Source reviewed only; GitHub-hosted CI and browser tests were not run for this batch. Confirm Cloudflare Ready and manual smoke QC.
