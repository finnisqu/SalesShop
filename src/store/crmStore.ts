import { create } from 'zustand';
import { localCrmRepository } from '../data/crmRepository';
import type {
  Activity,
  ActivityInput,
  Company,
  CreateProjectDetails,
  CrmDocument,
  Project,
  ProjectPatch,
  ProjectStage,
  StageChangeContext,
} from '../types/crm';

interface CrmState {
  companies: Company[];
  projects: Project[];
  activities: Activity[];
  hydrated: boolean;
  hydrate: () => void;
  createProject: (name: string, stage?: ProjectStage, details?: CreateProjectDetails) => string | null;
  updateProject: (projectId: string, patch: ProjectPatch, context?: StageChangeContext) => void;
  moveProject: (projectId: string, stage: ProjectStage, context?: StageChangeContext) => void;
  deleteProject: (projectId: string) => void;
  recordActivity: (activity: ActivityInput) => string;
}

const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

function persist(companies: Company[], projects: Project[], activities: Activity[]) {
  const document: CrmDocument = { schemaVersion: 2, companies, projects, activities };
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

function stageSummary(from: ProjectStage, to: ProjectStage, context?: StageChangeContext) {
  return context?.quoteNumber
    ? `${context.quoteNumber} moved project from ${from} to ${to}`
    : `Project moved from ${from} to ${to}`;
}

export const useCrmStore = create<CrmState>((set, get) => ({
  companies: [],
  projects: [],
  activities: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const document = localCrmRepository.load();
    set({ companies: document.companies, projects: document.projects, activities: document.activities, hydrated: true });
  },

  recordActivity: (input) => {
    const activity: Activity = {
      ...input,
      id: id('activity'),
      occurredAt: input.occurredAt ?? now(),
    };
    const activities = [...get().activities, activity];
    persist(get().companies, get().projects, activities);
    set({ activities });
    return activity.id;
  },

  createProject: (name, stage = 'Discovery', details = {}) => {
    const cleanName = name.trim();
    if (!cleanName) return null;
    const timestamp = now();
    const ensured = ensureCompany(get().companies, details.companyName, timestamp);
    const project: Project = {
      id: id('project'),
      name: cleanName,
      companyId: ensured.companyId,
      companyName: ensured.companyName,
      stage,
      amount: typeof details.amount === 'number' && Number.isFinite(details.amount) ? details.amount : undefined,
      lastTouchpoint: details.lastTouchpoint,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const projects = [project, ...get().projects];
    const activity: Activity = {
      id: id('activity'),
      type: 'project-created',
      summary: details.quoteNumber ? `Project created from ${details.quoteNumber} in ${stage}` : `Project created in ${stage}`,
      projectId: project.id,
      companyId: project.companyId,
      quoteId: details.quoteId,
      occurredAt: timestamp,
      metadata: { source: details.source ?? 'manual', quoteNumber: details.quoteNumber, amount: project.amount, toStage: stage },
    };
    const activities = [...get().activities, activity];
    persist(ensured.companies, projects, activities);
    set({ companies: ensured.companies, projects, activities });
    return project.id;
  },

  updateProject: (projectId, patch, context) => {
    const timestamp = now();
    let companies = get().companies;
    let normalizedCompany: { companyId?: string; companyName?: string } | undefined;
    if (Object.prototype.hasOwnProperty.call(patch, 'companyName')) {
      const ensured = ensureCompany(companies, patch.companyName, timestamp);
      companies = ensured.companies;
      normalizedCompany = { companyId: ensured.companyId, companyName: ensured.companyName };
    }

    const current = get().projects.find((project) => project.id === projectId);
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

    let activities = get().activities;
    if (current && patch.stage && patch.stage !== current.stage) {
      activities = [...activities, {
        id: id('activity'),
        type: 'project-stage-changed',
        summary: stageSummary(current.stage, patch.stage, context),
        projectId,
        companyId: current.companyId,
        quoteId: context?.quoteId,
        occurredAt: timestamp,
        metadata: { source: context?.source ?? 'manual', quoteNumber: context?.quoteNumber, fromStage: current.stage, toStage: patch.stage },
      }];
    }

    persist(companies, projects, activities);
    set({ companies, projects, activities });
  },

  moveProject: (projectId, stage, context) => {
    const current = get().projects.find((project) => project.id === projectId);
    if (!current || current.stage === stage) return;
    const timestamp = now();
    const projects = get().projects.map((project) =>
      project.id === projectId ? { ...project, stage, updatedAt: timestamp } : project,
    );
    const activity: Activity = {
      id: id('activity'),
      type: 'project-stage-changed',
      summary: stageSummary(current.stage, stage, context),
      projectId,
      companyId: current.companyId,
      quoteId: context?.quoteId,
      occurredAt: timestamp,
      metadata: { source: context?.source ?? 'manual', quoteNumber: context?.quoteNumber, fromStage: current.stage, toStage: stage },
    };
    const activities = [...get().activities, activity];
    persist(get().companies, projects, activities);
    set({ projects, activities });
  },

  deleteProject: (projectId) => {
    const projects = get().projects.filter((project) => project.id !== projectId);
    persist(get().companies, projects, get().activities);
    set({ projects });
  },
}));
