import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {nextReviewFocus} from './quoteReviewReturn';
const base=():Quote=>({id:'q',title:'Demo',status:'Draft',documentType:'quote',
 sections:[],lines:[],companyName:'Acme'} as Quote);
describe('return from quote Review issue repair',()=>{
 it('keeps focus on a finding that still needs work',()=>{
  const quote=base();
  expect(nextReviewFocus(quote,'quote:work')).toBe('quote:work');
 });
 it('selects next canonical blocker after the previous one is resolved',()=>{
  const quote=base();
  quote.lines=[
    {id:'material',kind:'material',description:'Quartz',pricingMode:'quantity-rate',
     rate:undefined,quantity:2,includeInTotal:true,customerVisible:true},
    {id:'trip',kind:'item',description:'Trip fee',pricingMode:'direct',
     amount:70,includeInTotal:true,customerVisible:true},
  ];
  expect(nextReviewFocus(quote,'quote:work')).toBe('line:material:rate');
 });
 it('returns to delivery only when blocking and review findings are clear',()=>{
  const quote=base();
  quote.lines=[{id:'trip',kind:'item',description:'Service',pricingMode:'direct',
     amount:120,includeInTotal:true,customerVisible:true}];
  expect(nextReviewFocus(quote,'quote:work')).toBe('__delivery__');
 });
 it('does not change quote data or customer pricing',()=>{
  const quote=base();const before=JSON.stringify(quote);
  nextReviewFocus(quote,null);
  expect(JSON.stringify(quote)).toBe(before);
 });
});
