# SalesShop UI Foundation v1 — Batch 1 / UI Inventory

**Status:** Baseline specification, no runtime modifications.
**Audit branch:** `architecture/react-foundation`
**Audit starting HEAD:** `913b12d15f187631ba1a0026f021ade86f6c23f8`
**Production:** `main` — do not change during this work.
**Method:** Static source inspection of the current React routes, principal workspace components, CSS import graph, and representative CSS declarations. This is not a browser-based visual QA report. The historical screenshot-reported failures below are confirmed by user reports; new speculative issues are labelled risks rather than observed bugs.

## Findings and risk priorities

### Scope of the CSS inventory

- `src/main.tsx` imports **41** CSS files, while `src/App.tsx` imports **29**; after removing two duplicates, these imports reference **68 distinct CSS files**. Additional CSS may be imported in individual components and is not included in this direct-entry count. Legacy notebook stylesheets at repository root are **not automatically active** simply because they exist.
- A 12-file targeted declaration scan (`index.css`, `mobile.css`, `mobile-app-shell.css`, `mobile-ui-unification.css`, `mobile-qc-batch5.css`, `quote-mobile-pass.css`, `quotes.css`, `catalog-workspace.css`, `connections-workspace.css`, `settings-workspace.css`, `board.css`, `role-perspective.css`) found **70 `!important` declarations**, **24 occurrences** of `100vh` / `100dvh`, and **553 literal hex-color occurrences**. Counts are declaration/text occurrences, not unique colors, and deliberately do not describe the full repository.
- The same 12-file sample uses `6px`, `7px`, `5px`, `2px`, and `8px` among several competing corner radii; frequently declared font sizes include `8px`, `9px`, `10px`, `11px`, and `12px`. These are signs of separate design decisions, not evidence of broken screens by themselves.
- The sample contains mobile breakpoints at `360`, `380`, `400`, `420`, `430`, `580`, `650`, `700`, `780`, `820`, `900`, `1060`, and `1180px`. Canonical responsive ownership is absent.
- `src/index.css` already declares foundational variables (`--chrome`, `--chrome-2`, `--border`, `--ink`, `--muted`, `--paper`, `--notebook`). Preserve these through an alias/deprecation layer rather than abruptly replacing their meanings.

### Evidence-backed technical debt

| ID | Priority | Finding | Evidence | Planned remediation |
| --- | --- | --- | --- | --- |
| UI-01 | P0 | **Viewport / scroll ownership is split among feature files.** Page views independently combine `100vh`, `100dvh`, and `calc(100dvh - 50px)`, even though Owner preview adds a banner in normal document flow. | `index.css`, `mobile-app-shell.css`, `quote-mobile-pass.css`, `catalog-workspace.css`, `settings-workspace.css`, `App.tsx` | One outer `WorkspaceShell` owns viewport and chrome; pages use `flex:1; min-height:0`, with one named scrollport. |
| UI-02 | P0 | **Mobile navigation is context-dependent.** The shared mobile command bar and an immersive Quotes command bar use separate rules, including role/viewer overrides. Losing either can trap users. | `MobileAppChrome.tsx`, `Quotes.tsx`, `mobile-app-shell.css`, `quote-mobile-pass.css` | Shared non-optional navigation slot, never dependent on an editor being mounted; Quotes can supply its own center tools. |
| UI-03 | P1 | **CSS overrides span generations and cross page boundaries.** Global `sales-app.view-*` selectors, `!important`, and imported late overrides make isolated changes hard. | `main.tsx`, `App.tsx`, 12-file sample | Establish a cascade/ownership policy and migrate each tab once, deleting redundant declarations after parity tests. |
| UI-04 | P1 | **Buttons, inputs, headings and cards have different measurements for the same semantic role.** | `quotes.css`, `connections-workspace.css`, `settings-workspace.css`, `board.css`, `role-perspective.css` | Semantic tokens + shared `Button`, `Field`, `Panel`, `PageHeader`, and `EmptyState`. |
| UI-05 | P1 | **Catalog is a multi-workspace module:** Materials, Sinks, Rates, Suppliers, and Other each own substantial styling, with quote insertion and mobile reference cards crossing contexts. | `CatalogWorkspace.tsx`, `catalog-workspace.css`, `materials-workspace.css`, `sinks-workspace.css`, `materials-suppliers.css`, `rates-workspace-unification.css` | Shared catalog header, search/action strip, item and section shells; preserve specialized editor grids. |
| UI-06 | P1 | **Role preview adds variable-height chrome.** Shared mobile page rules still subtract fixed `50px` from viewport; preview may need another row. | `RolePerspectiveControls.tsx`, `role-perspective.css`, `mobile-app-shell.css` | Let the shell's flex/grid layout subtract *actual rendered chrome*; keep Exit Preview outside feature scrollports. |
| UI-07 | P1 | **Notebook is intentionally a different visual genre.** Paper, drawing and binder styles need stronger scope, not blanket form/card overrides. | `App.tsx` Notebook route, `index.css`, `notebook-patch.css`, notebook components | Keep tactile paper surfaces and geometry; share only surrounding navigation, buttons, focus states and spacing primitives. |
| UI-08 | P2 | **Connections and Settings each reimplement common page-header and scroll/layout idioms.** Recent mobile height/footer bugs demonstrate risk. | `Connections.tsx`, `connections-workspace.css`, `CompanySettings.tsx`, `settings-workspace.css` | Pilot shared `PageHeader` and `ScrollPanel`; keep reporting and forms layouts domain-specific. |
| UI-09 | P1 | **Viewer workspaces are separate read-only layouts.** They must keep navigation and styling parity, without resurrecting edit controls. | `ViewerWorkspace.tsx`, `viewer-workspace.css`, `App.tsx` | Reuse view-level primitives; automated tests for mobile Viewer Catalog/Quotes escape paths and role preview. |
| UI-10 | P2 | **Special layers have independent z-index decisions:** nav drawer, quote popovers, customer previews and role banner. | `mobile-app-shell.css`, `quote-mobile-pass.css`, `role-perspective.css` | Define layer tokens; document portal, focus and scroll-lock rules before replacing layer constants. |

