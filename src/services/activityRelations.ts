import type {Activity,ActivityMetadata} from '../types/crm';

export type ActivityRelation=NonNullable<ActivityMetadata['relatedRecords']>[number];
const allowed=new Set<ActivityRelation['type']>(['contact','company','project','quote']);
/** Legacy CRM Activity columns hold one record per type. The extra associations
 * live in metadata JSONB and survive normalized CRM round-trips. */
export function activityRelations(activity:Activity):ActivityRelation[]{
 const legacy:ActivityRelation[]=[
  ...(activity.contactId?[{type:'contact' as const,id:activity.contactId}]:[]),
  ...(activity.companyId?[{type:'company' as const,id:activity.companyId}]:[]),
  ...(activity.projectId?[{type:'project' as const,id:activity.projectId}]:[]),
  ...(activity.quoteId?[{type:'quote' as const,id:activity.quoteId}]:[]),
 ];
 const stored=activity.metadata?.relatedRecords;
 // Older data and imported CRM metadata may not contain a valid list.
 const list=Array.isArray(stored)?stored:legacy;
 const seen=new Set<string>();
 return list.filter(item=>{
  if(!item||!allowed.has(item.type)||typeof item.id!=='string'||!item.id.trim())return false;
  const key=item.type+':'+item.id;
  if(seen.has(key))return false;
  seen.add(key);return true;
 }).map(item=>({...item}));
}

/**
 * New interactions may be logged from a Person, Deal or Quote without manually
 * selecting each parent record. Materialize those factual links in the saved
 * metadata too, rather than writing hidden primary columns the history reader
 * cannot see. Explicit selections take precedence and edits remain opt-in.
 */
export function activityRelationsWithContext(
 selected:readonly ActivityRelation[],
 contacts:readonly {id:string;companyId?:string}[],
 deals:readonly {id:string;companyId?:string}[],
 quotes:readonly {id:string;projectId?:string;companyId?:string}[],
):ActivityRelation[]{
 const all:ActivityRelation[]=[];
 const seen=new Set<string>();
 const add=(type:ActivityRelation['type'],id:string|undefined)=>{
  if(!id)return;
  const key=type+':'+id;
  if(seen.has(key))return;
  seen.add(key);all.push({type,id});
 };
 for(const link of selected){
  if(!link?.id||!allowed.has(link.type))continue;
  const key=link.type+':'+link.id;
  if(seen.has(key))continue;
  seen.add(key);all.push({...link});
 }
 for(const link of selected){
  if(link.type==='contact')add('company',contacts.find(c=>c.id===link.id)?.companyId);
  if(link.type==='project')add('company',deals.find(d=>d.id===link.id)?.companyId);
  if(link.type==='quote'){
   const quote=quotes.find(q=>q.id===link.id);
   add('project',quote?.projectId);
   add('company',quote?.companyId);
  }
 }
 // A Quote's Deal may own the Company even when the Quote doesn't.
 for(const link of [...all]){
  if(link.type==='project')add('company',deals.find(d=>d.id===link.id)?.companyId);
 }
 return all;
}

export function primaryActivityRelations(links:readonly ActivityRelation[]){
 const first=(type:ActivityRelation['type'])=>links.find(link=>link.type===type)?.id;
 return {contactId:first('contact'),companyId:first('company'),
  projectId:first('project'),quoteId:first('quote')};
}

export function activityDisplayName(links:readonly ActivityRelation[]):string{
 const picked=links.find(link=>link.type==='contact')??links[0];
 return picked?.label?.replace(/^(Quote|Deal|Company|Person) · /,'').trim()||'related record';
}

export function activityMethodSummary(method:NonNullable<ActivityMetadata['interactionMethod']>,
 links:readonly ActivityRelation[]):string{
 const titles:Record<typeof method,string>={
  'call':'Call','email':'Email','text':'Text','video-call':'Video call','in-person':'In-person meeting',
 };
 return titles[method]+' with '+activityDisplayName(links);
}
