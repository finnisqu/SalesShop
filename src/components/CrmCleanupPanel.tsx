import { useMemo, useState } from 'react';
import { buildCrmIntegrityReport, type CrmBrokenLink } from '../services/crmIdentity';
import { mergeCompanyIdentity, mergeContactIdentity, repairCrmBrokenLink } from '../services/crmIdentityService';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import type { Contact, Project } from '../types/crm';

function relationshipCount(companyId: string, contacts: Contact[], projects: Project[]) {
  return {
    contacts: contacts.filter((contact) => contact.companyId === companyId).length,
    projects: projects.filter((project) => project.companyId === companyId).length,
  };
}

function issueKindLabel(issue: CrmBrokenLink) {
  if (issue.kind === 'project-company') return 'Project ↔ account';
  if (issue.kind === 'contact-company') return 'Contact ↔ account';
  if (issue.kind === 'quote-company') return 'Quote ↔ account';
  return 'Quote ↔ contact';
}

export function CrmCleanupPanel({ onClose }: { onClose: () => void }) {
  const companies = useCrmStore((state) => state.companies);
  const contacts = useCrmStore((state) => state.contacts);
  const projects = useCrmStore((state) => state.projects);
  const updateCompany = useCrmStore((state) => state.updateCompany);
  const updateContact = useCrmStore((state) => state.updateContact);
  const quotes = useQuoteStore((state) => state.quotes);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  const report = useMemo(
    () => buildCrmIntegrityReport(companies, contacts, projects, quotes),
    [companies, contacts, projects, quotes],
  );

  const run = async (key: string, operation: () => Promise<void> | void) => {
    setBusyKey(key);
    setError('');
    try {
      await operation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'CRM cleanup failed.');
    } finally {
      setBusyKey('');
    }
  };

  const confirmCompanyMerge = (primaryId: string, duplicateId: string) => {
    const primary = companies.find((company) => company.id === primaryId);
    const duplicate = companies.find((company) => company.id === duplicateId);
    if (!primary || !duplicate) return;
    const duplicateLinks = relationshipCount(duplicate.id, contacts, projects);
    const message = [
      `Keep “${primary.name}” and merge “${duplicate.name}” into it?`,
      '',
      `${duplicateLinks.projects} project(s) and ${duplicateLinks.contacts} contact(s) will move to the kept account.`,
      'Quotes, activities, and signature links will be relinked. Frozen quote revisions and accepted snapshots will not be rewritten.',
    ].join('\n');
    if (!window.confirm(message)) return;
    void run(`company:${primaryId}:${duplicateId}`, () => mergeCompanyIdentity(primaryId, duplicateId));
  };

  const confirmContactMerge = (primaryId: string, duplicateId: string) => {
    const primary = contacts.find((contact) => contact.id === primaryId);
    const duplicate = contacts.find((contact) => contact.id === duplicateId);
    if (!primary || !duplicate) return;
    const message = [
      `Keep “${primary.name}” and merge “${duplicate.name}” into it?`,
      '',
      'Quote, activity, and signature links will move to the kept contact. Frozen quote revisions and accepted snapshots will not be rewritten.',
    ].join('\n');
    if (!window.confirm(message)) return;
    void run(`contact:${primaryId}:${duplicateId}`, () => mergeContactIdentity(primaryId, duplicateId));
  };

  return (
    <div className="project-editor-backdrop crm-cleanup-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="project-editor crm-cleanup-panel" aria-label="CRM cleanup">
        <header>
          <div>
            <span className="board-eyebrow">Identity & data hygiene</span>
            <h2>CRM cleanup</h2>
          </div>
          <button type="button" className="editor-close" onClick={onClose}>×</button>
        </header>

        <div className="crm-cleanup-summary">
          <div><strong>{report.issueCount}</strong><span>items to review</span></div>
          <div><strong>{report.companyDuplicates.length}</strong><span>account pairs</span></div>
          <div><strong>{report.contactDuplicates.length}</strong><span>contact pairs</span></div>
          <div><strong>{report.repairableCount}</strong><span>safe link suggestions</span></div>
        </div>

        <p className="crm-cleanup-principle">SalesShop only auto-resolves exact canonical names, saved aliases, unique emails, and unique phone numbers. Similar-looking records stay here for a person to decide.</p>
        {error && <div className="crm-cleanup-error" role="alert">{error}</div>}

        <section className="crm-cleanup-section">
          <header><div><strong>Possible duplicate accounts</strong><span>Choose which record survives.</span></div><b>{report.companyDuplicates.length}</b></header>
          {report.companyDuplicates.map((candidate) => {
            const firstLinks = relationshipCount(candidate.first.id, contacts, projects);
            const secondLinks = relationshipCount(candidate.second.id, contacts, projects);
            const firstBusy = busyKey === `company:${candidate.first.id}:${candidate.second.id}`;
            const secondBusy = busyKey === `company:${candidate.second.id}:${candidate.first.id}`;
            return (
              <article className="crm-duplicate-card" key={candidate.id}>
                <div className="crm-duplicate-reason"><span className={`confidence-${candidate.confidence}`}>{candidate.confidence === 'high' ? 'Strong match' : 'Review'}</span><small>{candidate.reasons.join(' · ')}</small></div>
                <div className="crm-duplicate-compare">
                  <div><strong>{candidate.first.name}</strong><span>{firstLinks.projects} projects · {firstLinks.contacts} contacts</span>{candidate.first.aliases?.length ? <small>Aliases: {candidate.first.aliases.join(', ')}</small> : null}</div>
                  <div><strong>{candidate.second.name}</strong><span>{secondLinks.projects} projects · {secondLinks.contacts} contacts</span>{candidate.second.aliases?.length ? <small>Aliases: {candidate.second.aliases.join(', ')}</small> : null}</div>
                </div>
                <div className="crm-merge-actions">
                  <button type="button" disabled={Boolean(busyKey)} onClick={() => confirmCompanyMerge(candidate.first.id, candidate.second.id)}>{firstBusy ? 'Merging…' : `Keep ${candidate.first.name}`}</button>
                  <button type="button" disabled={Boolean(busyKey)} onClick={() => confirmCompanyMerge(candidate.second.id, candidate.first.id)}>{secondBusy ? 'Merging…' : `Keep ${candidate.second.name}`}</button>
                  <button type="button" className="crm-not-duplicate" disabled={Boolean(busyKey)} onClick={() => updateCompany(candidate.first.id, { identityExclusions: [...(candidate.first.identityExclusions ?? []), candidate.second.id] })}>Not a duplicate</button>
                </div>
              </article>
            );
          })}
          {!report.companyDuplicates.length && <div className="crm-cleanup-empty">No likely duplicate accounts found.</div>}
        </section>

        <section className="crm-cleanup-section">
          <header><div><strong>Possible duplicate contacts</strong><span>Email and phone matches rank strongest.</span></div><b>{report.contactDuplicates.length}</b></header>
          {report.contactDuplicates.map((candidate) => {
            const firstCompany = candidate.first.companyId ? companies.find((company) => company.id === candidate.first.companyId) : undefined;
            const secondCompany = candidate.second.companyId ? companies.find((company) => company.id === candidate.second.companyId) : undefined;
            const firstBusy = busyKey === `contact:${candidate.first.id}:${candidate.second.id}`;
            const secondBusy = busyKey === `contact:${candidate.second.id}:${candidate.first.id}`;
            return (
              <article className="crm-duplicate-card" key={candidate.id}>
                <div className="crm-duplicate-reason"><span className={`confidence-${candidate.confidence}`}>{candidate.confidence === 'high' ? 'Strong match' : 'Review'}</span><small>{candidate.reasons.join(' · ')}</small></div>
                <div className="crm-duplicate-compare">
                  <div><strong>{candidate.first.name}</strong><span>{candidate.first.email || candidate.first.phone || 'No contact detail'}</span>{firstCompany && <small>{firstCompany.name}</small>}</div>
                  <div><strong>{candidate.second.name}</strong><span>{candidate.second.email || candidate.second.phone || 'No contact detail'}</span>{secondCompany && <small>{secondCompany.name}</small>}</div>
                </div>
                <div className="crm-merge-actions">
                  <button type="button" disabled={Boolean(busyKey)} onClick={() => confirmContactMerge(candidate.first.id, candidate.second.id)}>{firstBusy ? 'Merging…' : `Keep ${candidate.first.name}`}</button>
                  <button type="button" disabled={Boolean(busyKey)} onClick={() => confirmContactMerge(candidate.second.id, candidate.first.id)}>{secondBusy ? 'Merging…' : `Keep ${candidate.second.name}`}</button>
                  <button type="button" className="crm-not-duplicate" disabled={Boolean(busyKey)} onClick={() => updateContact(candidate.first.id, { identityExclusions: [...(candidate.first.identityExclusions ?? []), candidate.second.id] })}>Not a duplicate</button>
                </div>
              </article>
            );
          })}
          {!report.contactDuplicates.length && <div className="crm-cleanup-empty">No likely duplicate contacts found.</div>}
        </section>

        <section className="crm-cleanup-section">
          <header><div><strong>Broken or missing links</strong><span>Only unique exact matches get a Repair button.</span></div><b>{report.brokenLinks.length}</b></header>
          <div className="crm-link-list">
            {report.brokenLinks.map((issue) => {
              const repairable = Boolean(issue.suggestedCompanyId || issue.suggestedContactId);
              const company = issue.suggestedCompanyId ? companies.find((candidate) => candidate.id === issue.suggestedCompanyId) : undefined;
              const contact = issue.suggestedContactId ? contacts.find((candidate) => candidate.id === issue.suggestedContactId) : undefined;
              const key = `repair:${issue.id}`;
              return (
                <div className="crm-link-row" key={issue.id}>
                  <div><small>{issueKindLabel(issue)}</small><strong>{issue.label}</strong><span>{issue.detail}</span>{repairable && <em>Suggested: {company?.name ?? contact?.name}</em>}</div>
                  {repairable
                    ? <button type="button" disabled={Boolean(busyKey)} onClick={() => void run(key, () => repairCrmBrokenLink(issue))}>{busyKey === key ? 'Repairing…' : 'Repair link'}</button>
                    : <span className="crm-manual-review">Manual review</span>}
                </div>
              );
            })}
          </div>
          {!report.brokenLinks.length && <div className="crm-cleanup-empty">No broken CRM links found.</div>}
        </section>
      </aside>
    </div>
  );
}
