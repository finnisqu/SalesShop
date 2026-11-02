# Quotes Beta — Workflow optimization batch (2026-11-02)

## Changes committed to main

### P0 — Classic ↔ Beta compatibility

- Removed the editable-quote mount effect in `QuotesMobileBeta.tsx` that automatically included existing managed sink lines and converted legacy specification-only sink selections into priced rows.
- Sink billing is now explicit per Area sink, under Materials: **Include sink in quote total**. The old selection remains visible as a specification when the sink charge is excluded. Selling price input is disabled for unbilled sinks.
- New Beta sink rows remain included by default; actual inclusion for older records requires a managed quote line marked `includeInTotal`. A legacy `includeInPricing` flag by itself does not create a charge.
- Editing a previously saved sink with no managed charge does not create one; an explicit opt-in uses a single undoable store operation.
- The Area cost and issue-review models use actually billed sinks, rather than only legacy `includeInPricing` flags. This preserves distinction between missing buying cost, a specification-only sink, a blank sell price and explicit complimentary $0.
- Coverage: `quoteLegacySinkCompatibility.test.ts`. GitHub issue #65 stays open until full runtime parity has been validated.

### Faster starts

- Quick Quote now supports **Start from previous quote** in the new document picker, using the same `duplicateDocument` path as independent copies. This remaps quote-owned IDs while retaining useful Areas, measurements and price snapshots.
- A copied quote starts as a fresh draft with its own quote number; issued history, signature and sent/viewed timestamps are cleared. Existing quote document copies and signatures are untouched. `quoteDocumentCopy.test.ts` extended for signed sources.
- The initial Details screen now gives two explicit routes: **Start first Area** and **Start with General charges**, without creating an extra Area for a flat-fee estimate.
- Coverage: `quotePreviousStarter.test.ts`, `quotes-beta-general-fast-path.pw.ts` (auth-free local demo run only).

### Pricing overview cockpit

- Displays private internal-cost coverage by measured Area, including which cost categories are missing; a direct Calculator shortcut opens that Area.
- Adds a quote-wide count of cost-complete measured Areas and a **next action**: first canonical selling-price blocker, then a measured Area requiring private estimate completion, or Review if neither is pending.
- The advisory cost indicator **does not prevent issuing**. Existing audit/approval remains the sole pricing issue gate; customer total and quote price formulas remain unchanged.
- Coverage: `QuoteBetaPricingOverview.test.tsx` expanded for selling blocker priority and private estimate navigation.

## Validation required before deployment is accepted

1. **Classic→Beta→Classic without edits:** existing draft with spec-only sink, included flag but no priced line, or excluded managed line. Customer total must not change on opening, switching, refresh or background cloud sync.
2. **Intentional sink choice:** check Include in quote on a previously excluded sink; confirm new total and one managed charge, undo/reopen; uncheck and verify no phantom duplicate. Test new Beta sink, blank rate and explicitly entered $0.
3. **Previous Quote:** choose Start from previous, pick a signed or issued old quote, enter a new title; verify isolated draft, unique Area/piece/sink/line IDs, unchanged original and no copied delivery proof.
4. **General-only path:** create named Quick Quote, start from Details → General and add a fixed priced charge; confirm no forced Area.
5. **Pricing cockpit:** multiple Areas, incomplete selling and buying cost states, General fees, no Areas, zero/negative discounts, dark/light, mobile and desktop. Next action must prioritize canonical blockers; cost coverage must stay internal.
6. **Customer handoff:** preview, edit, reapprove exact revision, explicitly issue, share and manually record actual delivery. Validate historical signed and revoked links in an isolated test org.
7. **Automation:** run TypeScript, build, Vitest and Playwright at the current SHA; verify Cloudflare build badge and real-auth account permissions. No results were fabricated here.

## Intentional deferrals

- Area template gallery, advanced reusable company presets and auto-defaulting prior customer rates: not shipped, because these need clearer selection/snapshot rules to avoid silent repricing.
- Signed-link, Supabase RLS, team permissions, warehouse/pricing catalog, delivery automation, and Classic retirement: not changed.
- Real authenticated browser acceptance and compilation are **pending**, not implied by a successful GitHub commit.

See `docs/quotes/27-end-to-end-workflow-gap-audit.md` for the broader five-journey plan.
