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
 it('gives an external-quote rep the same unassigned Deal audience as a native quote owner',()=>{
  const outside=deal('builder-portal');
  const sent:Activity={id:'outside-1',projectId:outside.id,type:'quote-sent',
   occurredAt:'2026-11-12T12:00:00Z',summary:'External quote sent',
   metadata:{externalQuoteSent:true,recordedByUserId:'rep-a',source:'manual',
    bidSentDate:'2026-11-12',amount:50000}};
  const rows=visibleSubmissionDeals('cloud','member','rep-a',[outside],[sent],[],[]);
  expect(rows.map(item=>item.id)).toEqual(['builder-portal']);
  expect(visibleSubmissionDeals('cloud','member','rep-b',[outside],[sent],[],[]))
   .toEqual([]);
 });
 it('does not infer task ownership from an unconfirmed or native-issued Activity',()=>{
  const outside=deal('builder-portal');
  const base:Activity={id:'outside-1',projectId:outside.id,type:'quote-sent',
   occurredAt:'2026-11-12T12:00:00Z',summary:'Quote issued',
   metadata:{source:'quote',recordedByUserId:'rep-a'}};
  const misleading:Activity={...base,id:'other',metadata:{
   ...base.metadata,externalQuoteSent:true},quoteId:'native-q'};
  expect(visibleSubmissionDeals('cloud','member','rep-a',[outside],[base,misleading],[],[]))
   .toEqual([]);
  expect(visibleSubmissionDeals('cloud','viewer','rep-a',[outside],[{
   ...base,metadata:{...base.metadata,externalQuoteSent:true},
  }],[],[])).toEqual([]);
 });
 it('keeps explicit Deal assignment authoritative over a rep who sent an external quote',()=>{
  const assigned={...deal('assigned'),assignedUserId:'rep-b'};
  const sent:Activity={id:'outside-2',projectId:assigned.id,type:'quote-sent',
   occurredAt:'2026-11-12T12:00:00Z',summary:'External quote sent',
   metadata:{externalQuoteSent:true,recordedByUserId:'rep-a'}};
  expect(visibleSubmissionDeals('cloud','member','rep-a',[assigned],[sent],[],[]))
   .toEqual([]);
  expect(visibleSubmissionDeals('cloud','member','rep-b',[assigned],[sent],[],[]))
   .toEqual([assigned]);
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
 it('stops submission obligations when a salesperson loses quote issuance rights',()=>{
  const assigned={...deal('assigned'),assignedUserId:'rep'};
  for(const department of ['estimator','purchasing','project_manager'] as const){
    expect(visibleSubmissionDeals('cloud','member','rep',[assigned],[],[],[],department))
      .toEqual([]);
  }
  expect(visibleSubmissionDeals('cloud','member','rep',[assigned],[],[],[],'salesperson'))
    .toEqual([assigned]);
  expect(visibleSubmissionDeals('cloud','member','rep',[assigned],[],[],[],'general'))
    .toEqual([assigned]);
 });
 it('retains the owner/admin submission queue even with a specialist department',()=>{
  const unassigned=deal('unassigned');
  expect(visibleSubmissionDeals('cloud','admin','admin',[unassigned],[],[],[],'estimator'))
    .toEqual([unassigned]);
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
