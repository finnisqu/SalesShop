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
    expect(result.dealPeople.map(item=>item.id)).toEqual([contact.id]);
    expect(result.companyPeople.map(item=>item.id)).toEqual([otherContact.id]);
    expect(result.directHistory.map(item => item.id)).toEqual(['quote','direct']);
  });
  it('includes people from direct multi-link activity metadata but never infers all company contacts',()=>{
    const records=[
      {id:'with-metadata',type:'manual-touchpoint',projectId:deal.id,
       occurredAt:'2026-11-09T12:00:00Z',metadata:{relatedRecords:[
        {type:'project',id:deal.id},{type:'contact',id:otherContact.id},
       ]}},
      {id:'company-only',type:'manual-touchpoint',companyId:company.id,
       occurredAt:'2026-11-09T11:00:00Z',metadata:{relatedRecords:[
        {type:'contact',id:'unknown'}, {type:'company',id:company.id},
       ]}},
    ] as Activity[];
    const result=dealRecordView(deal,[company],[contact,otherContact],[],records);
    expect(result.dealPeople.map(p=>p.id)).toEqual(['contact-2']);
    expect(result.companyPeople.map(p=>p.id)).toEqual(['contact-1']);
    expect(result.directHistory.map(a=>a.id)).toEqual(['with-metadata']);
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
