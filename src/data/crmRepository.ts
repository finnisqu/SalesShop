import type { Company, CrmDocument, Project, ProjectStage } from '../types/crm';
import { PROJECT_STAGES } from '../types/crm';

const STORAGE_KEY = 'salesshop-react-crm-v1';

export interface CrmRepository {
  load(): CrmDocument;
  save(document: CrmDocument): void;
}

const stageSet = new Set<string>(PROJECT_STAGES);

function seedDocument(): CrmDocument {
  const timestamp = new Date().toISOString();
  const companies: Company[] = [
    { id: 'company_abc', name: 'ABC Construction', createdAt: timestamp, updatedAt: timestamp },
    { id: 'company_greystone', name: 'Greystone Builders', createdAt: timestamp, updatedAt: timestamp },
    { id: 'company_choate', name: 'Choate Construction', createdAt: timestamp, updatedAt: timestamp },
    { id: 'company_dhi', name: 'D.R. Horton (DHI Communities)', createdAt: timestamp, updatedAt: timestamp },
    { id: 'company_bar', name: 'BAR Construction', createdAt: timestamp, updatedAt: timestamp },
    { id: 'company_raywest', name: 'RAYWEST DESIGNBUILD', createdAt: timestamp, updatedAt: timestamp },
  ];

  const projects: Project[] = [
    { id: 'project_riverwalk', name: 'Riverwalk Apartments', companyId: 'company_abc', companyName: 'ABC Construction', stage: 'Bid Development', amount: 486000, nextAction: 'Finish quartz alternate', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_oak_grove', name: 'Oak Grove Phase II', companyId: 'company_greystone', companyName: 'Greystone Builders', stage: 'Bid Sent', amount: 382000, nextAction: 'Follow up with Sarah', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_hampton', name: 'Hampton Inn Greenville', companyId: 'company_choate', companyName: 'Choate Construction', stage: 'Bid Development', nextAction: 'Verify room count', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_collins', name: 'Collins Ridge', companyId: 'company_dhi', companyName: 'D.R. Horton (DHI Communities)', stage: 'Negotiation', amount: 521297.06, lastTouchpoint: '2026-10-01', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_blue_jay', name: 'Blue Jay Park', companyId: 'company_bar', companyName: 'BAR Construction', stage: 'Bid Sent', amount: 14540, lastTouchpoint: '2026-09-30', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_burrito', name: 'Burrito Shak - Kannapolis', companyId: 'company_raywest', companyName: 'RAYWEST DESIGNBUILD', stage: 'Closed Won', amount: 7239, lastTouchpoint: '2026-09-23', createdAt: timestamp, updatedAt: timestamp },
    { id: 'project_twin_lakes', name: 'Twin Lakes IL', companyId: 'company_choate', companyName: 'Choate Construction', stage: 'Discarded', amount: 100000, createdAt: timestamp, updatedAt: timestamp },
  ];

  return { schemaVersion: 1, companies, projects };
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
    dueDate: raw.dueDate,
    amount: typeof raw.amount === 'number' ? raw.amount : undefined,
    nextAction: raw.nextAction,
    lastTouchpoint: raw.lastTouchpoint,
    createdAt: raw.createdAt ?? timestamp,
    updatedAt: raw.updatedAt ?? timestamp,
  };
}

function normalize(raw: unknown): CrmDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<CrmDocument>;
  if (!Array.isArray(candidate.projects) || !Array.isArray(candidate.companies)) return null;
  const timestamp = new Date().toISOString();
  const companies = candidate.companies
    .filter((company): company is Company => Boolean(company && company.id && company.name))
    .map((company) => ({ ...company, createdAt: company.createdAt ?? timestamp, updatedAt: company.updatedAt ?? timestamp }));
  const projects = candidate.projects
    .map((project) => normalizeProject(project, timestamp))
    .filter((project): project is Project => Boolean(project));
  return { schemaVersion: 1, companies, projects };
}

export const localCrmRepository: CrmRepository = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seeded = seedDocument();
        this.save(seeded);
        return seeded;
      }
      const normalized = normalize(JSON.parse(raw));
      if (normalized) {
        this.save(normalized);
        return normalized;
      }
    } catch {
      // Fall through to a clean seed document.
    }
    const seeded = seedDocument();
    this.save(seeded);
    return seeded;
  },

  save(document) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
  },
};
