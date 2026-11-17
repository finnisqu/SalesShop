import {create} from 'zustand';
import {fileTargetKey,loadFileLinks,saveFileLinks,validateFileLinkDraft,
 type FileLinkRecord,type FileLinkDraft} from '../services/fileLinks357a';

interface FileLinkStore {
 scope:string|null;records:FileLinkRecord[];
 hydrate:(scope:string|null)=>void;
 add:(input:FileLinkDraft)=>FileLinkRecord;
 edit:(id:string,patch:Pick<FileLinkDraft,'title'|'url'|'kind'|'category'>)=>void;
 remove:(id:string)=>void;
}
const generateId=()=>typeof crypto!=='undefined'&&'randomUUID'in crypto
 ?crypto.randomUUID():'local-'+Date.now()+'-'+Math.random().toString(36).slice(2);
export const useFileLinkStore=create<FileLinkStore>((set,get)=>({
 scope:null,records:[],
 hydrate(scope){
  if(get().scope===scope)return;
  set({scope,records:scope?loadFileLinks(scope):[]});
 },
 add(input){
  const state=get(),scope=state.scope;
  if(!scope)throw new Error('Sign in to your workspace before saving a link.');
  const safe=validateFileLinkDraft(input);
  const duplicate=state.records.some(row=>
   fileTargetKey({kind:row.targetKind,id:row.targetId})===fileTargetKey({kind:safe.targetKind,id:safe.targetId})&&
   row.url===safe.url);
  if(duplicate)throw new Error('This link is already attached to that record.');
  const now=new Date().toISOString();
  const record:FileLinkRecord={...safe,id:generateId(),createdAt:now,updatedAt:now};
  const next=[record,...state.records];
  saveFileLinks(scope,next);
  set({records:next});return record;
 },
 edit(id,patch){
  const state=get(),scope=state.scope;
  if(!scope)throw new Error('File links are not ready.');
  const prior=state.records.find(row=>row.id===id);
  if(!prior)throw new Error('This link is no longer available.');
  const safe=validateFileLinkDraft({...prior,...patch});
  if(state.records.some(row=>row.id!==id&&row.url===safe.url&&
    row.targetId===safe.targetId&&row.targetKind===safe.targetKind))
    throw new Error('This link is already attached to that record.');
  const next=state.records.map(row=>row.id===id?{
   ...row,title:safe.title,url:safe.url,kind:safe.kind,category:safe.category??'other',
   updatedAt:new Date().toISOString(),
  }:row);
  saveFileLinks(scope,next);set({records:next});
 },
 remove(id){
  const state=get(),scope=state.scope;
  if(!scope)throw new Error('File links are not ready.');
  if(!state.records.some(row=>row.id===id))return;
  const next=state.records.filter(row=>row.id!==id);
  saveFileLinks(scope,next);set({records:next});
 },
}));
