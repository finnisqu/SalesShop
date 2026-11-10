import type {Activity,ActivityMetadata} from '../types/crm';

/** Last completed interaction with a person, excluding account creation,
 * automatic stage changes and other CRM system activity. */
export interface PersonLastContact {occurredAt:string;method?:ActivityMetadata['interactionMethod'];}

export function personLastContactIndex(activities:readonly Activity[]):Map<string,PersonLastContact>{
 const latest=new Map<string,PersonLastContact>();
 for(const activity of activities){
  if(activity.type!=='manual-touchpoint'&&activity.type!=='notebook-touchpoint')continue;
  const timestamp=Date.parse(activity.occurredAt);
  if(!Number.isFinite(timestamp)||timestamp>Date.now()+60_000)continue;
  const related=Array.isArray(activity.metadata?.relatedRecords)?
    activity.metadata.relatedRecords.filter(link=>link?.type==='contact').map(link=>link.id):[];
  const personIds=new Set([activity.contactId,...related].filter((id):id is string=>Boolean(id&&id.trim())));
  for(const id of personIds){
   const previous=latest.get(id);
   if(previous&&Date.parse(previous.occurredAt)>=timestamp)continue;
   latest.set(id,{occurredAt:activity.occurredAt,method:activity.metadata?.interactionMethod});
  }
 }
 return latest;
}
