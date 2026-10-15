# Batch 16F — open-source adoption check-in

Reviewed against active `architecture/react-foundation` and its `package.json` on October 15, 2026. **Purpose:** avoid rebuilding mature primitives while avoiding indiscriminate new dependencies. This batch is a reviewed adoption decision, not a blanket npm install. Customer signatures and pricing deserve separate parity/security tests before replacing their internals.

## Installed — reuse, do not reinvent

| Concern | Existing dependency | Next action |
|---|---|---|
| Plan/PDF reading | `pdfjs-dist` | Extend takeoff rendering and calibrated overlays in a focused takeoffs batch; do not introduce a second PDF renderer |
| Rich Notebook editing | `@tiptap/react`, `@tiptap/starter-kit` | Reuse for full page editor; Quick Notes reuse the current private Notebook store |
| Excel import/export | `exceljs`, plus existing `xlsx` | Evaluate overlap before deleting either import path; keep workbook parity |
| React application | `react`, `react-dom`, `zustand` | Preserve components and shared stores; do not rebuild each page |
| Dev/build/testing | `vite`, `vitest`, `@playwright/test` | Maintain full unit, browser, quote/pricing and visual CI, with extra signing/auth testing |
| Smooth ink geometry | `perfect-freehand`, `roughjs` | Preserve existing drawing behavior until a specific CAD integration feature needs more |

## Targeted additions (approved for *evaluation*, not installed)

**Money:** [Decimal.js](https://www.npmjs.com/package/decimal.js) — MIT, arbitrary-precision arithmetic and built-in TypeScript declarations. This is a strong candidate for quote totals, deposits, percentages, tax and margin. Before adding it, write golden tests from the approved estimator and decide where rounding occurs (intermediate measurement rates vs final invoice currency); **do not silently change existing quoted prices**. Treat gross margin and markup as distinct formulas.

**Boundary validation:** [Zod](https://zod.dev/) — MIT, TypeScript-first parse/validation. Candidate for import records, share/signing HTTP request and response shapes, handoff metadata, and customer-submitted forms. Server authorization and row-level security remain mandatory; Zod does not replace authentication. Add it when a concrete API contract has tests.

**Routing:** Current Batch 16B uses a small pure URL parser/serializer plus the existing Zustand navigation store. This is an intentional low-dependency bridge that preserves Beta editor navigation. [React Router](https://reactrouter.com/start/declarative/installation) can replace it when nested content routes, guards, error boundaries or browser navigation grow complex. **Avoid running both as competing routers.** Its declarative library mode is the likely fit for an existing React/Vite application.

## Add only alongside the feature they unlock

- **Files and takeoffs:** `pdf-lib` for document merging/stamping and `Uppy` when introducing real large-file uploads. A stamped image of a signature is **not** a cryptographically certified PDF signature; preserve the signing evidence, accepted revision, timestamps and audit trail separately.
- **Job-site photo editing:** `Cropper.js` or `Compressor.js` after a real image upload flow exists. Keep private access rules on storage objects.
- **Offline first:** `Dexie.js` when there is an approved local cache, and `Workbox` only after offline update/invalidation tests. Per-user browser task storage in Batch 16D is **device-local**, not multi-device sync.
- **Mobile:** `Capacitor` only after route stability and testing on real phone browsers.
- **Search:** `Fuse.js` or `MiniSearch` once contact size/search relevance warrants indexing; do not add both.
- **Maps / charting:** select one map or chart library if the actual product demands mapping or management reporting.

## Explicit deferrals

- No separate Auth.js or password server: Supabase Auth already exists.
- No Redis/BullMQ, Node/Nodemailer replacement, Socket.IO or Yjs without a specified job/realtime/collaboration requirement; Supabase capabilities should be assessed first.
- No rewrite of signed customer page, custom Canvas/CAD-Lite, Board reorder, or Notebook rich editor merely to use an external package.
- No `three.js`, OpenCV.js, 3D walkthrough, advanced GIS or owner analytics until the core Home / Quotes / CRM experience is verified.
- No unchecked vendor SDK or package added without licence, dependency, bundle, maintenance and security review.

## Release and adoption requirements

1. Identify a particular maintenance problem the dependency reduces.
2. Check license, active maintenance, known advisories, browser support, Vite and React versions and bundle cost.
3. Add exact package and lockfile changes together, never only a package.json entry.
4. Write parity tests against currently accepted estimator and document formats **before** switching implementations.
5. Ship through a small PR on `architecture/react-foundation` with passing unit/visual CI, and use a flag or rollback when appropriate.
6. Keep staged Supabase private quote/CRM security migrations and the billable testing environment separate from front-end dependency changes.

**Decision:** Batch 16F adopts **reuse of already-installed tooling** and postpones new packages until the first concrete tested use. This avoids increasing supply-chain and pricing risk just to accumulate libraries.