## Workspace-by-workspace inventory

| Workspace | Existing character to retain | Shell/header today | Scroll and mobile surface | Migration priority |
| --- | --- | --- | --- | --- |
| Notebook | Tactile notebook, physical pages, paper, binder and drawing | Shared global tab/nav plus Notebook toolbar | `notebook-workspace`, `desk-surface`, individual editor/canvas gesture handling | 5 — isolate special surfaces late |
| Board | Pipeline columns, project cards, Account/Project modes | `board-header-panel`, `board-view-toggle`, shared mobile drawer | `project-board` / account board with horizontal swiping and nested editors | 4 — standardize header/cards, preserve gestures |
| Quotes | Dense estimating editor; customer document preview and actions | Quotes-specific sidebar and mobile `quote-mobile-commandbar` | Immersive mobile quote workspace and custom scroll owner | 6 — high regression risk, preserve as last major tab |
| Catalog | Searchable Materials/Sinks/Rates/Suppliers reference | `catalog-header` desktop; catalog subsections in mobile drawer | Separate list/table and overlay systems per subsection | 3 — shared catalog frame before submodules |
| Connections | Relationship directory, company/customer KPIs and activity | `connections-heading`, `connections-tabs` | `connections-workspace` is the main scrollport | 2 — first representative content conversion |
| Settings | Clear company/team controls with form cards | `company-settings-header`, `settings-tabs` | `company-settings-view` owns vertical scrolling; mobile forms | 1 — pilot components without changing data |
| Viewer mode | Read-only cards, search and detail reveals | `viewer-workspace-header` and mobile shared chrome | `viewer-workspace` scrollport | Cross-cutting after each migration |
| Owner perspective | Safety banner, simulated role and Exit Preview | `role-perspective-banner` above normal chrome | Variable-height banner and per-route preview | Cross-cutting; navigation regression gate |
| Invitation/Auth & Public Quote | Auth branding and customer-facing document | Outside authenticated `App` | Separate app roots | Out of scope for general shell; share tokens opportunistically |

## Distinctions: verified vs. yet to inspect in a browser

**Verified in source:** conflicting height formulas; multiple UI component implementations; 68 direct imported CSS files; 12-file declaration counts; separate mobile chrome; variable role banner; tab-specific layouts.

**Previously observed/reported by the product owner:** header crowding; mobile content/footer overlaps; Viewer mobile navigation soft-lock. Recent fixes exist, but this audit does **not** claim these problems are still happening.

**Not yet verified visually:** computed style collisions and screenshot parity at 360/375/390/430/700/768/1024/1440 CSS px, landscape keyboard interactions, safe-area behavior, desktop zoom, and light/dark palette coverage. A browser/device QC baseline must precede each visual conversion.

## Batch 1 decision

No component or runtime CSS changes. Approve the tokens and contracts in `02-design-spec.md` first. Batch 2 creates a reusable foundation under current pages without forcing them to adopt it immediately. Batch 3 pilots one page and measures regression before wider conversion.
