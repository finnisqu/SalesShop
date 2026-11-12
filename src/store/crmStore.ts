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
import {initialCrmOwnerUserId,canReassignCrmOwner} from '../services/crmRecordOwnership';

interface CrmState {
  companies: Company[];
  contacts: Contact[];
  projects: Project[];
  activities: Activity[];
  hydrated: boolean;
  hydrate: () => void;
  resolveCompany: (name?: string, kind?: CompanyKind) => string | undefined;
  updateCompany: (companyId: string, patch: CompanyPatch) => void;
  /** Server-confirmed and conflict-aware owner reassignment; never optimistic. */
  assignCrmRecordOwner:(kind:'company'|'contact',recordId:string,ownerUserId?:string)=>Promise<void>;
  mergeCompanyRecords: (primaryId: string, duplicateId: string) => void;
  createContact: (input: ContactInput) => string | null;
  updateContact: (contactId: string, patch: ContactPatch) => void;
  mergeContactRecords: (primaryId: string, duplicateId: string) => void;
  relinkProjectCompany: (projectId: string, companyId: string) => void;
  /** Apply or clear an exact Deal-to-Company link without manufacturing CRM activity. */
  setProjectCompany: (projectId:string,companyId?:string)=>void;
  relinkContactCompany: (contactId: string, companyId?: string) => void;
  resolveContact: (input: ContactInput) => string | undefined;
  createProject: (name: string, stage?: ProjectStage, details?: CreateProjectDetails) => string | null;
  /** Server-confirmed, conflict-aware reassignment; no optimistic silent save. */
  assignProject: (projectId:string,assignedUserId?:string)=>Promise<void>;
  updateProject: (projectId: string, patch: ProjectPatch, context?: StageChangeContext) => void;
  /** Record an externally delivered bid without creating a native SalesShop quote. */
  recordExternalQuoteSent: (projectId:string, amount:number, bidSentDate:string, format?:string,
    submissionId?:string,recordedAt?:string)=>Promise<boolean>;
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
  /** Correct an existing external Quote Sent record without inserting another
   * submission event, changing Deal stage, or recreating bid completion proof. */
  correctExternalQuoteSent:(activityId:string,correction:{
    bidSentDate:string;amount:number;format?:string;notes?:string;
  })=>Promise<void>;
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
    ownerUserId:initialCrmOwnerUserId(
      useAuthStore.getState().mode,useAuthStore.getState().user?.id),
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

