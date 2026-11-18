/** #387 — Explicit CRM suggestion decisions. Browser-local dismissal IDs only.
 * Writes always re-check current identity, proof, and existing records. */
import {scopedStorageKey} from '../lib/developerPlayground';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useCrmStore} from '../store/crmStore';
import {taskScope,usePersonalTaskStore} from '../store/personalTaskStore';
import {canEditTeamArea} from './teamDepartments';
import {syncNormalizedCrm} from './normalizedCrmSync';
import type {CrmDocument} from '../types/crm';
import {normalizeEmail,normalizePersonName} from './crmIdentity';
import {proposeCrmSuggestions,type CrmSuggestion}
 from './crmSuggestions387';

export interface SuggestionIdentity{
 mode:'local'|'cloud';organizationId:string|null;userId:string|null;
}
export function currentSuggestionIdentity():SuggestionIdentity{
 const auth=useAuthStore.getState();
 return {mode:auth.mode,organizationId:auth.organizationId,userId:auth.user?.id??null};
}
const sameIdentity=(a:SuggestionIdentity,b:SuggestionIdentity)=>
 a.mode===b.mode&&a.organizationId===b.organizationId&&a.userId===b.userId;
export function suggestionsStorageKey(identity:SuggestionIdentity):string{
 const key=identity.mode==='local'?'local':[
  identity.organizationId??'unknown',identity.userId??'unknown'].join(':');
 return scopedStorageKey('salesshop:crm-suggestions-reviewed-v1:'+key);
}
export function readSuggestionDismissals(identity:SuggestionIdentity):string[]{
 try{
  const raw=localStorage.getItem(suggestionsStorageKey(identity));
  if(!raw||raw.length>40000)return [];
  const decoded:unknown=JSON.parse(raw);
  if(!Array.isArray(decoded))return [];
  return [...new Set(decoded.filter((id):id is string=>
   typeof id==='string'&&/^suggestion:(link|person|task):[a-zA-Z0-9_-]+:[a-z0-9]+$/.test(id))
   .slice(-350))];
 }catch{return [];}
}
export function dismissSuggestion(identity:SuggestionIdentity,id:string):string[]{
 if(!sameIdentity(identity,currentSuggestionIdentity()))
  throw new Error('The active SalesShop workspace changed.');
 const old=readSuggestionDismissals(identity);
 const next=[...new Set([...old,id])].slice(-350);
 try{localStorage.setItem(suggestionsStorageKey(identity),JSON.stringify(next));}
 catch{/* No record is affected; the suggestion can return after a reload. */}
 return next;
}
export function suggestionCanEdit(identity:SuggestionIdentity):boolean{
 const auth=useAuthStore.getState();
 if(!sameIdentity(identity,currentSuggestionIdentity())||!auth.ready||
  useRolePerspectiveStore.getState().activePerspective)return false;
 if(auth.mode==='local')return true;
 return Boolean(auth.user?.id&&auth.organizationId&&
  canEditTeamArea(auth.teamRole,auth.teamDepartment,'crm'));
}
export function suggestionTaskReady(identity:SuggestionIdentity):boolean{
 if(!suggestionCanEdit(identity))return false;
 const tasks=usePersonalTaskStore.getState();
 const expected=taskScope(identity.mode,identity.organizationId,identity.userId??undefined);
 return Boolean(expected&&tasks.scope===expected&&
  (identity.mode==='local'||tasks.syncStatus==='saved'));
}
export type SuggestionEdit={name?:string;email?:string;taskTitle?:string;dueDate?:string};
const textSafe=(value:string,max:number)=>
 value.trim().length>=2&&value.trim().length<=max&&!/[\u0000-\u001f<>]/.test(value);
