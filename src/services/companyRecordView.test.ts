import { describe, expect, it } from 'vitest';
import { companyRecordView } from './companyRecordView';
import type { Activity, Company, Contact, Project } from '../types/crm';
import type { Quote } from '../types/quote';

const company = { id: 'company-1', name: 'Company One', kind: 'customer', createdAt: '2026-01-01', updatedAt: '2026-01-01' } as Company;
const contact = { id: 'person-1', companyId: company.id, name: 'Estimator' } as Contact;
const project = { id: 'project-1', companyId: company.id, name: 'Job', updatedAt: '2026-01-02' } as Project;
const linkedQuote = { id: 'quote-1', projectId: project.id, updatedAt: '2026-01-03' } as Quote;
const otherQuote = { id: 'quote-2', projectId: 'another-project', updatedAt: '2026-01-03' } as Quote;

describe('Company record relationships', () => {
  it('includes project-linked quotes and their activities exactly once', () => {
    const events = [
      { id: 'a', summary: 'Sent quote', quoteId: linkedQuote.id, projectId: project.id, occurredAt: '2026-01-06' },
      { id: 'b', summary: 'Contact made', contactId: contact.id, occurredAt: '2026-01-05' },
      { id: 'c', summary: 'Company note', companyId: company.id, occurredAt: '2026-01-04' },
      { id: 'd', summary: 'Unrelated', quoteId: otherQuote.id, occurredAt: '2026-01-07' },
    ] as Activity[];
    const result = companyRecordView(company, [contact], [project], events, [linkedQuote, otherQuote]);
    expect(result.relatedContacts.map((x) => x.id)).toEqual([contact.id]);
    expect(result.relatedProjects.map((x) => x.id)).toEqual([project.id]);
    expect(result.relatedQuotes.map((x) => x.id)).toEqual([linkedQuote.id]);
    expect(result.relatedActivities.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('does not guess associations by names or include archived quotes', () => {
    const unrelated = { id: 'unrelated', name: company.name, companyId: 'other', updatedAt: '2026-01-01' } as Project;
    const archived = { id: 'archived', companyId: company.id, archivedAt: '2026-02-01', updatedAt: '2026-01-01' } as Quote;
    const result = companyRecordView(company, [], [unrelated], [], [archived, otherQuote]);
    expect(result.relatedProjects).toEqual([]);
    expect(result.relatedQuotes).toEqual([]);
    expect(result.relatedActivities).toEqual([]);
  });
});
