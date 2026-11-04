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
 it('routes an explicitly assigned Deal only to its salesperson, never to the creator or an admin',()=>{
  const assigned={...deal('assigned'),assignedUserId:'rep-a'};
  const history=[created('assigned','rep-b')];
  const quotes=[quote('owned-by-b','assigned','rep-b')];
  expect(visibleSubmissionDeals('cloud','member','rep-a',[assigned],history,quotes,[]))
   .toEqual([assigned]);
  expect(visibleSubmissionDeals('cloud','member','rep-b',[assigned],history,quotes,[]))
   .toEqual([]);
  expect(visibleSubmissionDeals('cloud','admin','admin',[assigned],history,quotes,[]))
   .toEqual([]);
 });
 it('preserves legacy unassigned deadlines until a salesperson is chosen',()=>{
  const unassigned=deal('legacy');
  expect(visibleSubmissionDeals('cloud','admin','admin',[unassigned],[],[],[]))
   .toEqual([unassigned]);
  expect(visibleSubmissionDeals('cloud','member','rep',[unassigned],
   [created('legacy','rep')],[],[])).toEqual([unassigned]);
 });
 it('does not deliver personal submission tasks to cloud viewers',()=>{
  expect(visibleSubmissionDeals('cloud','viewer','viewer',[deal('legacy')],[],[],[]))
   .toEqual([]);
 });
 it('shows the shop deadline queue for admins, but nothing unauthenticated',()=>{
  expect(visibleSubmissionDeals('cloud','admin','admin',deals,[],[],[])).toHaveLength(3);
  expect(visibleSubmissionDeals('cloud','member',undefined,deals,[],[],[])).toEqual([]);
  expect(visibleSubmissionDeals('local',null,undefined,deals,[],[],[])).toHaveLength(3);
 });
});
