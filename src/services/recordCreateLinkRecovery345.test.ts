import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {useCrmStore} from '../store/crmStore';
import {useDealPeopleStore} from '../store/dealPeopleStore';
import {useAuthStore} from '../store/authStore';
import {quotesForCompany,quotesForProject} from './quoteCrmLinks';

const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const memory=new Map<string,string>();
const storage={
 getItem:(key:string)=>memory.get(key)??null,
 setItem:(key:string,value:string)=>{memory.set(key,value);},
 removeItem:(key:string)=>{memory.delete(key);},
 clear:()=>{memory.clear();},
};
beforeEach(()=>{
 memory.clear();
 vi.stubGlobal('localStorage',storage);
 useAuthStore.setState({mode:'local',organizationId:null,user:null});
 useCrmStore.setState({companies:[],contacts:[],projects:[],activities:[],hydrated:true});
 useDealPeopleStore.setState({scope:null,loaded:false,loading:false,error:null,links:[]});
});
afterEach(()=>vi.unstubAllGlobals());

describe('Batch 345 — record creation links and recoverable partial saves',()=>{
 it('persists Company → Person → Deal → direct relationship across local reloads',async()=>{
  const crm=useCrmStore.getState();
  const companyId=crm.resolveCompany('Parkside Builders','customer');
  expect(companyId).toBeTruthy();
  const personId=crm.createContact({name:'Project Manager',companyId});
  const dealId=crm.createProject('Parkside Units','Discovery');
  expect(personId).toBeTruthy();
  expect(dealId).toBeTruthy();
  crm.setProjectCompany(dealId!,companyId);
  await useDealPeopleStore.getState().load('local');
  await useDealPeopleStore.getState().add(dealId!,personId!,'Estimator');
  expect(useDealPeopleStore.getState().links).toMatchObject([
   {dealId,personId,role:'Estimator'},
  ]);
  expect(useCrmStore.getState().projects.find(item=>item.id===dealId))
   .toMatchObject({companyId});
  // Simulate browser reload using real repository hydration and local link storage.
  useCrmStore.setState({companies:[],contacts:[],projects:[],activities:[],hydrated:false});
  useDealPeopleStore.setState({scope:null,loaded:false,loading:false,links:[]});
  useCrmStore.getState().hydrate();
  await useDealPeopleStore.getState().load('local');
  const restored=useCrmStore.getState();
  expect(restored.companies.find(item=>item.id===companyId)?.name).toBe('Parkside Builders');
  expect(restored.contacts.find(item=>item.id===personId)).toMatchObject({companyId,name:'Project Manager'});
  expect(restored.projects.find(item=>item.id===dealId)).toMatchObject({companyId,name:'Parkside Units'});
  expect(useDealPeopleStore.getState().links).toMatchObject([{dealId,personId,role:'Estimator'}]);
  expect(restored.activities.some(item=>item.projectId===dealId&&item.type==='project-created')).toBe(true);
 });
 it('requires the correct link workspace before adding a Person to a Deal',async()=>{
  await expect(useDealPeopleStore.getState().add('deal','person')).rejects.toThrow(/loading/);
  await useDealPeopleStore.getState().load('local');
  await useDealPeopleStore.getState().add('deal','person');
  expect(useDealPeopleStore.getState().links).toHaveLength(1);
  await expect(useDealPeopleStore.getState().add('deal','person'))
   .rejects.toThrow(/already linked/);
 });
 it('does not derive Quote relationships from coincidental names',()=>{
  const quotes=[
   {id:'native',projectId:'deal-1',companyId:undefined,updatedAt:'2026-11-14T00:00:00Z'},
   {id:'unlinked',projectId:undefined,companyId:undefined,updatedAt:'2026-11-14T00:00:00Z'},
  ];
  expect(quotesForProject({id:'deal-1'},quotes).map(q=>q.id)).toEqual(['native']);
  expect(quotesForCompany({id:'company-1'},[{id:'deal-1',companyId:'company-1'}],quotes)
   .map(q=>q.id)).toEqual(['native']);
  expect(quotesForCompany({id:'company-2'},[],quotes)).toEqual([]);
 });
 it('waits for contextual Person–Deal links rather than discarding failed promises',()=>{
  const quick=source('components/QuickCreate.tsx');
  expect(quick).toContain('const submitNamedCreate = async (event: FormEvent)');
  expect(quick).toContain('personLinkScope=dealPeopleScope(authMode,organizationId)');
  expect(quick).toContain('await current.load(personLinkScope)');
  expect(quick).toContain('if(latest.scope!==personLinkScope||!latest.loaded)');
  expect(quick).toContain('await links.add(projectId,context.id)');
  expect(quick).not.toContain('void links.add(projectId,context.id).catch');
  expect(quick).toContain('setPendingCreated({id:createdId,kind:namedMode})');
 });
 it('blocks duplicate Board creation after Company or Person linkage partially fails',()=>{
  const dialog=source('components/BoardQuickCreate.tsx');
  const board=source('components/Board.tsx');
  expect(dialog).toContain('if(!clean||savingRef.current||pendingCreated)return');
  expect(dialog).toContain("if(typeof result==='object')");
  expect(dialog).toContain('setPendingCreated(result.id)');
  expect(dialog).toContain('setError(result.warning)');
  expect(dialog).toContain('Open created {kind.toLowerCase()}');
  expect(dialog).toContain('onClick={openPendingCreated}');
  expect(board).toContain('} satisfies BoardPartialCreate');
  expect(board).toContain('if(failed.length)return {id,warning:');
  expect(board).toContain("return {id,warning:'Deal created, but related details could not all be saved.");
  expect(board).not.toContain("if(failed.length)window.alert");
 });
 it('validates all Board related People before creating the Deal and reports failed new People',()=>{
  const board=source('components/Board.tsx');
  const preflight=board.indexOf('for(const id of details?.personIds??[])');
  const create=board.indexOf("const id=createProject(name,'Discovery'");
  const linked=board.indexOf('for(const personId of personIds)');
  expect(preflight).toBeGreaterThan(0);
  expect(create).toBeGreaterThan(preflight);
  expect(linked).toBeGreaterThan(create);
  expect(board).toContain("else failed.push(newName+' (Person creation failed)')");
 });
});
