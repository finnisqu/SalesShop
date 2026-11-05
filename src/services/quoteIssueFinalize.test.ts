import {describe,expect,it} from 'vitest';
import type {Quote,QuoteDocument} from '../types/quote';
import {mergeConfirmedSentQuote} from './quoteIssueFinalize';

const quote=(id:string,updatedAt='2026-11-05T12:00:00Z'):Quote=>({
  id,title:id,quoteNumber:'DRAFT-'+id,documentType:'quote',
  status:'Draft',revision:0,sections:[],lines:[],history:[],
  originalQuoteDate:'2026-11-05',quoteDate:'2026-11-05',
  customerNotes:'',internalNotes:'',
  customerColumns:{quantity:false,rate:false,lineAmount:true},
  createdAt:updatedAt,updatedAt,
});
const doc=(quotes:Quote[],activeQuoteId:string|null):QuoteDocument=>
  ({schemaVersion:2,quotes,activeQuoteId});

describe('Quote issuance after asynchronous cloud confirmation',()=>{
  it('commits only the Sent quote and retains unrelated edits, new quotes and selection',()=>{
    const draft=quote('a');
    const changedOther={...quote('b'),title:'Edited while sending'};
    const added=quote('new');
    const sent:Quote={...draft,status:'Sent',quoteNumber:'Q-20261105-001'};
    const latest=doc([added,changedOther,draft],'b');
    const result=mergeConfirmedSentQuote(latest,draft,sent);
    expect(result.activeQuoteId).toBe('b');
    expect(result.quotes.map(q=>q.id)).toEqual(['new','b','a']);
    expect(result.quotes[0]).toBe(added);
    expect(result.quotes[1]).toBe(changedOther);
    expect(result.quotes[2]).toBe(sent);
    expect(latest.quotes[2]).toBe(draft);
  });

  it('rejects concurrent edits to the draft even when timestamps match',()=>{
    const draft=quote('a');
    const sent={...draft,status:'Sent' as const};
    const sameMillisecondEdit={...draft,title:'Price updated'};
    expect(sameMillisecondEdit.updatedAt).toBe(draft.updatedAt);
    expect(()=>mergeConfirmedSentQuote(doc([sameMillisecondEdit],'a'),draft,sent))
      .toThrow(/Quote changed while sending/);
  });

  it('rejects deletion, replacement, or a mismatched Sent document',()=>{
    const draft=quote('a');
    expect(()=>mergeConfirmedSentQuote(doc([],'b'),draft,{...draft,status:'Sent'}))
      .toThrow(/Quote changed while sending/);
    expect(()=>mergeConfirmedSentQuote(doc([quote('a')],'a'),draft,{...draft,status:'Sent'}))
      .toThrow(/Quote changed while sending/);
    expect(()=>mergeConfirmedSentQuote(doc([draft],'a'),draft,{...quote('b'),status:'Sent'}))
      .toThrow(/Quote changed while sending/);
  });
});
