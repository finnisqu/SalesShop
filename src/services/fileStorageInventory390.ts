/** #390 — provider-neutral Files & Docs inventory.
 * Provider secrets, tokens and URLs never belong in this metadata model.
 * A saved URL without authenticated provider metadata has UNKNOWN size.
 */
import {fileLinkProvider,type FileLinkRecord,type FileLinkCategory,
 type FileTargetKind} from './fileLinks357a';

export type FileStorageProvider='supabase-managed'|'supabase-byo'|'s3-byo'|
 'r2-byo'|'google-drive'|'dropbox'|'onedrive'|'box'|'web-link';
export type FileInventorySort='newest'|'oldest'|'name'|'size-desc'|'size-asc'|'provider';
export interface FileStorageObject{
 id:string;provider:FileStorageProvider;name:string;kind:'file'|'folder';
 category:FileLinkCategory;targetKind:FileTargetKind;targetId:string;
 sizeBytes:number|null;contentType?:string;createdAt:string;updatedAt:string;
 /** Secure object references, not signed download links. */
 objectKey?:string;bucket?:string;
 /** Optional opaque provider reference for external connectors, never a credential. */
 externalId?:string;
}
export interface FileInventoryItem extends FileStorageObject{
 source:'managed'|'linked';openUrl?:string;
}
export interface FileProviderCapability{
 provider:FileStorageProvider;label:string;mode:'managed'|'bring-your-own'|'linked';
 supportsUpload:boolean;supportsSizeMetadata:boolean;supportsDelete:boolean;
}
export const FILE_PROVIDER_CAPABILITIES:readonly FileProviderCapability[]=[
 {provider:'supabase-managed',label:'SalesShop Storage',mode:'managed',supportsUpload:true,supportsSizeMetadata:true,supportsDelete:true},
 {provider:'supabase-byo',label:'Customer Supabase',mode:'bring-your-own',supportsUpload:true,supportsSizeMetadata:true,supportsDelete:true},
 {provider:'s3-byo',label:'Amazon S3 / compatible',mode:'bring-your-own',supportsUpload:true,supportsSizeMetadata:true,supportsDelete:true},
 {provider:'r2-byo',label:'Cloudflare R2',mode:'bring-your-own',supportsUpload:true,supportsSizeMetadata:true,supportsDelete:true},
 {provider:'google-drive',label:'Google Drive',mode:'linked',supportsUpload:false,supportsSizeMetadata:false,supportsDelete:false},
 {provider:'dropbox',label:'Dropbox',mode:'linked',supportsUpload:false,supportsSizeMetadata:false,supportsDelete:false},
 {provider:'onedrive',label:'OneDrive / SharePoint',mode:'linked',supportsUpload:false,supportsSizeMetadata:false,supportsDelete:false},
 {provider:'box',label:'Box',mode:'linked',supportsUpload:false,supportsSizeMetadata:false,supportsDelete:false},
 {provider:'web-link',label:'Web link',mode:'linked',supportsUpload:false,supportsSizeMetadata:false,supportsDelete:false},
] as const;
export function providerFromLink(url:string):FileStorageProvider{
 switch(fileLinkProvider(url)){
  case 'Google Drive':return 'google-drive';
  case 'Dropbox':return 'dropbox';
  case 'OneDrive / SharePoint':return 'onedrive';
  case 'Box':return 'box';
  default:return 'web-link';
 }
}
export const providerLabel=(provider:FileStorageProvider):string=>
 FILE_PROVIDER_CAPABILITIES.find(p=>p.provider===provider)?.label??'External storage';

export function isValidSize(value:unknown):value is number{
 return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
}
export function fileSizeLabel(bytes:number|null):string{
 if(!isValidSize(bytes))return 'Unknown';
 if(bytes<1024)return bytes+' B';
 const units=['KB','MB','GB','TB','PB'];
 let n=bytes,unit=-1;
 do{n/=1024;unit++;}while(n>=1024&&unit<units.length-1);
 return n.toLocaleString('en-US',{maximumFractionDigits:n>=100?0:n>=10?1:2})+' '+units[unit];
}
export function inventoryFromLinks(links:readonly FileLinkRecord[]):FileInventoryItem[]{
 return links.map(row=>({
  id:'link:'+row.id,source:'linked',name:row.title,kind:row.kind,
  category:row.category??'other',targetKind:row.targetKind,targetId:row.targetId,
  provider:providerFromLink(row.url),sizeBytes:null,
  openUrl:row.url,createdAt:row.createdAt,updatedAt:row.updatedAt,
 }));
}
export function normalizeManagedFiles(rows:readonly FileStorageObject[]):FileInventoryItem[]{
 return rows.map(row=>{
  if(row.kind==='file'&&!isValidSize(row.sizeBytes))
   throw new Error('Stored file size must be an exact nonnegative byte count.');
  if(row.kind==='folder'&&row.sizeBytes!==null)
   throw new Error('Folder bytes are not a measured storage object size.');
  if(row.provider==='web-link'||row.provider==='google-drive'||row.provider==='dropbox'||
   row.provider==='onedrive'||row.provider==='box')
    throw new Error('Linked provider objects require an authenticated metadata adapter.');
  return {...row,source:'managed'};
 });
}
export function sortFileInventory(rows:readonly FileInventoryItem[],sort:FileInventorySort):FileInventoryItem[]{
 const stable=(a:FileInventoryItem,b:FileInventoryItem)=>
  b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id);
 return [...rows].sort((a,b)=>{
  switch(sort){
   case 'name':return a.name.localeCompare(b.name,undefined,{sensitivity:'base'})||stable(a,b);
   case 'oldest':return a.updatedAt.localeCompare(b.updatedAt)||a.id.localeCompare(b.id);
   case 'provider':return providerLabel(a.provider).localeCompare(providerLabel(b.provider))||stable(a,b);
   case 'size-desc':
   case 'size-asc':{
    // Unknown sizes stay LAST in either sort direction.
    if(a.sizeBytes===null)return b.sizeBytes===null?stable(a,b):1;
    if(b.sizeBytes===null)return -1;
    return (sort==='size-desc'?b.sizeBytes-a.sizeBytes:a.sizeBytes-b.sizeBytes)||stable(a,b);
   }
   default:return stable(a,b);
  }
 });
}
export interface FileUsageSummary{
 items:number;files:number;folders:number;knownFiles:number;unknownSize:number;
 knownBytes:number;providerCount:number;
 /** This is an INVENTORY total, not billed platform storage/egress. */
 byProvider:Array<{provider:FileStorageProvider;items:number;knownBytes:number;unknownSize:number}>;
}
export function summarizeFileInventory(rows:readonly FileInventoryItem[]):FileUsageSummary{
 const by=new Map<FileStorageProvider,{provider:FileStorageProvider;items:number;knownBytes:number;unknownSize:number}>();
 let knownBytes=0,knownFiles=0,unknownSize=0,files=0,folders=0;
 for(const row of rows){
  if(row.kind==='folder')folders++;else files++;
  const value=by.get(row.provider)??{provider:row.provider,items:0,knownBytes:0,unknownSize:0};
  value.items++;
  if(row.kind==='file'){
   if(isValidSize(row.sizeBytes)){knownBytes+=row.sizeBytes;knownFiles++;value.knownBytes+=row.sizeBytes;}
   else{unknownSize++;value.unknownSize++;}
  }
  by.set(row.provider,value);
 }
 return {items:rows.length,files,folders,knownFiles,unknownSize,knownBytes,
  providerCount:by.size,byProvider:[...by.values()].sort((a,b)=>b.items-a.items)};
}
