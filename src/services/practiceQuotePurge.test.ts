import {describe,it,expect} from 'vitest';
import {planPracticeQuotePurge,PRACTICE_QUOTE_ACTIVITY_TYPES} from './practiceQuotePurge';
import type {Quote} from '../types/quote';
import type {Activity} from '../types/crm';
import type {PersonalTask} from '../store/personalTaskStore';
const date='2026-11-04T15:00:00Z';
const quote=(change:Partial<Quote>={}):Quote=>({
 id:'q1',title:'Training quote',quoteNumber:'Q-20261104-003',
 documentType:'quote',status:'Sent',archivedAt:date,history:[],
 sections:[],lines:[],createdAt:date,updatedAt:date,
 ...change,
} as Quote);
const event=(type:Activity['type'],id='activity'):Activity=>({
 id,type,summary:type,quoteId:'q1',occurredAt:date,
});
const task=(id:string,link=true):PersonalTask=>({
 id,title:'Follow up',createdAt:date,updatedAt:date,
 associations:link?[{type:'quote',id:'q1'}]:[],
});
describe('archived practice quote purge policy',()=>{
 it('allows unsigned archived practice quote with quote-specific send/view/revision breadcrumbs',()=>{
  const events=[event('quote-created','a'),event('quote-sent','b'),
   event('quote-follow-up','c'),event('quote-viewed','d')];
  expect(planPracticeQuotePurge(quote(),[quote()],events,[]))
   .toEqual({blockers:[],activityIds:['a','b','c','d']});
 });
 it('requires archive first and does not silently identify a sent customer quote as test',()=>{
  expect(planPracticeQuotePurge(quote({archivedAt:undefined}),[],[],[])
   .blockers).toContain('Archive this document before permanent deletion');
 });
 it('blocks signed documents and accepted revision history even when archived',()=>{
  expect(planPracticeQuotePurge(quote({status:'Signed'}),[],[],[])
   .blockers).toContain('Signed documents and accepted agreements cannot be purged');
  expect(planPracticeQuotePurge(quote({signedAt:date}),[],[],[])
   .blockers).toContain('Signed documents and accepted agreements cannot be purged');
  expect(planPracticeQuotePurge(quote({history:[{status:'Signed'}] as unknown as Quote['history']}),[],[],[])
   .blockers).toContain('Signed documents and accepted agreements cannot be purged');
 });
 it('blocks dependent Change Orders and linked personal tasks',()=>{
  const q=quote();
  const child=quote({id:'child',parentQuoteId:q.id});
  const plan=planPracticeQuotePurge(q,[q,child],[],[task('task')]);
  expect(plan.blockers).toContain('Dependent Change Orders must be reviewed first');
  expect(plan.blockers).toContain('1 linked personal tasks');
 });
 it('blocks unrelated manual activities and indirect CRM references',()=>{
  const manual=event('manual-touchpoint','manual');
  const linked:Activity={...event('manual-touchpoint','indirect'),quoteId:undefined,
   metadata:{relatedRecords:[{type:'quote',id:'q1'}]}};
  const plan=planPracticeQuotePurge(quote(),[],[manual,linked],[]);
  expect(plan.blockers).toContain('2 other linked CRM activities need review');
  expect(plan.activityIds).toEqual([]);
 });
 it('removes quote-generated Deal/Contact setup history without deleting their records',()=>{
  const events=[event('project-created','deal'),event('project-stage-changed','stage'),
   event('contact-created','contact')].map(activity=>({
    ...activity,metadata:{source:'quote' as const},
   }));
  expect(planPracticeQuotePurge(quote(),[],events,[]).activityIds)
   .toEqual(['deal','stage','contact']);
  expect(planPracticeQuotePurge(quote(),[],[
   event('project-created','unrelated')],[]).blockers)
   .toContain('1 other linked CRM activities need review');
 });
 it('never classifies signed or manual events as removable lifecycle records',()=>{
  expect(PRACTICE_QUOTE_ACTIVITY_TYPES).not.toContain('quote-signed');
  expect(PRACTICE_QUOTE_ACTIVITY_TYPES).not.toContain('manual-touchpoint');
 });
});
