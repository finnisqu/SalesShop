import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Dashboard } from './Dashboard';
import { Button, Field, PageHeader, Panel, SectionTabs, StatusText } from '../design-system/components';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import { useNavigationStore } from '../store/navigationStore';
import { useAuthStore } from '../store/authStore';
import { inferAccountHealth } from '../services/accountHealth';
import { quotesForCompany, quotesForProject } from '../services/quoteCrmLinks';
import { displayQuoteNumber, quoteTotal } from '../types/quote';
import type { CompanyKind } from '../types/crm';

type ConnectionsTab = 'overview' | 'companies' | 'people' | 'projects' | 'quotes' | 'activity';
type CompanyFilter = 'all' | 'customer' | 'non-customer';

export const CONNECTIONS_TABS: Array<{ id: ConnectionsTab; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Sales dashboard' },
  { id: 'companies', label: 'Companies', description: 'Accounts & partners' },
  { id: 'people', label: 'People', description: 'Contacts' },
  { id: 'projects', label: 'Projects', description: 'Opportunities' },
  { id: 'quotes', label: 'Quotes', description: 'Commercial documents' },
  { id: 'activity', label: 'Activity', description: 'Sales history' },
];
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const TAB_KEY = 'salesshop-connections-tab-v1';

function initialTab(): ConnectionsTab {
  if (typeof window === 'undefined') return 'overview';
  try {
    const stored = window.sessionStorage.getItem(TAB_KEY);
    return CONNECTIONS_TABS.find((item) => item.id === stored)?.id ?? 'overview';
  } catch { return 'overview'; }
}

function timeLabel(value?: string) {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : value;
}

function findText(...items: Array<string | undefined>) {
  return items.filter(Boolean).join(' ').toLowerCase();
}

