# November 2 — Quotes Beta cost-coverage clarity (Batch 4)

## Financial safety
- Existing Area cost projections already require Material, charged Sinks, Shop, Installation, and other priced-work buying costs before showing an estimated margin.
- Explicit zero counts as entered, while blank means unknown.
- The desktop Calculator shows a 5-category coverage count. Missing shop and install costs say "Not entered" rather than displaying $0. Material, fabrication and installation warnings include focus shortcuts to private input fields.
- When fully covered, the result is an **estimated fully-loaded margin**; before that it is a partial estimate/known-cost spread. No private cost edit silently changes customer selling prices, quote revisions or public previews.
- The generic private line-cost ledger is **line-item only** and no longer labels its subtotal as a fully-loaded gross margin.
- Repeated-unit vanity fixture tests protect cost-completeness and unchanged selling lines.
- No Supabase migrations, RLS, document delivery or price formula changes.

## Manual acceptance
1. On desktop, open Calculator for kitchen, vanity and repeated-unit Area. Check missing costs, count (0–5), shortcuts, actual keyboard focus, and blank versus explicit zero labor.
2. Price a fully costed Area; verify margin only appears with 5/5 categories.
3. Verify the generic private cost disclosure uses line-item labels, including a multi-Area quote.
4. Confirm entering shop, installation or material cost does not reprice the customer quote; verify multiplier-mode interactions separately because they intentionally use the slab selling formula.
5. Review dark/light, phone/tablet/desktop, archived read-only quotes, Cloudflare loaded build SHA and sign-in.
6. Confirm notebook layout restoration and page-specific object undo from Batch 3; verify two pages and multi-account local device preferences.

Source review and tests authored; Vite/TypeScript, Vitest, browser, cloud-data and Cloudflare deployment acceptance remain unverified without runtime evidence.
