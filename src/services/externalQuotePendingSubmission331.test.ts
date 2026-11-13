import {describe,it,expect} from 'vitest';
import {
 isPendingExternalQuoteSubmission,readPendingExternalQuoteSubmission,
 savePendingExternalQuoteSubmission,clearPendingExternalQuoteSubmission,
 type PendingExternalQuoteSubmission,
} from './externalQuotePendingSubmission';

const scope={organizationId:'org-1',userId:'rep-1',dealId:'deal-1'};
const pending:PendingExternalQuoteSubmission={...scope,version:1,id:'activity_retry_1',
 recordedAt:'2026-11-13T14:00:00.000Z',bidSentDate:'2026-11-12',
 amount:25000,format:'Builder portal'};
function storage(){
 const entries=new Map<string,string>();
 return {
  getItem:(key:string)=>entries.get(key)??null,
  setItem:(key:string,value:string)=>{entries.set(key,value);},
  removeItem:(key:string)=>{entries.delete(key);},
 };
}
describe('Batch 331 — pending external bid identity after refresh',()=>{
 it('restores the same immutable Activity ID and original submission values',()=>{
  const memory=storage();
  expect(savePendingExternalQuoteSubmission(pending,memory)).toBe(true);
  expect(readPendingExternalQuoteSubmission(scope,memory)).toEqual(pending);
  expect(clearPendingExternalQuoteSubmission(pending,memory)).toBe(true);
  expect(readPendingExternalQuoteSubmission(scope,memory)).toBeNull();
 });
 it('never leaks recovery details across organizations, users or Deals',()=>{
  const memory=storage();
  savePendingExternalQuoteSubmission(pending,memory);
  for(const identity of [
   {...scope,organizationId:'org-2'},
   {...scope,userId:'rep-2'},
   {...scope,dealId:'deal-2'},
  ])expect(readPendingExternalQuoteSubmission(identity,memory)).toBeNull();
 });
 it('does not clear a newer retry attempt from another browser tab',()=>{
  const memory=storage();
  savePendingExternalQuoteSubmission(pending,memory);
  const newer={...pending,id:'activity_retry_2',recordedAt:'2026-11-13T15:00:00.000Z'};
  savePendingExternalQuoteSubmission(newer,memory);
  expect(clearPendingExternalQuoteSubmission(pending,memory)).toBe(false);
  expect(readPendingExternalQuoteSubmission(scope,memory)).toEqual(newer);
 });
 it('rejects malformed or foreign pending envelopes and handles blocked storage',()=>{
  expect(isPendingExternalQuoteSubmission({...pending,amount:-1},scope)).toBe(false);
  expect(isPendingExternalQuoteSubmission({...pending,dealId:'other'},scope)).toBe(false);
  expect(isPendingExternalQuoteSubmission({...pending,id:'quote_not_activity'},scope)).toBe(false);
  expect(readPendingExternalQuoteSubmission(scope,null)).toBeNull();
  expect(savePendingExternalQuoteSubmission(pending,null)).toBe(false);
 });
});
