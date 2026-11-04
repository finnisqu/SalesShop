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
 const list=stored===undefined?legacy:stored;
 const seen=new Set<string>();
 return list.filter(item=>{
  if(!item||!allowed.has(item.type)||typeof item.id!=='string'||!item.id.trim())return false;
  const key=item.type+':'+item.id;
  if(seen.has(key))return false;
  seen.add(key);return true;
 }).map(item=>({...item}));
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
