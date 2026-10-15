import { describe, expect, it } from 'vitest';
import { personRecordView } from './personRecordView';
import type { Activity, Company, Contact } from '../types/crm';

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
  it('does not guess affiliations by names, and does not invent a company for unassigned contacts', () => {
    const unassigned = { id: 'contact-b', name: 'Builder' } as Contact;
    const result = personRecordView(unassigned, [company], [{ id: 'a', companyId: company.id }] as Activity[]);
    expect(result.company).toBeNull();
    expect(result.directActivities).toEqual([]);
  });
});