  assignCrmRecordOwner:async(kind,recordId,ownerUserId)=>{
    const current=kind==='company'
      ?get().companies.find(c=>c.id===recordId):get().contacts.find(p=>p.id===recordId);
    if(!current)throw new Error('This record is no longer available.');
    const selected=ownerUserId||undefined;
    if(current.ownerUserId===selected)return;
    const auth=useAuthStore.getState();
    const perspective=Boolean(useRolePerspectiveStore.getState().activePerspective);
    if(!canReassignCrmOwner(auth.teamRole,auth.mode,perspective)||
      !auth.organizationId||!auth.user?.id||!supabase)
      throw new Error('Only organization owners and admins can reassign CRM records.');
    if(selected&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selected))
      throw new Error('Choose a valid teammate.');
    const organizationId=auth.organizationId;
    const actorId=auth.user.id;
    const timestamp=now();
    const table=kind==='company'?'companies':'contacts';
    // Ownership is a separate server-authoritative update. Ordinary CRM
    // upserts intentionally omit owner_user_id so a stale tab cannot revert it.
    // The database trigger independently enforces admin/owner permission, and
    // the organization membership FK disallows cross-workspace assignees.
    let query=supabase.from(table)
      .update({owner_user_id:selected??null,updated_at:timestamp})
      .eq('organization_id',organizationId).eq('id',recordId);
    query=current.ownerUserId?query.eq('owner_user_id',current.ownerUserId):
      query.is('owner_user_id',null);
    const {data,error}=await query.select('owner_user_id,updated_at').maybeSingle();
    if(error)throw error;
    if(!data)throw new Error(
      'Ownership changed elsewhere, or this record has not finished cloud saving. Reopen and retry.');
    const confirmed=typeof data.owner_user_id==='string'?data.owner_user_id:undefined;
    if(confirmed!==selected)
      throw new Error('The server returned an unexpected owner. Reload this record.');
    const latestAuth=useAuthStore.getState();
    if(latestAuth.mode!=='cloud'||latestAuth.organizationId!==organizationId||
      latestAuth.user?.id!==actorId)
      throw new Error('Workspace changed during assignment. Reopen the record in your current account.');
    const latest=kind==='company'
      ?get().companies.find(c=>c.id===recordId):get().contacts.find(p=>p.id===recordId);
    if(!latest||latest.ownerUserId!==current.ownerUserId)
      throw new Error('This record changed while assigning its owner. Reload before another change.');
    const serverTime=String(data.updated_at??timestamp);
    const updatedAt=Date.parse(serverTime)>Date.parse(latest.updatedAt)?serverTime:now();
    if(kind==='company'){
      const companies=get().companies.map(c=>c.id===recordId
        ?{...c,ownerUserId:confirmed,updatedAt}:c);
      persist(companies,get().contacts,get().projects,get().activities);
      set({companies});
    }else{
      const contacts=get().contacts.map(p=>p.id===recordId
        ?{...p,ownerUserId:confirmed,updatedAt}:p);
      persist(get().companies,contacts,get().projects,get().activities);
      set({contacts});
    }
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
      ownerUserId:initialCrmOwnerUserId(
        useAuthStore.getState().mode,useAuthStore.getState().user?.id),
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
      metadata: { source: input.source ?? 'manual',
        recordedByUserId:useAuthStore.getState().mode==='cloud'
          ?useAuthStore.getState().user?.id:undefined },
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

