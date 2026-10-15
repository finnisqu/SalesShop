import { describe, expect, it } from 'vitest';
import { personRecordView } from './personRecordView';
import type { Activity, Company, Contact, Project } from '../types/crm';
import type { Quote } from '../types/quote';

const company = { id: 'company-a', name: 'Builder' } as Company;
const person = { id: 'contact-a', name: 'Sam', companyId: company.id } as Contact;

describe('Person record relationship boundaries', () => {
  it('shows direct-contact events only, never a company-wide outreach or quote timeline', () => {
    const activities = [
      { id: 'company-log', companyId: company.id, occurredAt: '2026-10-14' },
      { id: 'other-person', contactId: 'someone-else', companyId: company.id, occurredAt: '2026-10-13' },
      { id: 'my-contact', contactId: person.id, occurredAt: '2026-10-12' },
      { id: 'my-contact-old', contactId: person.id, occurredAt: '2026-10-11' },
    ] as Activity[];
    const result = personRecordView(person, [company], activities);
    expect(result.company?.id).toBe(company.id);
    expect(result.directActivities.map((x) => x.id)).toEqual(['my-contact', 'my-contact-old']);
  });
  it('shows Deal links only from explicit contactId and projectId on non-archived quotes', () => {
    const deal = { id:'deal-a', name:'Builder job', companyId:company.id, updatedAt:'2026-10-14' } as Project;
    const otherDeal = { id:'deal-b', name:'Other job', companyId:company.id, updatedAt:'2026-10-13' } as Project;
    const unrelatedSameName = { id:'deal-c', name:deal.name, companyId:'another', updatedAt:'2026-10-12' } as Project;
    const quotes = [
      {id:'q1',projectId:deal.id,contactId:person.id},
      {id:'q2',projectId:deal.id,contactId:person.id},
      {id:'unrelated',projectId:otherDeal.id,contactId:'other-person'},
      {id:'archived',projectId:otherDeal.id,contactId:person.id,archivedAt:'2026-10-12'},
    ] as Quote[];
    const related = personRecordView(person,[company],[],[deal,otherDeal,unrelatedSameName],quotes);
    expect(related.linkedDeals.map(item=>[item.project.id,item.quoteCount])).toEqual([['deal-a',2]]);
  });
  it('does not infer a Deal role from merely sharing a company', () => {
    const project = { id:'p1', name:'Job',companyId:company.id,updatedAt:'2026-10-10' } as Project;
    const result = personRecordView(person,[company],[],[project],[]);
    expect(result.linkedDeals).toEqual([]);
  });
  it('does not guess affiliations by names, and does not invent a company for unassigned contacts', () => {
    const unassigned = { id: 'contact-b', name: 'Builder' } as Contact;
    const result = personRecordView(unassigned, [company], [{ id: 'a', companyId: company.id }] as Activity[]);
    expect(result.company).toBeNull();
    expect(result.directActivities).toEqual([]);
  });
});
