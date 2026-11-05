import type {NotebookDocument,NotebookEntry,NotebookFolder,TrashedNotebookEntry} from '../types/notebook';
import {scopedStorageKey} from '../lib/developerPlayground';

/** Identity-scoped, metadata-only recovery marker. The page content stays
 * in the existing local Notebook document and is never duplicated here. */
const KEY=scopedStorageKey('salesshop-cloud-notebook-pending-v1');
export interface NotebookRecoveryScope {userId:string;organizationId:string;}
export interface PendingNotebookSync extends NotebookRecoveryScope {
  token:string;
  changedEntryIds:string[];
  createdEntryIds:string[];
  trashedEntryIds:string[];
  createdFolderIds:string[];
}
const isDocument=(value:unknown):value is NotebookDocument=>{
  if(!value||typeof value!=='object')return false;
  const doc=value as Partial<NotebookDocument>;
  return doc.schemaVersion===3&&Array.isArray(doc.entries);
};
const cleanIds=(value:unknown):string[]=>Array.isArray(value)
  ?[...new Set(value.filter((id):id is string=>typeof id==='string'&&id.length>0))]:[];
const newer=(a:string,b:string):boolean=>{
  const at=Date.parse(a),bt=Date.parse(b);
  return Number.isFinite(at)&&Number.isFinite(bt)?at>bt:a>b;
};
export function readPendingNotebookSync(scope:NotebookRecoveryScope):PendingNotebookSync|null{
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw)return null;
    const value=JSON.parse(raw) as Partial<PendingNotebookSync>;
    if(value.userId!==scope.userId||value.organizationId!==scope.organizationId
      ||typeof value.token!=='string')return null;
    return {...scope,token:value.token,
      changedEntryIds:cleanIds(value.changedEntryIds),
      createdEntryIds:cleanIds(value.createdEntryIds),
      trashedEntryIds:cleanIds(value.trashedEntryIds),
      createdFolderIds:cleanIds(value.createdFolderIds)};
  }catch{return null;}
}
export function markPendingNotebookSync(scope:NotebookRecoveryScope,
  input:unknown,baseline:NotebookDocument|null):string|null{
  if(!isDocument(input))return null;
  const previous=readPendingNotebookSync(scope);
  const base=new Map((isDocument(baseline)?baseline.entries:[]).map(e=>[e.id,JSON.stringify(e)]));
  const existingFolders=new Set((isDocument(baseline)?baseline.folders??[]:[]).map(f=>f.id));
  const changed=new Set(previous?.changedEntryIds??[]);
  const created=new Set(previous?.createdEntryIds??[]);
  const trashed=new Set(previous?.trashedEntryIds??[]);
  const folders=new Set(previous?.createdFolderIds??[]);
  const localEntries=new Set(input.entries.map(e=>e.id));
  const localTrash=new Set((input.trashedEntries??[]).map(t=>t.entry.id));
  for(const entry of input.entries){
    if(base.get(entry.id)!==JSON.stringify(entry)){
      changed.add(entry.id);
      if(!base.has(entry.id))created.add(entry.id);
    }
  }
  for(const entryId of base.keys()){
    if(!localEntries.has(entryId)&&localTrash.has(entryId))trashed.add(entryId);
  }
  for(const folder of input.folders??[]){
    if(!existingFolders.has(folder.id))folders.add(folder.id);
  }
  const marker:PendingNotebookSync={...scope,token:crypto.randomUUID(),
    changedEntryIds:[...changed].filter(id=>localEntries.has(id)),
    createdEntryIds:[...created].filter(id=>localEntries.has(id)),
    trashedEntryIds:[...trashed].filter(id=>!localEntries.has(id)&&localTrash.has(id)),
    createdFolderIds:[...folders].filter(id=>(input.folders??[]).some(f=>f.id===id))};
  try{
    localStorage.setItem(KEY,JSON.stringify(marker));
    return marker.token;
  }catch{return null;}
}
export function clearPendingNotebookSync(scope:NotebookRecoveryScope,token:string){
  try{if(readPendingNotebookSync(scope)?.token===token)localStorage.removeItem(KEY);}
  catch{/* an acknowledged save must not be blocked by storage restrictions */}
}

/** During hydration the cloud wins except for explicitly pending pages
 * whose local revision is newer. Deletions require a later trash tombstone,
 * so an interrupted edit cannot silently remove a newer cloud page. */
export function mergePendingNotebookChanges(
  cloud:unknown,local:unknown,pending:PendingNotebookSync|null,
):NotebookDocument|null{
  const remote=isDocument(cloud)?cloud:null;
  if(!pending||!isDocument(local))return remote;
  const base:NotebookDocument=remote??{schemaVersion:3,entries:[],activeEntryId:null,folders:[],trashedEntries:[]};
  const byId=new Map<string,NotebookEntry>(base.entries.map(entry=>[entry.id,entry]));
  const changed=new Set(pending.changedEntryIds);
  const created=new Set(pending.createdEntryIds);
  let recovered=false;
  for(const entry of local.entries){
    if(!changed.has(entry.id))continue;
    const server=byId.get(entry.id);
    if(server?!newer(entry.updatedAt,server.updatedAt):!created.has(entry.id))continue;
    byId.set(entry.id,entry);
    recovered=true;
  }
  const trashById=new Map<string,TrashedNotebookEntry>(
    (base.trashedEntries??[]).map(item=>[item.entry.id,item]));
  for(const id of pending.trashedEntryIds){
    const tombstone=(local.trashedEntries??[]).find(item=>item.entry.id===id);
    const server=byId.get(id);
    if(!tombstone||!server||!newer(tombstone.deletedAt,server.updatedAt))continue;
    byId.delete(id);
    const previous=trashById.get(id);
    if(!previous||newer(tombstone.deletedAt,previous.deletedAt))
      trashById.set(id,tombstone);
    recovered=true;
  }
  const folders=new Map<string,NotebookFolder>((base.folders??[]).map(f=>[f.id,f]));
  const createdFolders=new Set(pending.createdFolderIds);
  for(const folder of local.folders??[]){
    if(createdFolders.has(folder.id)&&!folders.has(folder.id)){
      folders.set(folder.id,folder);recovered=true;
    }
  }
  if(!recovered)return remote;
  const activeEntryId=local.activeEntryId&&byId.has(local.activeEntryId)
    ?local.activeEntryId:base.activeEntryId&&byId.has(base.activeEntryId)?base.activeEntryId:null;
  return {...base,entries:[...byId.values()],activeEntryId,
    folders:[...folders.values()],trashedEntries:[...trashById.values()]};
}
