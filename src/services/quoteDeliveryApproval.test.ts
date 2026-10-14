import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {
  approvedCustomerDraft,quoteDeliveryApprovalKey,shareMatchesQuoteRevision,
} from './quoteDeliveryApproval';

const draft=(overrides:Partial<Quote>={}):Quote=>({
  id:'quote-1',revision:0,updatedAt:'2026-10-14T19:30:00.000Z',
  status:'Draft',...overrides,
} as Quote);

describe('Preview → Approve → Share revision binding',()=>{
  it('only accepts approval of the exact draft that was previewed',()=>{
    const quote=draft();
    const key=quoteDeliveryApprovalKey(quote);
    expect(approvedCustomerDraft(quote,key,key)).toBe(true);
    expect(approvedCustomerDraft(quote,key,null)).toBe(false);
    expect(approvedCustomerDraft(quote,null,key)).toBe(false);
  });
  it('invalidates approval after edits, new revisions, or quote switches',()=>{
    const first=draft();
    const key=quoteDeliveryApprovalKey(first);
    for(const changed of [
      draft({updatedAt:'2026-10-14T19:30:01.000Z'}),
      draft({revision:1}),
      draft({id:'different-quote'}),
    ])expect(approvedCustomerDraft(changed,key,key)).toBe(false);
  });
  it('does not mistake an issued document for an approvable draft',()=>{
    const sent=draft({status:'Sent'});
    const key=quoteDeliveryApprovalKey(sent);
    expect(approvedCustomerDraft(sent,key,key)).toBe(false);
  });
  it('shares only the current stored revision, never an older link',()=>{
    expect(shareMatchesQuoteRevision(draft({revision:2}),{revision:2})).toBe(true);
    expect(shareMatchesQuoteRevision(draft({revision:2}),{revision:1})).toBe(false);
  });
});
