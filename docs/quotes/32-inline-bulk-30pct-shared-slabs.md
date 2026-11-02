# Quotes Beta — Table editing, 30% three-way pricing, and shared physical slabs

Date: 2026-11-02

## Included in this batch
1. Area table: inline name (blur/Enter commit), live $/SF selling rate, customer display/visibility; direct Material, Measure, and Selling-price navigation. Existing full Area editor remains accessible. No unpriced or manual/multiplier line is silently converted to SF when editing the table.
2. Bulk Area mode: multi-select; explicit preview and confirmation to change customer display, visibility, or existing live-SF rates. Rejects mixed manual/multiplier rate changes. One store history entry and one Undo step.
3. Three-method private Calculator comparison: **30% gross margin default** (unless an Area explicitly has another target); comparison choice starts on margin. Other choices are SF and multiplier; selecting a radio is a preview only, with explicit Apply. Margin result is unavailable until cost categories are complete. The customer quote remains unchanged on cost-entry or preview selection.
4. Shared physical slab pools: salesperson explicitly selects 2+ already measured Areas with matching material ID/name, variant, thickness, finish, and purchase option. Enter slab SF, buying cost/slab, yield, optional manual whole-slab count. Pool computes buying slabs from **combined measured SF** and allocates one buying total to participating Areas by measured SF, preserving exact cents. An Area's explicit manual material-cost override takes precedence. It does not retroactively reprice any customer selling lines or slab multipliers. An invalidated pool is flagged and per-Area cost calculations are used until corrected.
5. Cloud persistence without schema migration: pool metadata is duplicated in each participating `quote_sections.scope` JSONB and reassembled into quote-level pools by `normalizedQuoteSync`. Independent quote copies remap pool and Area IDs; duplicated individual Areas do not inherit pool membership.

## Guardrails and limitations
- Physical yield/area-based pooling is an **estimating approximation**, not a geometric CNC cut/nesting guarantee. Different material variants never share a pool, even if they look alike. Production should confirm fit/cut directions, remnant usage, seams, vein/lot, fabrication, breakage, freight and supplier minimum orders.
- Quote-wide shared pools adjust **private material-buying projections only**; the existing Area multiplier customer selling basis remains independent and frozen until deliberately reapplied. A future dedicated quote-wide multiplier allocator should only be introduced with a signed-off pricing contract.
- Bulk changing material/sink catalog snapshots across Areas, automatic bulk quote repricing, unit-count multipliers, side-panel editor, full personal Recipe builder and shared Catalog favorites remain separate, more substantial batches.
- Shared pool metadata is in sensitive quote scope storage. Customer preview, signed/shared revisions and public endpoints need an authenticated privacy regression before production acceptance. No RLS/schema migrations were made.
- Pooled Area margins reflect proportional allocation, not actual cut/placement optimization. Do not promise guaranteed slab savings.

## Required release gates (not run in this session)
- Run Vite build/TypeScript, unit tests (including `quoteSharedSlabs.test.ts`), Playwright phone + desktop.
- Authenticate with a test organization and refresh a pooled quote. Confirm same group/count/cost after reload, and after a different account loads its own data. Undo/redo grouping and bulk edits.
- Verify 40 SF kitchen + 12 SF vanity on an 80 SF slab at 65% yield → **one** pooled slab vs two if separate. Validate exact cost reconciliation, zero cost, override count, changed variants and removed Areas.
- Compare old vs new customer PDF/Preview and issued revision history across active/signed/archived quote, confirming no internal buying costs leak and price totals are stable.
- Check bulk rate edits (including 0), missing rates, manual/multiplier mixtures, excluded lines, quick change of Areas, long text, high Area count, all themes, mobile 375px, tablet and desktop side rail.
- Confirm loaded Cloudflare bundle SHA; no CI/browser result is implied by a Git commit.

## Follow-up: Quick Area side panel
- From the Quote Builder table, Area actions open a focused right-side quick editor instead of routing away from the table.
- Summary, Measure, Materials/Sinks, Selling and private Calculator tabs reuse existing store-bound editors; full Area workspace remains available through **Open full Area**.
- Previous/Next switches between Areas without closing the panel. The background dims, Escape and clicking the backdrop close, and keyboard focus is contained/restored through the shared dismissible-layer helper.
- Review on phone/tablet/desktop is still required: drawer width, scrolling, long names, Material Catalog popovers and nested dialogs.
