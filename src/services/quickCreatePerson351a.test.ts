import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {useCrmStore} from '../store/crmStore';
import {useDealPeopleStore,dealPeopleScope} from '../store/dealPeopleStore';
import {useAuthStore} from '../store/authStore';
import {recordNameKey} from './recordNameKey';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const data=new Map<string,string>();
const storage={
 getItem:(key:string)=>data.get(key)??null,
 setItem:(key:string,value:string)=>{data.set(key,value);},
 removeItem:(key:string)=>{data.delete(key);},
 clear:()=>{data.clear();},
};
beforeEach(()=>{
 data.clear();vi.stubGlobal('localStorage',storage);
 useAuthStore.setState({mode:'local',organizationId:null,user:null});
 useCrmStore.setState({companies:[],contacts:[],projects:[],activities:[],hydrated:true});
 useDealPeopleStore.setState({scope:null,loaded:false,loading:false,error:null,links:[]});
});
afterEach(()=>vi.unstubAllGlobals());

describe('Batch 351a — universal Person quick create and contextual linking',()=>{
 it('creates a minimally defined Person without requiring a Company or Deal',()=>{
  const id=useCrmStore.getState().createContact({name:'Jordan Example',source:'manual'});
  expect(id).toBeTruthy();
  expect(useCrmStore.getState().contacts.find(person=>person.id===id)).toMatchObject({
   name:'Jordan Example',
  });
  expect(useCrmStore.getState().activities.some(activity=>
   activity.contactId===id&&activity.type==='contact-created'&&
   activity.metadata?.source==='manual')).toBe(true);
  expect(useCrmStore.getState().contacts.find(person=>person.id===id)?.companyId).toBeFalsy();
  const quick=src('components/QuickCreate.tsx');
  expect(quick).toContain("<strong>New Person</strong>");
  expect(quick).toContain("onClick={() => setNamedMode('person')}");
  expect(quick).toContain('close();openPerson(personId);');
 });
 it('supports Company context using the CRM Person primary-company link',()=>{
  const companyId=useCrmStore.getState().resolveCompany('Willow Construction','customer');
  expect(companyId).toBeTruthy();
  const personId=useCrmStore.getState().createContact({
   name:'Morgan Estimator',companyId,source:'manual',
  });
  expect(useCrmStore.getState().contacts.find(person=>person.id===personId)?.companyId).toBe(companyId);
  const quick=src('components/QuickCreate.tsx');
  expect(quick).toContain("if(context?.kind==='company'){");
  expect(quick).toContain("companyId=context.id;");
  expect(quick).toContain("createPerson({name:clean,companyId,source:'manual'})");
  expect(quick).toContain('updateContact(personId,{companyId:context.id});');
  expect(quick).toContain('Linking an existing Person here changes their primary Company.');
 });
 it('shares the durable Deal-Person link rather than manufacturing another relationship',async()=>{
  const companyId=useCrmStore.getState().resolveCompany('Harbor Builder','customer');
  const dealId=useCrmStore.getState().createProject('Harbor Phase II','Discovery');
  expect(companyId).toBeTruthy();expect(dealId).toBeTruthy();
  useCrmStore.getState().setProjectCompany(dealId!,companyId!);
  const scope=dealPeopleScope('local',null);
  await useDealPeopleStore.getState().load(scope);
  const personId=useCrmStore.getState().createContact({
   name:'Site Lead',companyId:companyId!,source:'manual',
  });
  await useDealPeopleStore.getState().add(dealId!,personId!);
  expect(useDealPeopleStore.getState().links).toMatchObject([{
   dealId,personId,
  }]);
  expect(useCrmStore.getState().contacts.find(x=>x.id===personId)?.companyId).toBe(companyId);
  const quick=src('components/QuickCreate.tsx');
  expect(quick).toContain('dealLinkScope=await readyDealLinks();');
  expect(quick).toContain('companyId=deal.companyId;');
  expect(quick).toContain('await links.add(context.id,personId);');
  expect(quick).toContain('const scope=await readyDealLinks();');
  expect(quick).toContain('await links.add(context.id,personId);');
  expect(quick).not.toContain('void links.add(context.id,personId)');
 });
 it('prevents an orphan Person when direct Deal linking is not loaded',async()=>{
  await expect(useDealPeopleStore.getState().add('deal','person'))
   .rejects.toThrow(/loading/);
  const quick=src('components/QuickCreate.tsx');
  const preflight=quick.indexOf('dealLinkScope=await readyDealLinks();');
  const create=quick.indexOf("const personId=createPerson({name:clean,companyId,source:'manual'});");
  expect(preflight).toBeGreaterThan(0);
  expect(create).toBeGreaterThan(preflight);
  expect(quick).toContain("if(latest.scope!==scope||!latest.loaded)");
  expect(quick).toContain('throw new Error(latest.error||');
  expect(quick).toContain("setPendingCreated({id:createdId,kind:namedMode})");
  expect(quick).toContain('Open created record');
  expect(quick).toContain("else if(saved.kind==='person')openPerson(saved.id);");
 });
 it('blocks silent exact-name duplicates but permits confirmed homonyms',()=>{
  expect(recordNameKey(' Jordan   Example ')).toBe(recordNameKey('jordan example'));
  const quick=src('components/QuickCreate.tsx');
  expect(quick).toContain('const normalizedPersonName=recordNameKey(name);');
  expect(quick).toContain('recordNameKey(person.name||person.email||\'\')===normalizedPersonName');
  expect(quick).toContain("if(existing&&!allowSameNamePerson)");
  expect(quick).toContain('setAllowSameNamePerson(false)');
  expect(quick).toContain('className="quick-create-person-duplicate-confirm"');
  expect(quick).toContain('checked={allowSameNamePerson}');
  expect(quick).toContain("exactPeople.length>0&&!allowSameNamePerson");
  expect(quick).toContain('openOrLinkExistingPerson(person.id)');
 });
 it('isolates existing-link retries, permissions, and Person-to-Person ambiguity',()=>{
  const quick=src('components/QuickCreate.tsx');
  expect(quick).toContain('if(namedCreatePending.current||pendingCreated||!canRecordExternal)return;');
  expect(quick).toContain('if(namedCreatePending.current||pendingCreated)return;');
  expect(quick).toContain('if(!canRecordExternal)throw new Error');
  expect(quick).toContain('if(!links.links.some(item=>item.dealId===context.id&&item.personId===personId))');
  expect(quick).toContain('namedCreatePending.current=false;');
  expect(quick).toContain('setNamedCreateSaving(false)');
  expect(quick).toContain('A new Person will be unlinked.');
  const style=src('quick-create.css');
  expect(style).toContain('.quick-create-person-matches');
  expect(style).toContain('min-height:44px');
  expect(style).toContain('accent-color:var(--ss-theme-accent)');
 });
});
