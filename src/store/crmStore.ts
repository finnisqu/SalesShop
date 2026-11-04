import { create } from 'zustand';
import { localCrmRepository } from '../data/crmRepository';
import { supabase } from '../lib/supabase';
import { applyProjectStageTransition } from '../services/boardIntegrity';
import {
  companyIdentityMatches,
  contactIdentityMatches,
  mergeCompanyCrmDocument,
  mergeContactCrmDocument,
  normalizeCompanyIdentity,
} from '../services/crmIdentity';
import { deleteNormalizedProject,deleteNormalizedCrmRecord } from '../services/normalizedCrmSync';
import type {
  Activity,
  ActivityInput,
  Company,
  CompanyKind,
  CompanyPatch,
  Contact,
  ContactInput,
  ContactPatch,
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
  mergeCompanyRecords: (primaryId: string, duplicateId: string) => void;
  createContact: (input: ContactInput) => string | null;
  updateContact: (contactId: string, patch: ContactPatch) => void;
  mergeContactRecords: (primaryId: string, duplicateId: string) => void;
  relinkProjectCompany: (projectId: string, companyId: string) => void;
  relinkContactCompany: (contactId: string, companyId?: string) => void;
  resolveContact: (input: ContactInput) => string | undefined;
  createProject: (name: string, stage?: ProjectStage, details?: CreateProjectDetails) => string | null;
  updateProject: (projectId: string, patch: ProjectPatch, context?: StageChangeContext) => void;
  moveProject: (projectId: string, stage: ProjectStage, context?: StageChangeContext) => void;
  deleteProject: (projectId: string) => void;
  deleteContact: (contactId:string)=>Promise<void>;
  deleteCompany: (companyId:string)=>Promise<void>;
  deleteActivity:(activityId:string)=>Promise<void>;
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
  const matches = companyIdentityMatches(companies, cleanName);
  if (matches.length === 1) return { companies, companyId: matches[0].id, companyName: matches[0].name };
  if (matches.length > 1) return { companies, companyId: undefined, companyName: cleanName };
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
    ? `${context.quoteNumber} moved deal from ${from} to ${to}`
    : `Deal moved from ${from} to ${to}`;
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
    const companies = get().companies.map((company) => {
      if (company.id !== companyId) return company;
      const nextName = patch.name?.trim() || company.name;
      const aliases = [...(patch.aliases ?? company.aliases ?? [])];
      if (normalizeCompanyIdentity(nextName) !== normalizeCompanyIdentity(company.name)) aliases.push(company.name);
      const seen = new Set<string>();
      const normalizedAliases = aliases.filter((alias) => {
        const clean = alias.trim();
        const key = normalizeCompanyIdentity(clean);
        if (!key || key === normalizeCompanyIdentity(nextName) || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).map((alias) => alias.trim());
      return { ...company, ...patch, name: nextName, aliases: normalizedAliases, updatedAt: timestamp };
    });
    persist(companies, get().contacts, get().projects, get().activities);
    set({ companies });
  },

  mergeCompanyRecords: (primaryId, duplicateId) => {
    const timestamp = now();
    const document = mergeCompanyCrmDocument({
      schemaVersion: 3,
      companies: get().companies,
      contacts: get().contacts,
      projects: get().projects,
      activities: get().activities,
    }, primaryId, duplicateId, timestamp);
    persist(document.companies, document.contacts, document.projects, document.activities);
    set({
      companies: document.companies,
      contacts: document.contacts,
      projects: document.projects,
      activities: document.activities,
    });
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

  updateContact: (contactId, patch) => {
    const timestamp = now();
    const contacts = get().contacts.map((contact) => contact.id === contactId
      ? {
          ...contact,
          ...patch,
          name: patch.name?.trim() || contact.name,
          email: patch.email?.trim() || (patch.email === '' ? undefined : contact.email),
          phone: patch.phone?.trim() || (patch.phone === '' ? undefined : contact.phone),
          title: patch.title?.trim() || (patch.title === '' ? undefined : contact.title),
          updatedAt: timestamp,
        }
      : contact);
    persist(get().companies, contacts, get().projects, get().activities);
    set({ contacts });
  },

  resolveContact: (input) => {
    const matches = contactIdentityMatches(get().contacts, input);
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) return undefined;
    return get().createContact(input) ?? undefined;
  },

  mergeContactRecords: (primaryId, duplicateId) => {
    const timestamp = now();
    const document = mergeContactCrmDocument({
      schemaVersion: 3,
      companies: get().companies,
      contacts: get().contacts,
      projects: get().projects,
      activities: get().activities,
    }, primaryId, duplicateId, timestamp);
    persist(document.companies, document.contacts, document.projects, document.activities);
    set({ contacts: document.contacts, activities: document.activities });
  },

  relinkProjectCompany: (projectId, companyId) => {
    const company = get().companies.find((candidate) => candidate.id === companyId);
    if (!company) return;
    const timestamp = now();
    const projects = get().projects.map((project) => project.id === projectId
      ? { ...project, companyId: company.id, companyName: company.name, updatedAt: timestamp }
      : project);
    persist(get().companies, get().contacts, projects, get().activities);
    set({ projects });
  },

  relinkContactCompany: (contactId, companyId) => {
    if (companyId && !get().companies.some((company) => company.id === companyId)) return;
    const timestamp = now();
    const contacts = get().contacts.map((contact) => contact.id === contactId
      ? { ...contact, companyId, updatedAt: timestamp }
      : contact);
    persist(get().companies, contacts, get().projects, get().activities);
    set({ contacts });
  },

  recordActivity: (input) => {
    const auth=useAuthStore.getState();
    const actor=auth.mode==='cloud'?auth.user?.id:undefined;
    const activity: Activity = {
      ...input,
      id: input.id ?? id('activity'),
      occurredAt: input.occurredAt ?? now(),
      // The normalized activities table already persists this JSON metadata;
      // no new SQL column or change to record permissions is required.
      metadata:actor?{...input.metadata,recordedByUserId:actor}:input.metadata,
    };
    const activities = [...get().activities, activity];
    const touchpoint=activity.type==='manual-touchpoint'||activity.type==='notebook-touchpoint';
    const day=new Date(activity.occurredAt);
    const dayKey=Number.isFinite(day.getTime())
      ?[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-')
      :null;
    const projectId=activity.projectId||'',touchDay=dayKey||'';
    const projects=touchpoint&&projectId&&touchDay
      ?get().projects.map(p=>p.id===projectId&&(!p.lastTouchpoint||p.lastTouchpoint<touchDay)
       ?{...p,lastTouchpoint:touchDay,updatedAt:now()}:p):get().projects;
    persist(get().companies, get().contacts, projects, activities);
    set({ activities,projects });
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
      summary: details.quoteNumber ? `Deal created from ${details.quoteNumber} in ${stage}` : `Deal created in ${stage}`,
      projectId: project.id,
      companyId: project.companyId,
      quoteId: details.quoteId,
      occurredAt: timestamp,
      metadata: { source: details.source ?? 'manual', quoteNumber: details.quoteNumber,
        amount: project.amount, toStage: stage,
        recordedByUserId:useAuthStore.getState().mode==='cloud'
          ?useAuthStore.getState().user?.id:undefined },
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

  deleteActivity:async(activityId)=>{
    const current=get().activities.find(a=>a.id===activityId);
    if(!current)return;
    if(current.type!=='manual-touchpoint'&&current.type!=='notebook-touchpoint')
      throw new Error('Automatic CRM audit history cannot be removed from this cleanup tool.');
    const organizationId=cloudOrganizationId();
    if(organizationId)await deleteNormalizedCrmRecord(organizationId,'activities',activityId);
    const activities=get().activities.filter(a=>a.id!==activityId);
    persist(get().companies,get().contacts,get().projects,activities);
    set({activities});
  },
  deleteContact:async(contactId)=>{
    const current=get();
    if(!current.contacts.some(contact=>contact.id===contactId))return;
    if(current.activities.some(a=>a.contactId===contactId))
     throw new Error('This person has Activity history. Preserve the CRM links or review those records first.');
    const organizationId=cloudOrganizationId();
    if(organizationId)await deleteNormalizedCrmRecord(organizationId,'contacts',contactId);
    const contacts=get().contacts.filter(contact=>contact.id!==contactId);
    persist(get().companies,contacts,get().projects,get().activities);
    set({contacts});
  },
  deleteCompany:async(companyId)=>{
    const current=get();
    if(!current.companies.some(company=>company.id===companyId))return;
    if(current.contacts.some(c=>c.companyId===companyId)||
       current.projects.some(d=>d.companyId===companyId)||
       current.activities.some(a=>a.companyId===companyId))
      throw new Error('This company still has People, Deals, or Activities linked to it.');
    const organizationId=cloudOrganizationId();
    if(organizationId)await deleteNormalizedCrmRecord(organizationId,'companies',companyId);
    const companies=get().companies.filter(company=>company.id!==companyId);
    persist(companies,get().contacts,get().projects,get().activities);
    set({companies});
  },
  deleteProject: (projectId) => {
    const organizationId = cloudOrganizationId();
    const projects = get().projects.filter((project) => project.id !== projectId);
    persist(get().companies, get().contacts, projects, get().activities);
    set({ projects });
    if (organizationId) void deleteNormalizedProject(organizationId, projectId).catch(reportCloudDeleteError);
  },
}));
