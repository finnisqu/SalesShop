/** Explicit Gmail-to-personal-Task follow-ups. No raw Gmail identity is persisted. */
import type {Company,Contact,Project} from '../types/crm';
import type {PersonalTask,TaskAssociation} from '../store/personalTaskStore';
import {localDateKey} from './salesCalendar';

export function gmailFollowUpSourceId(fingerprint:string):string{
 if(!/^[a-f0-9]{64}$/.test(fingerprint))
  throw new Error('A verified Gmail message fingerprint is required.');
 return 'gmail-followup:'+fingerprint;
}

/** One active or completed follow-up per message, per signed-in personal Task store.
 * Deleting the original Task explicitly allows creating a new one.
 */
export function existingGmailFollowUp(tasks:readonly PersonalTask[],
 fingerprint:string):PersonalTask|undefined{
 const source=gmailFollowUpSourceId(fingerprint);
 return tasks.find(task=>!task.deletedAt&&task.sourceObjectId===source);
}

export function gmailFollowUpTomorrow(now=new Date()):string{
 return gmailFollowUpDateAfter(1,now);
}
export function gmailFollowUpDateAfter(days:number,now=new Date()):string{
 const offset=Number.isInteger(days)&&days>=0&&days<=365?days:1;
 return localDateKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset,12));
}
/** Calendar-accurate local date; prevent accidentally scheduling a task in the past. */
export function isValidGmailFollowUpDate(value:string,today=localDateKey(new Date())):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<today)return false;
 const year=Number(value.slice(0,4)),month=Number(value.slice(5,7)),day=Number(value.slice(8,10));
 if(year<2000||year>9998)return false;
 const parsed=new Date(year,month-1,day,12);
 return Number.isFinite(parsed.getTime())&&localDateKey(parsed)===value;
}
export function gmailFollowUpTitle(personName:string):string{
 const name=personName.trim().slice(0,190)||'customer';
 return 'Follow up · '+name;
}
export function gmailFollowUpNotes(subject:string,date:string):string{
 const clean=subject.trim().replace(/[\r\n]+/g,' ').slice(0,300);
 const parsed=Date.parse(date);
 return (clean&&clean!=='(No subject)'?'Regarding: '+clean:'Follow up on email')+
  (Number.isFinite(parsed)?'\nEmail dated '+new Date(parsed).toLocaleDateString():'');
}
export function gmailFollowUpAssociations(person:Contact,companies:readonly Company[],
 deal?:Project,explicitCompanyId?:string):TaskAssociation[]{
 const result:TaskAssociation[]=[{type:'contact',id:person.id,label:'Person · '+person.name}];
 const personCompany=person.companyId&&companies.find(c=>c.id===person.companyId);
 const company=personCompany??companies.find(c=>!person.companyId&&c.id===explicitCompanyId);
 if(company)result.push({type:'company',id:company.id,label:'Company · '+company.name});
 if(deal){
  if(company?.id&&deal.companyId&&deal.companyId!==company.id)
   throw new Error('The Deal and Person are associated with different Companies.');
  result.push({type:'project',id:deal.id,label:'Deal · '+deal.name});
  if(!company&&deal.companyId){
   const fromDeal=companies.find(c=>c.id===deal.companyId);
   if(fromDeal)result.push({type:'company',id:fromDeal.id,label:'Company · '+fromDeal.name});
  }
 }
 return result;
}
