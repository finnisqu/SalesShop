import {describe,it,expect} from 'vitest';
import type {Quote} from '../types/quote';
import {createQuoteTableOrder,setQuoteTableOrder} from './quoteStructure';
import {quoteTotal} from '../types/quote';
const quote=():Quote=>({
 id:'q',quoteNumber:'DRAFT-1',documentType:'quote',
 originalQuoteDate:'2026-11-03',quoteDate:'2026-11-03',revision:0,
 status:'Draft',title:'Reorder test',sections:[
  {id:'a',title:'Kitchen',customerVisible:true,scope:{takeoffPieces:[
    {id:'p1',name:'Island',count:1,lengthIn:70,widthIn:36,backsplash:true},
    {id:'p2',name:'L',count:1,lengthIn:40,widthIn:20}],
   takeoffSinks:[{id:'s1',name:'3218',count:1,category:'kitchen',includeInPricing:true}]}},
  {id:'b',title:'Vanity',customerVisible:true,scope:{takeoffPieces:[],takeoffSinks:[]}}],
 lines:[{id:'m',sectionId:'a',kind:'material',description:'Stone',pricingMode:'quantity-rate',quantity:2,rate:40,
  includeInTotal:true,customerVisible:true,quantitySource:{kind:'area-scope',sectionId:'a',field:'countertopSf',capturedValue:2,appliedAt:'2026-11-03T00:00:00.000Z',syncMode:'live'}},
  {id:'c1',sectionId:'a',kind:'item',description:'Miter',pricingMode:'direct',amount:50,includeInTotal:true,customerVisible:true},
  {id:'c2',sectionId:'a',kind:'item',description:'Delivery',pricingMode:'direct',amount:100,includeInTotal:true,customerVisible:true},
  {id:'g1',kind:'item',description:'General A',pricingMode:'direct',amount:10,includeInTotal:true,customerVisible:true},
  {id:'g2',kind:'item',description:'General B',pricingMode:'direct',amount:20,includeInTotal:true,customerVisible:true}],
 customerColumns:{quantity:true,rate:true,lineAmount:true},
 customerNotes:'',internalNotes:'',history:[],
 createdAt:'2026-11-03T00:00:00.000Z',updatedAt:'2026-11-03T00:00:00.000Z',
 });
describe('reorder-only Quick Quote transaction',()=>{
 it('commits entire Area, piece and charge permutation without changing money or identities',()=>{
  const source=quote(),order=createQuoteTableOrder(source),total=quoteTotal(source);
  order.areas.reverse();order.pieces.a.reverse();order.charges.a.reverse();
  order.charges.__general.reverse();
  const updated=setQuoteTableOrder(source,order);
  expect(updated).not.toBe(source);
  expect(updated.sections.map(s=>s.id)).toEqual(['b','a']);
  expect(updated.sections[1].scope?.takeoffPieces?.map(p=>p.id)).toEqual(['p2','p1']);
  expect(updated.lines.map(l=>l.id)).toEqual(['m','c2','c1','g2','g1']);
  expect(quoteTotal(updated)).toBe(total);
  expect(source.sections[0].scope?.takeoffPieces?.[0].id).toBe('p1');
 });
 it('rejects missing, duplicated or stale identifiers with no partial mutation',()=>{
  const source=quote(),order=createQuoteTableOrder(source);
  order.areas=['a','a'];
  expect(setQuoteTableOrder(source,order)).toBe(source);
  order.areas=['a','b'];order.pieces.a=['p2','missing'];
  expect(setQuoteTableOrder(source,order)).toBe(source);
 });
 it('does not modify a quote on Done without moves',()=>{
  const source=quote();
  expect(setQuoteTableOrder(source,createQuoteTableOrder(source))).toBe(source);
 });
});
