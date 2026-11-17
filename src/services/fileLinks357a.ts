import {scopedStorageKey} from '../lib/developerPlayground';

export type FileTargetKind='company'|'deal'|'quote'|'externalQuote';
export type FileLinkKind='file'|'folder';
export type FileLinkCategory='drawing'|'bid'|'contract'|'spec'|'other';
export const FILE_LINK_CATEGORIES:ReadonlyArray<{id:FileLinkCategory;label:string}>=[
 {id:'drawing',label:'Drawings'}, {id:'bid',label:'Bid documents'},
 {id:'contract',label:'Contracts'}, {id:'spec',label:'Specifications'},
 {id:'other',label:'Other'},
];
export const fileLinkCategoryLabel=(value?:FileLinkCategory)=>
 FILE_LINK_CATEGORIES.find(item=>item.id===value)?.label??'Other';
export interface FileTarget {kind:FileTargetKind;id:string;title:string;
 companyId?:string;projectId?:string;}
export interface FileLinkRecord {
 id:string;title:string;url:string;kind:FileLinkKind;category?:FileLinkCategory;
 targetKind:FileTargetKind;targetId:string;
 createdAt:string;updatedAt:string;
}
export interface FileLinkDraft {
 title:string;url:string;kind:FileLinkKind;category?:FileLinkCategory;
 targetKind:FileTargetKind;targetId:string;
}
/** Local prototype intentionally scopes to the *individual* signed-in user.
 * This key is not a cloud permission mechanism or team-sharing substitute. */
export function fileLinksScope(mode:'local'|'cloud',org?:string|null,user?:string|null):string|null{
 if(mode==='local')return 'local-browser';
 return org&&user?'org:'+org+':user:'+user:null;
}
export function fileLinksStorageKey(scope:string):string{
 return scopedStorageKey('salesshop-file-links-v1:'+scope);
}
export function fileTargetKey(target:Pick<FileTarget,'kind'|'id'>):string{
 return target.kind+':'+target.id;
}
export function normalizeFileLinkUrl(input:string):string{
 const raw=input.trim();
 if(raw.length>2048)throw new Error('Link is too long (maximum 2048 characters).');
 let url:URL;
 try{url=new URL(raw);}catch{throw new Error('Enter a full https:// or http:// link.');}
 if(!['https:','http:'].includes(url.protocol)||!url.hostname||
    url.username||url.password){
  throw new Error('Use an ordinary http(s) link without embedded credentials.');
 }
 if(url.href.length>2048)throw new Error('Link is too long (maximum 2048 characters).');
 return url.href;
}
export function fileLinkProvider(value:string):string{
 let host='';
 try{host=new URL(value).hostname.toLowerCase();}catch{return 'Web link';}
 if(host==='drive.google.com'||host==='docs.google.com')return 'Google Drive';
 if(host.endsWith('.dropbox.com')||host==='dropbox.com')return 'Dropbox';
 if(host.endsWith('.sharepoint.com')||host.endsWith('.onedrive.live.com')||
  host==='onedrive.live.com'||host==='1drv.ms')return 'OneDrive / SharePoint';
 if(host==='box.com'||host.endsWith('.box.com'))return 'Box';
 return 'Web link';
}
export function validateFileLinkDraft(draft:FileLinkDraft):FileLinkDraft{
 const title=draft.title.trim();
 if(!title||title.length>180)throw new Error('Enter a title (1–180 characters).');
 const targetId=draft.targetId.trim();
 if(!targetId||targetId.length>200)throw new Error('Choose a linked CRM record.');
 if(!['company','deal','quote','externalQuote'].includes(draft.targetKind))
  throw new Error('Choose a supported CRM record.');
 if(!['file','folder'].includes(draft.kind))throw new Error('Choose file or folder.');
 if(draft.category!==undefined&&!FILE_LINK_CATEGORIES.some(item=>item.id===draft.category))
  throw new Error('Choose a supported document category.');
 return {...draft,title,targetId,url:normalizeFileLinkUrl(draft.url)};
}
export function loadFileLinks(scope:string):FileLinkRecord[]{
 try{
  const raw=localStorage.getItem(fileLinksStorageKey(scope));
  const parsed:unknown=raw?JSON.parse(raw):[];
  if(!Array.isArray(parsed))return [];
  return parsed.filter((value:unknown):value is FileLinkRecord=>{
   if(!value||typeof value!=='object')return false;
   const row=value as Record<string,unknown>;
   if(typeof row.id!=='string'||typeof row.createdAt!=='string'||typeof row.updatedAt!=='string')return false;
   try{validateFileLinkDraft(row as unknown as FileLinkDraft);return true;}
   catch{return false;}
  });
 }catch{return [];}
}
export function saveFileLinks(scope:string,items:readonly FileLinkRecord[]):void{
 // Persist before updating UI; quota/privacy errors must not look like a save.
 localStorage.setItem(fileLinksStorageKey(scope),JSON.stringify(items));
}


/** Reuses the exact source-record relationships; never matches by record name.
 * A Quote inherits its Deal + Company; a Deal inherits its Company.
 * Other records only join when both have a verified common link. */
export function relatedFileTargetKeys(target:FileTarget,targets:readonly FileTarget[],
 includeRelated:boolean):ReadonlySet<string>{
 const result=new Set<string>([fileTargetKey(target)]);
 if(!includeRelated)return result;
 const companyId=target.kind==='company'?target.id:target.companyId;
 const dealId=target.kind==='deal'?target.id:target.projectId;
 for(const other of targets){
  const sameCompany=!!companyId&&(other.kind==='company'&&other.id===companyId||
    other.companyId===companyId);
  const sameDeal=!!dealId&&(other.kind==='deal'&&other.id===dealId||
    other.projectId===dealId);
  if(sameCompany||sameDeal)result.add(fileTargetKey(other));
 }
 return result;
}
