# Batch 353b — Retire the legacy Quote builder from customer navigation

Date: November 16, 2026
Status: Source change committed, build/browser confirmation pending.

## User-visible change

Records → Quotes, mobile and desktop Quote navigation, and direct Quote record links now use the current `QuotesMobileBeta` implementation unconditionally, regardless of old device preference. The legacy `Quotes` component remains in source for code reference but is never mounted by the application shell.

Removed user-facing fallback links:
- Settings → Beta Features no longer offers the Detailed Editor toggle or launch button. Project Timeline (Beta) remains.
- Quote document library Actions no longer offers Detailed Editor.
- Quote row context actions and per-document options no longer offer Detailed Editor.
- Mobile app quote header no longer depends on an old device opt-in flag.

The prior `salesshop:quotes-mobile-beta-v1` localStorage preference is ignored. The state compatibility API now always keeps `enabled:true`, so stale callers cannot reactivate the old editor. A legacy `openDetailedQuoteEditor` programmatic action now routes the selected Quote to the modern editor; it does not switch modes.

Records → Quotes still requests the full document library; direct Quote links preserve the selected record and current quote metadata. The modern Quote workspace retains the current worktable, its pricing schedule support, document actions and associated records.

## Validation

`src/services/quoteEditorRetirement353b.test.ts` is registered in the regular TypeScript/Vitest/Cloudflare build gate. Updated the former Records navigation expectation and compatibility navigation tests to reflect the single-editor policy.

The code change does not mutate Supabase, quotes, signed revisions, catalog data or CRM records. Browser acceptance: with an existing browser previously set to the old editor, open Records → Quotes; choose a document; check overflow menus in Quotes, Settings and mobile. Confirm there is no way back to Detailed Editor. Actual Cloudflare build and user-side validation are still pending.
