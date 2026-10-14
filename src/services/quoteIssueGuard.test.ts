import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {quoteDeliveryApprovalKey} from './quoteDeliveryApproval';
import {assertMatchingApprovedDraft} from './quoteIssueGuard';

const draft=(overrides:Partial<Quote>={}):Quote=>({
  id:'quote-1',revision:0,status:'Draft',updatedAt:'2026-10-14T20:00:00.000Z',
  ...overrides,
} as Quote);

describe('Quote commit-time approval guard',()=>{
  const key=quoteDeliveryApprovalKey(draft());
  it('allows an unchanged exact draft at both issue checkpoints',()=>{
    expect(()=>assertMatchingApprovedDraft(draft(),key)).not.toThrow();
    expect(()=>assertMatchingApprovedDraft(draft({status:'Ready'}),key)).not.toThrow();
  });
  it('rejects changes that happened during async permission or number assignment',()=>{
    for(const changed of [
      draft({updatedAt:'2026-10-14T20:00:01.000Z'}),
      draft({revision:1}),
      draft({id:'different-quote'}),
      draft({status:'Sent'}),
      undefined,
    ])expect(()=>assertMatchingApprovedDraft(changed,key)).toThrow(/changed while it was being issued/);
  });
  it('does not alter Classic or Pricing Schedule issuance without an approval key',()=>{
    expect(()=>assertMatchingApprovedDraft(draft({revision:7}))).not.toThrow();
    expect(()=>assertMatchingApprovedDraft(undefined)).not.toThrow();
  });
});
