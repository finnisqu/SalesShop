import { create } from 'zustand';
import { localCrmRepository } from '../data/crmRepository';
import { supabase } from '../lib/supabase';
import { applyProjectStageTransition } from '../services/boardIntegrity';
import { deleteNormalizedProject } from '../services/normalizedCrmSync';
import type {
  Activity,
  ActivityInput,
  Company,
  CompanyKind,
  CompanyPatch,
  Contact,
  ContactInput,
  CreateProjectDetails,
  CrmDocument,
  Project,
  ProjectPatch,
  ProjectStage,
  StageChangeContext,
} from '../types/crm';
import { useAuthStore } from './authStore';

interface CrmState {
  companies: Company[];
  contacts: Contact[];
  projects: Project[];
  activities: Activity[];
  hydrated: boolean;
  hydrate: () => void;
  resolveCompany: (name?: string, kind?: CompanyKind) => string | undefined;
  updateCompany: (companyId: string, patch: CompanyPatch) => void;
  createContact: (input: ContactInput) => string | null;
  resolveContact: (input: ContactInput) => string | undefined;
  createProject: (name: string, stage?: ProjectStage, details?: CreateProjectDetails) => string | null;
  updateProject: (projectId: string, patch: ProjectPatch, context?: StageChangeContext) => void;
  moveProject: (projectId: string, stage: ProjectStage, context?: StageChangeContext) => void;
  deleteProject: (projectId: string) => void;
  recordActivity: (activity: ActivityInput) => string;
}

const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const now = () => new Date().toISOString();

function persist(companies: Company[], contacts: Contact[], projects: Project[], activities: Activity[]) {
  const document: CrmDocument = { schemaVersion: 3, companies, contacts, projects, activities };
  localCrmRepository.save(document);
}

function cloudOrganizationId() {
  const auth = useAuthStore.getState();
  return supabase && auth.mode === 'cloud' ? auth.organizationId : null;
}

function reportCloudDeleteError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Cloud delete failed.';
  useAuthStore.setState({ error: `Cloud sync: ${message}` });
}

