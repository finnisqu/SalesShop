import { useEffect, useMemo, useState } from 'react';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import { useCompanySettingsStore } from '../store/companySettingsStore';
import { quoteTotal, displayQuoteNumber, quoteLineTotal } from '../types/quote';
import { useNavigationStore, type AppView } from '../store/navigationStore';
import { useAuthStore } from '../store/authStore';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

/** Viewer-only browsing surface. No shared-record mutation controls are rendered. */
export function ViewerWorkspace({ section }: { section: AppView }) {
  const [query, setQuery] = useState('');
  const setCatalogSection = useNavigationStore((state) => state.setCatalogSection);
  const department = useAuthStore((state) => state.teamDepartment);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const hydrateQuotes = useQuoteStore((state) => state.hydrate);
  const quotes = useQuoteStore((state) => state.quotes);
  const companies = useCrmStore((state) => state.companies);
  const contacts = useCrmStore((state) => state.contacts);
  const projects = useCrmStore((state) => state.projects);
  const materials = useCompanySettingsStore((state) => state.settings.stockMaterials);

  useEffect(() => { hydrateQuotes(); }, [hydrateQuotes]);
  useEffect(() => { setQuery(''); setSelectedQuoteId(null); setSelectedProjectId(null); }, [section]);

  const filter = query.trim().toLowerCase();
  const filteredQuotes = useMemo(() => quotes.filter((quote) =>
    !filter || [quote.quoteNumber, quote.title, quote.companyName, quote.status].some((value) =>
      String(value ?? '').toLowerCase().includes(filter))
  ), [quotes, filter]);
  const filteredProjects = useMemo(() => projects.filter((project) =>
    !filter || [project.name, project.companyName, project.stage].some((value) =>
      String(value ?? '').toLowerCase().includes(filter))
  ), [projects, filter]);
  const filteredCompanies = useMemo(() => companies.filter((company) =>
    !filter || [company.name, company.kind].some((value) => value.toLowerCase().includes(filter))
  ), [companies, filter]);
  const filteredMaterials = useMemo(() => materials.filter((material) =>
    !filter || [material.name, material.materialType, material.supplier, material.brand].some((value) =>
      String(value ?? '').toLowerCase().includes(filter))
  ), [materials, filter]);

  const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const title = section === 'board' ? 'Project board' : section === 'quotes' ? 'Quotes'
    : section === 'catalog' ? 'Material catalog' : 'Connections';

  return <main className="viewer-workspace">
    <header className="viewer-workspace-header">
      <div><span className="board-eyebrow">Workspace access · Viewer</span><h1>{title}</h1>
        <p>Read-only access to shared SalesShop records. Your personal notebook remains editable.</p></div>
      <span className="viewer-role-pill" aria-label="Read-only access">View only</span>
    </header>
    {section === 'catalog' && department === 'purchasing' && <div className="viewer-purchasing-jump">
      <button type="button" onClick={() => setCatalogSection('suppliers')}>Open editable Suppliers catalog →</button>
      <span>Other catalog sections remain read-only.</span>
    </div>}
    <div className="viewer-search">
      <label htmlFor="viewer-workspace-search">Find in {title.toLowerCase()}</label>
      <input id="viewer-workspace-search" type="search" value={query}
        placeholder="Search shared records…" onChange={(event) => setQuery(event.target.value)} />
    </div>

    {section === 'board' && <div className="viewer-record-grid">
      {filteredProjects.map((project) => <article className="viewer-record" key={project.id}>
        <small>{project.stage}</small><h2>{project.name}</h2><p>{project.companyName || 'Unassigned company'}</p>
        <div className="viewer-facts">
          {project.amount !== undefined && <span>{money.format(project.amount)}</span>}
          {project.dueDate && <span>Due {project.dueDate}</span>}
        </div>
        <button type="button" onClick={() => setSelectedProjectId(project.id === selectedProjectId ? null : project.id)}>
          {selectedProjectId === project.id ? 'Hide details' : 'View details'}
        </button>
        {selectedProject?.id === project.id && <div className="viewer-details">
          {project.nextAction && <p><strong>Next action:</strong> {project.nextAction}</p>}
          {project.lastTouchpoint && <p><strong>Last touch:</strong> {project.lastTouchpoint}</p>}
          <p><strong>Stage:</strong> {project.stage}</p>
        </div>}
      </article>)}
      {!filteredProjects.length && <p className="viewer-empty">No matching projects.</p>}
    </div>}

    {section === 'quotes' && <div className="viewer-record-grid">
      {filteredQuotes.map((quote) => <article className="viewer-record" key={quote.id}>
        <small>{displayQuoteNumber(quote)} · {quote.status}</small><h2>{quote.title || 'Untitled quote'}</h2>
        <p>{quote.companyName || 'No company'}</p>
        <div className="viewer-facts"><strong>{money.format(quoteTotal(quote))}</strong><span>{quote.quoteDate}</span></div>
        <button type="button" onClick={() => setSelectedQuoteId(quote.id === selectedQuoteId ? null : quote.id)}>
          {selectedQuoteId === quote.id ? 'Hide line items' : 'View line items'}
        </button>
        {selectedQuote?.id === quote.id && <div className="viewer-details">
          {quote.lines.map((line) => <div key={line.id} className="viewer-line">
            <span>{line.description}</span><span>{money.format(quoteLineTotal(line))}</span>
          </div>)}
          {!quote.lines.length && <p>No line items yet.</p>}
          {quote.customerNotes && <p><strong>Customer notes:</strong> {quote.customerNotes}</p>}
        </div>}
      </article>)}
      {!filteredQuotes.length && <p className="viewer-empty">No matching quotes.</p>}
    </div>}

    {section === 'catalog' && <div className="viewer-record-grid">
      {filteredMaterials.map((material) => <article className="viewer-record" key={material.id}>
        <small>{material.materialType} · {material.active ? 'Active' : 'Inactive'}</small>
        <h2>{material.name}</h2>
        <p>{[material.brand,material.supplier].filter(Boolean).join(' · ') || 'No supplier listed'}</p>
        <div className="viewer-facts">
          {material.internalCost !== undefined && <span>Reference cost: {money.format(material.internalCost)} / {material.unit}</span>}
          {material.sku && <span>SKU: {material.sku}</span>}
        </div>
        {material.notes && <p>{material.notes}</p>}
      </article>)}
      {!filteredMaterials.length && <p className="viewer-empty">No matching materials.</p>}
      <p className="viewer-helper">This browsing view covers stock materials. Additional catalog categories will be included in the next Viewer UI pass.</p>
    </div>}

    {section === 'dashboard' && <div className="viewer-connections">
      <div className="viewer-metrics"><div><strong>{companies.length}</strong><span>Companies</span></div>
        <div><strong>{contacts.length}</strong><span>Contacts</span></div>
        <div><strong>{projects.length}</strong><span>Projects</span></div>
        <div><strong>{quotes.length}</strong><span>Quotes</span></div></div>
      <div className="viewer-record-grid">
        {filteredCompanies.map((company) => <article className="viewer-record" key={company.id}>
          <small>{company.kind === 'customer' ? 'Customer' : 'Other contact'}</small><h2>{company.name}</h2>
          <p>{contacts.filter((contact) => contact.companyId === company.id).length} contacts · {projects.filter((project) => project.companyId === company.id).length} projects</p>
          {contacts.filter((contact) => contact.companyId === company.id).slice(0, 3).map((contact) =>
            <div className="viewer-line" key={contact.id}><span>{contact.name}</span><span>{contact.title || contact.email || ''}</span></div>)}
        </article>)}
        {!filteredCompanies.length && <p className="viewer-empty">No matching companies.</p>}
      </div>
    </div>}
  </main>;
}
