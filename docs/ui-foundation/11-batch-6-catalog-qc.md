# UI Foundation — Batch 6: Catalog-wide QC and cleanup

**Branch:** `architecture/react-foundation`  
**Production `main`:** intentionally unchanged  
**Scope:** Consistency, contrast, and scrolling for the existing Catalog shell, Materials, Sinks, Rates, Suppliers and the Other placeholder. No data migrations, pricing formula edits, quote changes or supplier import rewrites.

## Audit findings and corrections

1. **Phone landscape still inherited desktop inner scrolling in places.** All five sections now share a single phone scroll owner (`.catalog-section-host`), including short touch-device landscape. Embedded Rates and Sinks explicitly expand in normal flow rather than creating a second full-height scroll viewport. The Catalog mobile hamburger and existing search-first layout remain.
2. **Supplier desktop height was too brittle.** The workbench previously declared `height:100%` beneath a padded parent and the legacy CSS forced `min-height:620px`; together these could cause overflow/competing scrollbars. The Suppliers Catalog host is now a bounded flex column and the workbench flexes to fill its available height, while the supplier navigator and detail panes retain their own independent scrolling.
3. **Expanded Supplier mobile cards included fixed ivory detail tiles.** Pricing effective dates, next review dates and publication counts now inherit proper card foreground/background pairs across Dark, Warm, Contrast, and alternate themes. Nested supplier rules, merge panels, commitment cards and pricing-source text receive themed surfaces.
4. **Four separate Catalog sections shared a bottom-sheet component but legacy colors differed.** `catalog-qc.css` styles the shared dialog header, close control, single scrollable content body and non-scrolling footer from one contract. Filter's Done/View results remains below the scroll area and reachable by touch. Individual section business actions and button callbacks are unchanged.
5. **Legacy styling interfered with shared components.** Removed the obsolete `.catalog-section-nav button.active::after` secondary underline and two no-longer-rendered `span` rules. The selected tab's highlight is now owned only by shared `SectionTabs`.
6. **An unscoped supplier `button.primary` declaration used `!important`.** Restricted it to `.supplier-workbench` and removed its global importance, stopping it from recoloring unrelated app buttons.
7. **Warm theme accent failed normal-text AA contrast on its assigned foreground.** Adjusted `--ss-theme-accent` slightly darker (`#8d6e30`), preserving the gold hue while taking its paired foreground above 4.5:1. Other ten-palette foreground/card/base/tint pairs were measured and remain above 4.5:1 for both normal and muted text.

## Regression gates

- `src/design-system/catalog-qc.test.ts` checks the palette contrast ratio for every installed theme (normal ink + muted against card/base/tint, and accent text); adapter import order; obsolete global selectors; scrolling ownership; bottom sheet scroll/footer; mobile supplier detail surfaces; and original pricing/supplier operations.
- Existing suite continues to test each prior Catalog conversion, including Materials filter parity, Sinks model/variant handlers, Rates price-policy controls, Suppliers cloud CRUD and preserved quote insertion.
- CI must complete `Supplier importer regression tests`, `Typecheck and build` and `Deploy to GitHub Pages`. A green CI is not a substitute for screenshots on real iOS Safari.

## On-device final QC

| Context | Test |
| --- | --- |
| Phone portrait | Rotate to landscape and back while browsing each Catalog section; check same hamburger and search-first reference UI, and scroll through expanded cards |
| Materials | Search, sort, filter and clear; open 2 variant records, pin/unpin slabs, compare; verify costs in Dark and Warm |
| Sinks | Search, category filters, open a model, check ADA/default variants, switch edit/reference and test form focus |
| Rates | Search categories, filters, sorting, open mobile rate details; verify editable rates and material-level policies |
| Suppliers | Search, Current/Missing filters; expand the detail tile; open full record and scroll contacts, rules and published history; Tools → Add supplier |
| Shared bottom sheets | Filter through every selector; Done should remain visible and not cover fields; close using X/Escape/backdrop, then verify scroll position |
| Desktop | 1024/1440px Catalog tab navigation; independently scroll Supplier navigator and its selected detail without clipping the footer |
| Themes | Light, Warm, Dark, Contrast, alternate palette; pay attention to Supplier date tiles, focus, prices, selected tabs and all form labels |
| Viewer/Owner Preview | Confirm hamburger, browsing and read-only enforcement remain unchanged |

## Cleanup discipline

Only obsolete, confidently superseded selectors were removed. Larger legacy CSS families are intentionally left in place until visual parity on mobile and desktop is confirmed; deleting them speculatively could reintroduce regressions in different sections. This batch deliberately does not remove Notes/Notebook paper styling, customer quote layout, role previews, or global theme behavior outside Catalog.

**Next:** app-wide UI Foundation sweep (Board/Quotes/Notebook) after Catalog passes device review. Keep `main` untouched until authorized.
