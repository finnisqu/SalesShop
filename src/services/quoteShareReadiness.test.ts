import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {reviewItemsBlockingDirectShare} from './quoteShareReadiness';

const quote=(patch:Partial<Quote>={}):Quote=>({
  id:'quote-1',title:'Kitchen proposal',quoteNumber:'DRAFT-1',status:'Draft',quoteDate:'2026-10-14',
  companyName:'World Stone customer',contactEmail:'',
  sections:[],lines:[{id:'line-1',kind:'item',description:'Countertops',
    pricingMode:'direct',amount:400,customerVisible:true,includeInTotal:true}],
  ...patch,
} as Quote);

describe('customer link readiness',()=>{
  it('requires formal issue when a draft has intentionally unresolved review items',()=>{
    expect(reviewItemsBlockingDirectShare(quote({companyName:'',contactName:''}))).toBe(1);
    expect(reviewItemsBlockingDirectShare(quote({status:'Ready',companyName:'',contactName:''}))).toBe(1);
  });
  it('allows complete drafts, and missing optional email alone does not block sharing',()=>{
    expect(reviewItemsBlockingDirectShare(quote())).toBe(0);
  });
  it('does not block existing frozen revisions or pricing schedules on quote-specific warnings',()=>{
    expect(reviewItemsBlockingDirectShare(quote({status:'Sent',companyName:''}))).toBe(0);
    expect(reviewItemsBlockingDirectShare(quote({documentType:'pricing-schedule',companyName:''}))).toBe(0);
  });
});
