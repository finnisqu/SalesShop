import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import type {Company,Contact,Project} from '../types/crm';
import {usePersonalTaskStore,taskScope,normalizedTaskAssociations} from '../store/personalTaskStore';
import {gmailFollowUpSourceId,existingGmailFollowUp,gmailFollowUpTomorrow,
 gmailFollowUpDateAfter,isValidGmailFollowUpDate,gmailFollowUpAssociations,
 gmailFollowUpTitle,gmailFollowUpNotes} from './gmailFollowUp364';
import {readFileSync} from 'node:fs';
const fingerprint='a'.repeat(64);
const store=new Map<string,string>();
beforeEach(()=>{
 store.clear();vi.stubGlobal('window',{localStorage:{
  getItem:(key:string)=>store.get(key)??null,
  setItem:(key:string,value:string)=>{store.set(key,value);}
 }});
 usePersonalTaskStore.setState({scope:taskScope('cloud','org123','u123'),tasks:[],syncStatus:'saved'});
});
afterEach(()=>vi.unstubAllGlobals());
const person={id:'p1',name:'Taylor',email:'taylor@ridge.com',companyId:'c1'} as Contact;
const company={id:'c1',name:'Ridge'} as Company;
const deal={id:'d1',name:'Building',companyId:'c1'} as Project;
describe('Gmail Follow-up Tasks #364',()=>{
 it('derives a repeatable source key without raw mailbox or message IDs',()=>{
  expect(gmailFollowUpSourceId(fingerprint)).toBe('gmail-followup:'+fingerprint);
  expect(()=>gmailFollowUpSourceId('thread123')).toThrow();
  expect(gmailFollowUpSourceId(fingerprint)).not.toContain('@');
 });
 it('uses local calendar arithmetic and prevents past or impossible due dates',()=>{
  const today=new Date(2026,10,16,9);
  expect(gmailFollowUpTomorrow(today)).toBe('2026-11-17');
  expect(gmailFollowUpDateAfter(7,today)).toBe('2026-11-23');
  expect(isValidGmailFollowUpDate('2026-11-17','2026-11-16')).toBe(true);
  expect(isValidGmailFollowUpDate('2026-11-15','2026-11-16')).toBe(false);
  expect(isValidGmailFollowUpDate('2026-11-31','2026-11-16')).toBe(false);
 });
 it('inherits Person Company and adds only explicitly selected compatible Deal',()=>{
  expect(gmailFollowUpAssociations(person,[company])).toEqual([
   {type:'contact',id:'p1',label:'Person · Taylor'},
   {type:'company',id:'c1',label:'Company · Ridge'}]);
  expect(gmailFollowUpAssociations(person,[company],deal).map(x=>x.type+':'+x.id))
   .toEqual(['contact:p1','company:c1','project:d1']);
  expect(()=>gmailFollowUpAssociations(person,[company],
   {...deal,companyId:'other'})).toThrow();
 });
 it('creates a real private follow-up Task using the existing personal Task store',()=>{
  const scope=taskScope('cloud','org123','u123');
  expect(usePersonalTaskStore.getState().scope).toBe(scope);
  const associations=gmailFollowUpAssociations(person,[company],deal);
  const id=usePersonalTaskStore.getState().createTask(gmailFollowUpTitle(person.name),{
   type:'follow-up',dueDate:'2026-11-20',queue:'Follow-ups',status:'open',
   priority:'high',associations,
   sourceObjectId:gmailFollowUpSourceId(fingerprint),
   notes:gmailFollowUpNotes('Countertop Pricing','2026-11-16T12:00:00Z'),
  });
  const task=usePersonalTaskStore.getState().tasks.find(x=>x.id===id);
  expect(task).toMatchObject({title:'Follow up · Taylor',dueDate:'2026-11-20',
   type:'follow-up',queue:'Follow-ups',priority:'high'});
  expect(normalizedTaskAssociations(task!)).toEqual(associations);
  expect(existingGmailFollowUp(usePersonalTaskStore.getState().tasks,fingerprint)?.id).toBe(id);
  expect(JSON.stringify(task)).not.toContain('thread123');
  expect(JSON.stringify(task)).not.toContain('taylor@ridge.com');
 });
 it('finds completed tasks too and only allows re-creation after an intentional delete',()=>{
  const first=usePersonalTaskStore.getState().createTask('Follow up',{
   type:'follow-up',sourceObjectId:gmailFollowUpSourceId(fingerprint)});
  expect(existingGmailFollowUp(usePersonalTaskStore.getState().tasks,fingerprint)?.id).toBe(first);
  usePersonalTaskStore.getState().complete(first!);
  expect(existingGmailFollowUp(usePersonalTaskStore.getState().tasks,fingerprint)?.id).toBe(first);
  usePersonalTaskStore.getState().remove(first!);
  expect(existingGmailFollowUp(usePersonalTaskStore.getState().tasks,fingerprint)).toBeUndefined();
 });
 it('keeps subject-only context editable and never copies the Gmail body automatically',()=>{
  expect(gmailFollowUpNotes('Quarterly Pricing','2026-11-15T10:00:00Z')).toContain('Regarding: Quarterly Pricing');
  const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  const ui=read('components/EmailFollowUp364.tsx');
  expect(ui).toContain('Create follow-up Task');
  expect(ui).toContain('validGmailToken(scope)');
  expect(ui).toContain('existingGmailFollowUp');
  expect(ui).toContain('createTask(');
  expect(ui).not.toContain('localStorage.setItem(');
  expect(ui).not.toContain('message.text');
  expect(read('components/EmailActivityLogger363.tsx')).toContain('<EmailFollowUp364');
 });
});
