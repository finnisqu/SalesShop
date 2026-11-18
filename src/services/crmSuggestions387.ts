/** #387 — deterministic, read-only CRM suggestions from explicit Activity
 * evidence. No LLM calls, contact inference, Notebook scanning or writes. */
import type {Activity,Company,Contact,Project} from '../types/crm';
import type {PersonalTask,TaskAssociation} from '../store/personalTaskStore';
import {normalizeEmail,normalizePersonName} from './crmIdentity';
import {localDay} from './automationRules358b';

export type CrmSuggestionKind='person-create'|'person-link'|'follow-up';
export interface CrmSuggestion {
 id:string;kind:CrmSuggestionKind;activityId:string;activityAt:string;
 title:string;reason:string;sourceSummary:string;
 proposedName?:string;email?:string;contactId?:string;
 companyId?:string;dueDate?:string;taskTitle?:string;
 taskSourceKey?:string;associations?:TaskAssociation[];
}
export interface CrmSuggestionInput{
 activities:readonly Activity[];contacts:readonly Contact[];
 companies:readonly Company[];deals:readonly Project[];
 tasks:readonly PersonalTask[];mode:'cloud'|'local';userId?:string;
 now:Date;
}
const emailRegex=/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const namedEmail=/(?:\bcontact|\bperson|\bmet with|\bspoke with|\bcalled|\bemailed|\bcontacted)\s*:?\s*([A-Za-z][A-Za-z .'-]{1,64})\s*[<(]\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\s*[>)]/i;
const followUpDate=/(?:follow[\s-]?up|call back|check back)\s*(?:on|by|due)?\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})\b/i;
function validDate(raw:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return false;
 const value=new Date(raw+'T12:00:00Z');
 return Number.isFinite(value.getTime())&&value.toISOString().slice(0,10)===raw;
}
function short(text:string,max=180):string{
 return text.trim().replace(/\s+/g,' ').slice(0,max);
}
function fingerprint(value:string):string{
 // Non-cryptographic version marker, never used for permission checks.
 let hash=2166136261;
 for(let i=0;i<value.length;i++){
  hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);
 }
 return (hash>>>0).toString(36);
}
function activityText(activity:Activity):string{
 return (activity.summary+'\n'+(activity.metadata?.notes??'')).slice(0,3000);
}
function associationsForActivity(
 a:Activity,companies:readonly Company[],deals:readonly Project[],
 contacts:readonly Contact[],
):TaskAssociation[]{
 const result:TaskAssociation[]=[];
 const project=deals.find(item=>item.id===a.projectId);
 if(project)result.push({type:'project',id:project.id,label:'Deal · '+project.name});
 const company=companies.find(item=>item.id===a.companyId);
 if(company)result.push({type:'company',id:company.id,label:'Company · '+company.name});
 const person=contacts.find(item=>item.id===a.contactId);
 if(person)result.push({type:'contact',id:person.id,label:'Person · '+person.name});
 return result;
}
export function proposeCrmSuggestions(input:CrmSuggestionInput):CrmSuggestion[]{
 const {activities,contacts,companies,deals,tasks,mode,userId,now}=input;
 if(!Number.isFinite(now.getTime())||(mode==='cloud'&&!userId))return [];
 const proposals:CrmSuggestion[]=[];
 const today=localDay(now);
 const matchedTaskKeys=new Set(tasks.map(task=>task.sourceObjectId).filter(Boolean));
 const allowedActivities=activities.filter(a=>{
  if(a.type!=='manual-touchpoint'&&a.type!=='notebook-touchpoint')return false;
  // For cloud mode, refuse un-attributed legacy events or another rep's
  // notes; owner/admin permissions do not imply personal-suggestion consent.
  if(mode==='cloud'&&a.metadata?.recordedByUserId!==userId)return false;
  const age=now.getTime()-Date.parse(a.occurredAt);
  return Number.isFinite(age)&&age>=0&&age<=60*86400000;
 }).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,120);
 for(const activity of allowedActivities){
  const raw=activityText(activity);
  const sourceSummary=short(activity.summary,240);
  const version=fingerprint(raw+'|'+activity.contactId+'|'+activity.companyId+
   '|'+activity.projectId+'|'+activity.occurredAt);
  const matches=[...new Set((raw.match(emailRegex)??[]).map(email=>email.toLowerCase()))];
  if(matches.length===1&&!activity.contactId&&!activity.metadata?.relatedRecords?.some(
   relation=>relation.type==='contact')){
   const email=matches[0];
   const found=contacts.filter(person=>normalizeEmail(person.email)===email);
   if(found.length===1){
    const person=found[0];
    if(!activity.companyId||!person.companyId||person.companyId===activity.companyId)
     proposals.push({
      id:'suggestion:link:'+activity.id+':'+version,
      kind:'person-link',activityId:activity.id,activityAt:activity.occurredAt,
      sourceSummary,title:'Link '+person.name+' to this Activity',
      reason:'The Activity contains a unique existing Person email. No contact is currently linked.',
      contactId:person.id,companyId:activity.companyId,email,
     });
   }else if(found.length===0){
    const explicit=raw.match(namedEmail);
    const name=explicit?.[1]?.trim();
    const named=explicit?.[2]?.toLowerCase();
    // Require an explicit, non-generic name coupled to this email.
    if(name&&name.split(/\s+/).length>=2&&name.length<=75&&named===email&&
      !contacts.some(person=>normalizePersonName(person.name)===normalizePersonName(name))){
     proposals.push({
      id:'suggestion:person:'+activity.id+':'+version,
      kind:'person-create',activityId:activity.id,activityAt:activity.occurredAt,
      sourceSummary,title:'Add '+name+' to People',
      reason:'The Activity explicitly names a Person alongside an email address not in CRM.',
      proposedName:name,email,companyId:activity.companyId,
     });
    }
   }
  }
  const matched=raw.match(followUpDate);
  const dueDate=matched?.[1];
  if(dueDate&&validDate(dueDate)){
   const days=(Date.parse(dueDate+'T12:00:00Z')-
    Date.parse(today+'T12:00:00Z'))/86400000;
   const key='suggestion:follow-up:'+activity.id;
   const associated=tasks.some(task=>!task.deletedAt&&task.dueDate===dueDate&&
    task.associations?.some(link=>
     link.type==='project'&&link.id===activity.projectId||
     link.type==='contact'&&link.id===activity.contactId));
   if(days>=-30&&days<=90&&!matchedTaskKeys.has(key)&&!associated){
    const links=associationsForActivity(activity,companies,deals,contacts);
    const context=links[0]?.label?.replace(/^(Deal|Company|Person) · /,'')||
     sourceSummary.slice(0,75);
    proposals.push({
     id:'suggestion:task:'+activity.id+':'+version,
     kind:'follow-up',activityId:activity.id,activityAt:activity.occurredAt,
     sourceSummary,title:'Create a follow-up Task',
     reason:'Explicit follow-up date '+dueDate+' was written in the Activity.',
     dueDate,taskTitle:'Follow up · '+context.slice(0,80),
     taskSourceKey:key,associations:links,
    });
   }
  }
 }
 return proposals.slice(0,90);
}