export function Connections() {
  const [tab, setTab] = useState<ConnectionsTab>(initialTab);
  const [query, setQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all');
  const [companyCreating, setCompanyCreating] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newCompanyKind, setNewCompanyKind] = useState<CompanyKind>('customer');
  const [personCreating, setPersonCreating] = useState(false);
  const [newPerson, setNewPerson] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonCompany, setNewPersonCompany] = useState('');
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [personName, setPersonName] = useState('');
  const [personEmail, setPersonEmail] = useState('');
  const [personPhone, setPersonPhone] = useState('');
  const [personTitle, setPersonTitle] = useState('');
  const [personCompany, setPersonCompany] = useState('');
  const [notice, setNotice] = useState('');

  const crmHydrate = useCrmStore((state) => state.hydrate);
  const quoteHydrate = useQuoteStore((state) => state.hydrate);
  const companies = useCrmStore((state) => state.companies);
  const contacts = useCrmStore((state) => state.contacts);
  const projects = useCrmStore((state) => state.projects);
  const activities = useCrmStore((state) => state.activities);
  const quotes = useQuoteStore((state) => state.quotes);
  const resolveCompany = useCrmStore((state) => state.resolveCompany);
  const createContact = useCrmStore((state) => state.createContact);
  const updateContact = useCrmStore((state) => state.updateContact);
  const openCompany = useNavigationStore((state) => state.openCompany);
  const openProject = useNavigationStore((state) => state.openProject);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const setView = useNavigationStore((state) => state.setView);
  const organizationId = useAuthStore((state) => state.organizationId);
  const cloudMode = useAuthStore((state) => state.mode);

  useEffect(() => { crmHydrate(); quoteHydrate(); }, [crmHydrate, quoteHydrate]);
  const chooseTab = (next: ConnectionsTab) => {
    setTab(next); setQuery(''); setNotice(''); setEditingPersonId(null);
    try { window.sessionStorage.setItem(TAB_KEY, next); } catch { /* best effort */ }
  };

  const companiesById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const needle = query.trim().toLowerCase();
  const companyRows = useMemo(() => companies
    .filter((company) => companyFilter === 'all' || company.kind === companyFilter)
    .filter((company) => findText(company.name, ...(company.aliases ?? [])).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name)), [companies, companyFilter, needle]);
  const peopleRows = useMemo(() => contacts
    .filter((person) => findText(person.name, person.email, person.phone, person.title,
      companiesById.get(person.companyId ?? '')?.name).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name)), [contacts, companiesById, needle]);
  const projectRows = useMemo(() => projects
    .filter((project) => findText(project.name, project.companyName, project.stage, project.nextAction).includes(needle))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [projects, needle]);
  const quoteRows = useMemo(() => quotes
    .filter((quote) => !quote.archivedAt)
    .filter((quote) => findText(quote.title, quote.companyName, quote.contactName, quote.quoteNumber, quote.status).includes(needle))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [quotes, needle]);
  const activityRows = useMemo(() => [...activities]
    .filter((activity) => findText(activity.summary, activity.type,
      companiesById.get(activity.companyId ?? '')?.name,
      projectsById.get(activity.projectId ?? '')?.name).includes(needle))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 150), [activities, companiesById, projectsById, needle]);

  const addCompany = (event: FormEvent) => {
    event.preventDefault();
    const name = newCompany.trim();
    if (!name) return;
    const id = resolveCompany(name, newCompanyKind);
    if (id) {
      setNewCompany(''); setCompanyCreating(false); setNotice('Company ready in your directory.');
      openCompany(id);
    } else setNotice('Several accounts may match this name. Review existing records before creating another.');
  };
  const addPerson = (event: FormEvent) => {
    event.preventDefault();
    if (!newPerson.trim() && !newPersonEmail.trim()) return;
    const id = createContact({
      name: newPerson.trim(), email: newPersonEmail.trim(), companyId: newPersonCompany || undefined, source: 'manual',
    });
    if (id) {
      setNewPerson(''); setNewPersonEmail(''); setNewPersonCompany('');
      setPersonCreating(false); setNotice('Person added to your directory.');
    } else setNotice('Could not add that person. Check the details and try again.');
  };
  const startEditingPerson = (person: (typeof contacts)[number]) => {
    setEditingPersonId(person.id); setPersonName(person.name);
    setPersonEmail(person.email ?? ''); setPersonPhone(person.phone ?? '');
    setPersonTitle(person.title ?? ''); setPersonCompany(person.companyId ?? '');
  };
  const savePerson = (event: FormEvent) => {
    event.preventDefault();
    if (!editingPersonId || (!personName.trim() && !personEmail.trim())) return;
    updateContact(editingPersonId, {
      name: personName.trim(), email: personEmail.trim() || undefined,
      phone: personPhone.trim() || undefined, title: personTitle.trim() || undefined,
      companyId: personCompany || undefined,
    });
    setEditingPersonId(null); setNotice('Contact details saved.');
  };
  const openActivity = (activity: (typeof activities)[number]) => {
    if (activity.quoteId) openQuote(activity.quoteId);
    else if (activity.projectId) openProject(activity.projectId);
    else if (activity.companyId) openCompany(activity.companyId);
  };

  return (
    <main className="connections-workspace">
      <PageHeader className="connections-heading connections-foundation-heading"
        eyebrow="SalesShop · Relationships & information"
        title="Connections"
        description="All the people, companies, projects, and conversations behind the work."
        actions={<div className="connections-workspace-summary" title="Current workspace records">
          <strong>{companies.length} companies</strong><span>{contacts.length} people · {projects.length} projects</span>
        </div>}
      />

      <SectionTabs className="connections-tabs" aria-label="Connections sections"
        items={CONNECTIONS_TABS} selected={tab} onSelect={chooseTab} />

      {tab === 'overview' ? (
        <div className="connections-overview">
          <Panel className="connections-scope-strip connections-foundation-scope"
            heading={<div><strong>Reporting view</strong><small>{cloudMode === 'cloud' && organizationId
              ? 'Current company workspace' : 'Current local workspace'}</small></div>}>
            <div className="connections-scope-buttons" role="group" aria-label="Reporting scope">
              <Button variant="quiet" className="active" aria-pressed="true">Workspace</Button>
              <Button variant="quiet" disabled title="Personal ownership and permission checks are not configured yet">Mine · Soon</Button>
            </div>
          </Panel>
          <p className="connections-scope-note">Personal reporting will become available after each quote, project, and activity has a verified salesperson owner. Team-wide visibility will follow your assigned role.</p>
          <Dashboard />
        </div>
      ) : (
        <>
          <div className="connections-directory-toolbar">
            <Field className="connections-search" id="connections-directory-search" label={`Search ${tab}`}>
              {(control) => <input {...control} type="search" value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder={tab === 'companies' ? 'Search company or alias…' : tab === 'people' ? 'Search names, email, company…' : `Search ${tab}…`} />}
            </Field>
            {tab === 'companies' && <>
              <Field className="connections-filter" id="connections-company-filter" label="Type">
                {(control) => <select {...control} value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value as CompanyFilter)}>
                  <option value="all">All companies</option><option value="customer">Customers & prospects</option><option value="non-customer">Partners & other</option>
                </select>}
              </Field>
              <Button variant="primary" className="connections-add" onClick={() => setCompanyCreating((v) => !v)}>+ Company</Button>
            </>}
            {tab === 'people' && <Button variant="primary" className="connections-add" onClick={() => setPersonCreating((v) => !v)}>+ Person</Button>}
          </div>
          {notice && <p className="connections-notice" role="status">{notice}</p>}
          {tab === 'companies' && (
            <section className="connections-directory" aria-label="Company directory">
              {companyCreating && <form className="connections-add-form" onSubmit={addCompany}>
                <strong>New company or relationship</strong>
                <label><span>Company name</span><input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} autoFocus required placeholder="Builder or supplier name" /></label>
                <label><span>Relationship</span><select value={newCompanyKind} onChange={(e) => setNewCompanyKind(e.target.value as CompanyKind)}>
                  <option value="customer">Customer / prospect</option><option value="non-customer">Partner / non-customer</option>
                </select></label>
                <div><button type="button" onClick={() => setCompanyCreating(false)}>Cancel</button><button type="submit" className="primary">Save & open</button></div>
              </form>}
              <p className="connections-count">{companyRows.length} companies · select to open the full account record</p>
              <div className="connections-card-grid">
                {companyRows.map((company) => {
                  const health = inferAccountHealth(company, contacts, projects, activities);
                  const companyQuotes = quotesForCompany(company, projects, quotes).filter((q) => !q.archivedAt);
                  return <button type="button" key={company.id} className="connections-record" onClick={() => openCompany(company.id)}>
                    <span className="connections-record-eyebrow">{company.kind === 'non-customer' ? 'Partner / other' : health.stage}</span>
                    <strong>{company.name}</strong>
                    <small>{health.contactCount} people · {health.openProjectCount} open projects · {companyQuotes.length} quotes</small>
                    <span className="connections-record-arrow" aria-hidden="true">↗</span>
                  </button>;
                })}
              </div>
              {!companyRows.length && <StatusText state="empty" className="connections-empty">No companies match. Try another search or relationship type.</StatusText>}
            </section>
          )}
          {tab === 'people' && (
            <section className="connections-directory" aria-label="People directory">
              {personCreating && <form className="connections-add-form" onSubmit={addPerson}>
                <strong>Add a person</strong>
                <label><span>Name</span><input value={newPerson} onChange={(e) => setNewPerson(e.target.value)} placeholder="Contact name" /></label>
                <label><span>Email</span><input type="email" value={newPersonEmail} onChange={(e) => setNewPersonEmail(e.target.value)} placeholder="Email address" /></label>
                <label><span>Company</span><select value={newPersonCompany} onChange={(e) => setNewPersonCompany(e.target.value)}>
                  <option value="">No company yet</option>{companies.slice().sort((a,b) => a.name.localeCompare(b.name)).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select></label>
                <div><button type="button" onClick={() => setPersonCreating(false)}>Cancel</button><button className="primary" type="submit" disabled={!newPerson.trim() && !newPersonEmail.trim()}>Add person</button></div>
              </form>}
              <p className="connections-count">{peopleRows.length} people · select a contact to edit their details</p>
              <div className="connections-card-grid">
                {peopleRows.map((person) => <article className="connections-record connections-person-record" key={person.id}>
                  <div><span className="connections-record-eyebrow">{companiesById.get(person.companyId ?? '')?.name ?? 'Unassigned company'}</span>
                    <strong>{person.name || person.email || 'Unnamed contact'}</strong>
                    <small>{[person.title,person.email,person.phone].filter(Boolean).join(' · ') || 'No contact details'}</small></div>
                  <button type="button" onClick={() => startEditingPerson(person)}>Edit</button>
                </article>)}
              </div>
              {!peopleRows.length && <StatusText state="empty" className="connections-empty">No contacts match. Adjust your search or add a person.</StatusText>}
              {editingPersonId && <form className="connections-person-editor" onSubmit={savePerson}>
                <header><strong>Edit contact</strong><button type="button" onClick={() => setEditingPersonId(null)} aria-label="Close contact editor">×</button></header>
                <label><span>Name</span><input value={personName} onChange={(e) => setPersonName(e.target.value)} /></label>
                <label><span>Email</span><input type="email" value={personEmail} onChange={(e) => setPersonEmail(e.target.value)} /></label>
                <label><span>Phone</span><input type="tel" value={personPhone} onChange={(e) => setPersonPhone(e.target.value)} /></label>
                <label><span>Title</span><input value={personTitle} onChange={(e) => setPersonTitle(e.target.value)} /></label>
                <label><span>Company</span><select value={personCompany} onChange={(e) => setPersonCompany(e.target.value)}>
                  <option value="">No company</option>{companies.slice().sort((a,b) => a.name.localeCompare(b.name)).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select></label>
                <div><button type="button" onClick={() => setEditingPersonId(null)}>Cancel</button><button className="primary" type="submit" disabled={!personName.trim() && !personEmail.trim()}>Save contact</button></div>
              </form>}
            </section>
          )}
          {tab === 'projects' && <section className="connections-directory">
            <p className="connections-count">{projectRows.length} projects · project status and due dates live on Board</p>
            <div className="connections-card-grid">
              {projectRows.map((project) => {
                const linked = quotesForProject(project, quotes).filter((q) => !q.archivedAt);
                return <button type="button" key={project.id} className="connections-record" onClick={() => openProject(project.id)}>
                  <span className="connections-record-eyebrow">{project.stage}</span>
                  <strong>{project.name}</strong>
                  <small>{[project.companyName,project.dueDate ? `Due ${timeLabel(project.dueDate)}` : undefined,`${linked.length} linked quotes`].filter(Boolean).join(' · ')}</small>
                  {project.amount !== undefined && <b>{money.format(project.amount)}</b>}
                  <span className="connections-record-arrow" aria-hidden="true">↗</span>
                </button>;
              })}
            </div>
            {!projectRows.length && <StatusText state="empty" className="connections-empty">No projects match your search.</StatusText>}
          </section>}
          {tab === 'quotes' && <section className="connections-directory">
            <p className="connections-count">{quoteRows.length} current documents · open a quote to edit or review</p>
            <div className="connections-card-grid">
              {quoteRows.map((quote) => <button type="button" key={quote.id} className="connections-record" onClick={() => openQuote(quote.id)}>
                <span className="connections-record-eyebrow">{quote.status} · {quote.documentType.replace('-', ' ')}</span>
                <strong>{quote.title || 'Untitled quote'}</strong>
                <small>{[quote.companyName,displayQuoteNumber(quote)].filter(Boolean).join(' · ')}</small>
                <b>{money.format(quoteTotal(quote))}</b>
                <span className="connections-record-arrow" aria-hidden="true">↗</span>
              </button>)}
            </div>
            {!quoteRows.length && <StatusText state="empty" className="connections-empty">No matching quotes.</StatusText>}
          </section>}
          {tab === 'activity' && <section className="connections-directory">
            <p className="connections-count">Latest {activityRows.length} activity records · opened from the linked quote, project, or company</p>
            <div className="connections-activity-list">
              {activityRows.map((activity) => {
                const actionable = Boolean(activity.quoteId || activity.projectId || activity.companyId);
                return <button type="button" key={activity.id} disabled={!actionable} onClick={() => openActivity(activity)}>
                  <span><strong>{activity.summary}</strong><small>{[companiesById.get(activity.companyId ?? '')?.name,projectsById.get(activity.projectId ?? '')?.name].filter(Boolean).join(' · ')}</small></span>
                  <time>{timeLabel(activity.occurredAt)}</time>
                </button>;
              })}
              {!activityRows.length && <StatusText state="empty" className="connections-empty">Activity appears here as your team works on quotes and projects.</StatusText>}
            </div>
          </section>}
        </>
      )}

      <footer className="connections-footer">
        <span>People and sales records are managed here. Team accounts, permissions, and invitations belong in Settings.</span>
        <button type="button" onClick={() => setView('settings')}>Open team settings →</button>
      </footer>
    </main>
  );
}
