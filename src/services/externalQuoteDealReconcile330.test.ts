import {describe,expect,it} from 'vitest';
import type {Project} from '../types/crm';
import {reconcileExternalQuoteDealAfterAck} from './externalQuoteDealReconcile';

const initial:Project={
 id:'deal-1',name:'Builder scope',stage:'Bid Development',dueDate:'2026-11-19',
 amount:1000,lastTouchpoint:'2026-11-07',
 createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-10T12:00:00Z',
};
const confirmed:Project={...initial,stage:'Bid Sent',amount:12000,
 dueDate:undefined,lastTouchpoint:'2026-11-12',
 stageChangedAt:'2026-11-12T12:00:00Z',updatedAt:'2026-11-13T12:00:00Z'};

describe('Batch 330: asynchronous external bid CRM state reconciliation',()=>{
 it('preserves another Deal and edits to the submitted Deal made during the network wait',()=>{
  const second:Project={...initial,id:'deal-2',name:'Unrelated quote'};
  const later={...initial,name:'Updated during upload',nextAction:'Call GC',
   updatedAt:'2026-11-13T13:00:00Z',lastTouchpoint:'2026-11-13'};
  const actual=reconcileExternalQuoteDealAfterAck([second,later],initial,confirmed);
  expect(actual[0]).toBe(second);
  expect(actual[1]).toMatchObject({
   name:'Updated during upload',nextAction:'Call GC',
   stage:'Bid Sent',amount:12000,dueDate:undefined,
   lastTouchpoint:'2026-11-13',updatedAt:'2026-11-13T13:00:00Z',
  });
  expect(later.stage).toBe('Bid Development');
  expect(later.dueDate).toBe('2026-11-19');
 });
 it('does not reverse a newer local negotiation or closed Deal transition',()=>{
  for(const stage of ['Negotiation','Closed Won','Completed'] as const){
   const later={...initial,stage,updatedAt:'2026-11-13T13:00:00Z'};
   expect(reconcileExternalQuoteDealAfterAck([later],initial,confirmed)[0]).toBe(later);
  }
 });
 it('can safely replay the same confirmed response without re-opening a due date',()=>{
  const [once]=reconcileExternalQuoteDealAfterAck([initial],initial,confirmed);
  const [twice]=reconcileExternalQuoteDealAfterAck([once],initial,confirmed);
  expect(twice).toEqual(once);
 });
});
