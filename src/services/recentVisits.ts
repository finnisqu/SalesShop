import type {AppView,CatalogSection,NavigationLocation} from '../store/navigationStore';

/** Persist only destinations, never contact names or other CRM data. */
export type RecentVisit =
 | {kind:'view';id:AppView}
 | {kind:'catalog';id:CatalogSection}
 | {kind:'deal'|'company'|'person'|'quote'|'notebook';id:string};

const VIEW_IDS:readonly string[]=['home','notebook','board','quotes','tasks','catalog','dashboard','tools','settings'];
const CATALOG_IDS:readonly string[]=['materials','sinks','other','rates','suppliers','tags'];
const RECORD_KINDS:readonly string[]=['deal','company','person','quote','notebook'];
export const RECENT_VISIT_LIMIT=12;

export function recentVisitFromLocation(location:NavigationLocation,pageId:string|null=null):RecentVisit{
 if(location.view==='dashboard'){
  if(location.focusedProjectId)return {kind:'deal',id:location.focusedProjectId};
  if(location.focusedCompanyId)return {kind:'company',id:location.focusedCompanyId};
  if(location.focusedContactId)return {kind:'person',id:location.focusedContactId};
 }
 if(location.view==='quotes'&&location.focusedQuoteId)
  return {kind:'quote',id:location.focusedQuoteId};
 if(location.view==='notebook'&&pageId)return {kind:'notebook',id:pageId};
 if(location.view==='catalog')return {kind:'catalog',id:location.catalogSection};
 return {kind:'view',id:location.view};
}

/** Most recent first; revisits move an existing entry without duplicating it. */
export function rememberRecentVisit(items:readonly RecentVisit[],next:RecentVisit):RecentVisit[]{
 if(items[0]?.kind===next.kind&&items[0].id===next.id)return items as RecentVisit[];
 return [next,...items.filter(item=>item.kind!==next.kind||item.id!==next.id)]
  .slice(0,RECENT_VISIT_LIMIT);
}

/** Defensive parser for localStorage, including invalid or older app data. */
export function parseRecentVisits(raw:string|null):RecentVisit[]{
 if(!raw)return [];
 try{
  const parsed:unknown=JSON.parse(raw);
  if(!Array.isArray(parsed))return [];
  const valid:RecentVisit[]=[];
  for(const candidate of parsed){
   if(!candidate||typeof candidate!=='object')continue;
   const item=candidate as Record<string,unknown>;
   if(typeof item.id!=='string'||!item.id||item.id.length>160||typeof item.kind!=='string')continue;
   let visit:RecentVisit|undefined;
   if(item.kind==='view'&&VIEW_IDS.includes(item.id))
    visit={kind:'view',id:item.id as AppView};
   else if(item.kind==='catalog'&&CATALOG_IDS.includes(item.id))
    visit={kind:'catalog',id:item.id as CatalogSection};
   else if(RECORD_KINDS.includes(item.kind))
    visit={kind:item.kind as 'deal'|'company'|'person'|'quote'|'notebook',id:item.id};
   if(visit&&!valid.some(v=>v.kind===visit.kind&&v.id===visit.id))valid.push(visit);
   if(valid.length===RECENT_VISIT_LIMIT)break;
  }
  return valid;
 }catch{return [];}
}
