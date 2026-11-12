import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import type {Project,ProjectStage} from '../types/crm';
import {localCrmRepository} from '../data/crmRepository';
import {useCrmStore} from './crmStore';

function deal(stage:ProjectStage):Project{
 return {id:'deal-correct',name:'Builder apartments',stage,amount:9999,
  dueDate:'2025-05-01',lastTouchpoint:'2025-07-01',
  createdAt:'2025-02-01T12:00:00.000Z',updatedAt:'2025-08-01T12:00:00.000Z'};
}
describe('correct existing external quote submission',()=>{
 beforeEach(()=>{
  vi.spyOn(localCrmRepository,'save').mockImplementation(()=>{});
  useCrmStore.setState({companies:[],contacts:[],projects:[deal('Completed')],
    activities:[],hydrated:true});
 });
 afterEach(()=>vi.restoreAllMocks());
 it('preserves the Activity identity, recording evidence, and Deal when correcting details',async()=>{
  const saved=await useCrmStore.getState().recordExternalQuoteSent(
    'deal-correct',4400,'2025-05-11','Excel','activity_correct_a','2026-11-10T12:00:00Z');
  expect(saved).toBe(true);
  const original=useCrmStore.getState();
  const existing=original.activities[0];
  expect(existing.metadata?.externalQuoteSent).toBe(true);
  await useCrmStore.getState().correctExternalQuoteSent(existing.id,{
   bidSentDate:'2025-05-13',amount:6700,format:'BuildingConnected',
   notes:'Corrected submitted amount',
  });
  const after=useCrmStore.getState();
  expect(after.activities).toHaveLength(1);
  expect(after.activities[0]).toMatchObject({
   id:existing.id,type:'quote-sent',projectId:existing.projectId,
   metadata:{externalQuoteSent:true,amount:6700,bidSentDate:'2025-05-13',
    externalQuoteFormat:'BuildingConnected',recordedAt:existing.metadata?.recordedAt,
    fromStage:existing.metadata?.fromStage,toStage:existing.metadata?.toStage},
  });
  expect(after.activities[0].occurredAt.slice(0,10)).toBe('2025-05-13');
  expect(after.projects).toEqual(original.projects);
 });
 it('rejects impossible corrections without altering the saved quote or Deal',async()=>{
  await useCrmStore.getState().recordExternalQuoteSent('deal-correct',2400,'2025-05-11','PDF',
    'activity_correct_b','2026-11-10T12:00:00Z');
  const original=useCrmStore.getState();
  const activity=original.activities[0];
  for(const change of [
   {bidSentDate:'2099-01-01',amount:123,format:'PDF'},
   {bidSentDate:'2025-02-31',amount:123,format:'PDF'},
   {bidSentDate:'2025-05-12',amount:-20,format:'PDF'},
  ]){
   await expect(useCrmStore.getState().correctExternalQuoteSent(activity.id,change))
    .rejects.toThrow();
  }
  expect(useCrmStore.getState().activities).toEqual(original.activities);
  expect(useCrmStore.getState().projects).toEqual(original.projects);
 });
});
