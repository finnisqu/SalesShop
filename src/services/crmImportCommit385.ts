/** #385 — Explicit, additive CRM import through the existing record mutations.
 * Existing records are never overwritten. File data is not stored locally.
 * Cloud mode waits for the normalized CRM upsert to acknowledge completion. */
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useCrmStore} from '../store/crmStore';
import {canEditTeamArea} from './teamDepartments';
import {syncNormalizedCrm} from './normalizedCrmSync';
import type {CrmDocument} from '../types/crm';
import {previewCrmImport,type CrmImportKind,type CrmImportMapping,
 type CrmImportTable} from './crmImport385';

export type CrmImportIdentity={mode:'local'|'cloud';organizationId:string|null;userId:string|null};
export interface CrmImportCommitResult{
 created:number;skipped:number;cloudConfirmed:boolean;
 note:string;
}
export const crmImportIdentity=():CrmImportIdentity=>{
 const auth=useAuthStore.getState();
 return {mode:auth.mode,organizationId:auth.organizationId,userId:auth.user?.id??null};
};
const sameIdentity=(a:CrmImportIdentity,b:CrmImportIdentity)=>
 a.mode===b.mode&&a.organizationId===b.organizationId&&a.userId===b.userId;
export function crmImportCanCreate(){
 const auth=useAuthStore.getState();
 if(!auth.ready||useRolePerspectiveStore.getState().activePerspective)return false;
 if(auth.mode==='local')return true;
 return !!auth.user?.id&&!!auth.organizationId&&
  canEditTeamArea(auth.teamRole,auth.teamDepartment,'crm');
}
export async function commitReviewedCrmImport(input:{
 kind:CrmImportKind;table:CrmImportTable;mapping:CrmImportMapping;
 identity:CrmImportIdentity;
}):Promise<CrmImportCommitResult>{
 const {kind,table,mapping,identity}=input;
 if(!sameIdentity(identity,crmImportIdentity())||!crmImportCanCreate())
  throw new Error('Your workspace or access changed. Reopen the Import tool.');
 const state=useCrmStore.getState();
 if(!state.hydrated)throw new Error('CRM records have not finished loading.');
 const initial=previewCrmImport(kind,table,mapping,{
  companies:state.companies,people:state.contacts,deals:state.projects,
 });
 if(initial.errors.length)throw new Error(initial.errors[0]);
 if(!initial.counts.ready)throw new Error('No reviewed new records are ready to import.');
 // No deletion, updates, or guessing of links. Only the rows already marked
 // ready are eligible; recheck each row against fresh store state at creation.
 let created=0,skipped=0;
 for(const candidate of initial.candidates){
  if(candidate.status!=='ready'){skipped++;continue;}
  if(!sameIdentity(identity,crmImportIdentity())||!crmImportCanCreate())
   throw new Error('Import stopped: the active workspace changed. Some rows may have been created.');
  const live=useCrmStore.getState();
  const current=previewCrmImport(kind,{
   ...table,rows:[table.rows[candidate.index]],
  },mapping,{companies:live.companies,people:live.contacts,deals:live.projects});
  const row=current.candidates[0];
  if(!row||row.status!=='ready'){skipped++;continue;}
  const values=row.values;
  if(kind==='company'){
   const id=live.resolveCompany(values.name,values.kind);
   if(!id)throw new Error('Import paused at row '+(candidate.index+2)+
    ': Company could not be created. Earlier rows may have been saved.');
  }else if(kind==='person'){
   const id=live.createContact({name:values.name,email:values.email,
    phone:values.phone,title:values.title,companyId:values.companyId,source:'manual'});
   if(!id)throw new Error('Import paused at row '+(candidate.index+2)+
    ': Person could not be created. Earlier rows may have been saved.');
  }else{
   const id=live.createProject(values.name,values.stage,{
    pipeline:values.pipeline,amount:values.amount,source:'manual',
   });
   if(!id)throw new Error('Import paused at row '+(candidate.index+2)+
    ': Deal could not be created. Earlier rows may have been saved.');
   if(values.companyId)useCrmStore.getState().setProjectCompany(id,values.companyId);
   if(values.dueDate||values.nextAction)
    useCrmStore.getState().updateProject(id,{
     ...(values.dueDate?{dueDate:values.dueDate}:{}),
     ...(values.nextAction?{nextAction:values.nextAction}:{}),
    });
  }
  created++;
 }
 if(!created)return {created:0,skipped,cloudConfirmed:identity.mode==='local',
  note:'No new records were created; the current CRM already contains the reviewed matches.'};
 if(identity.mode==='local')return {created,skipped,cloudConfirmed:true,
  note:'Created '+created+' record(s) in this local SalesShop workspace.'};
 // CRM changes are already in the same local recovery-backed repository used
 // by regular record creation. Explicitly confirm the cloud write; a failure
 // must NOT be reported as success or cause a blind retry creating duplicates.
 if(!identity.organizationId)throw new Error('No organization selected for cloud import.');
 try{
  if(!sameIdentity(identity,crmImportIdentity()))
   throw new Error('Workspace changed before cloud confirmation.');
  const updated=useCrmStore.getState();
  const doc:CrmDocument={schemaVersion:3,companies:updated.companies,
   contacts:updated.contacts,projects:updated.projects,activities:updated.activities};
  await syncNormalizedCrm(identity.organizationId,doc);
  if(!sameIdentity(identity,crmImportIdentity()))
   throw new Error('Workspace changed during cloud confirmation.');
  return {created,skipped,cloudConfirmed:true,
   note:'Created '+created+' record(s) and confirmed the cloud CRM save.'};
 }catch(error){
  return {created,skipped,cloudConfirmed:false,
   note:'Created '+created+' record(s) in the local CRM cache, but cloud confirmation failed: '+
    (error instanceof Error?error.message:'Unknown cloud error')+
    '. Do not clear local data. Check sync status before retrying.'};
 }
}
