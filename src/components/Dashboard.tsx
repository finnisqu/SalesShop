import { useEffect, useMemo } from 'react';
import { buildDashboardMetrics, type DashboardAttentionItem } from '../services/dashboardMetrics';
import { useCrmStore } from '../store/crmStore';
import { useNavigationStore } from '../store/navigationStore';
import { useQuoteStore } from '../store/quoteStore';
import { useSignatureStore } from '../store/signatureStore';
import { displayQuoteNumber } from '../types/quote';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeTime(value?: string) {
  if (!value) return '';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const elapsed = Math.max(0, Date.now() - time);
  const days = Math.floor(elapsed / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (days < 60) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function ageLabel(value?: number) {
  if (value === undefined) return '—';
  if (value === 0) return 'today';
  if (value === 1) return '1 day';
  return `${value} days`;
}

export function Dashboard() {
  const hydrateCrm = useCrmStore((state) => state.hydrate);
  const hydrateQuotes = useQuoteStore((state) => state.hydrate);
  const hydrateSignatures = useSignatureStore((state) => state.hydrate);
  const projects = useCrmStore((state) => state.projects);
  const companies = useCrmStore((state) => state.companies);
  const contacts = useCrmStore((state) => state.contacts);
  const activities = useCrmStore((state) => state.activities);
  const quotes = useQuoteStore((state) => state.quotes);
  const signatures = useSignatureStore((state) => state.signatures);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const openProject = useNavigationStore((state) => state.openProject);
  const openCompany = useNavigationStore((state) => state.openCompany);
  const setView = useNavigationStore((state) => state.setView);

  useEffect(() => {
    hydrateCrm();
    hydrateQuotes();
    hydrateSignatures();
  }, [hydrateCrm, hydrateQuotes, hydrateSignatures]);

  const metrics = useMemo(
    () => buildDashboardMetrics(quotes, signatures, projects, activities, companies, contacts),
    [quotes, signatures, projects, activities, companies, contacts],
  );
  const quotesById = useMemo(() => new Map(quotes.map((quote) => [quote.id, quote])), [quotes]);
  const largestStage = Math.max(1, ...metrics.pipelineByStage.map((stage) => stage.value));

  const openAttention = (item: DashboardAttentionItem) => {
    if (item.quoteId) openQuote(item.quoteId);
    else if (item.projectId) openProject(item.projectId);
    else if (item.companyId) openCompany(item.companyId);
  };

  const openActivity = (activity: (typeof activities)[number]) => {
    if (activity.quoteId) openQuote(activity.quoteId);
    else if (activity.projectId) openProject(activity.projectId);
    else if (activity.companyId) openCompany(activity.companyId);
  };

  return (
    <main className="leadership-dashboard">
      <section className="dashboard-heading">
        <div>
          <span className="dashboard-eyebrow">Sales operations · live intelligence</span>
          <h1>Sales snapshot</h1>
          <p>What needs attention, what is moving, and where the pipeline is getting old.</p>
        </div>
        <div className="dashboard-heading-note">Built from SalesShop records · no manual dashboard upkeep</div>
      </section>

      <section className="dashboard-kpis" aria-label="Sales outcome metrics">
        <article className="dashboard-kpi">
          <span>Quotes Sent</span>
          <strong>{metrics.quotesSent}</strong>
          <small>Unique sales documents that reached a customer</small>
        </article>
        <article className="dashboard-kpi">
          <span>Signatures Received</span>
          <strong>{metrics.signaturesReceived}</strong>
          <small>{metrics.signaturesReceived ? `${money.format(metrics.acceptedValue)} accepted value` : 'Customer commitments'}</small>
        </article>
        <article className="dashboard-kpi">
          <span>Close Rate</span>
          <strong>{Math.round(metrics.closeRate * 100)}%</strong>
          <small>Signed sales quotes ÷ sent sales quotes</small>
        </article>
        <article className="dashboard-kpi">
          <span>Open Pipeline</span>
          <strong>{money.format(metrics.openPipeline)}</strong>
          <small>Discovery through Negotiation</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-panel dashboard-attention">
          <header>
            <div><span className="dashboard-eyebrow">Morning queue</span><h2>Needs attention</h2></div>
            <strong>{metrics.attention.length}</strong>
          </header>
          <div className="dashboard-attention-list">
            {metrics.attention.map((item) => (
              <button type="button" key={item.id} className="dashboard-attention-row" onClick={() => openAttention(item)}>
                <span className={`dashboard-attention-priority priority-${item.priority}`} aria-label={`${item.priority} priority`} />
                <span className="dashboard-attention-copy">
                  <small>{item.kind === 'quote' ? 'Quote' : item.kind === 'account' ? 'Account' : 'Project'}</small>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </span>
                <span className="dashboard-attention-side">
                  {item.amount !== undefined && <strong>{money.format(item.amount)}</strong>}
                  {item.timestamp && <small>{relativeTime(item.timestamp)}</small>}
                </span>
              </button>
            ))}
            {!metrics.attention.length && (
              <div className="dashboard-empty">Nothing currently crosses the attention thresholds. The pipeline is quiet.</div>
            )}
          </div>
        </article>

        <article className="dashboard-panel dashboard-funnel">
          <header>
            <div><span className="dashboard-eyebrow">Quote journey</span><h2>Customer funnel</h2></div>
            <span>{metrics.pendingSignatures.length} awaiting decision</span>
          </header>
          <div className="dashboard-funnel-flow">
            <div><span>Draft</span><strong>{metrics.quoteFunnel.drafts}</strong></div>
            <i aria-hidden="true">→</i>
            <div><span>Sent</span><strong>{metrics.quoteFunnel.sent}</strong></div>
            <i aria-hidden="true">→</i>
            <div><span>Viewed</span><strong>{metrics.quoteFunnel.viewed}</strong></div>
            <i aria-hidden="true">→</i>
            <div><span>Signed</span><strong>{metrics.quoteFunnel.signed}</strong></div>
          </div>
          <div className="dashboard-funnel-stats">
            <div><span>View rate</span><strong>{Math.round(metrics.quoteFunnel.viewRate * 100)}%</strong></div>
            <div><span>Close rate</span><strong>{Math.round(metrics.quoteFunnel.closeRate * 100)}%</strong></div>
            <div><span>Median to view</span><strong>{ageLabel(metrics.quoteFunnel.medianDaysToView)}</strong></div>
            <div><span>Median to sign</span><strong>{ageLabel(metrics.quoteFunnel.medianDaysToSign)}</strong></div>
          </div>
        </article>

        <article className="dashboard-panel dashboard-pipeline">
          <header>
            <div><span className="dashboard-eyebrow">Value + stage age</span><h2>Open pipeline</h2></div>
            <button type="button" className="dashboard-link-button" onClick={() => setView('board')}>Open Board</button>
          </header>
          <div className="dashboard-pipeline-list">
            {metrics.pipelineByStage.map((stage) => (
              <div className="dashboard-stage-row" key={stage.stage}>
                <div className="dashboard-stage-copy">
                  <strong>{stage.stage}</strong>
                  <span>{stage.projectCount} {stage.projectCount === 1 ? 'project' : 'projects'}</span>
                  <small>{stage.projectCount ? `median ${ageLabel(stage.medianAgeDays)} · oldest ${ageLabel(stage.oldestAgeDays)}` : 'No active projects'}</small>
                  <b>{money.format(stage.value)}</b>
                </div>
                <div className="dashboard-stage-track" aria-hidden="true">
                  <span style={{ width: `${stage.value ? Math.max(5, (stage.value / largestStage) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel dashboard-accounts">
          <header>
            <div><span className="dashboard-eyebrow">Relationship opportunity</span><h2>Accounts going quiet</h2></div>
            <button type="button" className="dashboard-link-button" onClick={() => setView('board')}>Accounts Board</button>
          </header>
          <div className="dashboard-list">
            {metrics.accountsNeedingLove.map((account) => (
              <button type="button" key={account.companyId} className="dashboard-list-row" onClick={() => openCompany(account.companyId)}>
                <span className="dashboard-list-main">
                  <small>{account.stage}</small>
                  <strong>{account.name}</strong>
                  <span>{account.reason}</span>
                </span>
                <span className="dashboard-list-side">
                  <strong>{money.format(account.expectedAnnualWork)}/yr</strong>
                  <small>{account.daysSinceActivity === undefined ? 'No activity recorded' : `${account.daysSinceActivity}d since activity`}</small>
                </span>
              </button>
            ))}
            {!metrics.accountsNeedingLove.length && (
              <div className="dashboard-empty">No high-value dormant accounts currently need resurfacing.</div>
            )}
          </div>
        </article>

        <article className="dashboard-panel dashboard-activity">
          <header>
            <div><span className="dashboard-eyebrow">What changed</span><h2>Recent activity</h2></div>
            <span>{metrics.recentActivity.length ? 'Latest 8' : 'No activity yet'}</span>
          </header>
          <div className="dashboard-activity-list">
            {metrics.recentActivity.map((activity) => {
              const clickable = Boolean(activity.quoteId || activity.projectId || activity.companyId);
              return (
                <button
                  type="button"
                  key={activity.id}
                  className="dashboard-activity-row"
                  disabled={!clickable}
                  onClick={() => clickable && openActivity(activity)}
                >
                  <span className={`dashboard-activity-dot activity-${activity.type}`} aria-hidden="true" />
                  <span><strong>{activity.summary}</strong><small>{relativeTime(activity.occurredAt)}</small></span>
                </button>
              );
            })}
            {!metrics.recentActivity.length && <div className="dashboard-empty">Sales activity will collect here automatically.</div>}
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
