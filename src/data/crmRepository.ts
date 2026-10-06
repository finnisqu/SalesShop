import { readLocalDocument, writeLocalDocument } from './cloudAwareStorage';
import type { Activity, Company, Contact, CrmDocument, Project, ProjectStage } from '../types/crm';
import { ACTIVITY_TYPES, PROJECT_STAGES } from '../types/crm';

export interface CrmRepository {
  load(): CrmDocument;
  save(document: CrmDocument): void;
}

const stageSet = new Set<string>(PROJECT_STAGES);
const activityTypeSet = new Set<string>(ACTIVITY_TYPES);

function seedDocument(): CrmDocument {
  const timestamp = new Date().toISOString();
  const companies: Company[] = [
    { id: 'company_abc', name: 'ABC Construction', kind: 'customer', createdAt: timestamp, updatedAt: timestamp },
    { id: 'company_greystone', name: 'Greystone Builders', kind: 'customer', createdAt: timestamp, updatedAt: timestamp },
    { id: 'company_choate', name: 'Choate Construction', kind: 'customer', createdAt: timestamp, updatedAt: timestamp },
    { id: 'company_dhi', name: 'D.R. Horton (DHI Communities)', kind: 'customer', createdAt: timestamp, updatedAt: timestamp },
    { id: 'company_bar', name: 'BAR Construction', kind: 'customer', createdAt: timestamp, updatedAt: timestamp },
    { id: 'company_raywest', name: 'RAYWEST DESIGNBUILD', kind: 'customer', createdAt: timestamp, updatedAt: timestamp },
  ];

  const projects: Project[] = [
    { id: 'project_riverwalk', name: 'Riverwalk Apartments', companyId: 'company_abc', companyName: 'ABC Construction', stage: 'Bid Development', stageChangedAt: timestamp, amount: 486000, nextAction: 'Finish quartz alternate', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_oak_grove', name: 'Oak Grove Phase II', companyId: 'company_greystone', companyName: 'Greystone Builders', stage: 'Bid Sent', stageChangedAt: timestamp, amount: 382000, nextAction: 'Follow up with Sarah', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_hampton', name: 'Hampton Inn Greenville', companyId: 'company_choate', companyName: 'Choate Construction', stage: 'Bid Development', stageChangedAt: timestamp, nextAction: 'Verify room count', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_collins', name: 'Collins Ridge', companyId: 'company_dhi', companyName: 'D.R. Horton (DHI Communities)', stage: 'Negotiation', stageChangedAt: timestamp, amount: 521297.06, lastTouchpoint: '2026-10-01', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_blue_jay', name: 'Blue Jay Park', companyId: 'company_bar', companyName: 'BAR Construction', stage: 'Bid Sent', stageChangedAt: timestamp, amount: 14540, lastTouchpoint: '2026-09-30', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_burrito', name: 'Burrito Shak - Kannapolis', companyId: 'company_raywest', companyName: 'RAYWEST DESIGNBUILD', stage: 'Closed Won', stageChangedAt: timestamp, amount: 7239, lastTouchpoint: '2026-09-23', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_twin_lakes', name: 'Twin Lakes IL', companyId: 'company_choate', companyName: 'Choate Construction', stage: 'Discarded', stageChangedAt: timestamp, amount: 100000, createdAt: timestamp, updatedAt: timestamp },
  ];

  return { schemaVersion: 3, companies, contacts: [], projects, activities: [] };
}

function normalizeProject(raw: Partial<Project>, timestamp: string): Project | null {
  if (!raw.id || !raw.name) return null;
  const stage = stageSet.has(String(raw.stage)) ? raw.stage as ProjectStage : 'Discovery';
  return {
    id: raw.id,
    name: raw.name,
    companyId: raw.companyId,
    companyName: raw.companyName,
    stage,
    stageChangedAt: raw.stageChangedAt ?? raw.updatedAt ?? raw.createdAt ?? timestamp,
    dueDate: raw.dueDate,
    amount: typeof raw.amount === 'number' ? raw.amount : undefined,
    nextAction: raw.nextAction,
    lastTouchpoint: raw.lastTouchpoint,
    createdAt: raw.createdAt ?? timestamp,
    updatedAt: raw.updatedAt ?? timestamp,
  };
}

function normalizeContact(raw: Partial<Contact>, timestamp: string): Contact | null {
  if (!raw.id || !raw.name) return null;
  return {
    id: raw.id,
    companyId: raw.companyId,
    name: raw.name,
    email: raw.email,
    phone: raw.phone,
    title: raw.title,
    createdAt: raw.createdAt ?? timestamp,
    updatedAt: raw.updatedAt ?? timestamp,
  };
}

function normalizeActivity(raw: Partial<Activity>): Activity | null {
  if (!raw.id || !raw.summary || !raw.occurredAt || !activityTypeSet.has(String(raw.type))) return null;
  return {
    id: raw.id,
    type: raw.type as Activity['type'],
    summary: raw.summary,
    projectId: raw.projectId,
    companyId: raw.companyId,
    contactId: raw.contactId,
    quoteId: raw.quoteId,
    occurredAt: raw.occurredAt,
    metadata: raw.metadata,
  };
}

function normalize(raw: unknown): CrmDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<CrmDocument> & { contacts?: unknown[]; activities?: unknown[] };
  if (!Array.isArray(candidate.projects) || !Array.isArray(candidate.companies)) return null;
  const timestamp = new Date().toISOString();
  const companies = candidate.companies
    .filter((company): company is Company => Boolean(company && company.id && company.name))
    .map((company) => ({
      ...company,
      kind: company.kind === 'non-customer' ? 'non-customer' as const : 'customer' as const,
      createdAt: company.createdAt ?? timestamp,
      updatedAt: company.updatedAt ?? timestamp,
    }));
  const contacts = Array.isArray(candidate.contacts)
    ? candidate.contacts.map((contact) => normalizeContact(contact as Contact, timestamp)).filter((contact): contact is Contact => Boolean(contact))
    : [];
  const projects = candidate.projects
    .map((project) => normalizeProject(project, timestamp))
    .filter((project): project is Project => Boolean(project));
  const activities = Array.isArray(candidate.activities)
    ? candidate.activities.map((activity) => normalizeActivity(activity as Activity)).filter((activity): activity is Activity => Boolean(activity))
    : [];
  return { schemaVersion: 3, companies, contacts, projects, activities };
}

export const localCrmRepository: CrmRepository = {
  load() {
    const raw = readLocalDocument('crm');
    const normalized = normalize(raw);
    if (normalized) {
      this.save(normalized);
      return normalized;
    }
    const seeded = seedDocument();
    this.save(seeded);
    return seeded;
  },

  save(document) {
    writeLocalDocument('crm', document);
  },
};
