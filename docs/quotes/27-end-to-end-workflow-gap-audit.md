# Quotes Beta — End-to-end workflow gap audit (2026-11-02)

Source review: `src/components/QuotesMobileBeta.tsx`, `NewSalesDocumentPicker.tsx`, `QuoteBetaDetails.tsx`, `QuoteBetaMeasureGrid.tsx`, `QuoteBetaDesktopCommerce.tsx`, `QuoteBetaPricingOverview.tsx`, `QuoteBetaReview.tsx`, shared Quote store and pricing/takeoff/delivery services. Also reviewed `docs/quotes/02-classic-beta-parity.md`, `18b-classic-beta-feature-parity.md`, `03-customer-acceptance-gate.md` and existing Playwright workflow tests.

**Evidence boundary:** Source capabilities were inspected. Nothing here is a claim that production Cloudflare, real-auth Supabase, TypeScript/Vitest or mobile browser acceptance has passed. Classic stays selectable until signed-off parity.

## Summary

Beta has most foundational primitives: named Quick Quote and pricing-schedule creation, customer/Deal linking, Area & General takeoffs, Catalog/Rate Book/Sink choices, customer itemization/options, selling methods and private costs, Preview/Review, controlled issuing, links/manual delivery, signatures, revisions and archive/restore. The most significant next work is **safe legacy compatibility, speed and visibility across Areas, and real journey acceptance**.

## P0 — Protect legacy pricing before Classic cutover

**Finding:** `QuotesMobileBeta.tsx` includes an editable-quote mount/update effect that promotes old managed sink lines to `includeInTotal:true` and unpriced sink selections to `includeInPricing:true` without a conversion confirmation. `quoteTakeoffsLite.ts` deliberately preserves spec-only sinks. This may silently change an existing draft's amount simply by opening Beta.

