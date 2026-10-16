# SalesShop Quotes Beta — Classic feature-parity audit (Batch 18B)

**Branch:** `batch/18b-quotes-beta-parity-audit` (stacked on PR #57).
**Target:** complete Beta's real quoting workflows before Classic sunset.
**Release:** no edits to production `main` or Supabase.

This is a **source-based capability audit**, not an assertion that each
workflow has passed authenticated cross-device acceptance testing. Categories:

- **Present:** feature is wired into Beta and its backing store/service.
- **Partial:** most logic exists but workflow parity or specific UX remains incomplete.
- **Blocked/unproven:** rollout / authentication / integration evidence is missing.
- **Classic-only:** retained separately; not necessarily something to duplicate verbatim.

| Workflow | Classic implementation | Beta evidence | Finding / next validation |
| --- | --- | --- | --- |
| Create, name and duplicate quote | `Quotes.tsx`, Quote store | `NewSalesDocumentPicker`, `QuotesMobileBeta.createFromTemplate`, guarded copy naming | **Present**; test blank and template copy, duplicate prompts |
| Quote library, search, sort, archive/delete | Quotes list, store | Beta library filtering, `SalesDocumentActionsMenu`, archive/delete guard | **Present**; desktop/mobile Back, restore, role access needs release test |
| Customer / company / person + Deal | `QuoteCrmFields` | `QuoteBetaDetails` and same CRM picker | **Present, UX partial**; flow to first Area and Review should be one tap |
| Quick Quote areas and General line charges | Classic area/line editors | Beta General and Area managers, `BetaLine`, stable Store | **Present**; drag reorder/mobile touch parity requires visual/manual QC |
| Pieces, backsplash, sinks and measurements | `QuoteTakeoffsLite` | Beta Measure/Materials plus same `QuoteTakeoffsLite` | **Present**; stress-test recalculation, deletion and zero-value scenarios |
| Catalog selection, rate book and pricing | `QuoteMaterialLineFields`, `QuoteSinkLineFields`, `QuoteRateLineFields` | Same line fields; `QuoteBetaMaterials`, `QuoteSfRateChoices` | **Present**; run material variant/sink fallback and rate snapshot scenarios |
| Detailed internal estimating and margin | `QuoteInternalPricingSummary` and pricing controls | `QuoteBetaDesktopPricing` calculator under `QuoteBetaDesktopCommerce` | **Partial UX parity**; verify calculations across quantity, SF, slab multiplier and rate models, no customer-cost leakage |
| Line price modes / customer visibility | Classic line editors and customer preview | Beta line modes, `QuoteBetaEditablePreview`, `QuoteBetaCustomerOptions` | **Present**; verify total invariance when hiding/breaking out scope |
| Customer preview / signed copy | shared `CustomerPreview`, quote share, signature | `QuoteBetaEditablePreview`, shared `CustomerPreview`, `QuoteShareControl`, `QuoteSignatureDialog` | **Present**; customer-facing document and legacy signed revisions must remain identical |
| Review issues and inline repair | Classic pricing/reminder controls | `QuoteBetaReview`, `QuoteAuditInlineEditor`, shared `auditQuoteDraft` and issue gate | **Present, speed partial**; not every finding has an inline fix; retain jump-to-full-editor fallback |
| Issue, share, delivery confirmation | Classic store recordSent, customer share | Beta `QuoteBetaReview`, key-scoped preview/approval, `QuoteDeliveryConfirmation` | **Present**; issuing does NOT send email; test explicit revision confirmation, real link and public share separately |
| Revision / edit freeze / signature | Quote store, `QuoteSignatureDialog` | Beta `createRevision`, `quoteCanCreateRevision`, same share/signature primitives | **Present**; manual historical signed-record regression required |
| Pricing Schedules (simple/plan/workbook) | `PricingDocumentEditor` Classic workbook | Beta lazily mounts `PricingDocumentEditor`, customer schedule preview and validation | **Present**; special publisher/stock-level cases need workbook browser QC |
| Desktop Classic split view | `Quotes.tsx` edit/split/customer mode | Beta separate editor + editable preview + desktop rails | **Intentional UX difference**; don't port the split layout unless users miss a material capability |
| Instant external email sending/tracking | Not a proven first-party send/track workflow | Beta shares links and records seller-confirmed delivery | **Not an established parity requirement**; don't label links or clicks as delivery |
| Workspace privacy / multi-actor sharing | Old quote/CRM policies | Staged RLS and PR #57 personal role model | **Security release blocked** until isolated real-auth staging; UI parity does not prove safe access |

## Found workflow friction (prioritize before Classic retirement)

1. **P0 — Finish the current Area without spawning another one.** Existing Area footer offers Next Area and Done / Quote; provide a direct **Review quote** path alongside them. It must open the existing audit, never auto-issue or mark delivery.
2. **P0 — Customer/Deal → first Area without returning to Build.** In Beta Details, use **Continue to first Area** when no Areas exist, or **Continue to [existing] Area** otherwise. Always an explicit click; never create an Area automatically on render.
3. **P0 — Shared Quote protections.** Keep shared quote pricing math, issuing guards, immutable revision handling, and customer preview key approval, rather than short-circuiting for faster sending.
4. **P1 — Restore navigation and responsive controls.** The targeted Home/Deal smoke suite currently passes; full visual QC remains the broader gate. Preserve browser Back, landscape and dark-theme behavior.
5. **P1 — Complete validation matrix:** negative/zero charges; managed sink prices; live SF; cost/margin calculations; material variants; revisions; customer share/privacy; signed snapshots. Do not call the migration complete on unit and one device alone.
6. **P2 — Confirm whether remaining Classic split/customer panel affordances are desired** from usage feedback, instead of cloning the old UI automatically.

## Planned 18C acceptance

- From a named draft, go to Details, pick Customer/Deal, and reach an existing or newly created first Area in one deliberate action.
- From Measure/Materials/Pricing, open Review in one tap; review remains non-destructive and does not silently create/share/issue documents.
- Keep Next Area and Done / Quote options, unchanged pricing and store semantics.
- Tests guard these transitions; full browser QC continues separately.

## Nonnegotiable Classic sunset criteria

All high-value templates and price modes verified against known workbook outputs;
customer preview/signed-share behavior confirmed in local demo and real auth;
revision, archive, restore and signature regressions green; accessible desktop,
phone portrait and phone landscape paths verified; user acceptance on actual
sales jobs; privacy/RLS staging and rollout passed before broad organizational use.

**Decision:** Classic stays accessible; Beta is feature-rich but **not yet certified**
as a drop-in replacement in production.
