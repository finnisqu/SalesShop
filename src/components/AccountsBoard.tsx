import { useMemo, useState, type FormEvent } from 'react';
import { inferAccountHealth } from '../services/accountHealth';
import { useCrmStore } from '../store/crmStore';
import {
  ACCOUNT_STAGES,
  companyAnnualPotential,
  companyEstimatedAnnualWork,
  type AccountStage,
  type Company,
} from '../types/crm';

type AccountRow = { company: Company; health: ReturnType<typeof inferAccountHealth> };

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

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
    <div className="project-editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="project-editor account-editor" aria-label="Account details">
        <header>
          <div><span className="board-eyebrow">Account</span><h2>{company.name}</h2></div>
          <button type="button" className="editor-close" onClick={onClose}>×</button>
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
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const editingCompany = companies.find((company) => company.id === editingId) ?? null;

  return (
    <main className="board-view accounts-view">
      <section className="board-header-panel accounts-header-panel">
        <div><span className="board-eyebrow">Relationship health</span><h1>Accounts</h1><p>Same CRM data, viewed by customer relationship instead of project lifecycle.</p></div>
        <div className="board-view-toggle" aria-label="Board type">
          <button type="button" onClick={onShowProjects}>Projects</button>
          <button type="button" className="active">Accounts</button>
        </div>
        <div className="accounts-inference-note"><strong>Auto-inferred</strong><span>Each card explains why.</span></div>
      </section>

      <section className="project-board account-board" aria-label="Account relationship board">
        {ACCOUNT_STAGES.map((stage) => {
          const accounts = accountsByStage.get(stage) ?? [];
          return (
            <section className={`board-column account-column account-stage-${stage.toLowerCase().replaceAll(' ', '-')}`} key={stage}>
              <header className="board-column-header">
                <div><h2>{stage}</h2><span>{accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}</span></div>
              </header>
              <div className="board-column-rule" />
              <div className="board-card-stack">
                {accounts.map(({ company, health }) => {
                  const expectedAnnualWork = companyEstimatedAnnualWork(company);
                  return (
                    <article className="project-card account-card" key={company.id} onDoubleClick={() => setEditingId(company.id)} tabIndex={0}
                      onKeyDown={(event) => { if (event.key === 'Enter') setEditingId(company.id); }}>
                      <div className="project-card-company">{health.stage}</div>
                      <h3>{company.name}</h3>
                      <div className="account-card-stats">
                        <span>{health.openProjectCount} open</span>
                        <span>{health.contactCount} contacts</span>
                        {company.annualUnits !== undefined && <span>{company.annualUnits} units/yr</span>}
                      </div>
                      {expectedAnnualWork !== undefined && <div className="account-card-annual-value"><span>Expected annual work</span><strong>{money.format(expectedAnnualWork)}</strong></div>}
                      <p className="account-card-reason">{health.reason}</p>
                      <div className="project-last-touch">{formatDate(health.lastActivityAt)}</div>
                      <button type="button" className="project-card-open" onClick={() => setEditingId(company.id)}>Open</button>
                    </article>
                  );
                })}
                {!accounts.length && <div className="board-empty-card">No accounts here</div>}
              </div>
            </section>
          );
        })}
      </section>
      {editingCompany && <AccountEditor company={editingCompany} onClose={() => setEditingId(null)} />}
    </main>
  );
}
