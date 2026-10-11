import type { CrmDocument, Company, Contact, Project } from '../types/crm';
import type { Quote } from '../types/quote';

export type DuplicateConfidence = 'high' | 'review';

export interface CompanyDuplicateCandidate {
  id: string;
  first: Company;
  second: Company;
  confidence: DuplicateConfidence;
  reasons: string[];
}

export interface ContactDuplicateCandidate {
  id: string;
  first: Contact;
  second: Contact;
  confidence: DuplicateConfidence;
  reasons: string[];
}

export type CrmBrokenLinkKind = 'project-company' | 'contact-company' | 'quote-company' | 'quote-contact';

export interface CrmBrokenLink {
  id: string;
  kind: CrmBrokenLinkKind;
  label: string;
  detail: string;
  projectId?: string;
  contactId?: string;
  quoteId?: string;
  suggestedCompanyId?: string;
  suggestedContactId?: string;
}

export interface CrmIntegrityReport {
  companyDuplicates: CompanyDuplicateCandidate[];
  contactDuplicates: ContactDuplicateCandidate[];
  brokenLinks: CrmBrokenLink[];
  issueCount: number;
  repairableCount: number;
}

const COMPANY_WORDS: Record<string, string> = {
  '&': 'and',
  const: 'construction',
  constr: 'construction',
  construction: 'construction',
  bldrs: 'builder',
  builders: 'builder',
  builder: 'builder',
  dev: 'development',
  developers: 'development',
  developer: 'development',
  development: 'development',
  designbuild: 'design build',
};

const BUSINESS_SUFFIXES = new Set([
  'llc', 'inc', 'incorporated', 'corp', 'corporation', 'company', 'co', 'ltd', 'limited',
]);

function normalizeWords(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => (COMPANY_WORDS[word] ?? word).split(' '))
    .filter(Boolean);
}

export function normalizeCompanyIdentity(value: string) {
  return normalizeWords(value).join(' ');
}

export function normalizeCompanyLooseIdentity(value: string) {
  return normalizeWords(value)
    .filter((word) => !BUSINESS_SUFFIXES.has(word))
    .join(' ');
}

export function normalizePersonName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeEmail(value?: string) {
  return value?.trim().toLowerCase() || undefined;
}

export function normalizePhone(value?: string) {
  const digits = value?.replace(/\D/g, '') ?? '';
  if (digits.length < 7) return undefined;
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

function uniqueStrings(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const clean = value?.trim();
    if (!clean) return;
    const key = normalizeCompanyIdentity(clean);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });
  return result;
}

export function companyIdentityKeys(company: Pick<Company, 'name' | 'aliases'>) {
  return new Set(
    [company.name, ...(company.aliases ?? [])]
      .map(normalizeCompanyIdentity)
      .filter(Boolean),
  );
}

export function companyIdentityMatches(companies: Company[], value?: string) {
  const key = value ? normalizeCompanyIdentity(value) : '';
  if (!key) return [];
  return companies.filter((company) => companyIdentityKeys(company).has(key));
}

export function findCompanyByIdentity(companies: Company[], value?: string) {
  const matches = companyIdentityMatches(companies, value);
  return matches.length === 1 ? matches[0] : undefined;
}

export function contactIdentityMatches(
  contacts: Contact[],
  input: { companyId?: string; name?: string; email?: string; phone?: string },
) {
  const email = normalizeEmail(input.email);
  if (email) {
    const matches = contacts.filter((contact) => normalizeEmail(contact.email) === email);
    if (matches.length) return matches;
  }

  const phone = normalizePhone(input.phone);
  if (phone) {
    const matches = contacts.filter((contact) => normalizePhone(contact.phone) === phone);
    if (matches.length) return matches;
  }

  const name = input.name ? normalizePersonName(input.name) : '';
  if (!name) return [];
  return contacts.filter((contact) =>
    normalizePersonName(contact.name) === name
    && (!input.companyId || contact.companyId === input.companyId),
  );
}

export function findContactByIdentity(
  contacts: Contact[],
  input: { companyId?: string; name?: string; email?: string; phone?: string },
) {
  const matches = contactIdentityMatches(contacts, input);
  return matches.length === 1 ? matches[0] : undefined;
}

function companyPairReasons(first: Company, second: Company) {
  const reasons: string[] = [];
  const firstKeys = companyIdentityKeys(first);
  const secondKeys = companyIdentityKeys(second);
  if ([...firstKeys].some((key) => secondKeys.has(key))) {
    reasons.push('Same normalized name or alias');
    return { reasons, confidence: 'high' as const };
  }

  const firstLoose = normalizeCompanyLooseIdentity(first.name);
  const secondLoose = normalizeCompanyLooseIdentity(second.name);
  if (firstLoose && firstLoose === secondLoose) reasons.push('Same name after business suffixes / abbreviations');
  return { reasons, confidence: 'review' as const };
}

