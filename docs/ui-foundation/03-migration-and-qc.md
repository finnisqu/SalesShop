# SalesShop UI Foundation v1 — Migration Plan & QC

**Branch:** `architecture/react-foundation`. Do **not** change `main` for this effort.
**Batch 1 outcome:** source-backed inventory, design contract, prioritized implementation roadmap. No runtime changes.
**Next batch:** ship inert foundation tokens/components and validate zero visible regressions before adopting them in a workspace.

## Rollout sequence

| Batch | Scope | Primary files to inspect or introduce | Acceptance/rollback gate |
| --- | --- | --- | --- |
| 1 (current) | Inventory + design specification | `01-ui-inventory.md`, `02-design-spec.md`, this file | Docs reference actual code; no CSS/JS runtime changes |
| 2A | Token and primitive foundation (not applied globally) | `src/design-system/tokens.css`, `primitives.css`, `components/Button.tsx`, `Field.tsx` | Component fixture tests; unchanged app screenshots; no legacy selectors overwritten |
| 2B | Shell API with opt-in slot integration | `src/design-system/shell/*`, `App.tsx`, `MobileAppChrome.tsx` | All six routes navigable; Owner banner flows without height hacks; old shell retains behavior until swapped |
| 3 | Pilot: Settings | `CompanySettings.tsx`, `settings-workspace.css` | Settings tabs, autosave, role assignment, company branding, mobile forms unaffected |
| 4 | Connections | `Connections.tsx`, `connections-workspace.css`, `dashboard.css` | No KPI/footer overlap, directory tabs scroll, cards respond, reports unaffected |
| 5 | Catalog shell, then sub-workspaces | `CatalogWorkspace.tsx`, Materials/Sinks/Rates/Suppliers styles, mobile filter/drawer | Every Catalog subsection reachable, search/filter cards legible, imported pricing untouched |
| 6 | Board | `Board.tsx`, `AccountsBoard.tsx`, `board.css`, `accounts.css` | Both Board modes, card edit and drag/swipe, stage scroll, mobile columns unaffected |
| 7 | Viewer and Owner preview parity | `ViewerWorkspace.tsx`, `RolePerspectiveControls.tsx` | All restricted role tabs have hamburger/escape; preview cannot mutate |
| 8 | Notebook boundaries | `App.tsx`, Sidebar/Toolbar/Canvas, notebook styles | Tactile paper intact; Apple Pencil, touch-scroll, selection, object placement unaffected |
| 9 | Quotes | `Quotes.tsx`, quote mobile/popovers, customer preview, rate/material/sink line fields | Immersive mobile scroll, editor sizing, add-to-quote, send/revisions/signatures unchanged |
| 10 | Remove superseded CSS and clean specificity | `main.tsx`/`App.tsx` import graph, obsolete CSS, component styles | No redundant overrides in migrated scope, consistent responsive screenshots, green CI |

Batches are logical gates, not fixed deadlines. Split any large conversion (especially Catalog and Quotes) into smaller reviewed commits.

## Non-negotiable tests per migrated workspace

**Desktop:** 1024, 1280, 1440 CSS px; normal and 125% browser zoom. Sidebar, title hierarchy, action strip, long content, popover placement and keyboard focus.

**Phone:** 320, 375/390, 430 CSS px; portrait, landscape when practical; iOS Safari and Android Chrome where available. No horizontal page overflow or ghost row beneath toolbar. Drawers do not cover their own Done/Apply controls. Input focus does not inadvertently zoom. Long scroll pages stay scrollable. Consider keyboard open, dynamic browser address bar, notched/safe-area offsets.

**Tablet:** 700, 768, 1024px breakpoint boundaries. Check drawers, two-column card grids and split editors don't become unusably compressed.

**Account/permission states:** Owner normal; Owner preview Estimator/Viewer/Purchasing; actual Admin; Member General/Salesperson/Estimator/Purchasing/Project Manager; Viewer; invitation acceptance; empty first login. Tests must distinguish real access checks (RLS) from Owner UI simulation.

**High-risk journey checks:**
- Hamburger accessible from Catalog, Viewer, and Owner preview; close drawer and return to prior view.
- Quotes has navigation back path, independent vertical scrolling, stable totals and add-to-quote destinations.
- Catalog filter and supplier import menus remain usable on iPhone.
- Connections KPIs and attention list never overlap a footer or page actions.
- Notebook pencil/pen doesn't scroll page during drawing; touch scroll works when not drawing.
- Settings forms, Team roles, invite flow, permission matrix and autosave still function.
- Customer-facing quote document and public signing layout unchanged.

**Automated gates before deployment:** TypeScript, ESLint where configured, Vitest unit/component regressions, production Vite build; keep the existing GitHub Pages workflow. Add snapshot/visual browser tests when the harness supports them, ideally 3 widths x all six tabs plus Viewer/Owner states.

## A small acceptance checklist for each implementation batch

- [ ] Identify precisely which legacy classes/components this batch replaces.
- [ ] Document current desktop/mobile behavior from code and screenshots before editing.
- [ ] Convert components to design-system tokens/props without altering business/data logic.
- [ ] Verify shell height, only one intended scrollport, focus, overlay layers and safe areas.
- [ ] Test Owner preview and actual Viewer for every route touched.
- [ ] Compare desktop/tablet/phone screenshots and approve intentional visual differences.
- [ ] Confirm customer-facing documents, auth and external quote links were not affected.
- [ ] Delete replaced CSS rules **only after** style parity, not during the initial conversion.
- [ ] Run CI, identify the exact validated commit, and preserve a usable rollback.
- [ ] Do not merge or alter production `main` until explicitly approved.

## Immediate Batch 2 recommendation

Start with **shared tokens + a standalone component showcase/fixture** (buttons, fields, page headers, panels) that is **not wired to production screens**. Validate it at mobile and desktop widths. Then migrate *Settings first*, because it exercises cards, tabs, form controls, notices and role management with fewer geometry-specific exceptions than Notebook or Quotes.

**Avoid:** a sweeping global stylesheet rewrite, a blanket CSS specificity reset, deleting CSS based on filenames alone, or changing database/data logic as part of a visual migration.

## When this initiative is complete

SalesShop's six workspaces should share:
- recognizably consistent typography/color/spacing/controls;
- uniform reliable navigation and back/escape behavior;
- responsive drawer, modal and overflow conventions;
- one predictable content/shell scrolling contract;
- simple support for Owner preview and read-only accounts;
- documented intentional specializations rather than accidental inconsistencies.

UI Foundation v1 is complete when these goals have been visually QA'd and the old conflicting declarations have been removed **without sacrificing each workspace's distinctive function or personality**.
