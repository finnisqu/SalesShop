# SalesShop UI Foundation v1 — Batch 4: Connections

**Branch:** `architecture/react-foundation`  
**Production `main`:** unchanged  
**Scope:** Internal Connections tab and its reporting/CRM UI; **no business/data logic migrations**.

## Migrated components

- `Connections.tsx` now uses `PageHeader` for its editorial heading with the existing live workspace counts in the actions slot.
- Shared `SectionTabs` added under `src/design-system/components/SectionTabs.tsx`; Connections uses it for Overview, Companies, People, Projects, Quotes and Activity. The same `aria-current="page"` model and `chooseTab` handler (including sessionStorage persistence and query reset) remain.
- `Panel` wraps the reporting scope and preserves the existing disabled personal-reporting option; it **does not create a nested scrollport**.
- `Field` labels the directory search and company-type selector with stable input IDs. Company/person creation and editing, including CRM operations and form logic, remain unchanged.
- Shared `Button` adopted for the two directory creation actions and the reporting-scope controls. Record-opening buttons still use their current interactive card elements.
- `StatusText` now powers empty states in each directory.
- `connections-adapter.css` scopes new semantic colors, header/section spacing, directory cards, inputs, reporting panels, nav states, and dark-mode contrast to `.sales-app.view-dashboard`.
- Existing `Dashboard` KPI/funnel/attention/activity components retain their calculation/rendering code and class names. The scoped adapter gives their cards the same border, radius, padding rhythm and foreground/background pairings as other shared panels.
- The **Connections route owns the only vertical scrollport**; the internal Dashboard expands naturally in flow, and mobile retains the shared hamburger/navigation instead of a route-specific header.
- New unit/source-contract tests in `connections-adapter.test.tsx` protect shared nav, accessible search, key CRM codepaths, route-scoped theme tokens, and mobile scrolling.

## Design and behavior constraints

- Horizontal scrolling must remain available for the six section tabs at phone widths, including at 320 CSS px. The active section must be identifiable without relying only on color.
- Directory cards remain individual buttons; do not wrap them in a shared `Panel` that adds a nested button or changes their click target.
- Search, company filters, adding people/companies, editing contacts, jumping to company/project/quote, and Dashboard reporting values must be unchanged.
- Reporting personal scope **remains disabled** until verified salesperson ownership exists; do not activate it as part of a UI batch.
- The mobile Connections footer remains hidden as it previously overlapped the reporting/dashboard panels; Settings remains accessible from global navigation.
- The new adapter is deliberately loaded **after** the legacy appearance-contrast layer. It always pairs card/text colors for all installed palettes rather than painting all descendant text white in Dark mode.
- No quote document, Notebook, Catalog, Board, auth, cloud database, invitation or role behavior changed.

## QA before broader rollout

1. **Phone:** 320, 375/390 and 430px, portrait: header + 6 horizontally scrolling tabs; scope control; KPI two-column grid; long attention queues; directory searching, filter and form keyboard; no overlay footer.
2. **Desktop/tablet:** 768, 1024 and 1440px; confirm page-count badge, six tabs, column width, search + company-type + add action controls, and dashboard chart/pipeline panels.
3. **Appearance:** Warm, Light, After Hours/Dark, High Contrast plus a colorful theme; especially KPI descriptions, selected tab text, colored stage chips and focus outlines.
4. **Permissions:** Owner, actual Viewer read-only navigation, and Owner preview. Preview must remain inert; real Viewer must keep its hamburger.
5. **Functionality:** Create/edit people and companies, search, open projects and quotes, reporting totals and signatures, switch to Settings.
6. CI must pass all Vitest suites and the TypeScript/Vite production build. Screenshots/device QA remain necessary; automated CSS contract tests do **not** prove pixel-level layout.

## Next

**Batch 5:** Catalog shell, then Materials / Sinks / Rates / Suppliers in separate small conversions. Reuse `PageHeader`, `SectionTabs` and `Field` rather than adding another tab-specific design vocabulary. Preserve imports, pricing data and quote insertion logic.
