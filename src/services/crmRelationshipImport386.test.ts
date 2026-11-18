import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Company,Contact,Project} from '../types/crm';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useCrmStore} from '../store/crmStore';
import {useDealPeopleStore,type DealPersonLink} from '../store/dealPeopleStore';
import {parseCrmCsv} from './crmImport385';
import {RELATIONSHIP_FIELDS,suggestRelationshipMapping,
 previewRelationshipImport,type RelationshipImportSnapshot}
 from './crmRelationshipImport386';
import {crmImportIdentity} from './crmImportCommit385';
import {commitReviewedRelationshipImport,relationshipImportCanCommit}
 from './crmRelationshipImportCommit386';

const source=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const company:Company={
 id:'company_1',name:'Pioneer Builders',aliases:['Pioneer Construction'],
 kind:'customer',createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',
};
const deal:Project={
 id:'project_1',name:'Elm Apartments',companyId:'company_1',companyName:company.name,
 stage:'Bid Sent',pipeline:'multifamily',
 createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z',
};
const person:Contact={
 id:'contact_1',name:'Sam Rivera',email:'sam@example.com',
 companyId:'company_1',createdAt:'2026-11-01T12:00:00Z',
 updatedAt:'2026-11-01T12:00:00Z',
};
const fixture=(links:DealPersonLink[]=[],deals:Project[]=[deal],
 people:Contact[]=[person],companies:Company[]=[company]):RelationshipImportSnapshot=>({
 links,deals,people,companies,
});
const csv=(body:string)=>parseCrmCsv(body);
const mapping=()=>suggestRelationshipMapping([
 'Deal name','Deal Company','Person email','Relationship role',
]);
const localData=new Map<string,string>();
const storage={
 getItem:(key:string)=>localData.get(key)??null,
 setItem:(key:string,value:string)=>{localData.set(key,value);},
 removeItem:(key:string)=>{localData.delete(key);},
 clear:()=>localData.clear(),
};
beforeEach(()=>{
 localData.clear();vi.stubGlobal('localStorage',storage);
 useAuthStore.setState({mode:'local',ready:true,organizationId:null,user:null});
 useRolePerspectiveStore.setState({activePerspective:null});
 useCrmStore.setState({companies:[company],contacts:[person],
  projects:[deal],activities:[],hydrated:true});
 useDealPeopleStore.setState({scope:null,links:[],loaded:false,loading:false,error:null});
});
afterEach(()=>vi.unstubAllGlobals());

