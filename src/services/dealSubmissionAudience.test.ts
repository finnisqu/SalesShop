import {describe,expect,it} from 'vitest';
import type {Project,Activity} from '../types/crm';
import type {Quote} from '../types/quote';
import {visibleSubmissionDeals} from './dealSubmissionAudience';
const deal=(id:string):Project=>({id,name:id,stage:'Bid Development',
 dueDate:'2026-11-15',createdAt:'2026-11-03T00:00:00Z',updatedAt:'2026-11-03T00:00:00Z'});
const quote=(id:string,projectId:string,ownerUserId:string)=>({
 id,projectId,ownerUserId,
}) as unknown as Quote;
const created=(projectId:string,recordedByUserId:string):Activity=>({
 id:'a-'+projectId,projectId,type:'project-created',summary:'Deal created',
 occurredAt:'2026-11-03T00:00:00Z',metadata:{recordedByUserId},
});
describe('private deal submission task audience',()=>{
 const deals=[deal('mine'),deal('coworker'),deal('from-quote')];
 it('assigns only creator-owned or owned-quote deadlines to reps',()=>{
  const visible=visibleSubmissionDeals('cloud','member','rep',deals,
   [created('mine','rep'),created('coworker','coworker')],
   [quote('q','from-quote','rep')],[]);
  expect(visible.map(d=>d.id)).toEqual(['mine','from-quote']);
 });
 it('shows the shop deadline queue for admins, but nothing unauthenticated',()=>{
  expect(visibleSubmissionDeals('cloud','admin','admin',deals,[],[],[])).toHaveLength(3);
  expect(visibleSubmissionDeals('cloud','member',undefined,deals,[],[],[])).toEqual([]);
  expect(visibleSubmissionDeals('local',null,undefined,deals,[],[],[])).toHaveLength(3);
 });
});
