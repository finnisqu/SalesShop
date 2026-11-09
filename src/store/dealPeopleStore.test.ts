import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {useDealPeopleStore,dealPeopleScope} from './dealPeopleStore';

const memory=new Map<string,string>();
const storage={
 getItem:(key:string)=>memory.get(key)??null,
 setItem:(key:string,value:string)=>{memory.set(key,value);},
 removeItem:(key:string)=>{memory.delete(key);},
 clear:()=>{memory.clear();},
};
describe('direct Deal–Person memberships (local workspace)',()=>{
 beforeEach(()=>{
  memory.clear();vi.stubGlobal('localStorage',storage);
  useDealPeopleStore.setState({scope:null,loaded:false,loading:false,error:null,links:[]});
 });
 afterEach(()=>vi.unstubAllGlobals());
 it('uses organization scope for cloud and local-only storage for local mode',()=>{
  expect(dealPeopleScope('cloud','org-1')).toBe('org:org-1');
  expect(dealPeopleScope('cloud',null)).toBeNull();
  expect(dealPeopleScope('local',null)).toBe('local');
 });
 it('adds a Person without a CRM activity, persists their role and prevents duplicates',async()=>{
  const store=useDealPeopleStore.getState();
  await store.load('local');
  await useDealPeopleStore.getState().add('deal-1','person-1',' Architect ');
  expect(useDealPeopleStore.getState().links).toMatchObject([
   {dealId:'deal-1',personId:'person-1',role:'Architect'}]);
  await expect(useDealPeopleStore.getState().add('deal-1','person-1'))
   .rejects.toThrow(/already linked/);
  expect(memory.has('salesshop:deal-people:v1')).toBe(true);
  await useDealPeopleStore.getState().setRole('deal-1','person-1','Project Manager');
  expect(useDealPeopleStore.getState().links[0].role).toBe('Project Manager');
  useDealPeopleStore.setState({scope:null,loaded:false,links:[]});
  await useDealPeopleStore.getState().load('local');
  expect(useDealPeopleStore.getState().links[0].role).toBe('Project Manager');
  await useDealPeopleStore.getState().remove('deal-1','person-1');
  expect(useDealPeopleStore.getState().links).toEqual([]);
 });
 it('rejects mutation until the correct scope is loaded',async()=>{
  await expect(useDealPeopleStore.getState().add('d','p')).rejects.toThrow(/loading/);
 });
});
