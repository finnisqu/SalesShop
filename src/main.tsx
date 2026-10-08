import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './components/AuthGate';
import { PublicQuotePage } from './components/PublicQuotePage';
import { appRelativePath } from './lib/appUrl';
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

const isPublicQuote = appRelativePath().startsWith('/q/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPublicQuote ? (
      <PublicQuotePage />
    ) : (
      <AuthGate>
        <App />
      </AuthGate>
    )}
  </StrictMode>,
);
