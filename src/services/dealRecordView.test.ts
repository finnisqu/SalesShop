import { describe, expect, it } from 'vitest';
import { dealRecordView } from './dealRecordView';
import type { Activity, Company, Contact, Project } from '../types/crm';
import type { Quote } from '../types/quote';

const deal = { id: 'project-1', name: 'School', companyId: 'company-1', stage: 'Bid Sent' } as Project;
const company = { id: 'company-1', name: 'Builder' } as Company;
const contact = { id: 'contact-1', name: 'Estimator', companyId: company.id } as Contact;
const otherContact = { id: 'contact-2', name: 'Unrelated', companyId: company.id } as Contact;
const quote = { id: 'quote-1', projectId: deal.id, contactId: contact.id, updatedAt: '2026-10-15' } as Quote;
describe('Deal record relationships', () => {
  it('includes only explicitly related quotes, people and activities', () => {
    const items = [
      { id: 'direct', projectId: deal.id, occurredAt: '2026-10-12' },
      { id: 'quote', quoteId: quote.id, occurredAt: '2026-10-13' },
      { id: 'other-company', companyId: company.id, occurredAt: '2026-10-14' },
      { id: 'other-contact', contactId: otherContact.id, occurredAt: '2026-10-15' },
    ] as Activity[];
    const result = dealRecordView(deal, [company], [contact, otherContact], [quote], items);
    expect(result.company?.id).toBe(company.id);
    expect(result.linkedQuotes.map(item => item.id)).toEqual([quote.id]);
    expect(result.quoteContacts.map(item => item.id)).toEqual([contact.id]);
    expect(result.directHistory.map(item => item.id)).toEqual(['quote','direct']);
  });
  it('ignores matching names, other deals, and archived quotes', () => {
    const unrelated = { ...quote, id: 'other', projectId: 'project-2', updatedAt: '2026-10-16' };
    const archived = { ...quote, id: 'archived', archivedAt: '2026-10-16' };
    const result = dealRecordView(deal, [], [contact], [unrelated, archived], [],);
    expect(result.linkedQuotes).toEqual([]);
    expect(result.quoteContacts).toEqual([]);
    expect(result.directHistory).toEqual([]);
  });
});
