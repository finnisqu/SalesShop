/** #391 — real private Supabase Storage uploads for CRM Companies and Deals.
 * The SQL migration owns permissions and validates actual provider byte metadata.
 * Never expose the service-role key, invent a signed download URL or trust a client size.
 */
import {supabase} from '../lib/supabase';
import {useAuthStore} from '../store/authStore';
import {FILE_LINK_CATEGORIES,type FileLinkCategory,type FileTarget} from './fileLinks357a';
import type {FileInventoryItem} from './fileStorageInventory390';

export const MANAGED_BUCKET_391='sales-documents';
export const MANAGED_MAX_BYTES_391=15*1024*1024;
export const MANAGED_ORG_ALLOWANCE_391=500*1024*1024;
export const MANAGED_ACCEPT_391='.pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx,.pptx';
export type ManagedStatus391='pending'|'ready'|'trashed';
export type ManagedRow391={
 id:string;organization_id:string;uploaded_by:string;
 target_kind:'company'|'deal';target_id:string;
 title:string;category:FileLinkCategory;folder_path:string;
 mime_type:string;size_bytes:number|null;status:ManagedStatus391;
 object_path:string;created_at:string;updated_at:string;
};
export type ManagedListing391={
 available:boolean;items:ManagedRow391[];error:string|null;
};
const MIME_BY_EXTENSION:Record<string,string>={
 pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',
 webp:'image/webp',txt:'text/plain',csv:'text/csv',
 doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 xls:'application/vnd.ms-excel',
 xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export function managedFileValidation391(file:Pick<File,'name'|'size'>):{
 name:string;mime:string;
}{
 const name=file.name.trim();
 if(!name||name.length>180||/[\/\\\u0000-\u001f\u007f]/.test(name)||
  name==='.'||name==='..')
  throw new Error('Choose a file with a safe name (up to 180 characters).');
 if(!Number.isSafeInteger(file.size)||file.size<1||file.size>MANAGED_MAX_BYTES_391)
  throw new Error('Files must be larger than zero and no more than 15 MB.');
 const ext=name.split('.').pop()?.toLowerCase()??'';
 const mime=MIME_BY_EXTENSION[ext];
 if(!mime)throw new Error('Use PDF, image, text, Word, Excel or PowerPoint documents. Other formats are not yet enabled.');
 return {name,mime};
}
export function managedFolder391(input:string):string{
 const folder=input.trim().replace(/\s+/g,' ');
 if(folder.length>160||/[\u0000-\u001f\\]/.test(folder)||folder==='..'||folder.includes('../'))
  throw new Error('Choose a folder name up to 160 characters, without path traversal.');
 return folder;
}
/** Change only virtual organization metadata, never physical Storage paths. */
export function validateManagedOrganization391(category:FileLinkCategory,folderInput:string):{
 category:FileLinkCategory;folder_path:string;
}{
 if(!FILE_LINK_CATEGORIES.some(item=>item.id===category))
  throw new Error('Choose a supported document category.');
 return {category,folder_path:managedFolder391(folderInput)};
}
export function validManagedTarget391(target:Pick<FileTarget,'kind'|'id'>):boolean{
 return (target.kind==='company'||target.kind==='deal')&&Boolean(target.id.trim())&&
  target.id.length<=200;
}
function checkScope(org:string,expectedUser?:string):void{
 const state=useAuthStore.getState();
 if(!supabase||state.mode!=='cloud'||state.organizationId!==org||!state.user?.id||
  (expectedUser!==undefined&&state.user.id!==expectedUser))
  throw new Error('Your SalesShop workspace or user changed. Sign in and retry.');
}
function scopeGuard391(org:string):()=>void{
 const user=useAuthStore.getState().user?.id;
 checkScope(org,user);
 return ()=>checkScope(org,user);
}
function reason(error:{message?:string;code?:string}|null,action:string):string{
 const message=error?.message??'Unknown error';
 return action+': '+message;
}
/** Organization records are filtered by table RLS (no service-role fallback). */
export async function listManagedDocuments391(org:string):Promise<ManagedListing391>{
 const recheck=scopeGuard391(org);
 const all:ManagedRow391[]=[];
 const batchSize=500;
 for(let start=0;start<20_000;start+=batchSize){
  const {data,error}=await supabase!.from('crm_file_objects')
   .select('id,organization_id,uploaded_by,target_kind,target_id,title,category,folder_path,mime_type,size_bytes,status,object_path,created_at,updated_at')
   .eq('organization_id',org).order('updated_at',{ascending:false})
   .order('id',{ascending:true}).range(start,start+batchSize-1);
  recheck();
  if(error){
   if(error.code==='42P01'||error.code==='PGRST205'||
    /could not find the table.*crm_file_objects|relation.*crm_file_objects.*does not exist/i.test(error.message))
    return {available:false,items:[],error:null};
   return {available:false,items:[],error:reason(error,'Cannot load stored documents')};
  }
  const rows=(data??[]) as ManagedRow391[];
  all.push(...rows);
  if(rows.length<batchSize)return {available:true,items:all,error:null};
 }
 return {available:false,items:[],error:'File inventory exceeds the initial 20,000-item display limit; totals cannot be shown reliably.'};
}
export function managedToInventory391(row:ManagedRow391):FileInventoryItem{
 if(row.status!=='ready'||row.size_bytes===null||row.size_bytes<0)
  throw new Error('Only verified stored files belong in the active library.');
 return {
  id:'managed:'+row.id,source:'managed',provider:'supabase-managed',
  name:row.title,kind:'file',category:row.category,
  targetKind:row.target_kind,targetId:row.target_id,
  sizeBytes:row.size_bytes,contentType:row.mime_type,folderPath:row.folder_path,
  objectKey:row.object_path,bucket:MANAGED_BUCKET_391,
  createdAt:row.created_at,updatedAt:row.updated_at,
 };
}
export async function uploadManagedDocument391(org:string,target:FileTarget,file:File,
 category:FileLinkCategory,folderInput=''):Promise<void>{
 const recheck=scopeGuard391(org);
 if(!validManagedTarget391(target))throw new Error('Only Company and Deal uploads are enabled.');
 const {name,mime}=managedFileValidation391(file);
 const folder=managedFolder391(folderInput);
 const {data:pending,error:insertError}=await supabase!.from('crm_file_objects')
  .insert({organization_id:org,target_kind:target.kind,target_id:target.id,
   title:name,category,folder_path:folder,mime_type:mime})
  .select('id,object_path').single();
 recheck();
 if(insertError||!pending)throw new Error(reason(insertError,'Could not reserve document upload'));
 const id=String(pending.id),path=String(pending.object_path);
 const {error:uploadError}=await supabase!.storage.from(MANAGED_BUCKET_391)
  .upload(path,file,{upsert:false,contentType:mime,cacheControl:'0'});
 recheck();
 if(uploadError){
  // A network error may happen after Storage accepted the bytes. Leave the
  // pending index in place for retry or explicit deletion; never orphan bytes.
  throw new Error(reason(uploadError,'Upload reported an error. The pending document remains for review'));
 }
 // The DB trigger reads the actual Storage object metadata and sets size_bytes.
 await finishManagedUpload391(org,id);
}
export async function finishManagedUpload391(org:string,id:string):Promise<void>{
 const recheck=scopeGuard391(org);
 const {data,error}=await supabase!.from('crm_file_objects')
  .update({status:'ready'}).eq('id',id).eq('organization_id',org)
  .eq('status','pending').select('id,size_bytes,status').single();
 recheck();
 if(error||!data||data.size_bytes===null)
  throw new Error('File upload may have reached storage but verification did not finish. Refresh and use Complete upload to retry. '+(error?.message??''));
}
export async function organizeManagedDocument391(
 org:string,row:ManagedRow391,category:FileLinkCategory,folderInput:string,
):Promise<void>{
 const recheck=scopeGuard391(org);
 if(row.organization_id!==org||row.status!=='ready')
  throw new Error('Only ready documents can be organized.');
 const updates=validateManagedOrganization391(category,folderInput);
 if(row.category===updates.category&&row.folder_path===updates.folder_path)return;
 const {data,error}=await supabase!.from('crm_file_objects')
  .update(updates).eq('id',row.id).eq('organization_id',org)
  .eq('status','ready').select('id').single();
 recheck();
 if(error||!data)throw new Error(reason(error,'Could not organize document'));
}
export async function trashManagedDocument391(org:string,row:ManagedRow391):Promise<void>{
 const recheck=scopeGuard391(org);
 if(row.organization_id!==org||row.status!=='ready')throw new Error('This document is no longer ready.');
 const {data,error}=await supabase!.from('crm_file_objects')
  .update({status:'trashed'}).eq('id',row.id).eq('organization_id',org)
  .eq('status','ready').select('id').single();
 recheck();
 if(error||!data)throw new Error(reason(error,'Could not move document to trash'));
}
export async function restoreManagedDocument391(org:string,row:ManagedRow391):Promise<void>{
 const recheck=scopeGuard391(org);
 if(row.organization_id!==org||row.status!=='trashed')throw new Error('This document is not in the trash.');
 const {data,error}=await supabase!.from('crm_file_objects')
  .update({status:'ready'}).eq('id',row.id).eq('organization_id',org)
  .eq('status','trashed').select('id').single();
 recheck();
 if(error||!data)throw new Error(reason(error,'Could not restore document'));
}
export async function deleteManagedDocumentPermanently391(org:string,row:ManagedRow391):Promise<void>{
 const recheck=scopeGuard391(org);
 if(row.organization_id!==org||!['trashed','pending'].includes(row.status))
  throw new Error('Move the document to trash first.');
 // A pending row can still have bytes if finalization was interrupted. Remove
 // the object first so that deleting metadata cannot leave private orphan bytes.
 const {error:storageError}=await supabase!.storage.from(MANAGED_BUCKET_391)
  .remove([row.object_path]);
 recheck();
 if(storageError&&!(row.status==='pending'&&
    /not found|does not exist|404/i.test(storageError.message)))
  throw new Error(reason(storageError,'Could not delete storage object'));
 const {data,error}=await supabase!.from('crm_file_objects')
  .delete().eq('id',row.id).eq('organization_id',org).select('id').single();
 recheck();
 if(error||!data)throw new Error(reason(error,'Storage object deleted but index cleanup failed'));
}
export async function downloadManagedDocument391(org:string,row:ManagedRow391):Promise<void>{
 const recheck=scopeGuard391(org);
 if(row.organization_id!==org||row.status!=='ready')throw new Error('Document is unavailable.');
 const {data,error}=await supabase!.storage.from(MANAGED_BUCKET_391)
  .download(row.object_path);
 recheck();
 if(error||!data)throw new Error(reason(error,'Could not download private document'));
 // Download as a blob; do not store a signed bearer URL in history or localStorage.
 const url=URL.createObjectURL(data),a=document.createElement('a');
 a.href=url;a.download=row.title;a.style.display='none';
 document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),10_000);
}
