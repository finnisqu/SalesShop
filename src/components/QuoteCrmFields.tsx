import { useMemo, useState } from 'react';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import type { Quote } from '../types/quote';

interface Suggestion {
  id: string;
  primary: string;
  secondary?: string;
  onChoose: () => void;
}

function recentFirst<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function EntityField({ label, value, suggestions, onChange }: {
  label: string;
  value: string;
  suggestions: Suggestion[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(-1);
  const visible = open ? suggestions.slice(0, 5) : [];
  return (
    <label className="quote-crm-combobox">
      <span>{label}</span>
      <div className="quote-crm-input-wrap">
        <input
          value={value}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => { onChange(event.target.value); setOpen(true); setFocused(-1); }}
          onKeyDown={(event) => {
            if (!visible.length) return;
            if (event.key === 'ArrowDown') { event.preventDefault(); setFocused((current) => Math.min(visible.length - 1, current + 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setFocused((current) => Math.max(0, current - 1)); }
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter' && focused >= 0) { event.preventDefault(); visible[focused]?.onChoose(); setOpen(false); }
          }}
        />
        {visible.length > 0 && (
          <div className="quote-crm-suggestions">
            {visible.map((suggestion, index) => (
              <button type="button" key={suggestion.id} className={focused === index ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => { suggestion.onChoose(); setOpen(false); }}>
                <strong>{suggestion.primary}</strong>{suggestion.secondary && <small>{suggestion.secondary}</small>}
              </button>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}

function matches(value: string, query: string) {
  if (!query.trim()) return true;
  return value.toLowerCase().includes(query.trim().toLowerCase());
}

export function QuoteCrmFields({ quote }: { quote: Quote }) {
  const projects = useCrmStore((state) => state.projects);
  const companies = useCrmStore((state) => state.companies);
  const contacts = useCrmStore((state) => state.contacts);
  const updateQuote = useQuoteStore((state) => state.updateQuote);
  const linkedProject = quote.projectId ? projects.find((project) => project.id === quote.projectId) : undefined;

  const projectSuggestions = useMemo(() => recentFirst(projects)
    .filter((project) => matches(`${project.name} ${project.companyName ?? ''}`, quote.title))
    .map((project): Suggestion => ({
      id: project.id,
      primary: project.name,
      secondary: [project.companyName, project.stage].filter(Boolean).join(' · '),
      onChoose: () => updateQuote(quote.id, {
        projectId: project.id,
        title: project.name,
        companyId: project.companyId,
        companyName: project.companyName ?? quote.companyName,
      }),
    })), [projects, quote.id, quote.title, quote.companyName, updateQuote]);

  const companySuggestions = useMemo(() => recentFirst(companies)
    .filter((company) => matches(company.name, quote.companyName ?? ''))
    .map((company): Suggestion => ({
      id: company.id,
      primary: company.name,
      secondary: company.kind === 'non-customer' ? 'Non-customer relationship' : 'Customer / prospect',
      onChoose: () => updateQuote(quote.id, {
        companyId: company.id,
        companyName: company.name,
        projectId: linkedProject?.companyId === company.id ? quote.projectId : undefined,
      }),
    })), [companies, quote.id, quote.companyName, quote.projectId, linkedProject, updateQuote]);

  const contactSuggestions = useMemo(() => recentFirst(contacts)
    .filter((contact) => {
      const companyMatch = !quote.companyId || !contact.companyId || contact.companyId === quote.companyId;
      return companyMatch && matches(`${contact.name} ${contact.email ?? ''}`, quote.contactName ?? '');
    })
    .map((contact): Suggestion => {
      const company = contact.companyId ? companies.find((candidate) => candidate.id === contact.companyId) : undefined;
      const companyId = company?.id ?? quote.companyId;
      return {
        id: contact.id,
        primary: contact.name,
        secondary: [contact.title, company?.name, contact.email].filter(Boolean).join(' · '),
        onChoose: () => updateQuote(quote.id, {
          contactId: contact.id,
          contactName: contact.name,
          contactEmail: contact.email ?? quote.contactEmail,
          companyId,
          companyName: company?.name ?? quote.companyName,
          projectId: linkedProject && companyId && linkedProject.companyId !== companyId ? undefined : quote.projectId,
        }),
      };
    }), [contacts, companies, quote.id, quote.companyId, quote.companyName, quote.contactName, quote.contactEmail, quote.projectId, linkedProject, updateQuote]);

  return (
    <>
      <EntityField label="Project" value={quote.title} suggestions={projectSuggestions} onChange={(value) => updateQuote(quote.id, { title: value, projectId: undefined })} />
      <EntityField label="Company / customer" value={quote.companyName ?? ''} suggestions={companySuggestions} onChange={(value) => updateQuote(quote.id, { companyName: value, companyId: undefined, projectId: undefined })} />
      <EntityField label="Contact" value={quote.contactName ?? ''} suggestions={contactSuggestions} onChange={(value) => updateQuote(quote.id, { contactName: value, contactId: undefined })} />
      <label><span>Email</span><input type="email" value={quote.contactEmail ?? ''} onChange={(event) => updateQuote(quote.id, { contactEmail: event.target.value })} /></label>
      <label><span>Project address</span><input value={quote.address ?? ''} onChange={(event) => updateQuote(quote.id, { address: event.target.value })} /></label>
    </>
  );
}