function ensureCompany(companies: Company[], companyName: string | undefined, timestamp: string, kind: CompanyKind = 'customer') {
  const cleanName = companyName?.trim();
  if (!cleanName) return { companies, companyId: undefined, companyName: undefined };
  const existing = companies.find((company) => company.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) return { companies, companyId: existing.id, companyName: existing.name };
  const company: Company = {
    id: id('company'),
    name: cleanName,
    kind,
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
  contacts: [],
  projects: [],
  activities: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const document = localCrmRepository.load();
    set({
      companies: document.companies,
      contacts: document.contacts,
      projects: document.projects,
      activities: document.activities,
      hydrated: true,
    });
  },

  resolveCompany: (name, kind = 'customer') => {
    const timestamp = now();
    const ensured = ensureCompany(get().companies, name, timestamp, kind);
    if (ensured.companies !== get().companies) {
      persist(ensured.companies, get().contacts, get().projects, get().activities);
      set({ companies: ensured.companies });
    }
    return ensured.companyId;
  },

  updateCompany: (companyId, patch) => {
    const timestamp = now();
    const companies = get().companies.map((company) => company.id === companyId
      ? { ...company, ...patch, name: patch.name?.trim() || company.name, updatedAt: timestamp }
      : company);
    persist(companies, get().contacts, get().projects, get().activities);
    set({ companies });
  },

  createContact: (input) => {
    const cleanName = input.name?.trim() || input.email?.trim();
    if (!cleanName) return null;
    const timestamp = now();
    const contact: Contact = {
      id: id('contact'),
      companyId: input.companyId,
      name: cleanName,
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      title: input.title?.trim() || undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const contacts = [...get().contacts, contact];
    const activity: Activity = {
      id: id('activity'),
      type: 'contact-created',
      summary: `${contact.name} added as a contact`,
      companyId: contact.companyId,
      contactId: contact.id,
      quoteId: input.quoteId,
      occurredAt: timestamp,
      metadata: { source: input.source ?? 'manual' },
    };
    const activities = [...get().activities, activity];
    persist(get().companies, contacts, get().projects, activities);
    set({ contacts, activities });
    return contact.id;
  },

  resolveContact: (input) => {
    const cleanEmail = input.email?.trim().toLowerCase();
    const cleanName = input.name?.trim().toLowerCase();
    const existing = get().contacts.find((contact) => {
      if (cleanEmail && contact.email?.trim().toLowerCase() === cleanEmail) return true;
      return Boolean(cleanName && contact.name.trim().toLowerCase() === cleanName && contact.companyId === input.companyId);
    });
    if (existing) return existing.id;
    return get().createContact(input) ?? undefined;
  },

  recordActivity: (input) => {
    const activity: Activity = {
      ...input,
      id: id('activity'),
      occurredAt: input.occurredAt ?? now(),
    };
    const activities = [...get().activities, activity];
    persist(get().companies, get().contacts, get().projects, activities);
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
      stageChangedAt: timestamp,
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
    persist(ensured.companies, get().contacts, projects, activities);
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
    const stageTransition = current && patch.stage
      ? applyProjectStageTransition(current, patch.stage, get().activities, timestamp)
      : null;
    const effectiveStage = stageTransition?.project.stage ?? patch.stage;
    const projects = get().projects.map((project) => {
      if (project.id !== projectId) return project;
      return {
        ...project,
        ...patch,
        ...(effectiveStage ? { stage: effectiveStage } : {}),
        ...(stageTransition?.changed ? { stageChangedAt: timestamp } : {}),
        ...(normalizedCompany ?? {}),
        name: patch.name?.trim() || project.name,
        amount: typeof patch.amount === 'number' && Number.isFinite(patch.amount) ? patch.amount : patch.amount,
        updatedAt: timestamp,
      };
    });

    let activities = get().activities;
    if (current && stageTransition?.changed) {
      activities = [...activities, {
        id: id('activity'),
        type: 'project-stage-changed',
        summary: stageSummary(current.stage, stageTransition.project.stage, context),
        projectId,
        companyId: normalizedCompany?.companyId ?? current.companyId,
        quoteId: context?.quoteId,
        occurredAt: timestamp,
        metadata: { source: context?.source ?? 'manual', quoteNumber: context?.quoteNumber, fromStage: current.stage, toStage: stageTransition.project.stage },
      }];
    }

    persist(companies, get().contacts, projects, activities);
    set({ companies, projects, activities });
  },

  moveProject: (projectId, stage, context) => {
    const current = get().projects.find((project) => project.id === projectId);
    if (!current) return;
    const timestamp = now();
    const transition = applyProjectStageTransition(current, stage, get().activities, timestamp);
    if (!transition.changed) return;
    const projects = get().projects.map((project) =>
      project.id === projectId ? transition.project : project,
    );
    const activity: Activity = {
      id: id('activity'),
      type: 'project-stage-changed',
      summary: stageSummary(current.stage, transition.project.stage, context),
      projectId,
      companyId: current.companyId,
      quoteId: context?.quoteId,
      occurredAt: timestamp,
      metadata: { source: context?.source ?? 'manual', quoteNumber: context?.quoteNumber, fromStage: current.stage, toStage: transition.project.stage },
    };
    const activities = [...get().activities, activity];
    persist(get().companies, get().contacts, projects, activities);
    set({ projects, activities });
  },

  deleteProject: (projectId) => {
    const organizationId = cloudOrganizationId();
    const projects = get().projects.filter((project) => project.id !== projectId);
    persist(get().companies, get().contacts, projects, get().activities);
    set({ projects });
    if (organizationId) void deleteNormalizedProject(organizationId, projectId).catch(reportCloudDeleteError);
  },
}));
