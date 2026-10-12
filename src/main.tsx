import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './components/AuthGate';
import { DeveloperPlaygroundGate } from './components/DeveloperPlaygroundGate';
import { isDeveloperPlaygroundRoute } from './lib/developerPlayground';
import { PublicQuotePage } from './components/PublicQuotePage';
import { appRelativePath } from './lib/appUrl';
import './design-system/tokens.css';
import './design-system/primitives.css';
import './index.css';
import './auth.css';
import './pricing-schedule-builder.css';
import './pricing-rate-sheet.css';
import './pricing-rate-book-import.css';
import './pricing-schedule-refinements.css';
import './quote-crm-fields.css';
import './customer-document-brand.css';
import './account-forecast.css';
import './mobile.css';
import './mobile-demo-polish.css';
import './mobile-board-carousel.css';
import './global-search.css';
import './quick-create.css';
import './mobile-ui-unification.css';
import './mobile-quote-qc.css';
import './quote-document-setup.css';
import './mobile-pricing-containment.css';
import './mobile-document-navigation.css';
import './material-reference-variants.css';
import './material-stock-program.css';
import './board-scroll-controls.css';
import './quote-line-reorder.css';
import './quote-material-lines.css';
import './rates-usability.css';
import './rates-workspace-unification.css';
import './materials-workspace.css';
import './sinks-workspace.css';
import './materials-suppliers.css';
import './mobile-app-shell.css';
import './rates-mobile-reference.css';
import './mobile-catalog-reference.css';
import './mobile-workspaces-batch3.css';
import './mobile-qc-batch4.css';
import './mobile-materials-sort.css';
import './settings-workspace.css';
import './mobile-qc-batch5.css';
import './catalog-quote-integration.css';
import './quote-crm-batch7.css';
import './connections-workspace.css';
import './team-access.css';
// Last-stage legacy foreground bridge until all workspaces use design tokens.
import './appearance-contrast.css';
// Scoped UI Foundation Batch 3 Settings adapter (after legacy theme bridges).
import './design-system/settings-adapter.css';
// Batch 4 Connections palette/layout adapter, scoped after legacy theme fixes.
import './design-system/connections-adapter.css';
// UI Foundation Batch 5A Catalog shell; embedded catalog tools remain specialized.
import './design-system/catalog-adapter.css';
// Batch 5B Materials UI; scoped after the Catalog shell and legacy palette fixes.
import './design-system/materials-adapter.css';
// UI Foundation Batch 5C Sinks: route-scoped forms, product cards and mobile sheet.
import './design-system/sinks-adapter.css';
// UI Foundation Batch 5D Rates: shared lookup filters, editor and mobile cards.
import './design-system/rates-adapter.css';
// UI Foundation Batch 5E Suppliers: directory, forms and pricing publication history.
import './design-system/suppliers-adapter.css';
// Batch 6 Catalog-wide visual, scroll, and palette QC after all section adapters.
import './design-system/catalog-qc.css';
// UI Foundation Batch 7: Board, Quotes internal workspace, Notebook chrome.
import './design-system/board-adapter.css';
import './design-system/quotes-adapter.css';
import './design-system/notebook-chrome-adapter.css';
// Batch 8: Viewer / Owner preview parity and compact role escape.
import './design-system/restricted-view-adapter.css';
// Batch 9: Quotes estimating editor form and popover foundation; exclude customer paper.
import './design-system/quote-editor-adapter.css';
// Batch 10C: late opt-in corrections for Board and internal quote fields.
import './design-system/batch-10c.css';
// Batch 10D: consistent global toolbar actions on mobile Quotes.
import './design-system/batch-10d.css';
// Batch 11: owner/admin Team Quotes reference view and reporting groups.
import './design-system/batch-11-quotes.css';
// P2: ownership transfer within Team Settings, never in customer documents.
import './design-system/ownership-transfer.css';
// Takeoffs Lite is the final internal Quotes overlay (never customer paper).
import './quote-takeoffs-lite.css';
// Opt-in mobile-only Quotes Beta. Existing Quotes remains the default.
import './quotes-mobile-beta.css';
// Beta measurement sheet: scroll-away Area header, sticky tabs and splash popovers.
import './quotes-mobile-measure-grid.css';
// Dense Materials/Sinks and non-overlapping Rates chooser (mobile Quotes Beta only).
import './quotes-mobile-materials-pricing.css';
// Area/piece fabrication preferences and optional faucet drilling controls.
import './quotes-mobile-fabrication-options.css';
// Sticky Quotes Beta header/Selections sheet and aligned Accounts mobile Board shell.
import './quotes-mobile-sticky-selections.css';
// Stock / Builder Level 0–8 quote RATE presets use the existing material pricing guide.
import './quotes-mobile-builder-levels.css';
// Draft review and issue readiness audit (mobile Quotes Beta).
import './quotes-mobile-audit.css';
// Mobile Quotes Beta area progression and duplication shortcuts.
import './quotes-mobile-speed.css';

const isPublicQuote = appRelativePath().startsWith('/q/');
const isPlayground = !isPublicQuote && isDeveloperPlaygroundRoute();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPublicQuote ? (
      <PublicQuotePage />
    ) : isPlayground ? (
      <DeveloperPlaygroundGate><App /></DeveloperPlaygroundGate>
    ) : (
      <AuthGate>
        <App />
      </AuthGate>
    )}
  </StrictMode>,
);
