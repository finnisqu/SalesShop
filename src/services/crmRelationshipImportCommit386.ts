/** #385b — Explicitly approved Deal–Person links, through the existing
 * link store. No CRM record or Deal stage is created, updated or deleted. */
import {useCrmStore} from '../store/crmStore';
import {useDealPeopleStore,dealPeopleScope} from '../store/dealPeopleStore';
import {crmImportCanCreate,crmImportIdentity,type CrmImportIdentity}
 from './crmImportCommit385';
import {previewRelationshipImport,type RelationshipMapping,
 type RelationshipImportCandidate}
 from './crmRelationshipImport386';
import type {CrmImportTable} from './crmImport385';

export interface RelationshipCommitResult{
 created:number;skipped:number;note:string;
}
const sameIdentity=(first:CrmImportIdentity,second:CrmImportIdentity)=>
 first.mode===second.mode&&first.userId===second.userId&&
 first.organizationId===second.organizationId;
export function relationshipImportCanCommit(identity:CrmImportIdentity):boolean{
 const current=crmImportIdentity();
 const crm=useCrmStore.getState(),links=useDealPeopleStore.getState();
 const scope=dealPeopleScope(identity.mode,identity.organizationId);
 return sameIdentity(identity,current)&&crmImportCanCreate()&&crm.hydrated&&
  !!scope&&links.scope===scope&&links.loaded&&!links.loading&&!links.error;
}
export async function commitReviewedRelationshipImport({
 table,mapping,approved,identity,
}:{
 table:CrmImportTable;mapping:RelationshipMapping;
 approved:readonly number[];identity:CrmImportIdentity;
}):Promise<RelationshipCommitResult>{
 if(!relationshipImportCanCommit(identity))
  throw new Error('Import is unavailable until the correct workspace and Deal links are loaded.');
 const initial=useCrmStore.getState(),oldLinks=useDealPeopleStore.getState();
 const initialReview=previewRelationshipImport(table,mapping,{
  companies:initial.companies,people:initial.contacts,deals:initial.projects,
  links:oldLinks.links,
 });
 if(initialReview.errors.length)throw new Error(initialReview.errors[0]);
 if(!approved.length)throw new Error('Approve at least one Ready relationship.');
 const selected=new Set(approved);
 if(selected.size!==approved.length||[...selected].some(i=>
  !Number.isInteger(i)||i<0||i>=table.rows.length||
  initialReview.rows[i]?.status!=='ready'))
  throw new Error('Only unique, Ready relationship rows can be approved.');
 const expected=new Map<number,RelationshipImportCandidate>(
  [...selected].map(i=>[i,initialReview.rows[i]] as const));
 let created=0,skipped=0;
 for(const index of approved){
  if(!relationshipImportCanCommit(identity))
   throw new Error('Import interrupted by a workspace or permission change. '+
    created+' link(s) were already saved; review before retrying.');
  const crm=useCrmStore.getState(),store=useDealPeopleStore.getState();
  // Recompute against the latest records and existing links, not stale
  // file-derived IDs or a prior preview.
  const current=previewRelationshipImport({...table,rows:[table.rows[index]]},
   mapping,{companies:crm.companies,people:crm.contacts,deals:crm.projects,
    links:store.links});
  const row=current.rows[0],confirmed=expected.get(index);
  if(current.errors.length)throw new Error('The mapping changed during import.');
  if(!row||!confirmed||row.dealId!==confirmed.dealId||
   row.personId!==confirmed.personId){
   throw new Error('Row '+(index+2)+' now resolves to a different Person or Deal. '+
    created+' link(s) were already saved; review before retrying.');
  }
  if(row.status==='existing'){skipped++;continue;}
  if(row.status!=='ready'){
   throw new Error('Row '+(index+2)+' now needs review. '+
    created+' link(s) were already saved; review before retrying.');
  }
  try{
   await useDealPeopleStore.getState().add(row.dealId!,row.personId!,row.role);
  }catch(error){
   const reason=error instanceof Error?error.message:'Unknown link error.';
   throw new Error('Import paused at row '+(index+2)+': '+reason+' '+
    created+' earlier link(s) may already be saved. Review the current relationships before retrying.');
  }
  created++;
  if(!relationshipImportCanCommit(identity))
   throw new Error('Workspace changed during link confirmation. '+
    created+' link(s) may have been saved; review before retrying.');
 }
 return {
  created,skipped,
  note:'Saved '+created+' reviewed Deal–Person link(s).'+
   (skipped?' '+skipped+' link(s) already existed and were skipped.':'')+
   ' No Deal stages, existing links, or contact details were changed.',
 };
}
