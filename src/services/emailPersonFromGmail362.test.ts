import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {useCrmStore} from '../store/crmStore';
import {useAuthStore} from '../store/authStore';
import {emailDomain,emailDisplayName,gmailContactParticipants,existingPeopleByEmail,
 isPersonalEmailDomain,suggestedCompaniesFromEmail,suggestedPersonName} from './emailPersonFromGmail362';
import type {GmailThreadSummary} from './gmailRead359a';
import type {Company,Contact} from '../types/crm';
const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const data=new Map<string,string>();
beforeEach(()=>{
 data.clear();vi.stubGlobal('localStorage',{
  getItem:(key:string)=>data.get(key)??null,
  setItem:(key:string,val:string)=>{data.set(key,val);},
 });
 useAuthStore.setState({mode:'local',user:null,organizationId:null});
 useCrmStore.setState({companies:[],contacts:[],projects:[],activities:[],hydrated:true});
});
afterEach(()=>vi.unstubAllGlobals());
const thread:GmailThreadSummary={
 id:'thread123',subject:'Request',from:'Taylor Builder <taylor@ridge-build.com>',
 participants:['rep@ourshop.com','taylor@ridge-build.com','cc@example.com'],
 date:'2026-11-16T15:00:00Z',snippet:'Quote please',messageCount:2,
};
describe('Gmail to Person creation #362',()=>{
 it('lists only exact participant addresses excluding the signed-in mailbox',()=>{
  expect(gmailContactParticipants(thread,'REP@OURSHOP.COM'))
   .toEqual(['taylor@ridge-build.com','cc@example.com']);
  expect(gmailContactParticipants({...thread,participants:['rep@ourshop.com']},'rep@ourshop.com'))
   .toEqual([]);
 });
 it('prefills a name only from the correct From header',()=>{
  expect(emailDisplayName(thread.from,'taylor@ridge-build.com')).toBe('Taylor Builder');
  expect(emailDisplayName(thread.from,'cc@example.com')).toBe('');
  expect(suggestedPersonName(thread,'taylor@ridge-build.com')).toBe('Taylor Builder');
  expect(suggestedPersonName(thread,'alex.smith+sales@somebiz.com')).toBe('Alex Smith');
 });
 it('recognizes existing People by exact normalized email and avoids name-based merges',()=>{
  const people=[{id:'p1',name:'Taylor',email:' TAYLOR@ridge-build.com '} as Contact,
   {id:'p2',name:'Taylor',email:'taylor@elsewhere.com'} as Contact];
  expect(existingPeopleByEmail(people,'taylor@RIDGE-BUILD.COM').map(p=>p.id)).toEqual(['p1']);
 });
 it('suggests existing companies using other linked People on the same business domain',()=>{
  const companies=[{id:'c1',name:'Ridge Builder'} as Company,
   {id:'c2',name:'Unrelated'} as Company];
  const contacts=[{id:'p1',email:'billing@ridge-build.com',companyId:'c1'} as Contact,
   {id:'p2',email:'other@unrelated.com',companyId:'c2'} as Contact];
  expect(suggestedCompaniesFromEmail('taylor@ridge-build.com',contacts,companies)
   .map(s=>s.company.id)).toEqual(['c1']);
 });
 it('refuses to infer companies from personal providers',()=>{
  expect(emailDomain(' test@GMAIL.COM ')).toBe('gmail.com');
  expect(isPersonalEmailDomain('gmail.com')).toBe(true);
  const companies=[{id:'c1',name:'Gmail'} as Company];
  expect(suggestedCompaniesFromEmail('test@gmail.com',[],companies)).toEqual([]);
 });
 it('retains CRM native company foreign keys and standard contact-created provenance',()=>{
  const companyId=useCrmStore.getState().resolveCompany('Ridge Build','customer');
  const personId=useCrmStore.getState().createContact({
   name:'Taylor Builder',email:'taylor@ridge-build.com',companyId,source:'manual',
  });
  expect(useCrmStore.getState().contacts.find(p=>p.id===personId))
   .toMatchObject({name:'Taylor Builder',email:'taylor@ridge-build.com',companyId});
  expect(useCrmStore.getState().activities.some(a=>a.contactId===personId&&
   a.type==='contact-created')).toBe(true);
 });
 it('uses a deliberately confirmed form and no email content persistence',()=>{
  const component=src('components/EmailPersonCreate362.tsx');
  expect(component).toContain('Create Person');
  expect(component).toContain('existingPeopleByEmail');
  expect(component).toContain('suggestedCompaniesFromEmail');
  expect(component).toContain('resolveCompany(');
  expect(component).toContain('createContact(');
  expect(component).toContain('companyRelationshipPatch');
  expect(component).toContain('validGmailToken(scope)');
  expect(component).not.toContain('recordActivity(');
  expect(component).not.toContain('localStorage.setItem(');
  expect(src('components/EmailWorkspace.tsx')).toContain('<EmailPersonCreate362');
  expect(src('components/ToolsWorkspace.tsx')).toContain('companies={companies}');
 });
});
