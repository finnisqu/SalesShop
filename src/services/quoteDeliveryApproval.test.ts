import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {
  approvedCustomerDraft,quoteDeliveryApprovalKey,quoteDeliveryReviewKey,shareMatchesQuoteRevision,
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
  it('cannot reuse a preview approval when customer-facing scope changes in the same millisecond',()=>{
    const base=draft({
      title:'Kitchen',companyName:'Builder',customerNotes:'Price valid for 30 days',
      sections:[{id:'k',title:'Kitchen',customerVisible:true,customerDisplayMode:'detail'}],
      lines:[{id:'line',sectionId:'k',kind:'material',description:'Quartz',
        pricingMode:'direct',amount:1500,customerVisible:true,includeInTotal:true}],
      customerColumns:{quantity:true,rate:true,lineAmount:true},
    });
    const key=quoteDeliveryApprovalKey(base);
    expect(approvedCustomerDraft({...base},key,key)).toBe(true);
    for(const changed of [
      {...base,title:'Different project'},
      {...base,customerNotes:'Different terms'},
      {...base,companyName:'Different customer'},
      {...base,sections:[{...base.sections[0],title:'Island'}]},
      {...base,lines:[{...base.lines[0],amount:1600}]},
      {...base,lines:[{...base.lines[0],customerVisible:false}]},
    ]){
      expect(changed.updatedAt).toBe(base.updatedAt);
      expect(approvedCustomerDraft(changed,key,key)).toBe(false);
    }
  });
  it('keeps reviewed findings checked across preview without carrying them through changes',()=>{
    const quote=draft();
    const findings=[{id:'unselected-material',severity:'review'}];
    const key=quoteDeliveryReviewKey(quote,findings);
    expect(quoteDeliveryReviewKey(draft(),findings)).toBe(key);
    expect(quoteDeliveryReviewKey(draft({updatedAt:'2026-10-14T19:30:01.000Z'}),findings)).not.toBe(key);
    expect(quoteDeliveryReviewKey(draft({revision:1}),findings)).not.toBe(key);
    expect(quoteDeliveryReviewKey(draft({id:'quote-2'}),findings)).not.toBe(key);
    expect(quoteDeliveryReviewKey(quote,[{id:'price-missing',severity:'blocker'}])).not.toBe(key);
    expect(quoteDeliveryReviewKey(quote,[{id:'unselected-material',severity:'blocker'}])).not.toBe(key);
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
