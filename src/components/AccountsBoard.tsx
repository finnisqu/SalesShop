import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { inferAccountHealth } from '../services/accountHealth';
import { buildCrmIntegrityReport } from '../services/crmIdentity';
import {
  isMobileBoardInteraction,
  rememberMobileBoardStage,
  rememberMobileColumnScroll,
  restoreMobileBoardState,
} from '../lib/mobileBoardState';
import { useCrmStore } from '../store/crmStore';
import { useNavigationStore } from '../store/navigationStore';
import { useQuoteStore } from '../store/quoteStore';
import {
  ACCOUNT_STAGES,
  companyAnnualPotential,
  companyEstimatedAnnualWork,
  type AccountStage,
  type Company,
} from '../types/crm';
import { BoardScrollControls } from './BoardScrollControls';
import { useDismissibleLayer } from '../lib/useDismissibleLayer';
import { MobileBoardStagePicker } from './MobileBoardStagePicker';
import { CrmCleanupPanel } from './CrmCleanupPanel';

type AccountRow = { company: Company; health: ReturnType<typeof inferAccountHealth> };

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const ACCOUNT_BOARD_POSITION_KEY = 'salesshop-mobile-board-accounts-v1';

function formatDate(value?: string) {
  if (!value) return 'No activity yet';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function numericValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function AccountEditor({ company, onClose }: { company: Company; onClose: () => void }) {
  const contacts = useCrmStore((state) => state.contacts);
  const projects = useCrmStore((state) => state.projects);
  const activities = useCrmStore((state) => state.activities);
  const updateCompany = useCrmStore((state) => state.updateCompany);
  const createContact = useCrmStore((state) => state.createContact);
  const dialogRef = useDismissibleLayer<HTMLElement>(true, onClose);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [alias, setAlias] = useState('');

  const companyContacts = contacts.filter((contact) => contact.companyId === company.id);
  const companyProjects = projects.filter((project) => project.companyId === company.id);
  const projectIds = new Set(companyProjects.map((project) => project.id));
  const recentActivities = activities
    .filter((activity) => activity.companyId === company.id || Boolean(activity.projectId && projectIds.has(activity.projectId)))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 8);
  const health = inferAccountHealth(company, contacts, projects, activities);
  const annualPotential = companyAnnualPotential(company);
  const annualWork = companyEstimatedAnnualWork(company);

  const addContact = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() && !email.trim()) return;
    createContact({ companyId: company.id, name, email, source: 'manual' });
    setName('');
    setEmail('');
  };

  return (
    <div className="project-editor-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={dialogRef} role="dialog" aria-modal="true" className="project-editor account-editor" aria-label="Account details">
        <header>
          <div><span className="board-eyebrow">Account</span><h2>{company.name}</h2></div>
          <button type="button" className="editor-close" data-dialog-initial-focus onClick={onClose} aria-label="Close account details">×</button>
        </header>

        <div className="account-health-callout">
          <strong>{health.stage}</strong>
          <p>{health.reason}</p>
        </div>

        <label className="account-kind-control">
          <span>Relationship type</span>
          <select value={company.kind} onChange={(event) => updateCompany(company.id, { kind: event.target.value as Company['kind'] })}>
            <option value="customer">Customer / prospect</option>
            <option value="non-customer">Non-customer relationship</option>
          </select>
        </label>

        <section className="account-editor-section account-alias-section">
          <header><strong>Known aliases</strong><span>{company.aliases?.length ?? 0}</span></header>
          <p className="account-forecast-help">Exact aliases resolve back to this account when a salesperson types an alternate company name on a quote.</p>
          <div className="account-alias-list">
            {(company.aliases ?? []).map((item) => (
              <span className="account-alias-chip" key={item}>{item}<button type="button" aria-label={`Remove alias ${item}`} onClick={() => updateCompany(company.id, { aliases: (company.aliases ?? []).filter((candidate) => candidate !== item) })}>×</button></span>
            ))}
          </div>
          <form className="account-alias-add" onSubmit={(event) => {
            event.preventDefault();
            const clean = alias.trim();
            if (!clean) return;
            updateCompany(company.id, { aliases: [...(company.aliases ?? []), clean] });
            setAlias('');
          }}>
            <input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="Add alternate company name…" />
            <button type="submit" disabled={!alias.trim()}>Add alias</button>
          </form>
        </section>

        {company.kind === 'customer' && (
          <section className="account-editor-section account-volume-section">
            <header><strong>Annual account forecast</strong><span>Relationship-level</span></header>
            <p className="account-forecast-help">Use this for recurring builder volume that is bigger than any one project or community.</p>
            <div className="account-forecast-inputs">
              <label><span>Homes / units per year</span><input type="number" min="0" step="1" value={company.annualUnits ?? ''} onChange={(event) => updateCompany(company.id, { annualUnits: numericValue(event.target.value) })} placeholder="100" /></label>
              <label><span>Typical revenue / unit</span><div className="account-money-input"><span>$</span><input type="number" min="0" step="100" value={company.averageUnitValue ?? ''} onChange={(event) => updateCompany(company.id, { averageUnitValue: numericValue(event.target.value) })} placeholder="3500" /></div></label>
              <label><span>Expected share of work</span><div className="account-percent-input"><input type="number" min="0" max="100" step="5" value={company.expectedSharePct ?? ''} onChange={(event) => updateCompany(company.id, { expectedSharePct: numericValue(event.target.value) })} placeholder="100" /><span>%</span></div></label>
            </div>
            <div className="account-forecast-results">
              <div><span>Annual builder opportunity</span><strong>{annualPotential === undefined ? '—' : money.format(annualPotential)}</strong></div>
              <div><span>Expected annual work</span><strong>{annualWork === undefined ? '—' : money.format(annualWork)}</strong></div>
            </div>
          </section>
        )}

        <section className="account-editor-section">
          <header><strong>Contacts</strong><span>{companyContacts.length}</span></header>
          {companyContacts.map((contact) => (
            <div className="account-contact-row" key={contact.id}>
              <div><strong>{contact.name}</strong>{contact.title && <span>{contact.title}</span>}</div>
              <small>{contact.email || contact.phone || 'No contact details yet'}</small>
            </div>
          ))}
          {!companyContacts.length && <p className="account-empty">No contacts yet. Quotes can create these automatically.</p>}
          <form className="account-contact-add" onSubmit={addContact}>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contact name" />
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
            <button type="submit">Add</button>
          </form>
        </section>

        <section className="account-editor-section">
          <header><strong>Projects</strong><span>{companyProjects.length}</span></header>
          {companyProjects.map((project) => (
            <div className="account-project-row" key={project.id}>
              <strong>{project.name}</strong><span>{project.stage}</span>
            </div>
          ))}
          {!companyProjects.length && <p className="account-empty">No projects yet.</p>}
        </section>

        <section className="account-editor-section">
          <header><strong>Recent activity</strong><span>{recentActivities.length}</span></header>
          {recentActivities.map((activity) => (
            <div className="account-activity-row" key={activity.id}>
              <span>{activity.summary}</span><small>{formatDate(activity.occurredAt)}</small>
            </div>
          ))}
          {!recentActivities.length && <p className="account-empty">No activity yet.</p>}
        </section>
      </aside>
    </div>
  );
}

