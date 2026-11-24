/** #395 — in-memory discovery of CRM People from actual Gmail message text.
 * Exact addresses only; never infer that a quoted address sent the message.
 * Nothing here creates a contact, saves a message, or sends email anywhere.
 */
import type {Contact} from '../types/crm';
import {personEmailAddress} from './emailAutoMatch361';
import {extractAddresses,type GmailThreadDetails,type GmailThreadSummary}
 from './gmailRead359a';

export type GmailAddressEvidence395='reply-to'|'header'|'body';
export interface GmailAddressFinding395 {
 address:string;evidence:GmailAddressEvidence395;people:Contact[];
}
const priority:Record<GmailAddressEvidence395,number>={
 'reply-to':3,body:2,header:1,
};
export function gmailAddressesInDetails395(
 details:GmailThreadDetails,mailbox:string,
):Array<{address:string;evidence:GmailAddressEvidence395}> {
 const own=personEmailAddress(mailbox);
 const found=new Map<string,GmailAddressEvidence395>();
 const add=(raw:string,evidence:GmailAddressEvidence395)=>{
  const address=personEmailAddress(raw);
  if(!address||address===own)return;
  if(priority[evidence]>(priority[found.get(address)??'header']??0)||
     !found.has(address))found.set(address,evidence);
 };
 for(const message of details.messages){
  for(const address of extractAddresses(message.replyTo??''))add(address,'reply-to');
  for(const header of [message.from,message.to,message.cc??'']){
   for(const address of extractAddresses(header))add(address,'header');
  }
  // scanText contains more forwarded/quoted material than the displayed excerpt.
  for(const address of extractAddresses(message.searchText??message.text))add(address,'body');
 }
 for(const address of details.summary.participants)add(address,'header');
 return [...found].map(([address,evidence])=>({address,evidence})).slice(0,120);
}
export function gmailAddressFindings395(
 details:GmailThreadDetails,contacts:readonly Contact[],mailbox:string,
):GmailAddressFinding395[]{
 const byEmail=new Map<string,Contact[]>();
 for(const person of contacts){
  const address=personEmailAddress(person.email);
  if(!address)continue;
  const group=byEmail.get(address)??[];
  group.push(person);byEmail.set(address,group);
 }
 return gmailAddressesInDetails395(details,mailbox)
  .map(({address,evidence})=>({address,evidence,people:byEmail.get(address)??[]}))
  .sort((a,b)=>Number(b.people.length>0)-Number(a.people.length>0)||
   priority[b.evidence]-priority[a.evidence]||a.address.localeCompare(b.address))
  .slice(0,80);
}
/** Update the visible thread's CRM matching after its body has been inspected.
 * Content/addresses live in memory only and are discarded on account switch.
 */
export function gmailThreadWithAddresses395(
 thread:GmailThreadSummary,found:readonly {address:string}[],
):GmailThreadSummary{
 return {...thread,participants:[...new Set([
  ...thread.participants.map(v=>v.toLowerCase()),
  ...found.map(item=>item.address),
 ])]};
}
export function gmailEvidenceLabel395(kind:GmailAddressEvidence395):string{
 return kind==='reply-to'?'Reply-To':kind==='body'?'Message / forwarded chain':'Mail header';
}
