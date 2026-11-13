import {beforeEach,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Activity} from '../types/crm';
import {usePersonalTaskStore,type PersonalTask} from '../store/personalTaskStore';
import {mergePrivateTasks} from './personalTaskCloudSync';
import {confirmedBidSubmissionDealIds} from './confirmedBidSubmissions';

const scope='org:shop:user:rep-1';
const old='2026-11-10T12:00:00.000Z';
const submitted='2026-11-12T15:00:00.000Z';
const task=(patch:Partial<PersonalTask>={}):PersonalTask=>({
 id:'task_deal_submit_deal-1',title:'Submit quote · Builder',
 sourceObjectId:'deal-submit:deal-1',workspaceScope:scope,
 linked:{type:'project',id:'deal-1'},dueDate:'2026-11-14',
 status:'open',createdAt:old,updatedAt:old,...patch,
});
const delivered:Activity={id:'activity-external',type:'quote-sent',
 projectId:'deal-1',summary:'Submitted through builder portal',
 occurredAt:submitted,metadata:{
  source:'manual',externalQuoteSent:true,bidSentDate:'2026-11-12',
  amount:12000,fromStage:'Bid Development',toStage:'Bid Sent',
 }};
beforeEach(()=>usePersonalTaskStore.setState({
 scope,tasks:[task()],syncStatus:'saved',syncError:null,
}));
describe('Batch 331: Task recovery from a confirmed bid after cloud reload',()=>{
 it('reapplies immutable CRM proof after merging a later unconfirmed private Task edit',()=>{
  const remote=task({status:'completed',submissionConfirmedAt:submitted,
   completedAt:submitted,updatedAt:submitted});
  const stale=task({updatedAt:'2026-11-13T12:00:00.000Z',
   dueDate:'2026-11-18',title:'Updated by second device'});
  const merged=mergePrivateTasks([stale],[remote]);
  expect(merged[0]).toMatchObject({status:'open',submissionConfirmedAt:submitted});
  usePersonalTaskStore.getState().receiveCloud(scope,merged);
  const verified=confirmedBidSubmissionDealIds([delivered]);
  expect([...verified]).toEqual(['deal-1']);
  verified.forEach(id=>usePersonalTaskStore.getState().completeDealSubmissionTasks(id));
  const recovered=usePersonalTaskStore.getState().tasks[0];
  expect(recovered).toMatchObject({
   status:'completed',submissionConfirmedAt:submitted,dueDate:'2026-11-18',
   title:'Updated by second device',
  });
  const anotherLoad=mergePrivateTasks([recovered],[remote]);
  expect(anotherLoad[0].status).toBe('completed');
  expect(anotherLoad[0].submissionConfirmedAt).toBe(submitted);
 });
 it('does not complete protected Tasks from issuance alone or a different Deal',()=>{
  const issued:Activity={...delivered,id:'issued',quoteId:'quote-1',
   metadata:{source:'quote',revision:0}};
  expect(confirmedBidSubmissionDealIds([issued])).toEqual(new Set());
  const other:Activity={...delivered,projectId:'deal-2'};
  const ids=confirmedBidSubmissionDealIds([issued,other]);
  ids.forEach(id=>usePersonalTaskStore.getState().completeDealSubmissionTasks(id));
  expect(usePersonalTaskStore.getState().tasks[0].status).toBe('open');
 });
 it('retains the app-wide replay after cloud Tasks have loaded',()=>{
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  expect(app).toContain('confirmedBidSubmissionDealIds(activities).forEach(dealId=>');
  expect(app).toContain('completeDealSubmissionTasks(dealId)');
  expect(app).toContain("personalSyncStatus!=='saved'");
 });
});
