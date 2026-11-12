import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { inferAccountHealth } from '../services/accountHealth';
import {
  isMobileBoardInteraction,
  rememberMobileBoardStage,
  rememberMobileColumnScroll,
  restoreMobileBoardState,
} from '../lib/mobileBoardState';
import { useCrmStore } from '../store/crmStore';
import { useNavigationStore } from '../store/navigationStore';
import {useBoardShiftWheelScroll} from '../lib/useBoardShiftWheelScroll';
import { useQuoteStore } from '../store/quoteStore';
import { quotesForCompany } from '../services/quoteCrmLinks';
import { displayQuoteNumber, quoteTotal } from '../types/quote';
import {
  ACCOUNT_STAGES,
  companyAnnualPotential,
  companyEstimatedAnnualWork,
  type AccountStage,
  type Company,
} from '../types/crm';
import { useDismissibleLayer } from '../lib/useDismissibleLayer';
import { MobileBoardStagePicker } from './MobileBoardStagePicker';
import { Button } from '../design-system/components';
import {BoardQuickCreate} from './BoardQuickCreate';
import {WorkspaceHeader,WorkspaceMoreMenu} from './WorkspaceHeader';
import {WorkspaceHelp} from './WorkspaceHelp';
import {WorkspaceChromeIcon} from './WorkspaceChromeIcon';
import {RecordPreviewDrawer,type PreviewRecord} from './RecordPreviewDrawer';
import {companyRelationship,companyRelationshipLabel,companyRelationshipPatch,
 visibleCompanyAliases,type EditableCompanyRelationship} from '../services/companyRelationship';
