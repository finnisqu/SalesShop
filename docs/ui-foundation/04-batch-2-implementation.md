# SalesShop UI Foundation v1 — Batch 2 Implementation

**Branch:** `architecture/react-foundation`  
**Production `main`:** unchanged  
**Scope:** Batch 2A shared tokens / reusable primitives; Batch 2B markup-compatible shell interfaces.  
**Approach:** additive and opt-in, deliberately no mass tab restyling.

## What shipped

### 2A: Shared design foundation

- `src/design-system/tokens.css`: namespaced `--ss-*` semantic surfaces, colors, type, spacing, corner radii, shadows, focus, heights and layer scale. Keeps historical `--chrome`, `--ink`, `--paper` and Notebook styling untouched. Overrides **only new token values** for high-contrast settings and a 700px phone breakpoint. Dark theme support remains a future design task.
- `src/design-system/primitives.css`: selectors scoped to `.ss-*` opt-in elements; no global element resets, old tab selectors, or page-height overwrites.
- `src/design-system/components/Button.tsx`: four visual variants, default `type="button"`, busy/disabled controls, loading announcement, icon-only sizing.
- `Field.tsx`: render-prop pattern injecting matching `id`, required state, `aria-describedby`, and `aria-invalid` into actual input/select/textarea. Label/help/error are linked.
- `PageHeader.tsx`: eyebrow/title/description/actions slots; compact and mobile-description options.
- `Panel.tsx`: consistent semantic panel with independent bounded scrolling for the content area and normal-flow header/footer.
- `StatusText.tsx`: consistent status/alert semantics for empty/loading/error/success.

### 2B: Shell interfaces and safe opt-in

- `SalesShopShell.tsx` owns the app root wrapper API. Its **legacy mode** renders the *same root `div.sales-app` with direct children* that existing CSS expects.
- `WorkspaceViewport.tsx` provides a future managed flex/scroll owner. For now legacy mode preserves the same `div.role-perspective-content` and `inert` protection for Owner simulations. No new scroll root has been activated.
- `WorkspaceToolbar.tsx` provides a future three-slot toolbar. Legacy mode preserves the current direct child `header.mobile-app-commandbar` and its four existing controls; managed mode offers explicit start/center/end slots.
- `App.tsx` adopts `SalesShopShell mode="legacy"` and `WorkspaceViewport mode="legacy"`. `MobileAppChrome.tsx` adopts `WorkspaceToolbar mode="legacy"`.
- `main.tsx` imports new token/primitive CSS. Existing page-specific stylesheet imports and the runtime feature hierarchy are unchanged.

**Behavioral safety:** no Supabase, CRM, quote, catalog, Notebook, public document, invitation, role, or pricing logic changed. The new CSS doesn't apply to old components without explicit `ss-*` classes.

## Usage contract

```tsx
import { Button, Field, PageHeader, Panel, StatusText } from './design-system/components';
import { SalesShopShell, WorkspaceViewport, WorkspaceToolbar } from './design-system/shell';

<PageHeader
  eyebrow="Your workspace"
  title="Settings"
  description="Company and account preferences"
  actions={<Button variant="primary" onClick={onSave}>Save</Button>}
/>
<Panel heading="Company identity" scrollBody footer={<Button>Close</Button>}>
  <Field label="Company name" help="Used on customer documents" required>
    {(control) => <input {...control} value={name} onChange={onNameChange} />}
  </Field>
  <StatusText state="loading">Loading settings…</StatusText>
</Panel>
```

The example above is reference API usage, **not a new deployed Settings view**.

**Do not** enable `mode="managed"` for the live app root yet: existing feature CSS contains fixed `100dvh` and route-specific toolbar ownership. A managed shell needs a deliberate tab-by-tab migration, starting in Settings after screenshot baselines are captured.

## Tests and verification

`src/design-system/foundation.test.tsx` verifies button behavior, field accessibility, shared layouts, opt-in CSS, legacy shell DOM identity, role-preview inert behavior, and managed-toolbar slots.

Existing regression tests remain part of GitHub Actions, including mobile Viewer hamburger access and Catalog/Quotes navigation. Check the latest GitHub Pages run for complete verification before announcing production availability. Unit/build checks do not replace screenshot review; no visual screenshots were captured in this batch.

## Next batch: Settings pilot

1. Capture desktop and phone baseline screenshots for Settings (Owner, Admin, Member, Viewer where applicable).
2. Adopt `PageHeader`, `Panel`, `Button`, and `Field` within one Settings subsection first; preserve autosave and team RPC behavior.
3. Opt just the Settings content area into managed scrolling **after** measuring real nav/banners, not by subtracting `50px`.
4. Validate Settings tab switching, invite/manage role UI, changes/save states, long forms and iOS keyboard.
5. Expand to Connections when parity is confirmed. Quotes and Notebook retain specialized layouts until their own migration batches.

This is a prepared shared foundation, not a visual unification of the six workspaces yet.
