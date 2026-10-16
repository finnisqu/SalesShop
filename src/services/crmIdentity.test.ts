import { describe, expect, it } from 'vitest';
import type { CrmDocument, Company, Contact, Project } from '../types/crm';
import type { Quote } from '../types/quote';
import {
  buildCrmIntegrityReport,
  companyIdentityMatches,
  contactIdentityMatches,
  detectCompanyDuplicates,
  detectContactDuplicates,
  findCompanyByIdentity,
  findContactByIdentity,
  mergeCompanyCrmDocument,
  mergeContactCrmDocument,
  normalizeCompanyIdentity,
  relinkQuotesForCompany,
  relinkQuotesForContact,
} from './crmIdentity';

const timestamp = '2026-10-06T20:00:00.000Z';

function company(id: string, name: string, overrides: Partial<Company> = {}): Company {
  return {
    id,
    name,
    kind: 'customer',
    aliases: [],
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    ...overrides,
  };
}

function contact(id: string, name: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id,
    name,
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    ...overrides,
  };
}

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: `Project ${id}`,
    stage: 'Discovery',
    createdAt: '2026-01-01T12:00:00.000Z',
    updatedAt: '2026-01-01T12:00:00.000Z',
    ...overrides,
  };
}

function quote(id: string, overrides: Partial<Quote> = {}): Quote {
  return {
    id,
    quoteNumber: `DRAFT-${id}`,
    documentType: 'quote',
    originalQuoteDate: '2026-10-06',
    quoteDate: '2026-10-06',
    revision: 0,
    status: 'Draft',
    title: `Quote ${id}`,
    sections: [],
    lines: [],
    customerColumns: { quantity: false, rate: false, lineAmount: true },
    customerNotes: '',
    internalNotes: '',
    history: [],
    createdAt: '2026-10-06T12:00:00.000Z',
    updatedAt: '2026-10-06T12:00:00.000Z',
    ...overrides,
  };
}