export function detectCompanyDuplicates(companies: Company[]) {
  const candidates: CompanyDuplicateCandidate[] = [];
  for (let firstIndex = 0; firstIndex < companies.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < companies.length; secondIndex += 1) {
      const first = companies[firstIndex];
      const second = companies[secondIndex];
      if (first.identityExclusions?.includes(second.id) || second.identityExclusions?.includes(first.id)) continue;
      const result = companyPairReasons(first, second);
      if (!result.reasons.length) continue;
      candidates.push({
        id: [first.id, second.id].sort().join(':'),
        first,
        second,
        confidence: result.confidence,
        reasons: result.reasons,
      });
    }
  }
  return candidates;
}

function contactPairReasons(first: Contact, second: Contact) {
  const reasons: string[] = [];
  const firstEmail = normalizeEmail(first.email);
  const secondEmail = normalizeEmail(second.email);
  if (firstEmail && firstEmail === secondEmail) reasons.push('Same email');

  const firstPhone = normalizePhone(first.phone);
  const secondPhone = normalizePhone(second.phone);
  if (firstPhone && firstPhone === secondPhone) reasons.push('Same phone');

  const sameName = normalizePersonName(first.name) === normalizePersonName(second.name);
  if (sameName && first.companyId && first.companyId === second.companyId) reasons.push('Same name at the same account');

  const high = reasons.some((reason) => reason === 'Same email' || reason === 'Same phone');
  return { reasons, confidence: high ? 'high' as const : 'review' as const };
}

export function detectContactDuplicates(contacts: Contact[]) {
  const candidates: ContactDuplicateCandidate[] = [];
  for (let firstIndex = 0; firstIndex < contacts.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < contacts.length; secondIndex += 1) {
      const first = contacts[firstIndex];
      const second = contacts[secondIndex];
      if (first.identityExclusions?.includes(second.id) || second.identityExclusions?.includes(first.id)) continue;
      const result = contactPairReasons(first, second);
      if (!result.reasons.length) continue;
      candidates.push({
        id: [first.id, second.id].sort().join(':'),
        first,
        second,
        confidence: result.confidence,
        reasons: result.reasons,
      });
    }
  }
  return candidates;
}

function uniqueContactByEmail(contacts: Contact[], email?: string) {
  const key = normalizeEmail(email);
  if (!key) return undefined;
  const matches = contacts.filter((contact) => normalizeEmail(contact.email) === key);
  return matches.length === 1 ? matches[0] : undefined;
}

export function buildCrmIntegrityReport(
  companies: Company[],
  contacts: Contact[],
  projects: Project[],
  quotes: Quote[],
): CrmIntegrityReport {
  const companyIds = new Set(companies.map((company) => company.id));
  const contactIds = new Set(contacts.map((contact) => contact.id));
  const brokenLinks: CrmBrokenLink[] = [];

  contacts.forEach((contact) => {
    if (!contact.companyId || companyIds.has(contact.companyId)) return;
    brokenLinks.push({
      id: `contact-company:${contact.id}`,
      kind: 'contact-company',
      label: contact.name,
      detail: 'Contact points to an account that no longer exists.',
      contactId: contact.id,
    });
  });

  projects.forEach((project) => {
    const broken = Boolean(project.companyId && !companyIds.has(project.companyId));
    const unlinked = !project.companyId && Boolean(project.companyName?.trim());
    if (!broken && !unlinked) return;
    const suggested = findCompanyByIdentity(companies, project.companyName);
    brokenLinks.push({
      id: `project-company:${project.id}`,
      kind: 'project-company',
      label: project.name,
      detail: broken ? 'Project points to a missing account.' : 'Project has an account name but no CRM link.',
      projectId: project.id,
      suggestedCompanyId: suggested?.id,
    });
  });

  quotes.forEach((quote) => {
    const companyBroken = Boolean(quote.companyId && !companyIds.has(quote.companyId));
    const companyUnlinked = !quote.companyId && Boolean(quote.companyName?.trim());
    if (companyBroken || companyUnlinked) {
      const suggested = findCompanyByIdentity(companies, quote.companyName);
      brokenLinks.push({
        id: `quote-company:${quote.id}`,
        kind: 'quote-company',
        label: quote.title,
        detail: companyBroken ? 'Quote points to a missing account.' : 'Quote has a customer name but no CRM account link.',
        quoteId: quote.id,
        suggestedCompanyId: suggested?.id,
      });
    }

    const contactBroken = Boolean(quote.contactId && !contactIds.has(quote.contactId));
    const contactUnlinked = !quote.contactId && Boolean(quote.contactEmail?.trim());
    if (contactBroken || contactUnlinked) {
      const suggested = uniqueContactByEmail(contacts, quote.contactEmail);
      brokenLinks.push({
        id: `quote-contact:${quote.id}`,
        kind: 'quote-contact',
        label: quote.title,
        detail: contactBroken ? 'Quote points to a missing contact.' : 'Quote has an email but no CRM contact link.',
        quoteId: quote.id,
        suggestedContactId: suggested?.id,
      });
    }
  });

  const companyDuplicates = detectCompanyDuplicates(companies);
  const contactDuplicates = detectContactDuplicates(contacts);
  const issueCount = companyDuplicates.length + contactDuplicates.length + brokenLinks.length;
  const repairableCount = brokenLinks.filter((issue) => issue.suggestedCompanyId || issue.suggestedContactId).length;

  return { companyDuplicates, contactDuplicates, brokenLinks, issueCount, repairableCount };
}

