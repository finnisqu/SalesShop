import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './components/AuthGate';
import { PublicQuotePage } from './components/PublicQuotePage';
import './index.css';
import './auth.css';
import './pricing-schedule-builder.css';

const isPublicQuote = window.location.pathname.startsWith('/q/');

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
