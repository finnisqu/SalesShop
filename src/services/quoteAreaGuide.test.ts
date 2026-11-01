import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {quoteAreaGuide} from './quoteAreaGuide';
const quote=(patch:Partial<Quote>={}):Quote=>({
 id:'q',title:'Draft',status:'Draft',documentType:'quote',lines:[],
 sections:[{id:'k',title:'Kitchen'} as Quote['sections'][number]],...patch,
} as Quote);
describe('Area guide is optional and read-only',()=>{
 it('offers a first action for untouched Areas without writing data',()=>{
  const q=quote(),before=JSON.stringify(q);
  expect(quoteAreaGuide(q,q.sections[0])).toMatchObject({fresh:true,pieces:0,sinks:0,lines:0});
  expect(JSON.stringify(q)).toBe(before);
 });
 it('allows a flat-fee Area without pieces or material',()=>{
  const q=quote({lines:[{id:'fee',sectionId:'k',kind:'item',description:'Flat fee',
    pricingMode:'direct',amount:375,includeInTotal:true} as Quote['lines'][number]]});
  expect(quoteAreaGuide(q,q.sections[0])).toMatchObject({fresh:false,pieces:0,material:'',lines:1});
 });
 it('does not classify General Takeoffs as a fresh customer Area',()=>{
  const q=quote({sections:[{id:'g',title:'General Takeoffs'} as Quote['sections'][number]]});
  expect(quoteAreaGuide(q,q.sections[0]).fresh).toBe(false);
 });
});