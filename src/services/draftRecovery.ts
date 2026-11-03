import {scopedStorageKey} from '../lib/developerPlayground';

/** Private, account-scoped recovery for forms not yet submitted to SalesShop. */
const prefix=scopedStorageKey('salesshop-unsaved-drafts-v1:');
const MAX_AGE_MS=7*24*60*60*1000;

export function draftStorageKey(kind:string,mode:'local'|'cloud',
 organizationId:string|null,userId:string|undefined):string|null{
 if(mode==='cloud'&&(!organizationId||!userId))return null;
 const account=mode==='cloud'?'org:'+organizationId+':user:'+userId:'local:user';
 return prefix+account+':'+kind;
}

export function readSavedDraft<T>(key:string|null):T|null{
 if(!key)return null;
 try{
  const raw=window.localStorage.getItem(key);
  if(!raw)return null;
  const parsed=JSON.parse(raw) as {savedAt?:number;value?:T};
  if(!parsed||typeof parsed.savedAt!=='number'||
    parsed.savedAt>Date.now()+60000||Date.now()-parsed.savedAt>MAX_AGE_MS){
   window.localStorage.removeItem(key);return null;
  }
  return parsed.value??null;
 }catch{return null;}
}
export function writeSavedDraft<T>(key:string|null,value:T){
 if(!key)return;
 try{window.localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),value}));}
 catch{/* Browser storage can be full or disabled; don't interrupt editing. */}
}
export function clearSavedDraft(key:string|null){
 if(!key)return;
 try{window.localStorage.removeItem(key);}catch{/* best effort */}
}
