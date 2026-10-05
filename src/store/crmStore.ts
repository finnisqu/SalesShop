import { create } from 'zustand';
import { localCrmRepository } from '../data/crmRepository';
import type { Company, CrmDocument, Project, ProjectPatch, ProjectStage } from '../types/crm';

interface CrmState {
  companies: Company[];
  projects: Project[];
  hydrated: boolean;
  hydrate: () => void;
  createProject: (name: string, stage?: ProjectStage) => string | null;
  updateProject: (projectId: string, patch: ProjectPatch) => void;
  moveProject: (projectId: string, stage: ProjectStage) => void;
  deleteProject: (projectId: string) => void;
}

const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

function persist(companies: Company[], projects: Project[]) {
  const document: CrmDocument = { schemaVersion: 1, companies, projects };
  localCrmRepository.save(document);
}

function ensureCompany(companies: Company[], companyName: string | undefined, timestamp: string) {
  const cleanName = companyName?.trim();
  if (!cleanName) return { companies, companyId: undefined, companyName: undefined };
  const existing = companies.find((company) => company.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) return { companies, companyId: existing.id, companyName: existing.name };
  const company: Company = {
    id: id('company'),
    name: cleanName,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { companies: [...companies, company], companyId: company.id, companyName: company.name };
}

export const useCrmStore = create<CrmState>((set, get) => ({
  companies: [],
  projects: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const document = localCrmRepository.load();
    set({ companies: document.companies, projects: document.projects, hydrated: true });
  },

  createProject: (name, stage = 'Discovery') => {
    const cleanName = name.trim();
    if (!cleanName) return null;
    const timestamp = now();
    const project: Project = {
      id: id('project'),
      name: cleanName,
      stage,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const projects = [project, ...get().projects];
    persist(get().companies, projects);
    set({ projects });
    return project.id;
  },

  updateProject: (projectId, patch) => {
    const timestamp = now();
    let companies = get().companies;
    let normalizedCompany: { companyId?: string; companyName?: string } | undefined;
    if (Object.prototype.hasOwnProperty.call(patch, 'companyName')) {
      const ensured = ensureCompany(companies, patch.companyName, timestamp);
      companies = ensured.companies;
      normalizedCompany = { companyId: ensured.companyId, companyName: ensured.companyName };
    }

    const projects = get().projects.map((project) => {
      if (project.id !== projectId) return project;
      return {
        ...project,
        ...patch,
        ...(normalizedCompany ?? {}),
        name: patch.name?.trim() || project.name,
        amount: typeof patch.amount === 'number' && Number.isFinite(patch.amount) ? patch.amount : patch.amount,
        updatedAt: timestamp,
      };
    });
    persist(companies, projects);
    set({ companies, projects });
  },

  moveProject: (projectId, stage) => {
    const timestamp = now();
    const projects = get().projects.map((project) =>
      project.id === projectId ? { ...project, stage, updatedAt: timestamp } : project,
    );
    persist(get().companies, projects);
    set({ projects });
  },

  deleteProject: (projectId) => {
    const projects = get().projects.filter((project) => project.id !== projectId);
    persist(get().companies, projects);
    set({ projects });
  },
}));
