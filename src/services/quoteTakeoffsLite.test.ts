import { describe, expect, it } from 'vitest';
import type { Quote,QuoteTakeoffPiece,QuoteLine } from '../types/quote';
import { applyAreaScopeQuantity,resolveLineAreaScopeState } from './quoteAreaScope';
import {
  parseInches,isValidTakeoffPiece,takeoffPieceSf,totalTakeoffSf,
  patchQuoteTakeoff,detachQuoteTakeoff,sectionTakeoffSf,newTakeoffPiece,
  takeoffCustomerDetails,takeoffCustomerSpecs,
} from './quoteTakeoffsLite';

const at='2026-10-12T18:30:00.000Z';
const piece=(id:string,lengthIn?:number,widthIn?:number,count=1):QuoteTakeoffPiece=>({
  id,name:id,lengthIn,widthIn,count,
});
function quote():Quote {
  const source={kind:'area-scope' as const,sectionId:'kitchen',field:'countertopSf' as const,
    capturedValue:40,appliedAt:at,syncMode:'live' as const};
  const line=(id:string,sectionId:string,sourcePatch?:Partial<QuoteLine>):QuoteLine=>({
    id,sectionId,kind:'rate',description:'Fabrication',pricingMode:'quantity-rate',
    quantity:40,rate:25,customerVisible:true,includeInTotal:true,...sourcePatch,
  });
  return {
    id:'q',quoteNumber:'DRAFT-q',documentType:'quote',originalQuoteDate:'2026-10-12',
    quoteDate:'2026-10-12',revision:0,status:'Draft',title:'Test takeoffs',
    sections:[
      {id:'kitchen',title:'Kitchen',customerVisible:true,scope:{countertopSf:40,kitchenSinkCount:1}},
      {id:'bath',title:'Bath',customerVisible:true,scope:{countertopSf:17}}],
    lines:[
      line('live','kitchen',{quantitySource:source}),
      line('manual','kitchen',{quantity:19,quantitySource:undefined}),
      line('legacy','kitchen',{quantitySource:{...source,syncMode:undefined}}),
      line('sink','kitchen',{quantity:1,quantitySource:{...source,field:'kitchenSinkCount',capturedValue:1}}),
      line('other','bath',{quantity:17,quantitySource:{...source,sectionId:'bath',capturedValue:17}}),
    ],
    customerColumns:{quantity:true,rate:true,lineAmount:true},
    customerNotes:'',internalNotes:'',history:[],createdAt:at,updatedAt:at,
  };
}
describe('Takeoffs Lite: precise fractional-inch piece measurements',()=>{
  it('accepts decimal, mixed, hyphenated, stand-alone and unicode fractions',()=>{
    expect(parseInches('25.5')).toBe(25.5);
    expect(parseInches('25 1/2')).toBe(25.5);
    expect(parseInches('25-1/2')).toBe(25.5);
    expect(parseInches('25½')).toBe(25.5);
    expect(parseInches('½')).toBe(0.5);
    expect(parseInches('1/4')).toBe(0.25);
    expect(parseInches('24"')).toBe(24);
  });
  it('rejects negative, invalid, zero and extreme dimensions',()=>{
    for(const value of ['','0','-3','-1/2','1/0','25 2/2','twenty-five','3e12','10001']){
      expect(parseInches(value)).toBeUndefined();
    }
    expect(isValidTakeoffPiece(piece('bad',0,25))).toBe(false);
    expect(isValidTakeoffPiece(piece('bad',20,25,0))).toBe(false);
  });
  it('multiplies piece dimensions and count in inches, rounding only final SF once',()=>{
    const parts=[piece('island',96,36),piece('return',120,25.5),piece('vanity',60,25.5,2)];
    expect(parts.map(p=>takeoffPieceSf(p))).toEqual([24,21.25,21.25]);
    expect(totalTakeoffSf(parts)).toBe(66.5);
    expect(totalTakeoffSf([piece('a',3,5),piece('b',3,5)])).toBe(0.21);
    expect(totalTakeoffSf([piece('unfinished'),piece('complete',48,24)])).toBe(8);
  });
  it('patches area SF and only same-area LIVE-linked quantity; preserves all other pricing',()=>{
    const original=quote();
    const changed=patchQuoteTakeoff(original,'kitchen',
      [piece('island',96,36),piece('run',120,25.5)],at);
    expect(changed.sections[0].scope?.countertopSf).toBe(45.25);
    expect(changed.sections[0].scope?.takeoffPieces).toHaveLength(2);
    expect(changed.sections[0].scope?.kitchenSinkCount).toBe(1);
    expect(changed.sections[1]).toEqual(original.sections[1]);
    expect(changed.lines[0].quantity).toBe(45.25);
    expect(changed.lines[0].rate).toBe(25);
    expect(changed.lines[0].quantitySource?.capturedValue).toBe(45.25);
    expect(changed.lines[1]).toEqual(original.lines[1]);
    expect(changed.lines[2]).toEqual(original.lines[2]);
    expect(changed.lines[3]).toEqual(original.lines[3]);
    expect(changed.lines[4]).toEqual(original.lines[4]);
    expect(original.sections[0].scope?.countertopSf).toBe(40);
  });
  it('new SF quantity links stay live while old ones remain snapshot-based',()=>{
    const start=quote();
    const current=patchQuoteTakeoff(start,'kitchen',[piece('island',96,36)],at);
    const section=current.sections[0];
    expect(sectionTakeoffSf(section)).toBe(24);
    const patch=applyAreaScopeQuantity(section,'countertopSf',at);
    expect(patch?.quantity).toBe(24);
    expect(patch?.quantitySource?.syncMode).toBe('live');
    const linked={...current.lines[0],quantity:patch!.quantity,quantitySource:patch!.quantitySource};
    expect(resolveLineAreaScopeState({...current,lines:[linked]},linked)?.changed).toBe(false);
    expect(applyAreaScopeQuantity(start.sections[0],'countertopSf',at)?.quantitySource?.syncMode).toBeUndefined();
  });
  it('switches back to manual SF without erasing current billable area or quote rates',()=>{
    const original=quote();
    const measured=patchQuoteTakeoff(original,'kitchen',[piece('island',96,36)],at);
    const detached=detachQuoteTakeoff(measured,'kitchen');
    expect(detached.sections[0].scope?.countertopSf).toBe(24);
    expect(detached.sections[0].scope?.takeoffPieces).toBeUndefined();
    expect(detached.lines[0].quantity).toBe(24);
    expect(detached.lines[0].rate).toBe(25);
    expect(detached.lines[0].quantitySource?.syncMode).toBeUndefined();
    expect(detached.lines[0].quantitySource?.capturedValue).toBe(24);
    expect(detached.lines[1]).toEqual(original.lines[1]);
    expect(detachQuoteTakeoff(detached,'kitchen')).toBe(detached);
  });
  it('supports an empty area and a new piece with independent identity',()=>{
    const blank=patchQuoteTakeoff(quote(),'kitchen',[]);
    expect(blank.sections[0].scope?.countertopSf).toBe(0);
    expect(blank.lines[0].quantity).toBe(0);
    const a=newTakeoffPiece(1),b=newTakeoffPiece(1);
    expect(a).toMatchObject({name:'',count:1});
    expect(a.id).not.toBe(b.id);
  });
  it('uses only selected surface and sink labels in the customer document',()=>{
    const section=quote().sections[0];
    const withSpecs={...section,scope:{
      ...section.scope,takeoffMaterial:'  Glacier White Quartz  ',
      takeoffPieces:[piece('Private measurements',48,25)],
      takeoffSinks:[
        {id:'s1',category:'kitchen' as const,name:'3218 Single',count:2,
          unitPrice:240,internalCostOverride:110},
        {id:'s2',category:'vanity' as const,name:'',count:1,unitPrice:85},
        {id:'s3',category:'vanity' as const,name:'Unused sink',count:0,unitPrice:99},
      ],
    }};
    const detail=takeoffCustomerDetails(withSpecs);
    expect(detail).toEqual({
      material:'Glacier White Quartz',
      sinks:['2 × 3218 Single','1 × Vanity sink'],
    });
    expect(takeoffCustomerSpecs(withSpecs))
      .toBe('Glacier White Quartz · 2 × 3218 Single · 1 × Vanity sink');
    const displayed=JSON.stringify(detail);
    expect(displayed).not.toContain('Private measurements');
    expect(displayed).not.toContain('internalCost');
    expect(displayed).not.toContain('110');
    expect(displayed).not.toContain('Unused sink');
  });
  it('emits no customer details for an unselected Area',()=>{
    expect(takeoffCustomerDetails(quote().sections[1])).toEqual({material:'',sinks:[]});
    expect(takeoffCustomerSpecs(quote().sections[1])).toBe('');
  });

});
