import {describe,expect,it} from 'vitest';
import type {Activity,Company,Contact,Project} from '../types/crm';
import type {Quote} from '../types/quote';
import {activityAudience,matchesActivityFilters,DEFAULT_ACTIVITY_LOG_FILTERS,
 type ActivityLogFilters} from './activityLogFilters';
import {RELATIONSHIP_MARKERS} from './companyRelationship';

const companies=[
 {id:'prospect',name:'Prospect LLC',kind:'customer',aliases:[RELATIONSHIP_MARKERS.prospect]},
 {id:'customer',name:'Customer Inc',kind:'customer',aliases:[RELATIONSHIP_MARKERS.customer]},
 {id:'legacy',name:'Legacy Co',kind:'customer'},
] as Company[];
const contacts=[
 {id:'p1',name:'Pat',companyId:'prospect'},
 {id:'p2',name:'Cam',companyId:'customer'},
] as Contact[];
const projects=[{id:'d1',name:'Bid',companyId:'prospect'}] as Project[];
const internal=(_person:Contact)=>false;
const call={id:'a1',type:'manual-touchpoint',summary:'Call with Pat',occurredAt:'2026-11-08T14:00:00Z',
 metadata:{interactionMethod:'call',relatedRecords:[{type:'contact',id:'p1'}]}} as Activity;
const email={id:'a2',type:'manual-touchpoint',summary:'Email with Cam',occurredAt:'2026-11-08T16:00:00Z',
 metadata:{interactionMethod:'email',relatedRecords:[{type:'contact',id:'p2'}]}} as Activity;
const system={id:'a3',type:'project-stage-changed',summary:'Stage changed',occurredAt:'2026-11-08T16:00:00Z',
 projectId:'d1'} as Activity;
const allQuotes=[] as Quote[];
const filtered=(activity:Activity,partial:Partial<ActivityLogFilters>)=>
 matchesActivityFilters(activity,{...DEFAULT_ACTIVITY_LOG_FILTERS,...partial},
  companies,contacts,projects,allQuotes,internal,new Date('2026-11-09T14:00:00Z'));
describe('Activity history filters',()=>{
 it('finds calls with prospective customers without returning customer email or automatic events',()=>{
  const options={method:'call' as const,audience:'prospect' as const,kind:'interactions' as const};
  expect(filtered(call,options)).toBe(true);
  expect(filtered(email,options)).toBe(false);
  expect(filtered(system,options)).toBe(false);
 });
 it('reads linked People and Deals, but does not call legacy customer-kind records Customers',()=>{
  expect(activityAudience(call,companies,contacts,projects,allQuotes,internal).has('prospect')).toBe(true);
  expect(filtered(email,{audience:'customer'})).toBe(true);
  const legacy={...system,companyId:'legacy',projectId:undefined};
  expect(filtered(legacy,{audience:'unclassified'})).toBe(true);
  expect(filtered(legacy,{audience:'customer'})).toBe(false);
 });
 it('supports toggling system events and rolling windows',()=>{
  expect(filtered(system,{kind:'system',period:'7'})).toBe(true);
  expect(filtered(system,{kind:'interactions'})).toBe(false);
  expect(filtered(call,{period:'7'})).toBe(true);
  expect(filtered(call,{period:'7',method:'text'})).toBe(false);
  expect(filtered({...call,occurredAt:'2026-07-01T00:00:00Z'},{period:'30'})).toBe(false);
 });
});