function validDate(value:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const parsed=new Date(value+'T12:00:00Z');
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
}
export async function acceptCrmSuggestion(
 identity:SuggestionIdentity,
 suggestion:CrmSuggestion,
 changes:SuggestionEdit={},
):Promise<{message:string;cloudConfirmed:boolean}>{
 if(!suggestionCanEdit(identity))throw new Error('CRM edit permissions or workspace changed.');
 const state=useCrmStore.getState();
 if(!state.hydrated)throw new Error('CRM records are still loading.');
 const source=state.activities.find(item=>item.id===suggestion.activityId);
 if(!source)throw new Error('The source Activity no longer exists.');
 const fresh=proposeCrmSuggestions({
  activities:state.activities,contacts:state.contacts,companies:state.companies,
  deals:state.projects,tasks:usePersonalTaskStore.getState().tasks,
  mode:identity.mode,userId:identity.userId??undefined,now:new Date(),
 }).find(item=>item.id===suggestion.id&&item.kind===suggestion.kind);
 if(!fresh)throw new Error('This suggestion changed. Refresh its preview before accepting.');
 if(suggestion.kind==='person-create'){
  const name=(changes.name??fresh.proposedName??'').trim();
  const email=(changes.email??fresh.email??'').trim().toLowerCase();
  if(!textSafe(name,160)||!textSafe(email,180)||!/^([^\s@]+)@([^\s@]+\.[^\s@]+)$/.test(email))
   throw new Error('Enter a valid Person name and email.');
  if(state.contacts.some(person=>normalizeEmail(person.email)===email||
   normalizePersonName(person.name)===normalizePersonName(name)))
   throw new Error('A Person with that name or email already exists. Review the CRM record first.');
  if(fresh.companyId&&!state.companies.some(company=>company.id===fresh.companyId))
   throw new Error('The associated Company is no longer available.');
  const id=state.createContact({name,email,companyId:fresh.companyId,source:'manual'});
  if(!id)throw new Error('Unable to create the Person record.');
  if(identity.mode==='cloud'){
   if(!identity.organizationId)throw new Error('Missing organization for cloud confirmation.');
   try{
    const updated=useCrmStore.getState();
    const document:CrmDocument={schemaVersion:3,companies:updated.companies,
     contacts:updated.contacts,projects:updated.projects,activities:updated.activities};
    await syncNormalizedCrm(identity.organizationId,document);
   }catch(error){
    throw new Error('Person created in the local CRM cache but cloud confirmation failed: '+
     (error instanceof Error?error.message:'Unknown error')+
     '. Review syncing and People before retrying; do not recreate the Person.');
   }
  }
  if(!sameIdentity(identity,currentSuggestionIdentity()))
   throw new Error('Account changed after saving. Verify the new Person in the original workspace.');
  return {message:'Created Person · '+name+
   (identity.mode==='cloud'?' (cloud confirmed).':'.'),
   cloudConfirmed:true};
 }
 if(suggestion.kind==='person-link'){
  if(!fresh.contactId||source.contactId||
   source.metadata?.relatedRecords?.some(ref=>ref.type==='contact'))
   throw new Error('This Activity already has a contact or its link changed.');
  if(!state.contacts.some(person=>person.id===fresh.contactId))
   throw new Error('The suggested Person no longer exists.');
  await state.updateActivity(source.id,{
   summary:source.summary,occurredAt:source.occurredAt,metadata:source.metadata,
   projectId:source.projectId,companyId:source.companyId,
   quoteId:source.quoteId,contactId:fresh.contactId,
  });
  if(!sameIdentity(identity,currentSuggestionIdentity()))
   throw new Error('Workspace changed after the Activity update. Verify its link before retrying.');
  return {message:'Linked the existing Person to the Activity.',cloudConfirmed:true};
 }
 if(!suggestionTaskReady(identity))
  throw new Error('Private Tasks must finish loading and syncing before creating a follow-up.');
 const title=(changes.taskTitle??fresh.taskTitle??'').trim();
 const dueDate=(changes.dueDate??fresh.dueDate??'').trim();
 if(!textSafe(title,180)||!validDate(dueDate))
  throw new Error('Provide a valid Task title and due date (YYYY-MM-DD).');
 const tasks=usePersonalTaskStore.getState();
 if(!fresh.taskSourceKey)throw new Error('Missing suggestion Task identity.');
 if(tasks.tasks.some(task=>task.sourceObjectId===fresh.taskSourceKey))
  throw new Error('This follow-up was already created.');
 const newId=tasks.createTask(title,{
  dueDate,type:'follow-up',priority:'normal',
  sourceObjectId:fresh.taskSourceKey,associations:fresh.associations,
  notes:'Suggested from an explicitly dated Activity follow-up. Source Activity: '+
   fresh.activityId+'. Review before contacting a customer. No message was sent.',
 });
 if(!newId)throw new Error('Unable to create the follow-up Task.');
 return {message:'Created private follow-up Task · '+title+
  (identity.mode==='cloud'?' (cloud sync pending).':'.'),
  cloudConfirmed:identity.mode==='local'};
}
