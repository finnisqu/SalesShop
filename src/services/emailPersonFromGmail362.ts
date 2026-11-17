/** Conservative Gmail-to-CRM creation suggestions.
 * Domain/name evidence is advisory; only user confirmation writes CRM records.
 */
import type {Company,Contact} from '../types/crm';
import {normalizeCompanyLooseIdentity} from './crmIdentity';
import {isOurCompany} from './companyRelationship';
import {personEmailAddress} from './emailAutoMatch361';
import type {GmailThreadSummary} from './gmailRead359a';

const publicDomains=new Set([
 'gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','ymail.com',
 'hotmail.com','hotmail.co.uk','outlook.com','outlook.co.uk','live.com',
 'msn.com','aol.com','icloud.com','me.com','mac.com','proton.me',
 'protonmail.com','pm.me','mail.com','gmx.com','gmx.net','zoho.com',
 'fastmail.com','hey.com','qq.com','163.com','att.net','comcast.net',
 'verizon.net','bellsouth.net','cox.net','charter.net','sbcglobal.net'
]);
export function emailDomain(address:string):string|null {
 const email=personEmailAddress(address);
 return email?email.slice(email.indexOf('@')+1):null;
}
export function isPersonalEmailDomain(domain:string):boolean {
 return publicDomains.has(domain.toLowerCase());
}
export function gmailContactParticipants(thread:GmailThreadSummary,mailbox:string):string[]{
 const own=personEmailAddress(mailbox);
 return [...new Set(thread.participants.map(personEmailAddress)
  .filter((address):address is string=>!!address&&address!==own))].slice(0,50);
}
export function existingPeopleByEmail(contacts:readonly Contact[],address:string):Contact[]{
 const normalized=personEmailAddress(address);
 return normalized?contacts.filter(person=>personEmailAddress(person.email)===normalized):[];
}
export function emailDisplayName(header:string,address:string):string {
 const normalized=personEmailAddress(address);
 if(!normalized)return '';
 // Only trust a display name if its associated header address exactly matches.
 const headerEmail=(header.match(/<([^<>]+)>/)?.[1]??header).trim().toLowerCase();
 if(personEmailAddress(headerEmail)!==normalized)return '';
 const display=header.includes('<')?header.slice(0,header.lastIndexOf('<')).
  trim().replace(/^["']|["']$/g,'').trim():'';
 return display&&display.length<=180&&!/[@\r\n<>]/.test(display)?display:'';
}
export function suggestedPersonName(thread:GmailThreadSummary,address:string):string {
 const from=emailDisplayName(thread.from,address);
 if(from)return from;
 const local=address.split('@')[0].split('+')[0].replace(/[._-]+/g,' ').trim();
 return local?local.replace(/\b[a-z]/g,m=>m.toUpperCase()).slice(0,180):address;
}
export interface SuggestedCompany {company:Company;reason:string;rank:number}
export function suggestedCompaniesFromEmail(address:string,contacts:readonly Contact[],
 companies:readonly Company[]):SuggestedCompany[]{
 const domain=emailDomain(address);
 if(!domain||isPersonalEmailDomain(domain))return [];
 const linkedIds=new Set(contacts.filter(p=>
  emailDomain(p.email??'')===domain&&p.companyId).map(p=>p.companyId));
 const domainStem=(domain.split('.')[0]??'').replace(/[^a-z0-9]/g,'');
 const found:SuggestedCompany[]=[];
 for(const company of companies){
  if(isOurCompany(company))continue;
  if(linkedIds.has(company.id)){
   found.push({company,reason:'Other People at this email domain belong to this Company',rank:100});
  }else{
   const names=[company.name,...(company.aliases??[])];
   if(domainStem.length>=4&&names.some(name=>
     normalizeCompanyLooseIdentity(name).replace(/[^a-z0-9]/g,'')===domainStem)){
    found.push({company,reason:'Company name resembles the email domain',rank:60});
   }
  }
 }
 return found.sort((a,b)=>b.rank-a.rank||a.company.name.localeCompare(b.company.name));
}
