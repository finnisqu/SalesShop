# UI Foundation — Batch 7: Board, Quotes and Notebook

**Branch:** `architecture/react-foundation`  
**Production main:** unchanged  
**Goal:** Extend the shared SalesShop design vocabulary beyond Settings, Connections, and Catalog without removing each workspace's distinctive workflows.

## Work completed

### Board and Accounts
- Both project and account boards use the shared `PageHeader` with the existing copy, mode switch and account CRM cleanup action in their actions slots.
- Board mode switch buttons are shared `Button` elements with `aria-pressed` to identify Projects versus Accounts.
- New-project quick add uses a shared, properly labeled `Field` and a shared submit `Button`; it still sends through the original `quickAdd` form submit function.
- Route-scoped `board-adapter.css` normalizes header size, typography, desktop input sizing, stage column and project/account card edges and theme foreground/background pairings. Its mobile rules preserve the horizontal stage carousel, individual card-stack scrolling, and available global Quick Create rather than adding a duplicate form to the compact header.

### Quotes
- **Internal navigation only:** `quotes-adapter.css` adds theme pairs, radii and focus indicators to the quote list, quote metadata header, status/sidebar, mobile quote toolbar, document navigator and View/Tools menus.
- Quote's initial editor mode uses the shared `PHONE_LAYOUT_QUERY`; mobile `quote-mobile-pass.css` media queries also recognize short, touch-enabled landscape phones. A rotated phone thus keeps immersive Quote edit mode and its own hamburger rather than falling back to the desktop split screen.
- **Customer-facing quote paper and pricing schedule document styles are intentionally untouched**, as are actual price data, editable quote lines, signatures, quote-sharing and issued-quote checks.
- Quote menus retain their existing close/dismiss callbacks and scrollable tools body with a separate footer.

### Notebook
- `notebook-chrome-adapter.css` applies the same palette and UI scale to the notebook sidebar, page-list controls and main toolbar, including focus outlines and mobile/landscape layout.
- **Notebook remains a notebook:** intentionally light page tabs, the sheet itself, paper textures, lettering, ink canvas and object layers are not forced into Dark mode; the surrounding app chrome does respond to the selected theme.
- No notebook data structure, editor, drawing, page/canvas or object interaction logic was changed.

### Tests
- `src/design-system/app-shell-batch7.test.tsx` protects shared component composition, actual project/account actions, Board swipe/scroll ownership, Quotes role/issuance behavior and mobile-landscape query, customer document isolation, Notebook paper/ink isolation, contrast tokens, and CSS import order.
- GitHub Actions regression suite, TypeScript/Vite production build and Pages deployment remain the release gate.

## Device QA priorities
1. **Board Projects (desktop + phone):** switch Projects ↔ Accounts; quick-add on desktop; create via global + on phone; open/edit cards; swipe between pipeline stages, independently scroll a long card stack, rotate landscape.
2. **Accounts:** CRM cleanup button works, selected stage and account cards remain accessible, no second vertical page scroller on mobile.
3. **Quotes:** mobile phone portrait/landscape retains compact toolbar, hamburger, view selection and Tools; issue/send still follows team permission, quote editor scrolls; desktop quote list, undo/redo and split view still work; customer preview/PDF unchanged.
4. **Notebook:** flip and rename pages; change paper style, draw and type; toolbar dropdowns and object menus remain clickable; Dark mode changes navigation, **not paper**; mobile landscape uses one scrollable canvas and no clipping toolbar menus.
5. **Appearance:** Light, Warm, Dark, Contrast, seasonal palettes. Look particularly at Board project titles and amounts, quote list title/status, and Notebook sidebar versus paper.
6. **Permissions:** actual Viewer, specialized Members, and Owner perspective preview retain their read-only routing and banner escape.

## Next
Run real-device screenshots for the three migrated sections in all themes. Address any inconsistencies in a small Batch 7 polish patch; once visually confirmed, continue retiring only demonstrably superseded legacy rules. Do not merge to `main` without approval.