import {isOurOrgCompany} from '../services/ourOrganizationDirectory';

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
  const quotes = useQuoteStore((state) => state.quotes);
  const hydrateQuotes = useQuoteStore((state) => state.hydrate);
  const createQuote = useQuoteStore((state) => state.createQuote);
  const openQuote = useNavigationStore((state) => state.openQuote);
  useEffect(() => { hydrateQuotes(); }, [hydrateQuotes]);
  const linkedQuotes = quotesForCompany(company, projects, quotes).filter((quote) => !quote.archivedAt);
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
      <aside ref={dialogRef} role="dialog" aria-modal="true" className="project-editor account-editor" aria-label="Company details">
        <header>
          <div><span className="board-eyebrow">Company</span><h2>{company.name}</h2></div>
          <button type="button" className="editor-close" data-dialog-initial-focus onClick={onClose} aria-label="Close account details">×</button>
        </header>

        <div className="account-health-callout">
          <strong>{health.stage}</strong>
          <p>{health.reason}</p>
        </div>

        <label className="account-kind-control">
          <span>Relationship type</span>
          <select value={companyRelationship(company)}
            onChange={event=>{
              const choice=event.target.value as EditableCompanyRelationship;
              if(choice==='prospect'||choice==='customer'||choice==='partner')
                updateCompany(company.id,companyRelationshipPatch(company,choice));
            }}>
            <option value="unclassified" disabled>Not classified</option>
            <option value="prospect">Prospect</option>
            <option value="customer">Customer</option>
            <option value="partner">Partner / other</option>
          </select>
        </label>

        <section className="account-editor-section account-alias-section">
          <header><strong>Known aliases</strong><span>{visibleCompanyAliases(company).length}</span></header>
          <p className="account-forecast-help">Exact aliases resolve back to this account when a salesperson types an alternate company name on a quote.</p>
          <div className="account-alias-list">
            {visibleCompanyAliases(company).map((item) => (
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
            <p className="account-forecast-help">Use this for recurring builder volume that is bigger than any one deal or community.</p>
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
          <header><strong>Deals</strong><span>{companyProjects.length}</span></header>
          {companyProjects.map((project) => (
            <div className="account-project-row" key={project.id}>
              <strong>{project.name}</strong><span>{project.stage}</span>
            </div>
          ))}
          {!companyProjects.length && <p className="account-empty">No deals yet.</p>}
        </section>

        <section className="account-editor-section crm-linked-quotes">
          <header><strong>Quotes</strong><span>{linkedQuotes.length} linked</span></header>
          <div className="crm-linked-quote-list">
            {linkedQuotes.map((quote) => <button type="button" key={quote.id} className="crm-linked-quote-row" onClick={() => openQuote(quote.id)}>
              <strong>{quote.title || 'Untitled quote'}</strong>
              <span>{displayQuoteNumber(quote)} · {quote.status}{quoteTotal(quote) ? ` · ${money.format(quoteTotal(quote))}` : ''}</span>
            </button>)}
            {!linkedQuotes.length && <p className="account-empty">No quotes linked to this account yet.</p>}
          </div>
          {company.kind === 'customer' && <button className="crm-linked-create" type="button" onClick={() => {
            const id = createQuote({ title: `Quote · ${company.name}`, companyId: company.id, companyName: company.name });
            openQuote(id);
          }}>+ New quote for account</button>}
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

export function AccountsBoard({onShowProjects,compactCards,onToggleCompact,isStageCollapsed,onToggleStage,
  searchQuery='',onSearchChange,embedded=false,allowedCompanyIds,toolbarControl,onOpenQuoteMetadata}:{
  onShowProjects:()=>void;
  embedded?:boolean;
  searchQuery?:string;
  onSearchChange?:(value:string)=>void;
  allowedCompanyIds?:ReadonlySet<string>;toolbarControl?:ReactNode;
  onOpenQuoteMetadata?:(id:string)=>void;
  compactCards:boolean;
  onToggleCompact:()=>void;
  isStageCollapsed:(stage:AccountStage)=>boolean;
  onToggleStage:(stage:AccountStage)=>void;
}) {
  const companies = useCrmStore((state) => state.companies);
  const resolveCompany = useCrmStore((state) => state.resolveCompany);
  const contacts = useCrmStore((state) => state.contacts);
  const projects = useCrmStore((state) => state.projects);
  const activities = useCrmStore((state) => state.activities);
  const quotes = useQuoteStore((state) => state.quotes);
  const hydrateQuotes = useQuoteStore((state) => state.hydrate);
  const focusedCompanyId = useNavigationStore((state) => state.focusedCompanyId);
  const clearFocusedCompany = useNavigationStore((state) => state.clearFocusedCompany);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview,setPreview]=useState<PreviewRecord|null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const mobileInteraction = isMobileBoardInteraction();
  useBoardShiftWheelScroll(boardRef);

  useEffect(() => {
    hydrateQuotes();
  }, [hydrateQuotes]);

  const accountsByStage = useMemo(() => {
    const grouped = new Map<AccountStage, AccountRow[]>();
    ACCOUNT_STAGES.forEach((stage) => grouped.set(stage, []));
    companies.filter(company=>!isOurOrgCompany(company)).filter(company=>allowedCompanyIds
      ?allowedCompanyIds.has(company.id)
      :[company.name,...visibleCompanyAliases(company)].some(text=>
        text.toLowerCase().includes(searchQuery.trim().toLowerCase()))).forEach((company) => {
      const health = inferAccountHealth(company, contacts, projects, activities);
      grouped.get(health.stage)?.push({ company, health });
    });
    grouped.forEach((items) => items.sort((a, b) => a.company.name.localeCompare(b.company.name)));
    return grouped;
  }, [companies, contacts, projects, activities,searchQuery,allowedCompanyIds]);

  useEffect(() => {
    if (!mobileInteraction) return;
    const frame = window.requestAnimationFrame(() => restoreMobileBoardState(ACCOUNT_BOARD_POSITION_KEY, boardRef.current));
    return () => window.cancelAnimationFrame(frame);
  }, [mobileInteraction, companies.length]);

  useEffect(() => {
    if (!focusedCompanyId) return;
    if (companies.some((company) => company.id === focusedCompanyId)) setEditingId(focusedCompanyId);
    // Do not discard the deep-link while the account dialog is visible.
  }, [focusedCompanyId, companies, clearFocusedCompany]);

  const editingCompany = companies.find((company) => company.id === editingId) ?? null;

  const Surface=embedded?'div':'main';
  return (
    <Surface className={'board-view accounts-view'+(compactCards?' is-compact':'')+
     (embedded?' connections-embedded-board':'')}>
      {!embedded&&<WorkspaceHeader className="board-header-panel accounts-header-panel board-foundation-header"
        title="Companies" help={<WorkspaceHelp page="connections" section="companies"/>} mobileTabs={[{value:'projects',label:'Deals'},{value:'accounts',label:'Companies'}]}
        mobileTabValue="accounts" onMobileTabChange={value=>{if(value==='projects')onShowProjects();}}
        tabs={<div className="board-view-toggle" role="group" aria-label="Board type">
          <Button variant="quiet" aria-pressed={false} onClick={onShowProjects}>Deals</Button>
          <Button variant="quiet" className="active" aria-pressed={true}>Companies</Button>
        </div>}
        more={<WorkspaceMoreMenu label="Board More" items={[{
          label:compactCards?'Standard cards':'Compact cards',onClick:onToggleCompact,active:compactCards,
        }]}/>}
        search={<input type="search" aria-label="Search Board companies"
          placeholder="Search companies…" value={searchQuery}
          onChange={event=>onSearchChange?.(event.target.value)}/>}
        primary={<BoardQuickCreate kind="Company"
          onCreate={name=>{
            const before=new Set(useCrmStore.getState().companies.map(c=>c.id));
            const id=resolveCompany(name,'customer');
            if(id&&!before.has(id))
              useCrmStore.getState().updateCompany(id,companyRelationshipPatch({aliases:[]},'prospect'));
            return id;
          }}/>}
      />}
      {embedded&&<div className="connections-board-tools" role="group" aria-label="Company board controls">
        {toolbarControl??<span className="connections-board-subtitle">Grouped by relationship health</span>}
        <button type="button" className="connections-board-compact" aria-pressed={compactCards}
         onClick={onToggleCompact}>{compactCards?'Standard cards':'Compact cards'}</button>
        <BoardQuickCreate kind="Company" onCreate={name=>{
          const before=new Set(useCrmStore.getState().companies.map(c=>c.id));
          const id=resolveCompany(name,'customer');
          if(id&&!before.has(id))
            useCrmStore.getState().updateCompany(id,companyRelationshipPatch({aliases:[]},'prospect'));
          return id;
        }}/>
       </div>}
      <MobileBoardStagePicker
        boardRef={boardRef}
        stages={ACCOUNT_STAGES}
        counts={ACCOUNT_STAGES.map((stage) => (accountsByStage.get(stage) ?? []).length)}
      />
      <section
        ref={boardRef}
        className="project-board account-board"
        aria-label="Company relationship board"
        onScroll={(event) => rememberMobileBoardStage(ACCOUNT_BOARD_POSITION_KEY, event.currentTarget)}
      >
        {ACCOUNT_STAGES.map((stage, stageIndex) => {
          const accounts = accountsByStage.get(stage) ?? [];
          const collapsed=isStageCollapsed(stage);
          return (
            <section
              className={`board-column account-column ${collapsed?'is-collapsed':''} account-stage-${stage.toLowerCase().replaceAll(' ', '-')}`}
              data-board-stage={stage}
              key={stage}
            >
              <header className="board-column-header">
                <button type="button" className="board-column-toggle"
                  aria-expanded={mobileInteraction || !collapsed}
                  aria-label={(collapsed?'Expand ':'Collapse ')+stage+' column'}
                  title={collapsed?'Expand column':'Collapse column'}
                  disabled={mobileInteraction}
                  onClick={()=>onToggleStage(stage)}>
                  <span className="board-column-title">
                    <span className="board-column-stage-name">{stage}</span>
                    <span className="board-column-count">{accounts.length}<span className="board-column-count-suffix"> {accounts.length === 1 ? 'company' : 'companies'}</span></span>
                  </span>
                  <span className="board-column-trailing">
                    
                    <span className="board-carousel-position" aria-hidden="true">{stageIndex + 1} / {ACCOUNT_STAGES.length}</span>
                    <span className="board-column-hint" aria-hidden="true"><WorkspaceChromeIcon name={collapsed?'chevron-right':'chevron-left'}/></span>
                  </span>
                </button>
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
                      onClick={()=>setPreview({kind:'company',id:company.id})}
                      tabIndex={0}
                      onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPreview({kind:'company',id:company.id}); } }}
                      title={mobileInteraction ? 'Tap card to preview' : 'Click anywhere to preview'}
                    >
                      <div className="account-card-title-row">
                        <h3><button type="button" className="board-entity-name"
                          aria-label={'Preview company '+company.name}
                          onClick={event=>{event.stopPropagation();setPreview({kind:'company',id:company.id});}}>{company.name}</button></h3>
                        {expectedAnnualWork !== undefined && <strong className="account-card-title-value">{money.format(expectedAnnualWork)}</strong>}
                      </div>
                      <div className="account-card-stats">
                        <span>{companyRelationshipLabel(company)}</span>
                        <span>{health.openProjectCount} open</span>
                        <span>{health.contactCount} contacts</span>
                        {company.annualUnits !== undefined && <span>{company.annualUnits} units/yr</span>}
                      </div>
                      {expectedAnnualWork !== undefined && <div className="account-card-annual-value"><span>Expected annual work</span><strong>{money.format(expectedAnnualWork)}</strong></div>}
                      <p className="account-card-reason">{health.reason}</p>
                      <div className="project-last-touch">{formatDate(health.lastActivityAt)}</div>
                      <button type="button" className="project-card-open" onClick={(event) => { event.stopPropagation(); setEditingId(company.id); }}>Edit</button>
                    </article>
                  );
                })}
                {!accounts.length && <div className="board-empty-card">No companies in this stage yet</div>}
              </div>
            </section>
          );
        })}
      </section>

      {preview&&<RecordPreviewDrawer record={preview} onClose={()=>setPreview(null)}
        onSelect={setPreview} onGoToQuotePage={onOpenQuoteMetadata}
        onEditBoard={preview.kind==='company'?record=>setEditingId(record.id):undefined}/>}
      {editingCompany && <AccountEditor company={editingCompany} onClose={() => {
        setEditingId(null);
        if(focusedCompanyId===editingCompany.id)clearFocusedCompany();
      }} />}
    </Surface>
  );
}
