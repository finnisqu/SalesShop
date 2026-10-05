import { useEffect, useMemo } from 'react';
import { buildDashboardMetrics } from '../services/dashboardMetrics';
import { useCrmStore } from '../store/crmStore';
import { useNavigationStore } from '../store/navigationStore';
import { useQuoteStore } from '../store/quoteStore';
import { useSignatureStore } from '../store/signatureStore';
import { displayQuoteNumber, quoteTotal } from '../types/quote';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysOpen(value?: string) {
  if (!value) return '';
  const elapsed = Date.now() - new Date(value).getTime();
  const days = Math.max(0, Math.floor(elapsed / 86_400_000));
  return days === 0 ? 'Sent today' : `${days}d waiting`;
}

export function Dashboard() {
  const hydrateCrm = useCrmStore((state) => state.hydrate);
  const hydrateQuotes = useQuoteStore((state) => state.hydrate);
  const hydrateSignatures = useSignatureStore((state) => state.hydrate);
  const projects = useCrmStore((state) => state.projects);
  const quotes = useQuoteStore((state) => state.quotes);
  const signatures = useSignatureStore((state) => state.signatures);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const setView = useNavigationStore((state) => state.setView);

  useEffect(() => {
    hydrateCrm();
    hydrateQuotes();
    hydrateSignatures();
  }, [hydrateCrm, hydrateQuotes, hydrateSignatures]);

  const metrics = useMemo(
    () => buildDashboardMetrics(quotes, signatures, projects),
    [quotes, signatures, projects],
  );
  const quotesById = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote])), [quotes]);
  const largestStage = Math.max(1, ...metrics.pipelineByStage.map((stage) => stage.value));

  return (
    <main className="leadership-dashboard">
      <section className="dashboard-heading">
        <div>
          <span className="dashboard-eyebrow">Leadership · business outcomes</span>
          <h1>Sales snapshot</h1>
          <p>Quotes sent. Commitments received. Pipeline still in play. No activity theater.</p>
        </div>
        <div className="dashboard-heading-note">Live from SalesShop records</div>
      </section>

      <section className="dashboard-kpis" aria-label="Sales outcome metrics">
        <article className="dashboard-kpi">
          <span>Quotes Sent</span>
          <strong>{metrics.quotesSent}</strong>
          <small>Unique quotes that reached a customer</small>
        </article>
        <article className="dashboard-kpi">
          <span>Signatures Received</span>
          <strong>{metrics.signaturesReceived}</strong>
          <small>{metrics.signaturesReceived ? `${money.format(metrics.acceptedValue)} accepted value` : 'Customer commitments'}</small>
        </article>
        <article className="dashboard-kpi">
          <span>Close Rate</span>
          <strong>{Math.round(metrics.closeRate * 100)}%</strong>
          <small>Signed quotes ÷ sent quotes</small>
        </article>
        <article className="dashboard-kpi">
          <span>Open Pipeline</span>
          <strong>{money.format(metrics.openPipeline)}</strong>
          <small>Discovery through Negotiation</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-panel dashboard-pending">
          <header>
            <div><span className="dashboard-eyebrow">Needs a customer decision</span><h2>Pending signatures</h2></div>
            <strong>{metrics.pendingSignatures.length}</strong>
          </header>
          <div className="dashboard-list">
            {metrics.pendingSignatures.map((quote) => (
              <button type="button" key={quote.id} className="dashboard-list-row" onClick={() => openQuote(quote.id)}>
                <span className="dashboard-list-main">
                  <small>{displayQuoteNumber(quote)} · {quote.status}</small>
                  <strong>{quote.title}</strong>
                  <span>{quote.companyName || quote.contactName || 'Unassigned customer'}</span>
                </span>
                <span className="dashboard-list-side">
                  <strong>{money.format(quoteTotal(quote))}</strong>
                  <small>{daysOpen(quote.sentAt)}</small>
                </span>
              </button>
            ))}
            {!metrics.pendingSignatures.length && (
              <div className="dashboard-empty">No sent quotes are currently waiting on signature.</div>
            )}
          </div>
        </article>

        <article className="dashboard-panel dashboard-pipeline">
          <header>
            <div><span className="dashboard-eyebrow">Forecast</span><h2>Open pipeline</h2></div>
            <button type="button" className="dashboard-link-button" onClick={() => setView('board')}>Open Board</button>
          </header>
          <div className="dashboard-pipeline-list">
            {metrics.pipelineByStage.map((stage) => (
              <div className="dashboard-stage-row" key={stage.stage}>
                <div className="dashboard-stage-copy">
                  <strong>{stage.stage}</strong>
                  <span>{stage.projectCount} {stage.projectCount === 1 ? 'project' : 'projects'}</span>
                  <b>{money.format(stage.value)}</b>
                </div>
                <div className="dashboard-stage-track" aria-hidden="true">
                  <span style={{ width: `${stage.value ? Math.max(5, (stage.value / largestStage) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel dashboard-wins">
          <header>
            <div><span className="dashboard-eyebrow">Customer commitments</span><h2>Recent signed work</h2></div>
            <span>{money.format(metrics.acceptedValue)} total</span>
          </header>
          <div className="dashboard-list">
            {metrics.recentSignatures.map((signature) => {
              const quote = quotesById.get(signature.quoteId);
              return (
                <button type="button" key={signature.id} className="dashboard-list-row" onClick={() => openQuote(signature.quoteId)}>
                  <span className="dashboard-list-main">
                    <small>{signature.acceptedSnapshot.quoteNumber}</small>
                    <strong>{signature.acceptedSnapshot.title}</strong>
                    <span>{signature.signerName}{signature.acceptedSnapshot.companyName ? ` · ${signature.acceptedSnapshot.companyName}` : ''}</span>
                  </span>
                  <span className="dashboard-list-side">
                    <strong>{money.format(signature.acceptedSnapshot.acceptedTotal)}</strong>
                    <small>{formatDate(signature.acceptedAt)}</small>
                  </span>
                  {!quote && <span className="dashboard-record-note">Archived quote</span>}
                </button>
              );
            })}
            {!metrics.recentSignatures.length && (
              <div className="dashboard-empty">Signed quotes will appear here as customer commitments arrive.</div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
