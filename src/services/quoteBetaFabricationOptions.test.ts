import { describe, expect, it } from 'vitest';
import type { Quote, QuoteLine, QuoteTakeoffPiece } from '../types/quote';
import { quoteLinesTotal } from '../types/quote';
import {
  newTakeoffSink, patchQuoteTakeoffSinks, takeoffPieceSplashSf,
  totalBillableTakeoffSf, FAUCET_HOLE_OFFSETS_IN,
} from './quoteTakeoffsLite';
import { presentItemizedQuoteLines } from './quoteCustomerPresentation';

const date='2026-10-12T12:00:00.000Z';
const quote=():Quote=>({
  id:'q',quoteNumber:'DRAFT-q',documentType:'quote',originalQuoteDate:'2026-10-12',
  quoteDate:'2026-10-12',revision:0,status:'Draft',title:'Kitchen',sections:[
    {id:'area',title:'Kitchen',customerVisible:true,customerDisplayMode:'detail',
      scope:{takeoffPieces:[],takeoffSinks:[]}},
  ],lines:[{
    id:'top',sectionId:'area',kind:'material',description:'Kitchen Countertops · Ashen White',
    pricingMode:'direct',amount:1780,customerVisible:true,includeInTotal:true,
  }],customerColumns:{quantity:false,rate:false,lineAmount:true},
  customerNotes:'',internalNotes:'',history:[],createdAt:date,updatedAt:date,
});
describe('mobile beta fabrication selections and always-included sink accounting',()=>{
  it('defaults to one centered hole; supports nine symmetric 2-inch-offset drilling positions',()=>{
    const sink=newTakeoffSink();
    expect(sink.includeInPricing).toBe(true);
    expect(sink.faucetHoleOffsetsIn).toEqual([0]);
    expect(FAUCET_HOLE_OFFSETS_IN).toEqual([-8,-6,-4,-2,0,2,4,6,8]);
  });
  it('adds a priced sink charge automatically, but hides it in the main price until itemized',()=>{
    const sink={...newTakeoffSink(),name:'Kitchen 3218',unitPrice:220};
    const withSink=patchQuoteTakeoffSinks(quote(),'area',[sink]);
    expect(withSink.lines).toHaveLength(2);
    expect(withSink.lines[1].customerVisible).toBe(false);
    expect(withSink.lines[1].rate).toBe(220);
    expect(quoteLinesTotal(withSink.lines)).toBe(2000);
    expect(presentItemizedQuoteLines(withSink.lines).map(x=>x.amount)).toEqual([2000]);
    const itemized:QuoteLine[]=withSink.lines.map(line=>({...line,customerVisible:true}));
    expect(presentItemizedQuoteLines(itemized).map(x=>x.amount)).toEqual([1780,220]);
    expect(quoteLinesTotal(itemized)).toBe(2000);
  });
  it('preserves existing managed sink display choices and editing does not duplicate its charge',()=>{
    const sink={...newTakeoffSink(),name:'Kitchen 3218',unitPrice:220};
    const once=patchQuoteTakeoffSinks(quote(),'area',[sink]);
    const twice=patchQuoteTakeoffSinks(once,'area',[{...sink,unitPrice:225,faucetHoleOffsetsIn:[-2,0,2]}]);
    expect(twice.lines).toHaveLength(2);
    expect(quoteLinesTotal(twice.lines)).toBe(2005);
    expect(twice.sections[0].scope?.takeoffSinks?.[0].faucetHoleOffsetsIn).toEqual([-2,0,2]);
  });
  it('changes billable splash square footage by piece-specific height',()=>{
    const piece:QuoteTakeoffPiece={id:'p',name:'Island',lengthIn:72,widthIn:24,count:1,backsplash:true};
    expect(takeoffPieceSplashSf(piece)).toBe(2);
    expect(takeoffPieceSplashSf({...piece,splashHeightIn:6})).toBe(3);
    expect(totalBillableTakeoffSf([{...piece,count:0,splashHeightIn:6}])).toBe(0);
    expect(totalBillableTakeoffSf([{...piece,splashHeightIn:6}])).toBe(15);
  });
});
