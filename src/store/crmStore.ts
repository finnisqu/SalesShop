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
import {canEditTeamArea} from '../services/teamDepartments';
import {useRolePerspectiveStore} from './rolePerspectiveStore';
import {useQuoteStore} from './quoteStore';
import {canDeleteAutomaticCrmHistory} from '../services/recordManagementActivity';

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
  /** Server-confirmed, conflict-aware reassignment; no optimistic silent save. */
  assignProject: (projectId:string,assignedUserId?:string)=>Promise<void>;
  updateProject: (projectId: string, patch: ProjectPatch, context?: StageChangeContext) => void;
  /** Record an externally delivered bid without creating a native SalesShop quote. */
  recordExternalQuoteSent: (projectId:string, amount:number, bidSentDate:string, format?:string)=>boolean;
  moveProject: (projectId: string, stage: ProjectStage, context?: StageChangeContext) => void;
  deleteProject: (projectId: string) => void;
  deleteContact: (contactId:string)=>Promise<void>;
  deleteCompany: (companyId:string)=>Promise<void>;
  deleteActivity:(activityId:string,orphanedDraftAudit?:boolean,administrativeHistory?:boolean)=>Promise<void>;
  /** Local cache cleanup ONLY after server-confirmed quote practice purge. */
  discardPurgedQuoteActivities:(quoteId:string,activityIds:readonly string[])=>void;
  deleteCleanProject:(projectId:string)=>Promise<void>;
  recordActivity: (activity: ActivityInput) => string;
  updateActivity: (id:string,patch:Pick<Activity,'summary'|'occurredAt'|'metadata'|
   'contactId'|'companyId'|'projectId'|'quoteId'>)=>Promise<void>;
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

  updateActivity:async(activityId,patch)=>{
    const auth=useAuthStore.getState();
    const source=get().activities.find(item=>item.id===activityId);
    if(!source||source.type!=='manual-touchpoint')
      throw new Error('Only manually logged interactions can be edited here.');
    if(auth.mode==='cloud'){
      if(!auth.organizationId||!supabase||!canEditTeamArea(auth.teamRole,auth.teamDepartment,'crm'))
        throw new Error('You do not have permission to edit this interaction.');
      if(source.metadata?.recordedByUserId&&source.metadata.recordedByUserId!==auth.user?.id&&
        auth.teamRole!=='owner'&&auth.teamRole!=='admin')
        throw new Error('You can edit your own interactions, but not another salesperson’s log.');
    }
    if(!patch.summary.trim()||!Number.isFinite(new Date(patch.occurredAt).getTime())||
       new Date(patch.occurredAt).getTime()>Date.now()+60000)
      throw new Error('Choose a valid completed interaction date and description.');
    const metadata={
      ...source.metadata,...patch.metadata,
      recordedByUserId:source.metadata?.recordedByUserId??auth.user?.id,
      editedAt:now(),editedByUserId:auth.user?.id,
    };
    const next:Activity={...source,...patch,summary:patch.summary.trim(),metadata};
    const organizationId=auth.mode==='cloud'?auth.organizationId:null;
    if(organizationId&&supabase){
      // Confirm the normalized row was updated before changing the local cache.
      const {data,error}=await supabase.from('activities').update({
        summary:next.summary,occurred_at:next.occurredAt,
        contact_id:next.contactId??null,company_id:next.companyId??null,
        project_id:next.projectId??null,quote_id:next.quoteId??null,
        metadata:next.metadata,
      }).eq('organization_id',organizationId).eq('id',activityId).select('id');
      if(error)throw error;
      if(!data?.length)throw new Error('Activity update was not confirmed. Check your permissions and try again.');
      const afterAuth=useAuthStore.getState();
      if(afterAuth.mode!=='cloud'||afterAuth.organizationId!==organizationId||
         afterAuth.user?.id!==auth.user?.id)
        throw new Error('Account or workspace changed while saving. Reopen the activity in the current account.');
    }
    const activities=get().activities.map(item=>item.id===activityId?next:item);
    persist(get().companies,get().contacts,get().projects,activities);
    set({activities});
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
      pipeline: details.pipeline,
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

  assignProject:async(projectId,assignedUserId)=>{
    const current=get().projects.find(p=>p.id===projectId);
    if(!current)throw new Error('Deal is no longer available.');
    const selected=assignedUserId||undefined;
    if((current.assignedUserId||undefined)===selected)return;
    const auth=useAuthStore.getState();
    if(auth.mode==='cloud'){
      if(!auth.organizationId||!auth.user?.id||!supabase||
         !canEditTeamArea(auth.teamRole,auth.teamDepartment,'crm'))
        throw new Error('You do not have permission to assign Deals.');
      if(selected&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selected))
        throw new Error('Choose a valid teammate.');
      const organizationId=auth.organizationId;
      const updatedAt=now();
      let query=supabase.from('projects').update({
         assigned_user_id:selected??null,updated_at:updatedAt,
       }).eq('organization_id',organizationId).eq('id',projectId);
      // Compare-and-swap prevents an older tab from silently reassigning
      // another salesperson's Deal. RLS enforces editor permission; a
      // composite membership FK rejects cross-company assignees.
      query=current.assignedUserId
        ?query.eq('assigned_user_id',current.assignedUserId)
        :query.is('assigned_user_id',null);
      const {data,error}=await query.select('assigned_user_id,updated_at').maybeSingle();
      if(error)throw error;
      if(!data)throw new Error('This Deal assignment changed elsewhere, or the Deal is still saving. Refresh and try again.');
      const latestAuth=useAuthStore.getState();
      if(latestAuth.mode!=='cloud'||latestAuth.user?.id!==auth.user.id||
         latestAuth.organizationId!==organizationId)
        throw new Error('Workspace changed during assignment. Reopen the Deal in the current account.');
      const latest=get().projects.find(p=>p.id===projectId);
      if(!latest||latest.assignedUserId!==current.assignedUserId)
        throw new Error('Deal changed during assignment. Refresh before making further changes.');
      const serverTime=String(data.updated_at??updatedAt);
      const nextTime=Date.parse(serverTime)>Date.parse(latest.updatedAt)?serverTime:now();
      const projects=get().projects.map(p=>p.id===projectId
        ?{...p,assignedUserId:selected,updatedAt:nextTime}:p);
      persist(get().companies,get().contacts,projects,get().activities);
      set({projects});
      return;
    }
    if(selected)throw new Error('Team assignments require a connected workspace.');
  },

  updateProject: (projectId, patch, context) => {
    const current = get().projects.find((project) => project.id === projectId);
    if (!current) return;
    const timestamp = now();
    let companies = get().companies;
    let normalizedCompany: { companyId?: string; companyName?: string } | undefined;
    if (Object.prototype.hasOwnProperty.call(patch, 'companyName')) {
      const ensured = ensureCompany(companies, patch.companyName, timestamp);
      companies = ensured.companies;
      normalizedCompany = { companyId: ensured.companyId, companyName: ensured.companyName };
    }

    // Stage, name and pipeline updates must never wipe a Deal's value.
    // An explicit undefined clears it; a non-finite value is ignored.
    const amount = !Object.prototype.hasOwnProperty.call(patch, 'amount')
      ? current.amount
      : patch.amount === undefined || (typeof patch.amount === 'number' && Number.isFinite(patch.amount))
        ? patch.amount : current.amount;
    const stageTransition = patch.stage
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
        amount,
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

  recordExternalQuoteSent:(projectId,amount,bidSentDate,format)=>{
    const current=get().projects.find(project=>project.id===projectId);
    if(!current||!Number.isFinite(amount)||amount<0||
       !/^\d{4}-\d{2}-\d{2}$/.test(bidSentDate)||
       Number.isNaN(new Date(bidSentDate+'T12:00:00').getTime())||
       ['Closed Won','Completed','Closed Lost','Discarded'].includes(current.stage))return false;
    // Preserve more advanced stages if a previous bid was already recorded.
    const requestedStage:ProjectStage=
      ['Discovery','Intent to Bid','Bid Development'].includes(current.stage)?'Bid Sent':current.stage;
    const occurredAt=new Date(bidSentDate+'T12:00:00').toISOString();
    const transition=applyProjectStageTransition(current,requestedStage,get().activities,occurredAt);
    if(transition.blockedReason)return false;
    const timestamp=now();
    const projects=get().projects.map(project=>project.id===projectId
      ?{...project,stage:transition.project.stage,
        stageChangedAt:transition.changed?occurredAt:project.stageChangedAt,
        amount,dueDate:undefined,
        lastTouchpoint:!project.lastTouchpoint||project.lastTouchpoint<bidSentDate
          ?bidSentDate:project.lastTouchpoint,
        updatedAt:timestamp}:project);
    const actor=useAuthStore.getState();
    const activity:Activity={
      id:id('activity'),type:'quote-sent',projectId,
      companyId:current.companyId,occurredAt,
      summary:'External quote sent · '+new Intl.NumberFormat('en-US',{
        style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2,
      }).format(amount),
      metadata:{
        source:'manual',documentType:'quote',amount,
        externalQuoteSent:true,externalQuoteFormat:format?.trim().slice(0,120)||undefined,
        bidSentDate,bidDueDate:current.dueDate,
        fromStage:current.stage,toStage:transition.project.stage,
        recordedByUserId:actor.mode==='cloud'?actor.user?.id:undefined,
      },
    };
    const activities=[...get().activities,activity];
    // One CRM persistence update keeps deal value, submission date and history together.
    persist(get().companies,get().contacts,projects,activities);
    set({projects,activities});
    return true;
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

  discardPurgedQuoteActivities:(quoteId,activityIds)=>{
    if(!activityIds.length)return;
    const ids=new Set(activityIds);
    const current=get(),activities=current.activities.filter(a=>
      !(a.quoteId===quoteId&&ids.has(a.id)));
    if(activities.length===current.activities.length)return;
    persist(current.companies,current.contacts,current.projects,activities);
    set({activities});
  },
  deleteActivity:async(activityId,orphanedDraftAudit=false,administrativeHistory=false)=>{
    const current=get().activities.find(a=>a.id===activityId);
    if(!current)return;
    const removableManual=current.type==='manual-touchpoint'||current.type==='notebook-touchpoint';
    const orphanedSetup=orphanedDraftAudit&&!!current.quoteId&&
      (current.type==='quote-created'||current.type==='quote-linked');
    const auth=useAuthStore.getState();
    const permittedAdmin=administrativeHistory&&
     !useRolePerspectiveStore.getState().activePerspective&&
     (auth.mode==='local'||auth.teamRole==='owner'||auth.teamRole==='admin');
    const removableAuto=permittedAdmin&&
     canDeleteAutomaticCrmHistory(current,useQuoteStore.getState().quotes);
    if(!removableManual&&!orphanedSetup&&!removableAuto)
      throw new Error('Automatic CRM history is protected outside Settings Data Management.');
    const organizationId=cloudOrganizationId();
    if(organizationId)await deleteNormalizedCrmRecord(organizationId,'activities',activityId);
    const activities=get().activities.filter(a=>a.id!==activityId);
    persist(get().companies,get().contacts,get().projects,activities);
    set({activities});
  },
  deleteCleanProject:async(projectId)=>{
    const current=get();
    if(!current.projects.some(project=>project.id===projectId))return;
    const toRemove=current.activities.filter(a=>a.projectId===projectId&&
     (a.type==='project-created'||a.type==='project-stage-changed')).map(a=>a.id);
    if(current.activities.some(a=>(a.projectId===projectId||
      a.metadata?.relatedRecords?.some(link=>link.type==='project'&&link.id===projectId))
      &&!toRemove.includes(a.id)))
      throw new Error('This Deal has additional CRM history that must be reviewed first.');
    const organizationId=cloudOrganizationId();
    if(organizationId){
      // Delete only automatic creation/stage events before the unlinked Deal.
      for(const id of toRemove)await deleteNormalizedCrmRecord(organizationId,'activities',id);
      await deleteNormalizedCrmRecord(organizationId,'projects',projectId);
    }
    const projects=get().projects.filter(project=>project.id!==projectId);
    const activities=get().activities.filter(a=>!toRemove.includes(a.id));
    persist(get().companies,get().contacts,projects,activities);
    set({projects,activities});
  },
  deleteContact:async(contactId)=>{
    const current=get();
    if(!current.contacts.some(contact=>contact.id===contactId))return;
    const creationIds=current.activities.filter(a=>a.contactId===contactId&&
     a.type==='contact-created').map(a=>a.id);
    if(current.activities.some(a=>(a.contactId===contactId||
      a.metadata?.relatedRecords?.some(link=>link.type==='contact'&&link.id===contactId))
      &&!creationIds.includes(a.id)))
     throw new Error('This person has additional Activity history. Review it before deleting.');
    const organizationId=cloudOrganizationId();
    if(organizationId){
      for(const id of creationIds)await deleteNormalizedCrmRecord(organizationId,'activities',id);
      await deleteNormalizedCrmRecord(organizationId,'contacts',contactId);
    }
    const contacts=get().contacts.filter(contact=>contact.id!==contactId);
    const activities=get().activities.filter(a=>!creationIds.includes(a.id));
    persist(get().companies,contacts,get().projects,activities);
    set({contacts,activities});
  },
  deleteCompany:async(companyId)=>{
    const current=get();
    if(!current.companies.some(company=>company.id===companyId))return;
    if(current.contacts.some(c=>c.companyId===companyId)||
       current.projects.some(d=>d.companyId===companyId)||
       current.activities.some(a=>a.companyId===companyId||
         a.metadata?.relatedRecords?.some(link=>link.type==='company'&&link.id===companyId)))
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