export function mergeCompanyCrmDocument(
  document: CrmDocument,
  primaryId: string,
  duplicateId: string,
  timestamp: string,
): CrmDocument {
  if (primaryId === duplicateId) return document;
  const primary = document.companies.find((company) => company.id === primaryId);
  const duplicate = document.companies.find((company) => company.id === duplicateId);
  if (!primary || !duplicate) throw new Error('Both account records must still exist before merging.');

  const aliases = uniqueStrings([
    ...(primary.aliases ?? []),
    duplicate.name,
    ...(duplicate.aliases ?? []),
  ]).filter((alias) => normalizeCompanyIdentity(alias) !== normalizeCompanyIdentity(primary.name));

  const companies = document.companies
    .filter((company) => company.id !== duplicateId)
    .map((company) => company.id === primaryId ? {
      ...company,
      aliases,
      identityExclusions: [...new Set([
        ...(company.identityExclusions ?? []),
        ...(duplicate.identityExclusions ?? []),
      ])].filter((excludedId) => excludedId !== primaryId && excludedId !== duplicateId),
      annualUnits: company.annualUnits ?? duplicate.annualUnits,
      averageUnitValue: company.averageUnitValue ?? duplicate.averageUnitValue,
      expectedSharePct: company.expectedSharePct ?? duplicate.expectedSharePct,
      updatedAt: timestamp,
    } : company);

  const contacts = document.contacts.map((contact) =>
    contact.companyId === duplicateId ? { ...contact, companyId: primaryId, updatedAt: timestamp } : contact,
  );
  const projects = document.projects.map((project) =>
    project.companyId === duplicateId
      ? { ...project, companyId: primaryId, companyName: primary.name, updatedAt: timestamp }
      : project,
  );
  const activities = document.activities.map((activity) =>
    activity.companyId === duplicateId ? { ...activity, companyId: primaryId } : activity,
  );

  return { ...document, companies, contacts, projects, activities };
}

export function mergeContactCrmDocument(
  document: CrmDocument,
  primaryId: string,
  duplicateId: string,
  timestamp: string,
): CrmDocument {
  if (primaryId === duplicateId) return document;
  const primary = document.contacts.find((contact) => contact.id === primaryId);
  const duplicate = document.contacts.find((contact) => contact.id === duplicateId);
  if (!primary || !duplicate) throw new Error('Both contact records must still exist before merging.');

  const contacts = document.contacts
    .filter((contact) => contact.id !== duplicateId)
    .map((contact) => contact.id === primaryId ? {
      ...contact,
      identityExclusions: [...new Set([
        ...(contact.identityExclusions ?? []),
        ...(duplicate.identityExclusions ?? []),
      ])].filter((excludedId) => excludedId !== primaryId && excludedId !== duplicateId),
      companyId: contact.companyId ?? duplicate.companyId,
      email: contact.email ?? duplicate.email,
      phone: contact.phone ?? duplicate.phone,
      title: contact.title ?? duplicate.title,
      updatedAt: timestamp,
    } : contact);
  const activities = document.activities.map((activity) =>
    activity.contactId === duplicateId ? { ...activity, contactId: primaryId } : activity,
  );

  return { ...document, contacts, activities };
}

export function relinkQuotesForCompany(
  quotes: Quote[],
  primary: Company,
  duplicateId: string,
  timestamp: string,
) {
  return quotes.map((quote) => {
    if (quote.companyId !== duplicateId) return quote;
    const editable = !quote.archivedAt && (quote.status === 'Draft' || quote.status === 'Ready');
    return {
      ...quote,
      companyId: primary.id,
      companyName: editable ? primary.name : quote.companyName,
      updatedAt: timestamp,
    };
  });
}

export function relinkQuotesForContact(
  quotes: Quote[],
  primary: Contact,
  duplicateId: string,
  timestamp: string,
) {
  return quotes.map((quote) => {
    if (quote.contactId !== duplicateId) return quote;
    const editable = !quote.archivedAt && (quote.status === 'Draft' || quote.status === 'Ready');
    return {
      ...quote,
      contactId: primary.id,
      contactName: editable ? primary.name : quote.contactName,
      contactEmail: editable ? (primary.email ?? quote.contactEmail) : quote.contactEmail,
      updatedAt: timestamp,
    };
  });
}
