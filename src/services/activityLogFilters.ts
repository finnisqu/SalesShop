import type {Activity,Company,Contact,Project,ActivityMetadata} from '../types/crm';
import type {Quote} from '../types/quote';
import {activityRelations} from './activityRelations';
import {companyRelationship, type CompanyRelationship} from './companyRelationship';

export type ActivityMethodFilter='all'|NonNullable<ActivityMetadata['interactionMethod']>;
export type ActivityAudienceFilter='all'|CompanyRelationship|'internal'|'unlinked';
export type ActivityKindFilter='all'|'interactions'|'system';
export interface ActivityLogFilters {
 method:ActivityMethodFilter;audience:ActivityAudienceFilter;kind:ActivityKindFilter;
 period:'all'|'7'|'30'|'90';
}
export const DEFAULT_ACTIVITY_LOG_FILTERS:ActivityLogFilters={
 method:'all',audience:'all',kind:'all',period:'all',
};
const interaction=(activity:Activity)=>Boolean(activity.metadata?.interactionMethod)||
 activity.type==='manual-touchpoint'||activity.type==='notebook-touchpoint';
export function activityAudience(activity:Activity,companies:readonly Company[],
 contacts:readonly Contact[],projects:readonly Project[],quotes:readonly Quote[],
 isInternal:(contact:Contact)=>boolean):Set<ActivityAudienceFilter>{
 const byCompany=new Map(companies.map(c=>[c.id,c]));
 const byPerson=new Map(contacts.map(c=>[c.id,c]));
 const byDeal=new Map(projects.map(p=>[p.id,p]));
 const byQuote=new Map(quotes.map(q=>[q.id,q]));
 const found=new Set<ActivityAudienceFilter>();
 for(const link of activityRelations(activity)){
  const person=link.type==='contact'?byPerson.get(link.id):undefined;
  if(person&&isInternal(person))found.add('internal');
  const companyId=link.type==='company'?link.id:
   person?.companyId??(link.type==='project'?byDeal.get(link.id)?.companyId:
   link.type==='quote'?byQuote.get(link.id)?.companyId:undefined);
  const company=companyId?byCompany.get(companyId):undefined;
  if(company)found.add(companyRelationship(company));
 }
 if(!found.size)found.add('unlinked');
 return found;
}
export function matchesActivityFilters(activity:Activity,filters:ActivityLogFilters,
 companies:readonly Company[],contacts:readonly Contact[],projects:readonly Project[],
 quotes:readonly Quote[],isInternal:(contact:Contact)=>boolean,now=new Date()):boolean{
 const manual=interaction(activity);
 if(filters.kind==='interactions'&&!manual)return false;
 if(filters.kind==='system'&&manual)return false;
 if(filters.method!=='all'&&activity.metadata?.interactionMethod!==filters.method)return false;
 if(filters.period!=='all'){
  const occurred=Date.parse(activity.occurredAt);
  const days=Number(filters.period);
  if(!Number.isFinite(occurred)||occurred<now.getTime()-days*86400000||occurred>now.getTime())return false;
 }
 if(filters.audience!=='all'&&!activityAudience(activity,companies,contacts,projects,quotes,isInternal).has(filters.audience))return false;
 return true;
}
