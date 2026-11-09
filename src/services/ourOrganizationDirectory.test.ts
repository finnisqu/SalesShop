import {describe,expect,it,vi} from 'vitest';
import {OUR_ORG_GROUPS,ensureOurOrgCompany,isOurOrgCompany,ourOrgCompanyIds,
 ourOrgGroup,ourOrgPeople,ourOrgRoles,rosterGroupForContact,
 ourOrgMemberMarker,ourOrgRoleMarker,isOurOrgContact} from './ourOrganizationDirectory';
import type {Company,Contact} from '../types/crm';

const employeeCompany={id:'emp',name:'Internal Employees',kind:'non-customer',
 aliases:[OUR_ORG_GROUPS[0].marker]} as Company;
const subcontractCompany={id:'sub',name:'Internal Subcontractors',kind:'non-customer',
 aliases:[OUR_ORG_GROUPS[1].marker]} as Company;
const outside={id:'other',name:'Customer',kind:'customer'} as Company;
const contacts=[
 {id:'p1',companyId:'emp',name:'Jess Employee'},
 {id:'p2',companyId:'sub',name:'Sam Subcontractor'},
 {id:'p3',companyId:'other',name:'Carter Customer'},
] as Contact[];

describe('Our Organization directory',()=>{
 it('separates employees and subcontractors from external CRM records without deleting contacts',()=>{
  expect(ourOrgGroup(employeeCompany)).toBe('employees');
  expect(ourOrgGroup(subcontractCompany)).toBe('subcontractors');
  expect(isOurOrgCompany(outside)).toBe(false);
  expect([...ourOrgCompanyIds([employeeCompany,subcontractCompany,outside])]).toEqual(['emp','sub']);
  expect(ourOrgPeople(contacts,[employeeCompany,subcontractCompany,outside],'employees')
   .map(p=>p.id)).toEqual(['p1']);
  expect(ourOrgPeople(contacts,[employeeCompany,subcontractCompany,outside],'subcontractors')
   .map(p=>p.id)).toEqual(['p2']);
 });
 it('keeps subcontractors in Our Organization while linking their external company',()=>{
  const vendor={id:'vendor',name:'Specialty Installers LLC',kind:'non-customer'} as Company;
  const sub={...subcontractCompany,aliases:[
   OUR_ORG_GROUPS[1].marker,ourOrgMemberMarker('p4'),
  ]};
  const person={id:'p4',name:'Taylor Installer',companyId:'vendor',title:'Installer'} as Contact;
  const entities=[employeeCompany,sub,vendor];
  expect(rosterGroupForContact(person,entities)).toBe('subcontractors');
  expect(isOurOrgContact(person,entities)).toBe(true);
  expect(ourOrgPeople([person],entities,'subcontractors').map(p=>p.id)).toEqual(['p4']);
  expect(ourOrgPeople([person],entities,'employees')).toEqual([]);
 });
 it('reuses saved role options and roles from current roster entries',()=>{
  const employee={...employeeCompany,aliases:[
   OUR_ORG_GROUPS[0].marker,ourOrgRoleMarker('Project Manager'),
  ]};
  const existing={id:'p1',name:'Jess',companyId:'emp',title:'Installer'} as Contact;
  expect(ourOrgRoles([existing],[employee],'employees')).toEqual(['Installer','Project Manager']);
  expect(ourOrgRoles([existing],[employee],'subcontractors')).toEqual([]);
 });
 it('reuses the tagged internal company without making duplicate records',()=>{
  const resolve=vi.fn(()=>undefined);
  const update=vi.fn();
  expect(ensureOurOrgCompany('employees',[employeeCompany],resolve,update)).toBe('emp');
  expect(resolve).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
 });
 it('initializes an internal group via ordinary normalized CRM Company aliases',()=>{
  const resolve=vi.fn(()=> 'internal-id');
  const update=vi.fn();
  const id=ensureOurOrgCompany('employees',[outside],resolve,update);
  expect(id).toBe('internal-id');
  expect(resolve).toHaveBeenCalledWith(OUR_ORG_GROUPS[0].companyName,'non-customer');
  expect(update).toHaveBeenCalledWith('internal-id',{aliases:[OUR_ORG_GROUPS[0].marker]});
 });
});