describe('CRM identity normalization', () => {
  it('normalizes common company abbreviations without auto-merging fuzzy names', () => {
    expect(normalizeCompanyIdentity('BAR Const.')).toBe('bar construction');
    expect(normalizeCompanyIdentity('BAR Construction')).toBe('bar construction');

    const candidates = detectCompanyDuplicates([
      company('a', 'BAR Construction'),
      company('b', 'Bar Const.'),
      company('c', 'World Stone of Sanford'),
      company('d', 'World Stone'),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ confidence: 'high' });
  });

  it('treats business-suffix-only matches as review rather than automatic identity', () => {
    const candidates = detectCompanyDuplicates([
      company('a', 'Acme LLC'),
      company('b', 'Acme Inc'),
    ]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toBe('review');
  });

  it('uses saved aliases for exact company resolution and exposes ambiguity instead of inventing another identity', () => {
    const companies = [
      company('bar', 'BAR Construction', { aliases: ['BAR Const.', 'Bar Construction Company'] }),
      company('bar-legacy', 'BAR Const.'),
    ];
    expect(companyIdentityMatches(companies, 'bar const')).toHaveLength(2);
    expect(findCompanyByIdentity(companies, 'bar const')).toBeUndefined();
    expect(findCompanyByIdentity([companies[0]], 'BAR CONSTRUCTION COMPANY')?.id).toBe('bar');
  });

  it('resolves contacts by unique email or phone and detects duplicate evidence', () => {
    const contacts = [
      contact('a', 'Sarah Smith', { email: 'SARAH@example.com', phone: '(864) 555-1212', companyId: 'bar' }),
      contact('b', 'S. Smith', { email: 'sarah@example.com', companyId: 'bar' }),
      contact('c', 'Sarah Smith', { phone: '864-555-1212', companyId: 'other' }),
    ];

    expect(contactIdentityMatches(contacts, { email: 'sarah@example.com' })).toHaveLength(2);
    expect(contactIdentityMatches(contacts, { phone: '(864) 555-1212' })).toHaveLength(2);
    expect(findContactByIdentity(contacts, { email: 'sarah@example.com' })).toBeUndefined();
    expect(findContactByIdentity(contacts, { phone: '(864) 555-1212' })).toBeUndefined();

    const duplicates = detectContactDuplicates(contacts);
    expect(duplicates.some((candidate) => candidate.reasons.includes('Same email'))).toBe(true);
    expect(duplicates.some((candidate) => candidate.reasons.includes('Same phone'))).toBe(true);
  });
});

  it('honors Not-a-duplicate review exclusions', () => {
    const first = company('a', 'BAR Construction', { identityExclusions: ['b'] });
    const second = company('b', 'Bar Const.');
    expect(detectCompanyDuplicates([first, second])).toHaveLength(0);

    const contactA = contact('contact-a', 'Sarah Smith', { email: 'sarah@example.com', identityExclusions: ['contact-b'] });
    const contactB = contact('contact-b', 'S. Smith', { email: 'sarah@example.com' });
    expect(detectContactDuplicates([contactA, contactB])).toHaveLength(0);
  });

describe('CRM identity merge behavior', () => {
  it('merges account relationships into the chosen primary and stores the old name as an alias', () => {
    const document: CrmDocument = {
      schemaVersion: 3,
      companies: [
        company('primary', 'BAR Construction', { annualUnits: 100 }),
        company('duplicate', 'Bar Const.', { averageUnitValue: 3500, aliases: ['BAR Co'] }),
      ],
      contacts: [contact('contact', 'Sarah', { companyId: 'duplicate' })],
      projects: [project('project', { companyId: 'duplicate', companyName: 'Bar Const.' })],
      activities: [{
        id: 'activity',
        type: 'quote-sent',
        summary: 'Sent',
        companyId: 'duplicate',
        occurredAt: '2026-10-01T12:00:00.000Z',
      }],
    };

    const merged = mergeCompanyCrmDocument(document, 'primary', 'duplicate', timestamp);
    expect(merged.companies).toHaveLength(1);
    expect(merged.companies[0].aliases).toEqual(['BAR Co']);
    expect(merged.companies[0].annualUnits).toBe(100);
    expect(merged.companies[0].averageUnitValue).toBe(3500);
    expect(merged.contacts[0].companyId).toBe('primary');
    expect(merged.projects[0]).toMatchObject({ companyId: 'primary', companyName: 'BAR Construction' });
    expect(merged.activities[0].companyId).toBe('primary');
  });

  it('relinks current quote IDs while preserving issued customer display text and frozen history', () => {
    const primary = company('primary', 'BAR Construction');
    const frozen = quote('sent', {
      status: 'Sent',
      companyId: 'duplicate',
      companyName: 'Bar Const.',
      history: [{
        revision: 0,
        quoteDate: '2026-10-06',
        capturedAt: timestamp,
        status: 'Sent',
        title: 'Issued',
        companyId: 'duplicate',
        companyName: 'Bar Const.',
        sections: [],
        lines: [],
        customerColumns: { quantity: false, rate: false, lineAmount: true },
        customerNotes: '',
        customerTotal: 0,
      }],
    });
    const draft = quote('draft', { companyId: 'duplicate', companyName: 'Bar Const.' });

    const relinked = relinkQuotesForCompany([frozen, draft], primary, 'duplicate', timestamp);
    expect(relinked[0].companyId).toBe('primary');
    expect(relinked[0].companyName).toBe('Bar Const.');
    expect(relinked[0].history[0].companyId).toBe('duplicate');
    expect(relinked[1]).toMatchObject({ companyId: 'primary', companyName: 'BAR Construction' });
  });

  it('merges contacts without overwriting populated primary fields and relinks quotes safely', () => {
    const document: CrmDocument = {
      schemaVersion: 3,
      companies: [],
      contacts: [
        contact('primary', 'Sarah Smith', { email: 'sarah@example.com', companyId: 'bar' }),
        contact('duplicate', 'Sarah S.', { phone: '8645551212', title: 'Estimator', companyId: 'bar' }),
      ],
      projects: [],
      activities: [{ id: 'a', type: 'quote-viewed', summary: 'Viewed', contactId: 'duplicate', occurredAt: timestamp }],
    };
    const merged = mergeContactCrmDocument(document, 'primary', 'duplicate', timestamp);
    expect(merged.contacts).toHaveLength(1);
    expect(merged.contacts[0]).toMatchObject({ email: 'sarah@example.com', phone: '8645551212', title: 'Estimator' });
    expect(merged.activities[0].contactId).toBe('primary');

    const issued = quote('issued', { status: 'Viewed', contactId: 'duplicate', contactName: 'Sarah S.', contactEmail: 'old@example.com' });
    const draft = quote('draft', { contactId: 'duplicate', contactName: 'Sarah S.', contactEmail: 'old@example.com' });
    const relinked = relinkQuotesForContact([issued, draft], merged.contacts[0], 'duplicate', timestamp);
    expect(relinked[0]).toMatchObject({ contactId: 'primary', contactName: 'Sarah S.', contactEmail: 'old@example.com' });
    expect(relinked[1]).toMatchObject({ contactId: 'primary', contactName: 'Sarah Smith', contactEmail: 'sarah@example.com' });
  });
});

describe('CRM integrity report', () => {
  it('suggests only unique exact repairs for broken project and quote links', () => {
    const companies = [company('bar', 'BAR Construction', { aliases: ['BAR Const.'] })];
    const contacts = [contact('sarah', 'Sarah Smith', { companyId: 'bar', email: 'sarah@example.com' })];
    const projects = [project('project', { companyName: 'BAR Const.' })];
    const quotes = [quote('quote', { companyName: 'BAR Construction', contactEmail: 'sarah@example.com' })];

    const report = buildCrmIntegrityReport(companies, contacts, projects, quotes);
    expect(report.brokenLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'project-company', suggestedCompanyId: 'bar' }),
      expect.objectContaining({ kind: 'quote-company', suggestedCompanyId: 'bar' }),
      expect.objectContaining({ kind: 'quote-contact', suggestedContactId: 'sarah' }),
    ]));
    expect(report.repairableCount).toBe(3);
  });
});
