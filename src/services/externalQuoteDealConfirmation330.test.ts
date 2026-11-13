import {describe,expect,it} from 'vitest';
import {confirmedExternalQuoteDeal} from './externalQuoteDealConfirmation';

describe('Batch 330 external Quote Deal acknowledgement',()=>{
 const saved={id:'deal-1',stage:'Bid Sent',amount:12000,due_date:null};
 it('accepts the exact persisted stage, amount and cleared bid deadline',()=>{
  expect(confirmedExternalQuoteDeal(saved,'deal-1','Bid Sent',12000)).toBe(true);
  expect(confirmedExternalQuoteDeal({...saved,amount:'12000'},
   'deal-1','Bid Sent',12000)).toBe(true);
  expect(confirmedExternalQuoteDeal({...saved,amount:0},
   'deal-1','Bid Sent',0)).toBe(true);
 });
 it('cannot confirm a hidden record, stale amount, changed stage or pending deadline',()=>{
  for(const value of [null,undefined,{},[],{...saved,id:'other'},
   {...saved,stage:'Negotiation'}, {...saved,due_date:'2026-11-19'},
   {...saved,amount:12001}, {...saved,amount:null},
   {...saved,amount:'not a price'}]){
    expect(confirmedExternalQuoteDeal(value,'deal-1','Bid Sent',12000)).toBe(false);
  }
 });
 it('does not confuse an earlier quote submission with a different Deal',()=>{
  expect(confirmedExternalQuoteDeal(saved,'deal-2','Bid Sent',12000)).toBe(false);
 });
});
