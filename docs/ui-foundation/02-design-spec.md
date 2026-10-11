# SalesShop UI Foundation v1 — Batch 1 / Design Specification

**Status:** Proposed implementation contract; no runtime changes in Batch 1.
**Visual objective:** "Different rooms in the same building" — understated stone/paper editorial design, consistent interaction language, and predictable responsive geometry.

## 1. Ownership and architecture

**Non-negotiable:** The global shell owns viewport height, cross-tab navigation, account/role information, safe-area handling, and the size of available content space. Each workspace owns *only* its internal layout and an explicit scrollport. A tab may ask the shell for a contextual toolbar, but it cannot hide the sole navigation escape path.

Proposed source tree:

```text
src/design-system/
  tokens.css                # --ss-* semantic variables, aliases to old variables
  primitives.css            # scoped, low-specificity shared styles
  components/
    Button.tsx              # primary/secondary/quiet/destructive + icon-only
    Field.tsx               # label/help/error + input/select/textarea adapters
    PageHeader.tsx          # kicker/title/description/actions with compact variant
    Panel.tsx               # consistent header/body/footer, optional scroll body
    StatusText.tsx          # loading/empty/error/success surfaces
    Drawer.tsx              # portal, focus restoration, escape, safe-area rules
  shell/
    SalesShopShell.tsx      # navigation, role banner, viewport allocation
    WorkspaceViewport.tsx   # slot-based body/scrollport ownership
    WorkspaceToolbar.tsx    # standardized toolbar width + overflow behavior
```

This is **a proposal for Batch 2**, not a commitment to introduce every component at once. Prefer extracting proven shared patterns over redesigning every screen.

### Shared shell contract

```text
SalesShopShell (height: 100dvh, flex column, overflow hidden)
  OwnerPerspectiveBanner? (normal flow, natural measured height)
  DesktopHeader | MobileHeader (one per viewport; consistent 50px baseline)
  WorkspaceViewport (flex: 1; min-height: 0; min-width: 0)
    Optional workspace toolbar, e.g. Quotes
    Workspace-local content (owns explicitly named scrolling surface)
```

- **One navigation authority:** hamburger and route switcher are outside editor content. It is never conditional on data, editing permission, view mode, or Catalog subsection.
- **No feature-owned global viewport calculations:** migrate `height: 100dvh`, `calc(100dvh - 50px)`, `height:100%` caps on route roots to natural flex inheritance. The shell alone measures available space.
- **One vertical scroll owner per panel:** a parent flex/grid element has `min-height:0`; its explicit `overflow:auto` child scrolls. Nested drawers/tables can independently scroll inside bounded regions; document which element owns each scroll.
- **No overlay covering content:** footer actions are in layout flow or in a panel-owned sticky footer with padding compensation, not fixed to viewport over arbitrary children.
- **Mobile narrow widths:** no hidden overflow of navigation. Keep the universal header minimal. Secondary actions and the Owner role selector live in drawers/overflow menus. Owner Exit Preview stays in a visible outside-scroll banner.
- **Quotes exception:** may retain its immersive editor and 50px contextual toolbar, but the navigation escape route and available height still come from the shared shell.
- **Notebook exception:** retains binder/paper sizing, independent drawing gestures and distinct background. Do not apply blanket `button` or contenteditable typography rules inside paper.

Initial shell sketch (not shipping code):

```css
.ss-app-frame { height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }
.ss-global-chrome, .ss-preview-banner { flex: none; }
.ss-route-viewport { flex: 1 1 auto; min-height: 0; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.ss-route-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
```

## 2. Semantic tokens

Namespace all new variables with `--ss-` and keep preexisting `--chrome`, `--paper`, etc. working through temporary aliases. **Never replace the global paper typography or color system simply by adopting these tokens.**

Proposed initial token values, grounded in the current palette:

| Token | Initial value | Intent |
| --- | --- | --- |
| `--ss-app-bg` | `#dedbd2` | Neutral canvas behind workspaces |
| `--ss-shell-bg` | `#f4f3ef` | Common app chrome |
| `--ss-surface` | `#f6f3e9` | Standard panel |
| `--ss-surface-raised` | `#fffaf0` | Cards, inputs and hover surfaces |
| `--ss-text` | `#272821` | Primary ink |
| `--ss-text-muted` | `#77766f` | Secondary text (verify contrast by context) |
| `--ss-border` | `#cbc8be` | Dividers and default borders |
| `--ss-accent` | `#c4a640` | Restrained active/selection accent |
| `--ss-paper` | `#fff9df` | Notebook and editorial/paper treatments |
| `--ss-positive` | TBD accessible olive | Success/accepted status, not general decoration |
| `--ss-danger` | TBD accessible rust | Errors and destructive actions |
| `--ss-focus` | TBD contrast-tested accent | Universal keyboard focus ring |

Implement semantic tokens for light mode **first** and explicitly provide values for existing dark/alternate themes if present; do not pretend dark mode is already covered.

Spacing uses a **4px base rhythm**: `--ss-space-1:4px`, `2:8px`, `3:12px`, `4:16px`, `5:20px`, `6:24px`, `8:32px`; rare specialty measurements remain local.

Radius tiers: `--ss-radius-xs:4px`, `sm:6px`, `md:8px`, `lg:12px`; pill `999px` only for actual pill semantics. Shadows: one subtle raised shadow and one overlay shadow.

### Typography

- General UI/body: existing Inter/system sans stack. Editorial section/page titles: Georgia serif.
- Proposed standard **page title** 26px desktop / 22px mobile; **section** 18px / 17px; **panel title** 16px; **body** 14px; **metadata/label** 12px; **microcopy** 11px *minimum for normal interface text*.
- Dense estimating tables may require a reviewed, intentionally narrower scale. Existing 6–9px labels should be inventoried and selectively increased, not changed indiscriminately; small data must stay legible on a real phone.
- Text inputs on touch screens: **16px font size** to avoid iOS Safari auto-zoom. Disabled text must still be readable; link text should not rely on color alone.
- Use weight/size/spacing deliberately. Never create six distinct uppercase eyebrow styles for six tabs.

### Control metrics

| Property | Desktop | Phone |
| --- | --- | --- |
| Global header | 50px | 50px |
| Regular control/button target | 40px minimum | 44px minimum touch target; Quotes dense icon rows require explicit tap-target QC |
| Search / select / text input | 40px minimum | 44px minimum, input font 16px |
| Page horizontal inset | 24px (16px tablet) | 12px, except edge-to-edge specialist editors |
| Panel padding | 16px / 20px | 12px |
| Standard gaps | 8px / 12px / 16px | 8px / 12px |
| Card / panel radius | 8px | 8px |
| Banner | natural height | natural height; no fixed `calc()` subtraction |
| Narrow viewport support | 1024px+ desktop treatment | 320–700px verified; 700–1024px tablet treatment |

Breakpoints proposed: **700px** mobile shell, **1024px** tablet/desktop behavior, **380px** compact phone tolerance; component/container queries preferred where content-driven. Old breakpoints remain until each migrated component is tested and cleaned.

## 3. Shared components and consistent behavior

1. **PageHeader:** optional eyebrow, title, description, badge/status, action slot. Can hide optional description on compact phones, but it must not consume the entire viewport. Workspace-specific header alternatives (Quotes, Notebook) use the same metrics.
2. **WorkspaceToolbar:** start/center/end slots and overflow menu, constrained grid/flex widths, never more direct children than available space. On phones prioritize nav > title > one primary action; all else in overflow/drawer.
3. **Button:** one primary treatment, one subtle/secondary, one quiet/icon, one danger; consistent hover/focus/pressed/disabled, loading and tooltip behavior.
4. **Field:** one label/help/error rhythm and input height, clear required states, readable selected values, appropriate mobile keyboards.
5. **Panel/Card:** shared border, title, content padding and optional *owned* scroll area. Decorative paper variants are explicit opt-ins.
6. **Popover/Drawer/Dialog:** portal or well-defined stacking root, keyboard Escape behavior, focus return, accessible label, outside-click rules, phone-safe sizing, no pinned Done button hiding body options.
7. **State components:** consistent empty, loading, permission-denied, invitation-needed and error text. Preserve contextual explanations.
8. **Search and filters:** shared field+filter layout with mobile drawer; Catalog can use specialized filter chips but not an unrelated control aesthetic.

