# SalesShop UI Foundation — Batch 10B: responsive browser QC

**Scope:** React foundation branch `architecture/react-foundation`. Production `main` is not part of this pass.

## Deliverables

- `playwright.config.ts` defines Chromium checks at 320x700, 390x844, 430x932, 844x390 phone landscape (coarse pointer), 768x1024 tablet, 1280x800 desktop and 1440x900 desktop.
- `e2e/visual-qc.pw.ts` loads a local-only workspace (Supabase disabled), exercises six tabs, records global overflow and scrollport geometry, validates navigation escape routes, inspects Quotes' setup and mobile menu, checks Catalog's independent filter scroll and footer, and captures Warm Paper / After Hours / High Contrast / Coastal screenshots.
- `.github/workflows/visual-qc.yml` runs the browser suite on architecture-branch source changes and uploads an HTML report, screenshots, geometry JSON and failure traces as `salesshop-batch10b-visual-qc`.
- `npm run test:visual` can be run locally after `npm install` and `npx playwright install chromium`.

## Automated evidence vs manual acceptance

This suite runs **real Chromium rendering**, not source-only CSS assertions; nevertheless it is **local demo data**, not a login to World Stone. It is not evidence of live Supabase auth, RLS, company/team membership or production permissions. Chromium phone emulation cannot prove Apple Pencil and real Safari behavior.

The screenshot evidence is a **capture set, not a pixel-perfect approved baseline**. The automated assertions detect viewport-width leaks, missing navigation, inaccessible menu footers, browser runtime errors, mobile typography and missing theme selection. The screenshot artifacts still require review for alignment, visual density and subtle clipping. The workflow must actually complete successfully before this evidence is called green.

### Manual review still necessary

- **iOS Safari 320/375/390/430 and rotated phone:** Catalog search, filters, Done button; Quotes immersive editor/menu/popovers, keyboard-induced viewport changes, one scroll owner and notched safe areas.
- **Android Chrome:** same mobile scenarios, with real touch scrolling and keyboard.
- **Notebook:** Apple Pencil drawing versus finger scrolling with Pencil mode toggled; toolbars, paper layers and touch-action behavior.
- **Actual cloud role tests:** Owner role-preview banner and escape, real Viewer/Estimator/Purchasing/Salesperson limits; invitation acceptance.
- **Public quote document and signing/printing:** branded customer paper remains outside themed internal UI.
- **Desktop and tablet 700/768/1024/1280/1440 at normal and 125% zoom:** aligned titles/panels, readable theme labels, keyboard focus, long scrolling columns.

## Theme token contrast sanity check

Static semantic color-token contrast was computed for normal ink on card surfaces: Warm 11.98:1, Dark 10.06:1, High Contrast 17.55:1, Coastal 11.14:1. These exceed 4.5:1 at the token level. **They do not guarantee every specific legacy control uses the correct colors**, so screenshots and device checks remain required.

## Deployment gate

The original SalesShop Pages workflow continues to run `npm test` and `npm run build` and deploy the architecture branch. The browser QC workflow is an additional parallel gate; neither changes `main`.

Review the full browser workflow run and its artifact before merging the foundation or declaring full visual sign-off. If a run fails, treat its screenshot + geometry JSON as evidence and address exact selectors/components rather than resetting global theme/scroll rules.

## Rendered screenshot findings and fixes

These are **observed in Chromium-rendered output**, not inferred solely from legacy CSS:

1. **Dark Settings save chip:** `Auto-saved` retained a cream background while its text adopted a very light dark-theme muted token. Fixed in `settings-adapter.css` so status text and card surface always come from the same theme.
2. **Company branding preview:** Dark appearance painted a preview of the customer contact block as an unintended gray surface with dark paper text. The Settings preview now deliberately keeps light document paper and dark matching contact typography, without changing the public/customer quote document.
3. **Dark Catalog empty state:** The message inside a mobile reference-card empty state used low-contrast legacy copy on a dark card. `catalog-qc.css` now pairs the reference card background and status foreground with theme tokens.
4. **Mobile Quotes setup testing:** The compact Quotes design intentionally hides the desktop setup-summary buttons. The Browser QC route now opens Document via the actual **Quote tools → Quote setup → Document** path instead of trying to click a nonvisible desktop control.

A first browser run reached the cloud sign-in screen because the Supabase client has a fallback project URL. A **development-only** `VITE_SALES_SHOP_LOCAL_QC=1` flag now explicitly disables that connection for isolated browser tests; it does not override production authentication. The next valid browser run passed **24/28 tests**. Its four failures were all the shared incorrect mobile Quotes test click above, now corrected. The final run includes browser-computed contrast assertions for the three observed dark-theme surfaces. Verify its status in GitHub Actions before claiming the final visual automation matrix is green.