**Tracking:** [Issue #65](https://github.com/finnisqu/SalesShop/issues/65). First build a legacy Classic fixture and a user-approved migration preview. Merely switching editors must not alter totals. Do not rewrite signed or archived quote records.

**Further gate:** Refresh/cloud sync after editing and before issuing, revision-signature isolation, role/ownership checks, plus read-only archived route behavior. Run against isolated test accounts before declaring production readiness.

## P1 — Make the fastest normal Quick Quote path genuinely fast

1. **Details start:** after naming a quote, choose **Start Area** or **Simple/General-only**. Customer/Deal links remain optional. Do not create empty Areas automatically on render.
2. **Area presets:** Kitchen, Vanity, Island, Laundry, Unit Type with editable names, measurements, default splash/edge profiles, optional sink choices and rate context. Only insert on explicit click. Preserve vendor snapshots and no phantom $0 values. Allow saving a clean reusable Area preset separate from copying a customer quote.
3. **Quick Quote from previous:** existing Actions → independent copy is functional; surface a discoverable *use previous quote as starting point* path in the new-quote picker. Ensure it is an independent **draft** with no shared revision IDs, signatures, active public links, or copied delivery proof.
4. **Measured entry speed:** efficient tab order, keyboard navigation, enter-next-field, in-place unit display and paired length × width, count, splash, sink quantity; touch-friendly reordering and autocomplete without layout jumps. Preserve current live SF binding and fractional-dimension behavior.
5. **Smart defaults:** use currently assigned company rate/sink/material catalog for explicit new selections, not for retroactive repricing. Show origin/effective date and explain snapshot vs live source. Never conflate supplier buying price with customer rate.

## P1 — Turn Materials & Pricing into an operational dashboard

1. Quote-wide pricing already shows totals, SF, material, sinks, blockers and General. **Added in commit `03b3cb2`:** measured Area cards show private cost coverage and a direct Calculator link. No issue gate added.
2. Next add compact **missing sell price**, **missing buying cost**, **needs material**, and **ready for review** facets, always reflecting the canonical quote audit and existing `projectAreaCost`. Treat missing internal cost as estimating information, not a new block on customer issuing.
3. Provide **Next unresolved Area** navigation and a breadcrumb/return target from measure, material, price, calculator and review fix-ups; avoid making salespeople reopen the same Area repeatedly.
4. Separate the three methods clearly: customer SF rate, slab multiplier **selling basis**, and manually quoted price. Preserve private known-cost spread versus fully-loaded estimate and explicit-zero semantics.
5. Cross-Area price summary should reconcile once to the customer-visible amount. A quote-only, private estimator summary should never leak into printed customer preview.

## P1 — Final handoff that cannot mislead the salesperson

1. Retain the canonical Preview → Approve exact draft → Issue frozen revision → Share/create link → Manually confirm delivered sequence.
2. Review should give concise, editable, deep-linked findings and support a direct *back to where I was* action. Only require acknowledgments for actual review findings.
3. Statuses must distinguish saved locally vs cloud-confirmed, issued vs delivered, link copied vs actually shared, viewed vs signed, and active vs archived.
4. Verify historical PDFs/customer views/signed copies use the exact frozen revision, including hidden amounts and selection appendix. Revisions require explicit user action.
5. No automatic email or inferred customer delivery based on copying a link.

## P1 — Responsive/real-world acceptance

- Perform phone portrait (375–390 px), tablet/landscape (~768 px), desktop, light/dark, long names, high Area counts and large General lists; check fixed footer, popovers, scrolling and keyboard Escape.
- Test offline/reconnect and immediate refresh of an unsynced draft, as well as several device edits and cloud convergence; distinguish draft recovery from authoritative frozen history.
- Use separately authorized salesperson/viewer accounts in a dedicated test organization for share/signature/RLS scenarios. Never use real customer signing or revocation as a test.
- Verify the latest Cloudflare loaded bundle SHA, TypeScript/Vite build, Vitest and Playwright at the exact SHA. GitHub Actions remain manual-only under current hosting constraints.

## P2 — Specialized workflows

- Complete builder/community schedules and spreadsheet import/export stress tests (variants, snapshots, level pricing, plan substitutions, published rows); do not conflate a schedule with a standard customer quote.
- Multi-Family remains explicitly a placeholder in `salesDocumentTemplates.ts`; scope a proper unit-type schedule, material purchase/calculator and cut-to-size workflow before exposing it as a working template.
- Consider customer-ready PDF/email handoff and related task/deal context only if they retain the explicit revision delivery model and privacy principles.

## Acceptance journeys (the actual Beta retirement gate)

| Journey | Start → completion | Contract |
| --- | --- | --- |
| Simple fee | Name → optional customer → General charge → Review → Preview/approve/issue | No forced Area/material; price exactly matches customer copy |
| Kitchen or vanity | Name → Area → pieces/splash/sink → catalog material/rate → private estimate → Review | SF/live link, sink count, totals and cost coverage are stable on edit/undo |
| Repeat builder unit | Previous quote/preset → independent job draft → adjust counts and prices | No copied signatures/links; prior customer document remains immutable |
| Builder/plan schedule | Choose template → stock-level or previous-rate snapshot → plan/option matrix → publish → issue | Historical prices remain frozen; no silent Rate Book repricing |
| Revision/handoff | Open issued record → explicitly create revision → adjust → Preview/issue → separately share | Old signed evidence remains unmodified; no phantom send/delivery |

## Suggested development batches

- **Batch A (P0):** legacy sink migration safety and Classic/Beta no-mutation fixture tests. No default repricing when opening a draft.
- **Batch B:** Quote starter/Area presets and General-only fast path; safe independent *from previous* copy.
- **Batch C:** Quote-wide Pricing cockpit and next-unresolved navigation; preserve audit/Cost coverage distinctions.
- **Batch D:** Review/Preview contextual return navigation and dense mobile polish; explicit issue/share vocabulary.
- **Batch E:** full Classic/Beta contract suite, Cloudflare build and authenticated acceptance; only then consider product-owner-approved Classic sunset.

Keep improvements as atomic source-reviewed commits on `main` per current project guidance. For pricing, customer presentation, customer-data sharing, legal snapshots or Supabase changes, use a stronger dedicated release/acceptance gate.