Proposed z-index scale *after resolving existing overlays*: content 0; sticky subheader 10; global chrome 20; in-workspace popover 100; role banner/menus 200; modal backdrop 1000; modal content 1010; high-priority toast 1100. This is an **implementation intent**, not a value that can safely overwrite current `z-index:1500` drawers without migration.

## 4. Workspace personality and intentional exceptions

| Workspace | Consistent global pieces | Keep intentionally distinct |
| --- | --- | --- |
| Notebook | Global chrome, menu/toolbar affordances, focus, buttons, dialogs | Paper colors and textures, binder depth, ink, handwriting, spatial objects |
| Board | Page header, tabs, card border/radius, menu, dialogs | Kanban columns, stage semantics, draggable cards, horizontal stage swipe |
| Quotes | Navigation, status indicators, action surfaces, popover/drawer behavior | Immersive estimating grid, dense rows, dual editor/customer presentation, quote-specific scope controls |
| Catalog | Page header, item/card header, search, filters, drawer | Data-dense Materials/Sinks/Rates/Suppliers grids and detailed reference cards |
| Connections | Page header, section tabs, cards and controls | Reporting figures, CRM relationship context and activity timeline |
| Settings | Page header, tabs, form labels/inputs, cards, save states | Team/role permissions and company branding forms |

**Customer-facing quote output and public signing pages** are documents, not internal workspaces; keep their own print/document styles. Auth flows are independent of the workspace shell.

## 5. Constraints and acceptance tests

- **Behavioral parity:** no change to quote math, supplier imports, CRM edits, notebook autosave, roles, Supabase RLS, invitations, customer-facing PDF/print, or public quote links during design migration.
- **Access parity:** Viewer and scoped Members can navigate to every permitted route and back. Owner Preview cannot mutate records and always shows Exit Preview.
- **Mobile parity:** hamburger stays visible in Catalog/Quotes for read-only roles; no tab can soft-lock; action bars fit 320px without horizontal overflow or a dropped row.
- **Scroll parity:** page content scrolls independently of global chrome; internal table/drawer scrolling doesn't scroll an unrelated workspace; touch drawing isn't broken.
- **Visual parity:** screen review at 320, 375/390, 430, 700, 768, 1024, 1440 CSS pixels; browser zoom and safe-area checks; screenshot diffs reviewed, not blindly accepted.
- **Accessibility:** visible focus and labels; contrast target WCAG AA for normal text (4.5:1) and large text (3:1); 44px touch targets when practicable. Do not declare conformance until tested.
- **CSS hygiene:** prevent new tab-specific `100dvh` and `!important` overrides after migration, allow documented exceptions. Track rather than immediately ban historical declarations.
- **Migration workflow:** small commits to `architecture/react-foundation`, TypeScript + Vitest + Vite production build per batch, user approval before any production-main cutover.

## Decisions still requiring visual QA in Batch 2

1. Compare actual screenshot baseline to the proposed serif/metadata sizes before applying tokens.
2. Contrast-test palette and finalize muted/error/focus/dark variants.
3. Decide whether the shared `PageHeader` for Quotes is visibly present or only provides a slot for immersive controls.
4. Determine proper Catalog suppliers/import dialog stacking relative to the new shell.

**Approval principle:** Accept the common language first, then adopt one component at a time. Avoid a global CSS reset.