  setProjectCompany:(projectId,companyId)=>{
    const current=get();
    const match=companyId?current.companies.find(c=>c.id===companyId):undefined;
    if(companyId&&!match)throw new Error('This company is not available in the current workspace.');
    if(!current.projects.some(p=>p.id===projectId))
      throw new Error('This Deal is not available in the current workspace.');
    const projects=current.projects.map(p=>p.id===projectId?{
      ...p,companyId:match?.id,companyName:match?.name,updatedAt:now(),
    }:p);
    persist(current.companies,current.contacts,projects,current.activities);
    set({projects});
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
    if(!source||(source.type!=='manual-touchpoint'&&source.type!=='notebook-touchpoint'))
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

  correctExternalQuoteSent:async(activityId,correction)=>{
    const source=get().activities.find(activity=>activity.id===activityId);
    if(!source||source.type!=='quote-sent'||source.metadata?.externalQuoteSent!==true||
      !source.projectId||source.quoteId)
      throw new Error('This is not an editable external quote submission.');
    const auth=useAuthStore.getState();
    if(useRolePerspectiveStore.getState().activePerspective)
      throw new Error('Quote corrections are unavailable in role preview.');
    if(auth.mode==='cloud'&&(!auth.organizationId||!auth.user?.id||!supabase||
      !canEditTeamArea(auth.teamRole,auth.teamDepartment,'crm')))
      throw new Error('Your role cannot correct this CRM quote.');
    if(auth.mode==='cloud'&&source.metadata?.recordedByUserId&&
      source.metadata.recordedByUserId!==auth.user?.id&&
      auth.teamRole!=='owner'&&auth.teamRole!=='admin')
      throw new Error('Only the recorder or a company administrator can correct this submission.');
    const {bidSentDate,amount,format,notes}=correction;
    const day=new Date(bidSentDate+'T12:00:00');
    const dayKey=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),
      String(day.getDate()).padStart(2,'0')].join('-');
    const today=new Date();
    const todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),
      String(today.getDate()).padStart(2,'0')].join('-');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(bidSentDate)||!Number.isFinite(day.getTime())||
      dayKey!==bidSentDate||bidSentDate>todayKey||
      !Number.isFinite(amount)||amount<0)
      throw new Error('Enter a valid past sent date and nonnegative quote amount.');
    const timestamp=now();
    const deal=get().projects.find(project=>project.id===source.projectId);
    const summary='External quote sent · '+new Intl.NumberFormat('en-US',{
      style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2,
    }).format(amount)+' · '+(deal?.name??'Linked Deal');
    const metadata:Activity['metadata']={
      ...source.metadata,
      bidSentDate,amount,
      externalQuoteFormat:format?.trim().slice(0,120)||undefined,
      notes:notes?.trim().slice(0,5000)||undefined,
      editedAt:timestamp,editedByUserId:auth.user?.id,
    };
    const corrected:Activity={...source,summary,occurredAt:day.toISOString(),metadata};
    const organizationId=auth.mode==='cloud'?auth.organizationId:null;
    if(organizationId&&supabase){
      const {data,error}=await supabase.from('activities').update({
        summary:corrected.summary,occurred_at:corrected.occurredAt,
        metadata:corrected.metadata,
      }).eq('organization_id',organizationId).eq('id',activityId)
        .eq('type','quote-sent').select('id,metadata');
      if(error)throw error;
      if(!data?.length)throw new Error('The external quote correction was not confirmed. Please retry.');
      const persisted=data[0].metadata as Activity['metadata'];
      if(persisted?.externalQuoteSent!==true||
        persisted?.bidSentDate!==bidSentDate||Number(persisted?.amount)!==amount)
        throw new Error('The server did not return the expected correction. Reopen this record.');
      const afterAuth=useAuthStore.getState();
      if(afterAuth.mode!=='cloud'||afterAuth.organizationId!==organizationId||
        afterAuth.user?.id!==auth.user?.id)
        throw new Error('Workspace changed during quote correction. Reopen the record.');
    }
    // This is an in-place correction of ONE historical Activity. Do not
    // re-trigger quote delivery, task completion, or project stage transitions.
    const activities=get().activities.map(activity=>activity.id===activityId?corrected:activity);
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
      // Newly created Deals are mine by default; reassignment remains explicit.
      assignedUserId:useAuthStore.getState().mode==='cloud'
        ?useAuthStore.getState().user?.id:undefined,
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
    const hasDeadlineEdit=Object.prototype.hasOwnProperty.call(patch,'dueDate');
    const deadlineChanged=hasDeadlineEdit&&(patch.dueDate??undefined)!==(current.dueDate??undefined);
    const originalDueDate=current.originalDueDate??(current.dueDate||patch.dueDate||undefined);
    const dueDateHistory=deadlineChanged?
      [...(current.dueDateHistory??[]),{
        from:current.dueDate,to:patch.dueDate,at:timestamp,
        responsibility:patch.dueDateResponsibility??'neutral',
        reason:patch.dueDateChangeReason?.trim().slice(0,500)||undefined,
      }]:current.dueDateHistory;
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
        ...(hasDeadlineEdit?{originalDueDate,dueDateHistory}:{}),
         ...(deadlineChanged?{
           dueDateResponsibility:patch.dueDateResponsibility??'neutral',
           dueDateChangeReason:patch.dueDateChangeReason??undefined,
         }:{}),
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

  recordExternalQuoteSent:async(projectId,amount,bidSentDate,format,submissionId,recordedAt)=>{
    const current=get().projects.find(project=>project.id===projectId);
    const sentAt=new Date(bidSentDate+'T12:00:00');
    if(!current||!Number.isFinite(amount)||amount<0||
       !/^\d{4}-\d{2}-\d{2}$/.test(bidSentDate)||
       !Number.isFinite(sentAt.getTime())||
       [sentAt.getFullYear(),String(sentAt.getMonth()+1).padStart(2,'0'),
        String(sentAt.getDate()).padStart(2,'0')].join('-')!==bidSentDate||
       new Date(bidSentDate+'T00:00:00').getTime()>Date.now())return false;
    const historical=['Closed Won','Completed','Closed Lost','Discarded'].includes(current.stage);
    const requestedStage:ProjectStage=
      ['Discovery','Intent to Bid','Bid Development'].includes(current.stage)?'Bid Sent':current.stage;
    const occurredAt=sentAt.toISOString();
    const transition=historical?{project:current,changed:false}:
      applyProjectStageTransition(current,requestedStage,get().activities,occurredAt);
    if('blockedReason' in transition&&transition.blockedReason)return false;
    const timestamp=now();
    const projects=historical?get().projects:get().projects.map(project=>project.id===projectId
      ?{...project,stage:transition.project.stage,
        stageChangedAt:transition.changed?occurredAt:project.stageChangedAt,
        amount,dueDate:undefined,
        lastTouchpoint:!project.lastTouchpoint||project.lastTouchpoint<bidSentDate
          ?bidSentDate:project.lastTouchpoint,
        updatedAt:timestamp}:project);
    const actor=useAuthStore.getState();
    const activity:Activity={
      id:submissionId??id('activity'),type:'quote-sent',projectId,
      companyId:current.companyId,occurredAt,
      summary:'External quote sent · '+new Intl.NumberFormat('en-US',{
        style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2,
      }).format(amount)+' · '+current.name,
      metadata:{
        source:'manual',documentType:'quote',amount,
        externalQuoteSent:true,externalQuoteFormat:format?.trim().slice(0,120)||undefined,
        bidSentDate,bidDueDate:current.dueDate,
        fromStage:current.stage,toStage:transition.project.stage,
        recordedAt:recordedAt??timestamp,
        recordedByUserId:actor.mode==='cloud'?actor.user?.id:undefined,
      },
    };
    if(actor.mode==='cloud'){
      if(!supabase||!actor.organizationId||!actor.user?.id||
         !canEditTeamArea(actor.teamRole,actor.teamDepartment,'crm'))
        throw new Error('You cannot record external quotes in this workspace.');
      // The previous flow closed the form after a local cache write, even if
      // the asynchronous CRM cloud sync subsequently failed. A successful
      // submission now requires a confirmed remote Activity row. The same
      // client-generated ID is reused on retry to avoid double logging.
      const organizationId=actor.organizationId,actorId=actor.user.id;
      const {error}=await supabase.from('activities').insert({
        organization_id:organizationId,id:activity.id,type:activity.type,
        summary:activity.summary,project_id:activity.projectId,
        company_id:activity.companyId??null,contact_id:null,quote_id:null,
        occurred_at:activity.occurredAt,metadata:activity.metadata,
        sort_order:get().activities.length,
      });
      if(error&&error.code!=='23505')throw new Error('External quote was not saved to cloud: '+error.message);
      // A network retry can reach an already-inserted record. Verify its
      // immutable submission identity instead of creating a second event or
      // accidentally accepting another submission under the same ID.
      const {data:confirmed,error:lookupError}=await supabase.from('activities')
        .select('id,type,project_id,metadata')
        .eq('organization_id',organizationId).eq('id',activity.id).maybeSingle();
      if(lookupError||!confirmed)
        throw new Error('Could not confirm the external quote was saved. Please retry.');
      const meta=confirmed.metadata as Activity['metadata'];
      if(confirmed.type!=='quote-sent'||confirmed.project_id!==projectId||
         meta?.externalQuoteSent!==true||meta.bidSentDate!==bidSentDate||
         meta.recordedByUserId!==actorId||meta.recordedAt!==activity.metadata?.recordedAt||
         Number(meta.amount)!==amount||
         (meta.externalQuoteFormat??'')!==(activity.metadata?.externalQuoteFormat??''))
        throw new Error('This submission ID was already used for different details. Reopen the form.');
      const nextAuth=useAuthStore.getState();
      if(nextAuth.mode!=='cloud'||nextAuth.organizationId!==organizationId||
         nextAuth.user?.id!==actorId)
        throw new Error('Workspace changed while saving. Reopen the quote record.');
    }
    // Record appears immediately after the cloud acknowledgement. Standard
    // CRM sync subsequently persists Deal stage, value and due date changes.
    if(get().activities.some(item=>item.id===activity.id))return true;
    const activities=[...get().activities,activity];
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
