import {describe,it,expect} from 'vitest';
import type {Quote,QuoteTakeoffPiece,QuoteTakeoffSink} from '../types/quote';
import {quoteTotal,quoteLinesTotal} from '../types/quote';
import {roundedBillableTakeoffSf,totalBillableTakeoffSf,patchQuoteTakeoff} from './quoteTakeoffsLite';

/** The exact two-room worksheet example supplied for the matrix redesign. */
const makeQuote=():Quote=>{
 const kitchen:QuoteTakeoffPiece[]=[
  {id:'island',name:'Island',count:1,lengthIn:73,widthIn:36},
  {id:'perimeter',name:'Perimeter',count:1,lengthIn:120,widthIn:25.5},
  {id:'splash',name:'Splash',count:1,lengthIn:120,widthIn:4},
 ];
 const bath:QuoteTakeoffPiece[]=[
  {id:'vanity',name:'Double Vanity',count:1,lengthIn:68,widthIn:22.5},
  {id:'bath-splash',name:'Splash',count:1,lengthIn:68,widthIn:4},
 ];
 const kSink:QuoteTakeoffSink={id:'k-sink',name:'3218',category:'kitchen',count:1,unitPrice:220,includeInPricing:true};
 const bSink:QuoteTakeoffSink={id:'b-sink',name:'1813',category:'vanity',count:2,unitPrice:75,includeInPricing:true};
 return {
  id:'workbook-example',title:'Two room quote',documentType:'quote',status:'Draft',
  quoteNumber:'DRAFT-workbook',originalQuoteDate:'2026-11-02',quoteDate:'2026-11-02',
  revision:0,customerNotes:'',internalNotes:'',createdAt:'2026-11-02',updatedAt:'2026-11-02',
  history:[],customerColumns:{quantity:true,rate:true,lineAmount:true},
  sections:[
   {id:'kitchen',title:'Kitchen',customerVisible:true,scope:{
    takeoffPieces:kitchen,takeoffSinks:[kSink],billableSfRounding:'whole-up',
    countertopSf:43,takeoffMaterial:'Valle Nevado Granite'}},
   {id:'bathroom',title:'Bathroom',customerVisible:true,scope:{
    takeoffPieces:bath,takeoffSinks:[bSink],billableSfRounding:'whole-up',
    countertopSf:13,takeoffMaterial:'Valle Nevado Granite'}},
  ],
  lines:[
   {id:'stone-k',sectionId:'kitchen',kind:'material',description:'Granite kitchen',
    pricingMode:'quantity-rate',quantity:43,rate:36,includeInTotal:true,customerVisible:true,
    quantitySource:{kind:'area-scope',sectionId:'kitchen',field:'countertopSf',capturedValue:43,
     syncMode:'live',appliedAt:'2026-11-02'}},
   {id:'sink-k',sectionId:'kitchen',kind:'sink',description:'3218',pricingMode:'quantity-rate',
    quantity:1,rate:220,takeoffSinkId:'k-sink',includeInTotal:true,customerVisible:true},
   {id:'stone-b',sectionId:'bathroom',kind:'material',description:'Granite bathroom',
    pricingMode:'quantity-rate',quantity:13,rate:36,includeInTotal:true,customerVisible:true,
    quantitySource:{kind:'area-scope',sectionId:'bathroom',field:'countertopSf',capturedValue:13,
     syncMode:'live',appliedAt:'2026-11-02'}},
   {id:'sink-b',sectionId:'bathroom',kind:'sink',description:'1813',pricingMode:'quantity-rate',
    quantity:2,rate:75,takeoffSinkId:'b-sink',includeInTotal:true,customerVisible:true},
  ],
 } as Quote;
};
describe('workbook-style matrix pricing parity',()=>{
 it('preserves measured and billable SF separately for each room',()=>{
  const quote=makeQuote();
  const kitchen=quote.sections[0].scope!.takeoffPieces!;
  const bathroom=quote.sections[1].scope!.takeoffPieces!;
  expect(totalBillableTakeoffSf(kitchen)).toBe(42.83);
  expect(totalBillableTakeoffSf(bathroom)).toBe(12.51);
  expect(roundedBillableTakeoffSf(kitchen,'whole-up')).toBe(43);
  expect(roundedBillableTakeoffSf(bathroom,'whole-up')).toBe(13);
 });
 it('calculates the two Area totals from a single stone line and actual sink lines',()=>{
  const quote=makeQuote();
  expect(quoteLinesTotal(quote.lines.filter(l=>l.sectionId==='kitchen'))).toBe(1768);
  expect(quoteLinesTotal(quote.lines.filter(l=>l.sectionId==='bathroom'))).toBe(618);
  expect(quoteTotal(quote)).toBe(2386);
 });
 it('preserves geometry but re-syncs selling SF when a measured splash is struck out',()=>{
  const q=makeQuote();
  const pieces=q.sections[0].scope!.takeoffPieces!;
  const updated=patchQuoteTakeoff(q,'kitchen',pieces.map(p=>p.id==='splash'
    ?{...p,excludedFromQuote:true}:p));
  expect(updated.sections[0].scope!.takeoffPieces!.find(p=>p.id==='splash')?.lengthIn).toBe(120);
  expect(updated.sections[0].scope!.countertopSf).toBe(40);
  expect(updated.lines.find(l=>l.id==='stone-k')?.quantity).toBe(40);
  expect(quoteTotal(updated)).toBe(2278);
  expect(quoteTotal(q)).toBe(2386);
 });
});
