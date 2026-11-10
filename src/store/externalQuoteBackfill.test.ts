import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import type {Project,ProjectStage} from '../types/crm';
import {localCrmRepository} from '../data/crmRepository';
import {useCrmStore} from './crmStore';

function deal(stage:ProjectStage):Project{
 return {id:'deal-test',name:'Historical multifamily',stage,amount:9999,
  dueDate:'2025-05-01',lastTouchpoint:'2025-07-01',
  createdAt:'2025-02-01T12:00:00.000Z',updatedAt:'2025-08-01T12:00:00.000Z'};
}
describe('historical external quote backfill',()=>{
 beforeEach(()=>{
  vi.spyOn(localCrmRepository,'save').mockImplementation(()=>{});
  useCrmStore.setState({companies:[],contacts:[],projects:[deal('Completed')],
    activities:[],hydrated:true});
 });
 afterEach(()=>vi.restoreAllMocks());
 it('logs a historical external quote without changing completed Deal stage, value, due date or touchpoint',async()=>{
  const original=useCrmStore.getState().projects[0];
  const saved=await useCrmStore.getState().recordExternalQuoteSent('deal-test',4200,'2025-05-11','Spreadsheet');
  expect(saved).toBe(true);
  const state=useCrmStore.getState();
  expect(state.projects[0]).toEqual(original);
  expect(state.activities).toHaveLength(1);
  expect(state.activities[0].type).toBe('quote-sent');
  expect(state.activities[0].metadata?.externalQuoteSent).toBe(true);
  expect(state.activities[0].metadata?.amount).toBe(4200);
  expect(state.activities[0].metadata?.bidSentDate).toBe('2025-05-11');
 });
 it('records lost Deals without reopening the pipeline',async()=>{
  useCrmStore.setState({projects:[deal('Closed Lost')],activities:[]});
  expect(await useCrmStore.getState().recordExternalQuoteSent('deal-test',3500,'2025-05-11','PDF')).toBe(true);
  expect(useCrmStore.getState().projects[0].stage).toBe('Closed Lost');
 });
 it('retains existing open-Deal submission semantics',async()=>{
  useCrmStore.setState({projects:[deal('Bid Development')],activities:[]});
  expect(await useCrmStore.getState().recordExternalQuoteSent('deal-test',4400,'2025-05-11','Excel')).toBe(true);
  expect(useCrmStore.getState().projects[0].stage).toBe('Bid Sent');
  expect(useCrmStore.getState().projects[0].amount).toBe(4400);
  expect(useCrmStore.getState().projects[0].dueDate).toBeUndefined();
 });
 it('rejects impossible future dates',async()=>{
  expect(await useCrmStore.getState().recordExternalQuoteSent('deal-test',4400,'2099-01-01','PDF')).toBe(false);
  expect(useCrmStore.getState().activities).toHaveLength(0);
 });
  it('does not duplicate a retried submission ID',async()=>{
   const first=await useCrmStore.getState().recordExternalQuoteSent(
     'deal-test',2500,'2025-05-11','PDF','activity_retried','2026-11-10T17:00:00.000Z');
   const again=await useCrmStore.getState().recordExternalQuoteSent(
     'deal-test',2500,'2025-05-11','PDF','activity_retried','2026-11-10T17:00:00.000Z');
   expect(first).toBe(true);expect(again).toBe(true);
   expect(useCrmStore.getState().activities.filter(x=>x.id==='activity_retried')).toHaveLength(1);
  });
  it('rejects invalid dates that Date would otherwise normalize',async()=>{
   expect(await useCrmStore.getState().recordExternalQuoteSent('deal-test',4400,'2025-02-31','PDF')).toBe(false);
   expect(useCrmStore.getState().activities).toHaveLength(0);
  });

});