describe('#385b review-first Deal–Person relationship importer',()=>{
 it('suggests mappings for exact IDs or names/email and requires real identifiers',()=>{
  expect(RELATIONSHIP_FIELDS.map(f=>f.id)).toEqual([
   'dealId','dealName','companyName','personId','personEmail','personName','role',
  ]);
  expect(mapping()).toEqual({dealName:0,companyName:1,personEmail:2,role:3});
  expect(suggestRelationshipMapping(['Deal ID','Person ID','Role']))
   .toEqual({dealId:0,personId:1,role:2});
  const table=csv('Deal name,Person name\nElm Apartments,Sam Rivera');
  const result=previewRelationshipImport(table,
   {dealName:0,personName:1},fixture());
  expect(result.errors).toContain(
   'Map Person ID or Person email. Names alone are not sufficient.');
 });
 it('matches a unique Deal name and unique Person email, preserving the requested role',()=>{
  const table=csv('Deal name,Deal Company,Person email,Relationship role\n'+
   'Elm Apartments,Pioneer Construction,SAM@EXAMPLE.COM,Estimator');
  const result=previewRelationshipImport(table,mapping(),fixture());
  expect(result.errors).toEqual([]);
  expect(result.counts).toEqual({ready:1,existing:0,review:0});
  expect(result.rows[0]).toMatchObject({
   status:'ready',dealId:deal.id,personId:person.id,
   dealName:deal.name,personName:person.name,role:'Estimator',
  });
 });
 it('uses exact SalesShop IDs, and rejects corroborating details that disagree',()=>{
  const table=csv('Deal ID,Person ID,Deal name,Person email\n'+
   'project_1,contact_1,Elm Apartments,sam@example.com\n'+
   'project_1,contact_1,Another Deal,sam@example.com\n'+
   'project_1,contact_1,Elm Apartments,other@example.com\n'+
   'foreign-id,contact_1,Elm Apartments,sam@example.com');
  const map=suggestRelationshipMapping(table.headers);
  const result=previewRelationshipImport(table,map,fixture());
  expect(result.rows.map(row=>row.status))
   .toEqual(['ready','review','review','review']);
  expect(result.rows[1].reason).toContain('Deal identifiers');
  expect(result.rows[2].reason).toContain('Person identifiers');
  expect(result.rows[3].reason).toContain('Deal ID not found');
 });
 it('never guesses ambiguous name-only Deals or duplicate email People',()=>{
  const file=csv('Deal name,Person email\nElm Apartments,sam@example.com');
  const ambiguous=previewRelationshipImport(file,
   {dealName:0,personEmail:1},fixture([],[
    deal,{...deal,id:'project_2'},
   ]));
  expect(ambiguous.rows[0].status).toBe('review');
  expect(ambiguous.rows[0].reason).toContain('Several Deals');
  const twoPeople=previewRelationshipImport(file,
   {dealName:0,personEmail:1},fixture([], [deal],[
    person,{...person,id:'contact_2'},
   ]));
  expect(twoPeople.rows[0].status).toBe('review');
  expect(twoPeople.rows[0].reason).toContain('Several People');
 });
 it('flags unresolved, multiple-match and mismatched Companies, not fuzzy links',()=>{
  const file=csv('Deal name,Deal Company,Person email\n'+
   'Elm Apartments,Unknown Company,sam@example.com\n'+
   'Elm Apartments,Pioneer Builders,sam@example.com');
  const results=previewRelationshipImport(file,
   {dealName:0,companyName:1,personEmail:2},fixture());
  expect(results.rows.map(row=>row.status)).toEqual(['review','ready']);
  const twoCompanies=previewRelationshipImport(
   csv('Deal name,Deal Company,Person email\nElm Apartments,Pioneer Builders,sam@example.com'),
   {dealName:0,companyName:1,personEmail:2},fixture([], [deal], [person],
    [company,{...company,id:'company_2'}]));
  expect(twoCompanies.rows[0].status).toBe('review');
  expect(twoCompanies.rows[0].reason).toContain('ambiguous');
 });
 it('classifies existing links and file duplicates separately, without overwriting roles',()=>{
  const table=csv('Deal ID,Person email,Role\n'+
   'project_1,sam@example.com,Estimator\nproject_1,sam@example.com,Owner');
  const map={dealId:0,personEmail:1,role:2};
  const preview=previewRelationshipImport(table,map,fixture());
  expect(preview.rows.map(row=>row.status)).toEqual(['ready','review']);
  const existing:DealPersonLink={
   dealId:deal.id,personId:person.id,role:'Customer',
   createdAt:'2026-11-10T12:00:00Z',
  };
  const linked=previewRelationshipImport(table,map,fixture([existing]));
  expect(linked.rows.map(row=>row.status)).toEqual(['existing','existing']);
  expect(linked.rows[0].reason).toContain('preserved');
 });
 it('validates column mapping and role values before any save',()=>{
  const table=csv('Deal ID,Person email,Role\nproject_1,sam@example.com,<script>');
  expect(previewRelationshipImport(table,{dealId:0,personEmail:1,role:2},fixture())
   .rows[0].status).toBe('review');
  expect(previewRelationshipImport(table,{dealId:0,personEmail:0},fixture())
   .errors).toContain('One spreadsheet column cannot map to multiple fields.');
  expect(previewRelationshipImport(table,{dealId:9,personEmail:1},fixture())
   .errors).toContain('A mapped field points to a missing column.');
 });
 it('saves ONLY approved Ready links using the real store and survives local reload',async()=>{
  await useDealPeopleStore.getState().load('local');
  expect(relationshipImportCanCommit(crmImportIdentity())).toBe(true);
  const extraPerson:Contact={...person,id:'contact_2',
   name:'Ana Smith',email:'ana@example.com'};
  useCrmStore.setState({contacts:[person,extraPerson]});
  const table=csv('Deal ID,Person email,Relationship role\n'+
   'project_1,sam@example.com,Estimator\n'+
   'project_1,ana@example.com,Architect');
  const map=suggestRelationshipMapping(table.headers);
  const identity=crmImportIdentity();
  const result=await commitReviewedRelationshipImport({
   table,mapping:map,approved:[0],identity,
  });
  expect(result).toMatchObject({created:1,skipped:0});
  const actual=useDealPeopleStore.getState().links;
  expect(actual).toHaveLength(1);
  expect(actual[0]).toMatchObject({
   dealId:'project_1',personId:'contact_1',role:'Estimator',
  });
  expect(useCrmStore.getState().contacts).toHaveLength(2);
  expect(useCrmStore.getState().activities).toHaveLength(0);
  useDealPeopleStore.setState({scope:null,loaded:false,links:[]});
  await useDealPeopleStore.getState().load('local');
  expect(useDealPeopleStore.getState().links).toMatchObject([{
   dealId:'project_1',personId:'contact_1',role:'Estimator',
  }]);
  await expect(commitReviewedRelationshipImport({
   table,mapping:map,approved:[0],identity,
  })).rejects.toThrow('Only unique, Ready');
  expect(useDealPeopleStore.getState().links[0].role).toBe('Estimator');
 });
 it('refuses unapproved or needs-review row indexes, and blocks stale identities',async()=>{
  await useDealPeopleStore.getState().load('local');
  const table=csv('Deal ID,Person email\nproject_1,sam@example.com\nproject_1,absent@example.com');
  const map={dealId:0,personEmail:1};
  const identity=crmImportIdentity();
  await expect(commitReviewedRelationshipImport({
   table,mapping:map,approved:[],identity,
  })).rejects.toThrow('Approve at least one');
  await expect(commitReviewedRelationshipImport({
   table,mapping:map,approved:[0,1],identity,
  })).rejects.toThrow('Only unique, Ready');
  useAuthStore.setState({mode:'cloud',organizationId:'different',user:null});
  await expect(commitReviewedRelationshipImport({
   table,mapping:map,approved:[0],identity,
  })).rejects.toThrow('correct workspace');
  expect(useDealPeopleStore.getState().links).toHaveLength(0);
 });
 it('is gated by Deal-link hydration and does not create any CRM records',async()=>{
  const identity=crmImportIdentity();
  expect(relationshipImportCanCommit(identity)).toBe(false);
  await useDealPeopleStore.getState().load('local');
  expect(relationshipImportCanCommit(identity)).toBe(true);
  useCrmStore.setState({hydrated:false});
  expect(relationshipImportCanCommit(identity)).toBe(false);
  useCrmStore.setState({hydrated:true});
  useDealPeopleStore.setState({loading:true});
  expect(relationshipImportCanCommit(identity)).toBe(false);
  const service=source('services/crmRelationshipImportCommit386.ts');
  expect(service).toContain('useDealPeopleStore.getState().add(');
  expect(service).not.toContain('createProject(');
  expect(service).not.toContain('createContact(');
  expect(service).not.toContain('setProjectCompany(');
  expect(service).not.toContain('supabase.from(');
 });
 it('exposes the relationship flow under existing Tools > Import',()=>{
  const wrapper=source('components/CrmImportWorkspace385.tsx');
  const screen=source('components/CrmRelationshipImport386.tsx');
  expect(wrapper).toContain("if(importMode==='links')return <CrmRelationshipImport386");
  expect(wrapper).toContain('Link People to Deals');
  expect(screen).toContain('Select all {selectable.size} Ready');
  expect(screen).toContain('checked={approved.has(candidate.index)');
  expect(screen).toContain('I reviewed the selected');
  expect(screen).toContain('commitReviewedRelationshipImport({');
  expect(screen).toContain('Download sample link CSV');
 });
});
