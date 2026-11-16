import type {Contact,Project} from '../types/crm';
import type {DealPersonLink} from '../store/dealPeopleStore';
import type {GmailThreadSummary} from './gmailRead359a';
import type {EmailTarget} from './emailThreadLinks359a';
export interface EmailTargetSuggestion extends EmailTarget {reason:string;rank:number}
/** Suggest exact matching CRM contacts first. A shared Company can suggest a Deal
 * but never auto-associate correspondence with every company opportunity. */
export function emailTargetSuggestions(thread:GmailThreadSummary,
 contacts:readonly Contact[],deals:readonly Project[],
 directLinks:readonly DealPersonLink[]=[]):EmailTargetSuggestion[]{
 const participants=new Set(thread.participants.map(p=>p.trim().toLowerCase()));
 const matches=contacts.filter(c=>c.email&&participants.has(c.email.trim().toLowerCase()));
 const personIds=new Set(matches.map(p=>p.id));
 const companyIds=new Set(matches.map(p=>p.companyId).filter(Boolean));
 const items:EmailTargetSuggestion[]=[
  ...matches.map(person=>({kind:'person' as const,id:person.id,title:person.name||person.email||'Person',
   reason:'Email address matches participant',rank:100})),
 ];
 for(const deal of deals){
  if(directLinks.some(link=>link.dealId===deal.id&&personIds.has(link.personId))){
   items.push({kind:'deal',id:deal.id,title:deal.name,reason:'Participant directly linked to Deal',rank:90});
  }else if(deal.companyId&&companyIds.has(deal.companyId)){
   items.push({kind:'deal',id:deal.id,title:deal.name,reason:'Participant belongs to Deal Company',rank:50});
  }
 }
 return items.sort((a,b)=>b.rank-a.rank||a.title.localeCompare(b.title)).slice(0,12);
}
