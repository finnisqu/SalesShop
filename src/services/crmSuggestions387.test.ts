import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Activity,Contact,Company,Project} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
import {useAuthStore} from '../store/authStore';
import {useCrmStore} from '../store/crmStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {usePersonalTaskStore} from '../store/personalTaskStore';
import {proposeCrmSuggestions,type CrmSuggestionInput}
 from './crmSuggestions387';
import {acceptCrmSuggestion,currentSuggestionIdentity,dismissSuggestion,
 readSuggestionDismissals,suggestionsStorageKey,suggestionCanEdit,
 suggestionTaskReady} from './crmSuggestionActions387';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const now=new Date('2026-11-18T17:00:00Z');
const company:Company={id:'company_1',name:'North Ridge',
 kind:'customer',createdAt:'2026-11-01T10:00:00Z',updatedAt:'2026-11-01T10:00:00Z'};
const deal:Project={id:'deal_1',name:'Building A',companyId:'company_1',
 stage:'Bid Sent',createdAt:'2026-11-01T10:00:00Z',updatedAt:'2026-11-01T10:00:00Z'};
const person:Contact={id:'person_1',name:'Jane Smith',email:'jane@example.com',
 companyId:'company_1',createdAt:'2026-11-01T10:00:00Z',
 updatedAt:'2026-11-01T10:00:00Z'};
const activity=(patch:Partial<Activity>={}):Activity=>({
 id:'activity_1',type:'manual-touchpoint',
 summary:'Contact: Jane Smith <jane@example.com>. Follow up by 2026-11-25.',
 companyId:'company_1',projectId:'deal_1',
 occurredAt:'2026-11-17T14:00:00Z',
 metadata:{recordedByUserId:'rep-a'},...patch,
});
const propose=(patch:Partial<CrmSuggestionInput>={})=>
 proposeCrmSuggestions({
  activities:[activity()],contacts:[],companies:[company],deals:[deal],
  tasks:[],mode:'local',userId:undefined,now,...patch,
 });
const memory=new Map<string,string>();
const storage={
 getItem:(key:string)=>memory.get(key)??null,
 setItem:(key:string,value:string)=>{memory.set(key,value);},
 removeItem:(key:string)=>{memory.delete(key);},
 clear:()=>memory.clear(),
};
beforeEach(()=>{
 memory.clear();
 vi.stubGlobal('localStorage',storage);
 useAuthStore.setState({mode:'local',ready:true,organizationId:null,user:null});
 useCrmStore.setState({hydrated:true,activities:[activity()],
  contacts:[],companies:[company],projects:[deal]});
 useRolePerspectiveStore.setState({activePerspective:null});
 usePersonalTaskStore.setState({scope:'local:user',tasks:[],syncStatus:'local',syncError:null});
});
afterEach(()=>vi.unstubAllGlobals());

