import {describe,it,expect,vi,beforeEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {extractAddresses,summarizeGmailThread,displayGmailThread} from './gmailRead359a';
import {emailWorkspaceScope,emailLinksKey,normalizeMailbox,validateEmailLink,
 loadEmailLinks,saveEmailLinks} from './emailThreadLinks359a';
import {emailTargetSuggestions} from './emailThreadMatching359a';
import type {Contact,Project} from '../types/crm';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const values=new Map<string,string>();
beforeEach(()=>{
 values.clear();
 vi.stubGlobal('localStorage',{
  getItem:(k:string)=>values.get(k)??null,
  setItem:(k:string,v:string)=>{values.set(k,v);},
 });
});
const sample={id:'18df9',messages:[{id:'m1',internalDate:'1794859200000',
 payload:{headers:[
  {name:'From',value:'Builder One <Builder@Customer.com>'},
  {name:'To',value:'Sales Rep <rep@example.com>'},
  {name:'Subject',value:'Pricing for Cedar Apartments'},
 ]},snippet:'Please see quote.'}]};
describe('Gmail provider / CRM linking #359a',()=>{
 it('extracts exact normalized email participants from real headers',()=>{
  expect(extractAddresses('Alice <A@example.com>, B@EXAMPLE.COM')).toEqual(['a@example.com','b@example.com']);
  const normalized=summarizeGmailThread(sample);
  expect(normalized.subject).toBe('Pricing for Cedar Apartments');
  expect(normalized.participants).toEqual(['builder@customer.com','rep@example.com']);
  expect(normalized.messageCount).toBe(1);
  expect(displayGmailThread(sample).messages[0].text).toBe('Please see quote.');
 });
 it('suggests a matching Person before linked/Company Deals, never attaches automatically',()=>{
  const contact={id:'p1',name:'Builder',email:'Builder@Customer.com',
   companyId:'c1'} as Contact;
  const other={id:'p2',name:'Other',email:'other@example.com'} as Contact;
  const deals=[{id:'d1',name:'Cedar',companyId:'c1'} as Project,
   {id:'d2',name:'Unrelated',companyId:'c2'} as Project];
  const suggested=emailTargetSuggestions(summarizeGmailThread(sample),[contact,other],deals);
  expect(suggested.map(s=>s.kind+':'+s.id)).toEqual(['person:p1','deal:d1']);
 });
 it('isolates linked conversations by SalesShop org+user and mailbox',()=>{
  const alice=emailWorkspaceScope('cloud','org','alice')!,bob=emailWorkspaceScope('cloud','org','bob')!;
  expect(emailWorkspaceScope('local')).toBeNull();
  expect(emailLinksKey(alice)).not.toBe(emailLinksKey(bob));
  const linked={id:'link1',provider:'gmail' as const,mailbox:'builder@example.com',
   threadId:'18df9',targetKind:'deal' as const,targetId:'d1',linkedAt:'2026-11-16'};
  saveEmailLinks(alice,[linked]);
  expect(loadEmailLinks(alice)).toEqual([linked]);
  expect(loadEmailLinks(bob)).toEqual([]);
  expect(JSON.stringify(loadEmailLinks(alice))).not.toContain('snippet');
 });
 it('refuses malformed mailbox and thread IDs rather than leaking arbitrary URLs',()=>{
  expect(normalizeMailbox(' User@Example.com ')).toBe('user@example.com');
  for(const mailbox of ['hello','user@','', 'x @other.com']){
   expect(()=>normalizeMailbox(mailbox)).toThrow();
  }
  expect(()=>validateEmailLink({mailbox:'a@example.com',threadId:'../evil',
   targetKind:'deal',targetId:'d'})).toThrow();
  expect(()=>validateEmailLink({mailbox:'a@example.com',threadId:'18df9',
   targetKind:'deal',targetId:''})).toThrow();
 });
 it('has a real Connected Email page and record-scoped conversation readers',()=>{
  expect(read('components/RecordsSectionNav.tsx')).toContain("id:'email',label:'Email'");
  expect(read('components/Connections.tsx')).toContain("tab==='email'&&<EmailWorkspace");
  expect(read('components/DealRecordPage.tsx')).toContain('<RecordEmailThreadsPanel kind="deal"');
  expect(read('components/PersonRecordPage.tsx')).toContain('<RecordEmailThreadsPanel kind="person"');
  expect(read('App.tsx')).toContain('<EmailAccountBoundary/>');
 });
 it('does not save tokens or message bodies and requires explicit CRM linking',()=>{
  const storage=read('services/emailThreadLinks359a.ts');
  expect(storage).not.toContain('access_token');
  expect(storage).not.toContain('messageBody');
  expect(read('components/EmailWorkspace.tsx')).toContain('Link conversation');
  expect(read('components/EmailWorkspace.tsx')).toContain('No email or text');
 });
});
