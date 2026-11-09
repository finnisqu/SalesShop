import {describe,expect,it,vi} from 'vitest';
import {OUR_ORG_GROUPS,ensureOurOrgCompany,isOurOrgCompany,ourOrgCompanyIds,
 ourOrgGroup,ourOrgPeople} from './ourOrganizationDirectory';
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