describe('#387 deterministic CRM Suggestions',()=>{
 it('proposes a Person and a dated Task only from explicit evidence',()=>{
  const suggested=propose();
  expect(suggested.map(s=>s.kind)).toEqual(['person-create','follow-up']);
  expect(suggested[0]).toMatchObject({proposedName:'Jane Smith',
   email:'jane@example.com',companyId:'company_1'});
  expect(suggested[1]).toMatchObject({dueDate:'2026-11-25',
   taskSourceKey:'suggestion:follow-up:activity_1'});
  expect(suggested[1].associations).toEqual([
   {type:'project',id:'deal_1',label:'Deal · Building A'},
   {type:'company',id:'company_1',label:'Company · North Ridge'},
  ]);
 });
 it('suggests linking an existing unique Person instead of creating a duplicate',()=>{
  const suggestions=propose({contacts:[person]});
  expect(suggestions.map(s=>s.kind)).toEqual(['person-link','follow-up']);
  expect(suggestions[0].contactId).toBe('person_1');
  expect(propose({contacts:[person,{...person,id:'person_2'}]})
   .some(s=>s.kind==='person-link'||s.kind==='person-create')).toBe(false);
 });
 it('does not infer People from an unnamed email or a name without email',()=>{
  expect(propose({activities:[activity({summary:'Called jane@example.com'})]}))
   .toHaveLength(0);
  expect(propose({activities:[activity({summary:'Contact: Jane Smith'})]}))
   .toHaveLength(0);
  expect(propose({contacts:[{...person,email:'other@example.com'}]})
   .some(s=>s.kind==='person-create')).toBe(false);
 });
 it('does not propose a Person link across conflicting Company identities',()=>{
  const different={...person,companyId:'company_2'};
  expect(propose({contacts:[different]}).some(s=>s.kind==='person-link')).toBe(false);
  expect(propose({contacts:[person],
   activities:[activity({contactId:'person_1'})]}).some(s=>s.kind==='person-link')).toBe(false);
  expect(propose({contacts:[person],
   activities:[activity({metadata:{relatedRecords:[
    {type:'contact',id:'person_1'},
   ]}})]}).some(s=>s.kind==='person-link')).toBe(false);
 });
 it('ignores automatic history, stale events, future events and another salesperson',()=>{
  expect(propose({activities:[activity({type:'quote-sent'})]})).toHaveLength(0);
  expect(propose({activities:[activity({occurredAt:'2026-08-01T00:00:00Z'})]}))
   .toHaveLength(0);
  expect(propose({activities:[activity({occurredAt:'2026-11-19T00:00:00Z'})]}))
   .toHaveLength(0);
  expect(propose({mode:'cloud',userId:'rep-b'})).toHaveLength(0);
  expect(propose({mode:'cloud',userId:'rep-a'})).toHaveLength(2);
  expect(propose({mode:'cloud',userId:'rep-a',
   activities:[activity({metadata:{}})]})).toHaveLength(0);
 });
 it('rejects invalid follow-up dates, no relative-date guessing and repeats',()=>{
  expect(propose({activities:[activity({summary:'Follow up next week'})]})).toHaveLength(0);
  expect(propose({activities:[activity({summary:'Follow up by 2026-02-30'})]}))
   .toHaveLength(0);
  expect(propose({activities:[activity({summary:'Follow up by 2027-12-25'})]}))
   .toHaveLength(0);
  const duplicate={id:'task_1',title:'Existing',
   sourceObjectId:'suggestion:follow-up:activity_1',deletedAt:'2026-11-18',
   createdAt:'2026-11-17',updatedAt:'2026-11-18'} as PersonalTask;
  expect(propose({tasks:[duplicate]}).some(s=>s.kind==='follow-up')).toBe(false);
 });
 it('uses an Activity version marker so edits can generate fresh suggestions',()=>{
  const old=propose()[0];
  const updated=propose({activities:[activity({summary:
   'Contact: Jane Smith <jane@example.com>. Follow up by 2026-11-25. Discussed proposal.'})]})[0];
  expect(old.id).not.toBe(updated.id);
  expect(old.id).toMatch(/^suggestion:person:activity_1:[a-z0-9]+$/);
  expect(old.id).not.toContain('jane@example.com');
 });
 it('isolates dismissal IDs per user and org without storing raw Activity text',()=>{
  const a={mode:'cloud' as const,organizationId:'org-a',userId:'rep-a'};
  const b={mode:'cloud' as const,organizationId:'org-a',userId:'rep-b'};
  const c={mode:'cloud' as const,organizationId:'org-b',userId:'rep-a'};
  expect(suggestionsStorageKey(a)).not.toBe(suggestionsStorageKey(b));
  expect(suggestionsStorageKey(a)).not.toBe(suggestionsStorageKey(c));
  const local=currentSuggestionIdentity();
  const id=propose()[0].id;
  dismissSuggestion(local,id);
  expect(readSuggestionDismissals(local)).toEqual([id]);
  expect(localStorage.getItem(suggestionsStorageKey(local))).not.toContain('Jane Smith');
  expect(readSuggestionDismissals(a)).toEqual([]);
  useAuthStore.setState({mode:'cloud',organizationId:'org-b',user:null});
  expect(()=>dismissSuggestion(local,id)).toThrow('workspace changed');
 });
 it('accepts Person creation only when current proof and records still match',async()=>{
  const choice=propose().find(s=>s.kind==='person-create')!;
  const result=await acceptCrmSuggestion(currentSuggestionIdentity(),choice,
   {name:'Jane Smith',email:'jane@example.com'});
  expect(result.cloudConfirmed).toBe(true);
  const created=useCrmStore.getState().contacts;
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({name:'Jane Smith',email:'jane@example.com',
   companyId:'company_1'});
  await expect(acceptCrmSuggestion(currentSuggestionIdentity(),choice))
   .rejects.toThrow('changed');
 });
 it('links to a uniquely matched Person using the existing Activity editor',async()=>{
  useCrmStore.setState({contacts:[person]});
  const candidate=propose({contacts:[person]}).find(s=>s.kind==='person-link')!;
  await acceptCrmSuggestion(currentSuggestionIdentity(),candidate);
  expect(useCrmStore.getState().activities[0].contactId).toBe('person_1');
  expect(useCrmStore.getState().contacts).toHaveLength(1);
 });
 it('creates an idempotent private Task, never a customer email or Deal stage change',async()=>{
  const candidate=propose().find(s=>s.kind==='follow-up')!;
  const result=await acceptCrmSuggestion(currentSuggestionIdentity(),candidate,
   {taskTitle:'Check bid status',dueDate:'2026-11-26'});
  expect(result.cloudConfirmed).toBe(true);
  expect(usePersonalTaskStore.getState().tasks[0]).toMatchObject({
   title:'Check bid status',dueDate:'2026-11-26',
   sourceObjectId:'suggestion:follow-up:activity_1',type:'follow-up',
  });
  expect(useCrmStore.getState().projects[0].stage).toBe('Bid Sent');
  expect(propose({tasks:usePersonalTaskStore.getState().tasks})
   .some(s=>s.kind==='follow-up')).toBe(false);
  await expect(acceptCrmSuggestion(currentSuggestionIdentity(),candidate))
   .rejects.toThrow('changed');
 });
 it('denies writes in read-only perspective and cloud Task loading states',async()=>{
  const candidate=propose()[0];
  useRolePerspectiveStore.setState({activePerspective:'viewer' as never});
  expect(suggestionCanEdit(currentSuggestionIdentity())).toBe(false);
  await expect(acceptCrmSuggestion(currentSuggestionIdentity(),candidate))
   .rejects.toThrow('permissions');
  useRolePerspectiveStore.setState({activePerspective:null});
  usePersonalTaskStore.setState({syncStatus:'loading',scope:'org:other:user:rep-a'});
  expect(suggestionTaskReady(currentSuggestionIdentity())).toBe(false);
 });
 it('wires review, edit, dismiss, accept to the guarded Tools inbox',()=>{
  const tools=read('components/ToolsWorkspace.tsx');
  const ui=read('components/CrmSuggestionsWorkspace387.tsx');
  const actions=read('services/crmSuggestionActions387.ts');
  expect(tools).toContain("id:'suggestions',label:'Suggestions'");
  expect(tools).toContain("section==='suggestions'&&<CrmSuggestionsWorkspace387");
  for(const label of ['Review','Edit','Dismiss','Accept','All caught up.'])
   expect(ui).toContain(label);
  expect(actions).toContain('state.updateActivity(source.id');
  expect(actions).toContain('state.createContact({name,email');
  expect(actions).toContain('tasks.createTask(title');
  expect(actions).toContain("syncNormalizedCrm(identity.organizationId,document)");
  expect(actions).not.toContain('sendGmailMessage(');
  expect(actions).not.toContain('.moveProject(');
 });
});
