import {describe,it,expect} from 'vitest';
import {crmDeletionBlockers,type CrmDeletionReferences} from './crmDeletionBlockers';
import type {Activity} from '../types/crm';
const references=():CrmDeletionReferences=>({
 companies:[],contacts:[],projects:[],activities:[],quotes:[],tasks:[],
});
const activity=(id:string,type:Activity['type'],ids:Partial<Activity>):Activity=>({
 id,type,summary:type,occurredAt:'2026-11-03T10:00:00Z',...ids,
});
describe('safe test-record deletion references',()=>{
 it('permits deletion of a Person with only its automatic creation event',()=>{
  const refs={...references(),activities:[activity('create','contact-created',{contactId:'p1'})]};
  expect(crmDeletionBlockers('person','p1',refs)).toEqual([]);
  refs.activities.push(activity('call','manual-touchpoint',{contactId:'p1'}));
  expect(crmDeletionBlockers('person','p1',refs)).toContain('1 activities');
 });
 it('permits deletion of a Deal with only automatic creation and stage events',()=>{
  const refs={...references(),activities:[
   activity('create','project-created',{projectId:'d1'}),
   activity('stage','project-stage-changed',{projectId:'d1'}),
  ]};
  expect(crmDeletionBlockers('deal','d1',refs)).toEqual([]);
  refs.activities.push(activity('send','quote-sent',{projectId:'d1'}));
  expect(crmDeletionBlockers('deal','d1',refs)).toContain('1 activities');
 });
 it('protects Companies linked to people, activity or historical quote names',()=>{
  const refs={...references(),
   companies:[{id:'c1',name:'Mock Builder'}] as unknown as CrmDeletionReferences['companies'],
   quotes:[{id:'q1',companyName:'Mock Builder'}] as unknown as CrmDeletionReferences['quotes'],
  };
  expect(crmDeletionBlockers('company','c1',refs)).toContain('1 linked quotes');
 });
 it('ignores generated bid reminders when deleting otherwise-unlinked test Deals',()=>{
  const refs={...references(),tasks:[{
   id:'task_deal_submit_d1',title:'Submit quote',dueDate:'2026-11-12',
   sourceObjectId:'deal-submit:d1',createdAt:'2026-11-03',updatedAt:'2026-11-03',
   associations:[{type:'project' as const,id:'d1'}],
  }]};
  expect(crmDeletionBlockers('deal','d1',refs)).toEqual([]);
 });
 it('protects a second Person attached only through Activity metadata',()=>{
  const refs={...references(),activities:[activity('call','manual-touchpoint',{
   contactId:'person-aaron',
   metadata:{relatedRecords:[
    {type:'contact',id:'person-aaron'},
    {type:'contact',id:'person-bryan'},
   ]},
  })]};
  expect(crmDeletionBlockers('person','person-bryan',refs)).toContain('1 activities');
 });
 it('blocks deletion when an active personal task references the record',()=>{
  const refs={...references(),tasks:[{
   id:'t1',title:'Call',createdAt:'2026-11-03',updatedAt:'2026-11-03',
   associations:[{type:'contact' as const,id:'p1'}],
  }]};
  expect(crmDeletionBlockers('person','p1',refs)).toContain('1 linked personal tasks');
 });
});
