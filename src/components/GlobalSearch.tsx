import { useEffect, useMemo, useRef, useState } from 'react';
import { useCrmStore } from '../store/crmStore';
import { useNavigationStore } from '../store/navigationStore';
import { useNotebookStore } from '../store/notebookStore';
import { useQuoteStore } from '../store/quoteStore';

type SearchResult = {
  id: string;
  kind: 'Project' | 'Account' | 'Contact' | 'Quote' | 'Notebook';
  title: string;
  detail?: string;
  searchText: string;
  open: () => void;
};

function plainText(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreResult(result: SearchResult, query: string) {
  const title = result.title.toLowerCase();
  const text = result.searchText.toLowerCase();
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (text.includes(query)) return 3;
  return 99;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const projects = useCrmStore((state) => state.projects);
  const companies = useCrmStore((state) => state.companies);
  const contacts = useCrmStore((state) => state.contacts);
  const entries = useNotebookStore((state) => state.entries);
  const quotes = useQuoteStore((state) => state.quotes);
  const hydrateQuotes = useQuoteStore((state) => state.hydrate);

  const openProject = useNavigationStore((state) => state.openProject);
  const openCompany = useNavigationStore((state) => state.openCompany);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const openNotebookPage = useNavigationStore((state) => state.openNotebookPage);
  const setView = useNavigationStore((state) => state.setView);

  useEffect(() => { hydrateQuotes(); }, [hydrateQuotes]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const allResults = useMemo<SearchResult[]>(() => {
    const companyNames = new Map(companies.map((company) => [company.id, company.name]));
    return [
      ...projects.map((project): SearchResult => ({
        id: `project:${project.id}`,
        kind: 'Project',
        title: project.name,
        detail: [project.companyName, project.stage].filter(Boolean).join(' · '),
        searchText: [project.name, project.companyName, project.stage, project.nextAction].filter(Boolean).join(' '),
        open: () => openProject(project.id),
      })),
      ...companies.map((company): SearchResult => ({
        id: `company:${company.id}`,
        kind: 'Account',
        title: company.name,
        detail: company.kind === 'non-customer' ? 'Non-customer relationship' : 'Customer / prospect',
        searchText: [company.name, company.kind].join(' '),
        open: () => openCompany(company.id),
      })),
      ...contacts.map((contact): SearchResult => ({
        id: `contact:${contact.id}`,
        kind: 'Contact',
        title: contact.name || contact.email || 'Unnamed contact',
        detail: [contact.title, companyNames.get(contact.companyId ?? ''), contact.email].filter(Boolean).join(' · '),
        searchText: [contact.name, contact.title, contact.email, contact.phone, companyNames.get(contact.companyId ?? '')].filter(Boolean).join(' '),
        open: () => contact.companyId ? openCompany(contact.companyId) : setView('board'),
      })),
      ...quotes.map((quote): SearchResult => ({
        id: `quote:${quote.id}`,
        kind: 'Quote',
        title: quote.title || quote.quoteNumber,
        detail: [quote.quoteNumber, quote.companyName, quote.status].filter(Boolean).join(' · '),
        searchText: [quote.title, quote.quoteNumber, quote.companyName, quote.contactName, quote.contactEmail, quote.status].filter(Boolean).join(' '),
        open: () => openQuote(quote.id),
      })),
      ...entries.map((entry): SearchResult => ({
        id: `notebook:${entry.id}`,
        kind: 'Notebook',
        title: entry.title || 'Untitled page',
        detail: plainText(entry.contentHtml).slice(0, 90) || 'Notebook page',
        searchText: [entry.title, plainText(entry.contentHtml)].join(' '),
        open: () => openNotebookPage(entry.id),
      })),
    ];
  }, [projects, companies, contacts, quotes, entries, openProject, openCompany, openQuote, openNotebookPage, setView]);

  const results = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return [];
    return allResults
      .map((result) => ({ result, score: scoreResult(result, clean) }))
      .filter(({ score }) => score < 99)
      .sort((a, b) => a.score - b.score || a.result.title.localeCompare(b.result.title))
      .slice(0, 20)
      .map(({ result }) => result);
  }, [allResults, query]);

  const choose = (result: SearchResult) => {
    result.open();
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        className="global-search-launcher"
        aria-label="Search SalesShop"
        title="Search SalesShop"
        onClick={() => setOpen(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.25" />
          <path d="M15.2 15.2 20 20" />
        </svg>
      </button>

      {open && (
        <div className="global-search-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="global-search-sheet" role="dialog" aria-modal="true" aria-label="Search SalesShop">
            <header className="global-search-header">
              <div className="global-search-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.25" /><path d="M15.2 15.2 20 20" /></svg>
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search SalesShop…"
                  autoComplete="off"
                  enterKeyHint="search"
                  aria-label="Search SalesShop"
                />
              </div>
              <button type="button" className="global-search-close" onClick={() => setOpen(false)} aria-label="Close search">×</button>
            </header>

            <div className="global-search-results">
              {!query.trim() && (
                <div className="global-search-empty">
                  <strong>Find anything</strong>
                  <span>Projects, accounts, contacts, quotes, and notebook pages.</span>
                </div>
              )}
              {query.trim() && !results.length && (
                <div className="global-search-empty">
                  <strong>No matches</strong>
                  <span>Try a customer, project, contact, quote number, or note title.</span>
                </div>
              )}
              {results.map((result) => (
                <button key={result.id} type="button" className="global-search-result" onClick={() => choose(result)}>
                  <span className={`global-search-kind kind-${result.kind.toLowerCase()}`}>{result.kind}</span>
                  <span className="global-search-result-copy">
                    <strong>{result.title}</strong>
                    {result.detail && <small>{result.detail}</small>}
                  </span>
                  <span className="global-search-arrow" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
