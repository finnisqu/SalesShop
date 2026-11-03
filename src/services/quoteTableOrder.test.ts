import {describe,it,expect} from 'vitest';
import type {Quote} from '../types/quote';
import {createQuoteTableOrder,setQuoteTableOrder} from './quoteStructure';
import {quoteTotal} from '../types/quote';
const quote=()=>({
 id:'q',status:'Draft',sections:[
  {id:'a',title:'Kitchen',scope:{takeoffPieces:[
    {id:'p1',name:'Island',count:1,lengthIn:70,widthIn:36,backsplash:true},
    {id:'p2',name:'L',count:1,lengthIn:40,widthIn:20}],
   takeoffSinks:[{id:'s1',name:'3218',count:1,category:'kitchen'}]}},
  {id:'b',title:'Vanity',scope:{takeoffPieces:[],takeoffSinks:[]}}],
 lines:[{id:'m',sectionId:'a',kind:'material',pricingMode:'quantity-rate',quantity:2,rate:40,
  includeInTotal:true,customerVisible:true,quantitySource:{syncMode:'live',field:'countertopSf'}},
  {id:'c1',sectionId:'a',kind:'item',description:'Miter',pricingMode:'direct',amount:50,includeInTotal:true},
  {id:'c2',sectionId:'a',kind:'item',description:'Delivery',pricingMode:'direct',amount:100,includeInTotal:true},
  {id:'g1',kind:'item',description:'General A',pricingMode:'direct',amount:10,includeInTotal:true},
  {id:'g2',kind:'item',description:'General B',pricingMode:'direct',amount:20,includeInTotal:true}]
 } as Quote);
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
