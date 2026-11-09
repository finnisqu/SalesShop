import {create} from 'zustand';
import {supabase} from '../lib/supabase';

export interface DealPersonLink{
 dealId:string;personId:string;role?:string;createdAt:string;
}
interface State{
 scope:string|null;loaded:boolean;loading:boolean;error:string|null;links:DealPersonLink[];
 load:(scope:string|null,force?:boolean)=>Promise<void>;
 add:(dealId:string,personId:string,role?:string)=>Promise<void>;
 setRole:(dealId:string,personId:string,role:string)=>Promise<void>;
 remove:(dealId:string,personId:string)=>Promise<void>;
}
const storageKey='salesshop:deal-people:v1';
const cleanRole=(value?:string)=>value?.trim().slice(0,120)||undefined;
const isLocal=(scope:string)=>scope==='local';
function localLinks():DealPersonLink[]{
 try{
  const value=JSON.parse(localStorage.getItem(storageKey)??'[]') as unknown;
  if(!Array.isArray(value))return [];
  return value.filter((item):item is DealPersonLink=>Boolean(item&&typeof item==='object'&&
   typeof item.dealId==='string'&&typeof item.personId==='string'&&typeof item.createdAt==='string'))
   .map(item=>({...item,role:cleanRole(item.role)}));
 }catch{return [];}
}
function saveLocal(links:DealPersonLink[]){
 try{localStorage.setItem(storageKey,JSON.stringify(links));}catch{/* no browser storage */}
}
const scopeOrg=(scope:string)=>scope.startsWith('org:')?scope.slice(4):null;
let loadSerial=0;
export const useDealPeopleStore=create<State>((set,get)=>({
 scope:null,loaded:false,loading:false,error:null,links:[],
 load:async(scope,force=false)=>{
  if(!scope){loadSerial++;set({scope:null,loaded:false,loading:false,error:null,links:[]});return;}
  if(get().scope===scope&&get().loaded&&!force)return;
  if(get().scope===scope&&get().loading)return;
  const seq=++loadSerial;
  set({scope,loaded:false,loading:true,error:null,links:[]});
  if(isLocal(scope)){
   if(seq===loadSerial)set({links:localLinks(),loaded:true,loading:false});
   return;
  }
  try{
   if(!supabase)throw new Error('Supabase is unavailable.');
   const org=scopeOrg(scope);
   if(!org)throw new Error('Missing workspace.');
   const {data,error}=await supabase.from('deal_people')
    .select('deal_id,person_id,role,created_at').eq('organization_id',org)
    .order('created_at',{ascending:true}).limit(5000);
   if(error)throw error;
   if(seq!==loadSerial||get().scope!==scope)return;
   set({links:(data??[]).map(row=>({
    dealId:String(row.deal_id),personId:String(row.person_id),
    role:cleanRole(row.role??undefined),createdAt:String(row.created_at),
   })),loaded:true,loading:false});
  }catch(e){if(seq===loadSerial)set({loaded:false,loading:false,
    error:e instanceof Error?e.message:'Unable to load Deal contacts.'});}
 },
 add:async(dealId,personId,role)=>{
  const {scope,loaded,links}=get();
  if(!scope||!loaded)throw new Error('Deal contacts are still loading.');
  if(!dealId||!personId)throw new Error('Choose a Deal and Person.');
  if(links.some(link=>link.dealId===dealId&&link.personId===personId))
   throw new Error('This Person is already linked to this Deal.');
  const next:DealPersonLink={dealId,personId,role:cleanRole(role),createdAt:new Date().toISOString()};
  if(!isLocal(scope)){
   if(!supabase)throw new Error('Supabase is unavailable.');
   const org=scopeOrg(scope);
   if(!org)throw new Error('Missing workspace.');
   const {data,error}=await supabase.from('deal_people').insert({
    organization_id:org,deal_id:dealId,person_id:personId,role:next.role??null,
   }).select('created_at').single();
   if(error)throw error;
   next.createdAt=String(data.created_at);
  }
  if(get().scope!==scope)return;
  const updated=[...get().links,next];set({links:updated});
  if(isLocal(scope))saveLocal(updated);
 },
 setRole:async(dealId,personId,role)=>{
  const {scope,loaded,links}=get();
  if(!scope||!loaded)throw new Error('Deal contacts are still loading.');
  if(!links.some(x=>x.dealId===dealId&&x.personId===personId))throw new Error('Link not found.');
  const nextRole=cleanRole(role);
  if(!isLocal(scope)){
   const org=scopeOrg(scope);
   if(!supabase||!org)throw new Error('Supabase is unavailable.');
   const {data,error}=await supabase.from('deal_people').update({role:nextRole??null})
    .eq('organization_id',org).eq('deal_id',dealId).eq('person_id',personId)
    .select('deal_id');
   if(error)throw error;
   if(!data?.length)throw new Error('No permission to edit this Deal contact.');
  }
  if(get().scope!==scope)return;
  const updated=get().links.map(x=>x.dealId===dealId&&x.personId===personId?
   {...x,role:nextRole}:x);
  set({links:updated});if(isLocal(scope))saveLocal(updated);
 },
 remove:async(dealId,personId)=>{
  const {scope,loaded,links}=get();
  if(!scope||!loaded)throw new Error('Deal contacts are still loading.');
  if(!links.some(x=>x.dealId===dealId&&x.personId===personId))return;
  if(!isLocal(scope)){
   const org=scopeOrg(scope);
   if(!supabase||!org)throw new Error('Supabase is unavailable.');
   const {data,error}=await supabase.from('deal_people').delete()
    .eq('organization_id',org).eq('deal_id',dealId).eq('person_id',personId)
    .select('deal_id');
   if(error)throw error;
   if(!data?.length)throw new Error('No permission to unlink this Person.');
  }
  if(get().scope!==scope)return;
  const updated=get().links.filter(x=>x.dealId!==dealId||x.personId!==personId);
  set({links:updated});if(isLocal(scope))saveLocal(updated);
 },
}));
export function dealPeopleScope(mode:'cloud'|'local',orgId:string|null){
 return mode==='local'?'local':orgId?'org:'+orgId:null;
}
