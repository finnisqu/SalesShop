import {create} from 'zustand';
import {useAuthStore} from './authStore';
import {useRolePerspectiveStore} from './rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {
 listManagedDocuments391,uploadManagedDocument391,finishManagedUpload391,
 downloadManagedDocument391,trashManagedDocument391,restoreManagedDocument391,
 deleteManagedDocumentPermanently391,type ManagedRow391,
} from '../services/managedDocuments391';
import type {FileTarget,FileLinkCategory} from '../services/fileLinks357a';

type Readiness='idle'|'loading'|'ready'|'unconfigured'|'error';
interface ManagedFileState391{
 scope:string|null;organizationId:string|null;userId:string|null;
 rows:ManagedRow391[];readiness:Readiness;busy:boolean;error:string|null;notice:string|null;
 bind:()=>void;
 refresh:()=>Promise<void>;
 upload:(target:FileTarget,file:File,category:FileLinkCategory,folder:string)=>Promise<void>;
 complete:(id:string)=>Promise<void>;
 download:(row:ManagedRow391)=>Promise<void>;
 trash:(row:ManagedRow391)=>Promise<void>;
 restore:(row:ManagedRow391)=>Promise<void>;
 purge:(row:ManagedRow391)=>Promise<void>;
 clearNotice:()=>void;
}
let refreshEpoch=0;
function identity(){
 const s=useAuthStore.getState();
 if(s.mode!=='cloud'||!s.organizationId||!s.user?.id)
  return {key:null,org:null,user:null};
 return {key:s.organizationId+':'+s.user.id,org:s.organizationId,user:s.user.id};
}
function sameIdentity(key:string|null):boolean{return identity().key===key;}
function editable(){
 const s=useAuthStore.getState();
 return !useRolePerspectiveStore.getState().activePerspective&&
  canEditTeamArea(s.teamRole,s.teamDepartment,'crm');
}
export const useManagedFileStore391=create<ManagedFileState391>((set,get)=>{
 const run=async(operation:(org:string)=>Promise<void>,notice:string,needsEdit=true)=>{
  const state=get(),scope=state.scope,org=state.organizationId;
  if(!scope||!org||state.busy||state.readiness!=='ready'||!sameIdentity(scope))
   throw new Error('Document storage is not ready for this SalesShop account.');
  if(needsEdit&&!editable())throw new Error('You do not have permission to change CRM documents.');
  set({busy:true,error:null,notice:null});
  try{
   await operation(org);
   if(get().scope!==scope||!sameIdentity(scope))return;
   set({busy:false,notice});await get().refresh();
  }catch(error){
   if(get().scope===scope)set({busy:false,error:error instanceof Error?error.message:'Document operation failed.'});
   throw error;
  }
 };
 return {
  scope:null,organizationId:null,userId:null,rows:[],
  readiness:'idle',busy:false,error:null,notice:null,
  bind(){
   const id=identity();
   if(get().scope===id.key)return;
   ++refreshEpoch;
   set({scope:id.key,organizationId:id.org,userId:id.user,rows:[],
    readiness:id.key?'loading':'idle',busy:false,error:null,notice:null});
   if(id.key)void get().refresh();
  },
  async refresh(){
   const {scope,organizationId:org}=get();
   if(!scope||!org||!sameIdentity(scope))return;
   const epoch=++refreshEpoch;
   set({readiness:'loading',error:null});
   try{
    const result=await listManagedDocuments391(org);
    if(get().scope!==scope||!sameIdentity(scope)||epoch!==refreshEpoch)return;
    set({rows:result.items,
     readiness:result.available?'ready':result.error?'error':'unconfigured',
     error:result.error});
   }catch(error){
    if(get().scope===scope&&sameIdentity(scope)&&epoch===refreshEpoch)
     set({readiness:'error',error:error instanceof Error?error.message:'Storage cannot be loaded.'});
   }
  },
  upload:async(target,file,category,folder)=>
   run(org=>uploadManagedDocument391(org,target,file,category,folder),'Document uploaded and verified.'),
  complete:async(id)=>
   run(org=>finishManagedUpload391(org,id),'Upload completed.'),
  download:async(row)=>
   run(org=>downloadManagedDocument391(org,row),'Download started.',false),
  trash:async(row)=>
   run(org=>trashManagedDocument391(org,row),'Document moved to trash.'),
  restore:async(row)=>
   run(org=>restoreManagedDocument391(org,row),'Document restored.'),
  purge:async(row)=>
   run(org=>deleteManagedDocumentPermanently391(org,row),'Document permanently deleted.'),
  clearNotice:()=>set({notice:null,error:null}),
 };
});