export function AccountsBoard({ onShowProjects }: { onShowProjects: () => void }) {
  const companies = useCrmStore((state) => state.companies);
  const contacts = useCrmStore((state) => state.contacts);
  const projects = useCrmStore((state) => state.projects);
  const activities = useCrmStore((state) => state.activities);
  const quotes = useQuoteStore((state) => state.quotes);
  const hydrateQuotes = useQuoteStore((state) => state.hydrate);
  const focusedCompanyId = useNavigationStore((state) => state.focusedCompanyId);
  const clearFocusedCompany = useNavigationStore((state) => state.clearFocusedCompany);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const boardRef = useRef<HTMLElement | null>(null);
  const mobileInteraction = isMobileBoardInteraction();

  useEffect(() => {
    hydrateQuotes();
  }, [hydrateQuotes]);

  const integrityReport = useMemo(
    () => buildCrmIntegrityReport(companies, contacts, projects, quotes),
    [companies, contacts, projects, quotes],
  );

  const accountsByStage = useMemo(() => {
    const grouped = new Map<AccountStage, AccountRow[]>();
    ACCOUNT_STAGES.forEach((stage) => grouped.set(stage, []));
    companies.forEach((company) => {
      const health = inferAccountHealth(company, contacts, projects, activities);
      grouped.get(health.stage)?.push({ company, health });
    });
    grouped.forEach((items) => items.sort((a, b) => a.company.name.localeCompare(b.company.name)));
    return grouped;
  }, [companies, contacts, projects, activities]);

  useEffect(() => {
    if (!mobileInteraction) return;
    const frame = window.requestAnimationFrame(() => restoreMobileBoardState(ACCOUNT_BOARD_POSITION_KEY, boardRef.current));
    return () => window.cancelAnimationFrame(frame);
  }, [mobileInteraction, companies.length]);

  useEffect(() => {
    if (!focusedCompanyId) return;
    if (companies.some((company) => company.id === focusedCompanyId)) setEditingId(focusedCompanyId);
    clearFocusedCompany();
  }, [focusedCompanyId, companies, clearFocusedCompany]);

  const editingCompany = companies.find((company) => company.id === editingId) ?? null;

  return (
    <main className="board-view accounts-view">
      <section className="board-header-panel accounts-header-panel">
        <div><span className="board-eyebrow">Relationship health</span><h1>Accounts</h1><p>Same CRM data, viewed by customer relationship instead of project lifecycle.</p></div>
        <div className="board-view-toggle" aria-label="Board type">
          <button type="button" onClick={onShowProjects}>Projects</button>
          <button type="button" className="active">Accounts</button>
        </div>
        <div className="accounts-header-actions">
          <div className="accounts-inference-note"><strong>Auto-inferred</strong><span>Each card explains why.</span></div>
          <button type="button" className={`accounts-cleanup-button ${integrityReport.issueCount ? 'has-issues' : ''}`} onClick={() => setCleanupOpen(true)}>
            CRM cleanup{integrityReport.issueCount ? ` · ${integrityReport.issueCount}` : ''}
          </button>
        </div>
      </section>

      <MobileBoardStagePicker
        boardRef={boardRef}
        stages={ACCOUNT_STAGES}
        counts={ACCOUNT_STAGES.map((stage) => (accountsByStage.get(stage) ?? []).length)}
      />
      <section
        ref={boardRef}
        className="project-board account-board"
        aria-label="Account relationship board"
        onScroll={(event) => rememberMobileBoardStage(ACCOUNT_BOARD_POSITION_KEY, event.currentTarget)}
      >
        {ACCOUNT_STAGES.map((stage, stageIndex) => {
          const accounts = accountsByStage.get(stage) ?? [];
          return (
            <section
              className={`board-column account-column account-stage-${stage.toLowerCase().replaceAll(' ', '-')}`}
              data-board-stage={stage}
              key={stage}
            >
              <header className="board-column-header">
                <div><h2>{stage}</h2><span>{accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}</span></div>
                <div className="board-column-trailing">
                  <span className="board-carousel-position" aria-hidden="true">{stageIndex + 1} / {ACCOUNT_STAGES.length}</span>
                </div>
              </header>
              <div className="board-column-rule" />
              <div
                className="board-card-stack"
                onScroll={(event) => rememberMobileColumnScroll(ACCOUNT_BOARD_POSITION_KEY, stage, event.currentTarget.scrollTop)}
              >
                {accounts.map(({ company, health }) => {
                  const expectedAnnualWork = companyEstimatedAnnualWork(company);
                  return (
                    <article
                      className="project-card account-card"
                      key={company.id}
                      onClick={mobileInteraction ? () => setEditingId(company.id) : undefined}
                      onDoubleClick={mobileInteraction ? undefined : () => setEditingId(company.id)}
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setEditingId(company.id); } }}
                      title={mobileInteraction ? 'Tap to open' : 'Double-click to open'}
                    >
                      <div className="project-card-company">{health.stage}</div>
                      <div className="account-card-title-row">
                        <h3>{company.name}</h3>
                        {expectedAnnualWork !== undefined && <strong className="account-card-title-value">{money.format(expectedAnnualWork)}</strong>}
                      </div>
                      <div className="account-card-stats">
                        <span>{health.openProjectCount} open</span>
                        <span>{health.contactCount} contacts</span>
                        {company.annualUnits !== undefined && <span>{company.annualUnits} units/yr</span>}
                      </div>
                      {expectedAnnualWork !== undefined && <div className="account-card-annual-value"><span>Expected annual work</span><strong>{money.format(expectedAnnualWork)}</strong></div>}
                      <p className="account-card-reason">{health.reason}</p>
                      <div className="project-last-touch">{formatDate(health.lastActivityAt)}</div>
                      <button type="button" className="project-card-open" onClick={(event) => { event.stopPropagation(); setEditingId(company.id); }}>Open</button>
                    </article>
                  );
                })}
                {!accounts.length && <div className="board-empty-card">No accounts in this stage yet</div>}
              </div>
            </section>
          );
        })}
      </section>
      <BoardScrollControls boardRef={boardRef} />
      {editingCompany && <AccountEditor company={editingCompany} onClose={() => setEditingId(null)} />}
      {cleanupOpen && <CrmCleanupPanel onClose={() => setCleanupOpen(false)} />}
    </main>
  );
}
