import {describe,it,expect} from 'vitest';
import {recordManagementDependencies} from './recordManagementDependencies';
import {crmDeletionBlockers,type CrmDeletionReferences} from './crmDeletionBlockers';
import type {Company,Contact,Project,Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import type {PersonalTask} from '../store/personalTaskStore';
const date='2026-11-04T12:00:00Z';
const company=(id:string,name:string):Company=>({id,name,kind:'customer',createdAt:date,updatedAt:date});
const person=(id:string,companyId?:string):Contact=>({id,name:'Contact '+id,companyId,createdAt:date,updatedAt:date});
const deal=(id:string,companyId?:string):Project=>({id,name:'Deal '+id,companyId,stage:'Discovery',createdAt:date,updatedAt:date});
const quote=(id:string,patch:Partial<Quote>={}):Quote=>({
 id,title:id,quoteNumber:'DRAFT-'+id,status:'Draft',sections:[],lines:[],history:[],
 createdAt:date,updatedAt:date,...patch
} as Quote);
const activity=(id:string,type:Activity['type'],patch:Partial<Activity>={}):Activity=>({
 id,type,summary:id,occurredAt:date,...patch,
});
const task=(id:string,patch:Partial<PersonalTask>={}):PersonalTask=>({
 id,title:id,createdAt:date,updatedAt:date,...patch,
});
const empty=():CrmDeletionReferences=>({
 companies:[],contacts:[],projects:[],activities:[],quotes:[],tasks:[],
});
const keys=(values:ReturnType<typeof recordManagementDependencies>)=>
 values.map(item=>item.kind+':'+item.id);
describe('Record Management linked-record drill-down',()=>{
 it('reveals direct People, Deals, Quotes, Activities and Tasks for a Company',()=>{
  const refs:CrmDeletionReferences={...empty(),
   companies:[company('co','Acme Builder')],
   contacts:[person('p1','co')],
   projects:[deal('d1','co')],
   quotes:[quote('q1',{companyName:'Acme Builder'}),quote('q2',{companyId:'co'})],
   activities:[activity('a1','manual-touchpoint',{companyId:'co'})],
   tasks:[task('t1',{associations:[{type:'company',id:'co'}]})],
  };
  expect(keys(recordManagementDependencies('company','co',refs))).toEqual([
   'person:p1','deal:d1','quote:q1','quote:q2','activity:a1','task:t1',
  ]);
  expect(crmDeletionBlockers('company','co',refs)).toEqual([
   '1 linked people','1 linked deals','2 linked quotes','1 activities','1 linked personal tasks',
  ]);
 });
 it('shows non-creation history and quote/task links for a Person',()=>{
  const refs={...empty(),
   quotes:[quote('q1',{contactId:'p1'})],
   activities:[
    activity('created','contact-created',{contactId:'p1'}),
    activity('call','manual-touchpoint',{
     metadata:{relatedRecords:[{type:'contact',id:'p1'}]},
    }),
   ],
   tasks:[task('t1',{linked:{type:'contact',id:'p1'}})],
  };
  expect(keys(recordManagementDependencies('person','p1',refs))).toEqual([
   'quote:q1','activity:call','task:t1',
  ]);
 });
 it('hides auto-generated Bid reminders and housekeeping audit events for a Deal',()=>{
  const refs={...empty(),
   activities:[
    activity('create','project-created',{projectId:'d1'}),
    activity('stage','project-stage-changed',{projectId:'d1'}),
    activity('call','manual-touchpoint',{projectId:'d1'}),
   ],
   tasks:[task('automatic',{sourceObjectId:'deal-submit:d1',
    associations:[{type:'project',id:'d1'}]}),
    task('manual',{associations:[{type:'project',id:'d1'}]})],
  };
  expect(keys(recordManagementDependencies('deal','d1',refs))).toEqual([
   'activity:call','task:manual',
  ]);
  expect(crmDeletionBlockers('deal','d1',refs)).toContain('1 linked personal tasks');
 });
 it('allows Activity -> follow-up Task -> back without deleting the parent',()=>{
  const refs={...empty(),tasks:[
   task('t1',{sourceObjectId:'activity-followup:a1'}),
   task('t2',{sourceObjectId:'activity-followup:a1',deletedAt:date}),
  ]};
  expect(keys(recordManagementDependencies('activity','a1',refs))).toEqual(['task:t1']);
 });
 it('exposes a dependent change order without pretending archive erases history',()=>{
  const refs={...empty(),quotes:[quote('parent'),quote('child',{parentQuoteId:'parent'})]};
  expect(keys(recordManagementDependencies('quote','parent',refs))).toEqual(['quote:child']);
 });
});
