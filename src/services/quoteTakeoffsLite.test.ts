import { describe, expect, it } from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {quoteTotal} from '../types/quote';
import type { Quote,QuoteTakeoffPiece,QuoteLine } from '../types/quote';
import { applyAreaScopeQuantity,resolveLineAreaScopeState } from './quoteAreaScope';
import {
  parseInches,isValidTakeoffPiece,takeoffPieceSf,totalTakeoffSf,
  patchQuoteTakeoff,detachQuoteTakeoff,sectionTakeoffSf,newTakeoffPiece,
  takeoffPieceMiterInches,totalBillableMiterInches,roundedBillableTakeoffSf,
  takeoffCustomerDetails,takeoffCustomerSpecs,takeoffSinkIncludedInQuote,
  setQuoteTakeoffSinkCharge,patchQuoteTakeoffSinks,reviewQuoteTakeoffSinkCharge,
  quoteTakeoffSinkChargeConfirmation,
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
  it('rounds only billable selling SF and preserves exact source geometry',()=>{
    const p=piece('island',25,25); // 4.340277... SF
    expect(totalTakeoffSf([p])).toBe(4.34);
    expect(roundedBillableTakeoffSf([p],'exact')).toBe(4.34);
    expect(roundedBillableTakeoffSf([p],'quarter-up')).toBe(4.5);
    expect(roundedBillableTakeoffSf([p],'half-up')).toBe(4.5);
    expect(roundedBillableTakeoffSf([p],'whole-up')).toBe(5);
    const start=quote();
    start.sections[0].scope={...start.sections[0].scope,billableSfRounding:'whole-up'};
    const updated=patchQuoteTakeoff(start,'kitchen',[p],at);
    expect(updated.sections[0].scope?.countertopSf).toBe(5);
    expect(updated.sections[0].scope?.takeoffTopSf).toBe(4.34);
    expect(updated.lines.find(l=>l.id==='live')?.quantity).toBe(5);
  });
  it('tracks explicit linked miter lengths as source geometry changes or is excluded',()=>{
    const p={...piece('waterfall',96,36,2),miterFront:true,miterRight:true};
    expect(takeoffPieceMiterInches(p)).toBe(264);
    expect(totalBillableMiterInches([p])).toBe(264);
    expect(totalBillableMiterInches([{...p,excludedFromQuote:true}])).toBe(0);
    const start=quote();
    start.lines.push({
      id:'miters',sectionId:'kitchen',kind:'rate',description:'Mitered edge',
      pricingMode:'quantity-rate',quantity:264,rate:50,
      customerVisible:true,includeInTotal:true,
      quantitySource:{kind:'area-scope',sectionId:'kitchen',
        field:'miterInches',capturedValue:264,appliedAt:at,syncMode:'live'},
    });
    const updated=patchQuoteTakeoff(start,'kitchen',[{...p,lengthIn:100}],at);
    expect(updated.sections[0].scope?.miterInches).toBe(272);
    expect(updated.lines.find(line=>line.id==='miters')?.quantity).toBe(272);
    const excluded=patchQuoteTakeoff(updated,'kitchen',[{...p,excludedFromQuote:true}],at);
    expect(excluded.lines.find(line=>line.id==='miters')?.quantity).toBe(0);
    expect(excluded.sections[0].scope?.takeoffPieces?.[0].miterFront).toBe(true);
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
        {id:'s1',category:'kitchen' as const,name:'3218 Single',count:2,includeInPricing:true,
          unitPrice:240,internalCostOverride:110},
        {id:'s2',category:'vanity' as const,name:'',count:1,includeInPricing:true,unitPrice:85},
        {id:'s3',category:'vanity' as const,name:'Unused sink',count:0,includeInPricing:true,unitPrice:99},
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

 it('preserves an existing specification-only sink and manual sink charge until confirmed opt-in',()=>{
  const start=quote();
  const sink={id:'legacy',category:'kitchen' as const,name:'Undermount',count:2,
    includeInPricing:false,unitPrice:250};
  start.sections[0].scope={...start.sections[0].scope,takeoffSinks:[sink]};
  start.lines.push({id:'manual-sink',sectionId:'kitchen',kind:'sink',description:'Fixture allowance',
    pricingMode:'quantity-rate',quantity:1,rate:180,customerVisible:true,includeInTotal:true});
  const snapshot=JSON.stringify(start),before=quoteTotal(start);
  expect(takeoffSinkIncludedInQuote(start,'kitchen','legacy')).toBe(false);
  const proposal=reviewQuoteTakeoffSinkCharge(start,'kitchen','legacy',true)!;
  expect(proposal.before).toBe(before);expect(proposal.after).toBe(before+500);
  expect(proposal.manualSinkChargePresent).toBe(true);
  expect(quoteTakeoffSinkChargeConfirmation(start,'kitchen','legacy',true))
   .toContain('Review separately priced sink lines');
  expect(JSON.stringify(start)).toBe(snapshot);
  const applied=setQuoteTakeoffSinkCharge(start,'kitchen','legacy',true);
  expect(quoteTotal(applied)).toBe(before+500);
  expect(applied.lines.filter(l=>l.takeoffSinkId==='legacy')).toHaveLength(1);
  expect(applied.lines.find(l=>l.id==='manual-sink')).toEqual(start.lines.find(l=>l.id==='manual-sink'));
  expect(JSON.stringify(start)).toBe(snapshot);
 });
 it('never switches off an excluded legacy managed sink merely by editing its model',()=>{
  const start=quote();
  const sink={id:'old',category:'vanity' as const,name:'Sink',count:1,
    includeInPricing:true,unitPrice:200};
  start.sections[0].scope={...start.sections[0].scope,takeoffSinks:[sink]};
  start.lines.push({id:'old-line',sectionId:'kitchen',takeoffSinkId:'old',kind:'sink',
    description:'Legacy selection',pricingMode:'quantity-rate',quantity:1,rate:200,
    customerVisible:false,includeInTotal:false});
  const before=quoteTotal(start);
  const updated=patchQuoteTakeoffSinks(start,'kitchen',[{...sink,name:'Renamed'}]);
  expect(quoteTotal(updated)).toBe(before);
  expect(updated.lines.find(l=>l.id==='old-line')?.includeInTotal).toBe(false);
  expect(takeoffSinkIncludedInQuote(updated,'kitchen','old')).toBe(false);
  const optedIn=setQuoteTakeoffSinkCharge(updated,'kitchen','old',true);
  expect(optedIn.lines.filter(l=>l.takeoffSinkId==='old')).toHaveLength(1);
  expect(optedIn.lines.find(l=>l.id==='old-line')?.includeInTotal).toBe(true);
  expect(quoteTotal(optedIn)).toBe(before+200);
 });
 it('retains the difference between complimentary zero and unknown sink selling price',()=>{
  const start=quote();
  start.sections[0].scope={...start.sections[0].scope,takeoffSinks:[
   {id:'free',category:'vanity',name:'Complimentary',count:1,includeInPricing:false,unitPrice:0},
   {id:'unknown',category:'kitchen',name:'Unpriced',count:1,includeInPricing:false},
  ]};
  const free=setQuoteTakeoffSinkCharge(start,'kitchen','free',true);
  const unknown=setQuoteTakeoffSinkCharge(free,'kitchen','unknown',true);
  expect(free.lines.find(l=>l.takeoffSinkId==='free')?.rate).toBe(0);
  expect(unknown.lines.find(l=>l.takeoffSinkId==='unknown')?.rate).toBeUndefined();
  expect(reviewQuoteTakeoffSinkCharge(free,'kitchen','unknown',true)?.priceMissing).toBe(true);
  expect(quoteTotal(unknown)).toBe(quoteTotal(start));
 });
 it('preserves a managed sink line ID when a salesperson toggles pricing off and on',()=>{
  const original=quote();
  const sink={id:'managed',category:'kitchen' as const,name:'3218',count:1,
    unitPrice:175,includeInPricing:true};
  original.sections[0].scope={...original.sections[0].scope,takeoffSinks:[sink]};
  original.lines.push({id:'original-managed-line',sectionId:'kitchen',takeoffSinkId:sink.id,
    kind:'sink',description:'Sink · 3218',pricingMode:'quantity-rate',quantity:1,
    rate:175,customerVisible:false,includeInTotal:true});
  const originalAmount=quoteTotal(original);
  const optedOut=setQuoteTakeoffSinkCharge(original,'kitchen',sink.id,false);
  expect(quoteTotal(optedOut)).toBe(originalAmount-175);
  expect(optedOut.lines.find(l=>l.id==='original-managed-line')).toMatchObject({
    takeoffSinkId:'managed',includeInTotal:false,customerVisible:false,rate:175,
  });
  const afterEdit=patchQuoteTakeoffSinks(optedOut,'kitchen',
    [{...optedOut.sections[0].scope!.takeoffSinks![0],name:'3218 edited'}]);
  expect(afterEdit.lines.filter(l=>l.takeoffSinkId===sink.id)).toHaveLength(1);
  expect(afterEdit.lines.find(l=>l.id==='original-managed-line')?.includeInTotal).toBe(false);
  const optedBackIn=setQuoteTakeoffSinkCharge(afterEdit,'kitchen',sink.id,true);
  expect(optedBackIn.lines.filter(l=>l.takeoffSinkId===sink.id).map(l=>l.id))
    .toEqual(['original-managed-line']);
  expect(quoteTotal(optedBackIn)).toBe(originalAmount);
  expect(original.lines.find(l=>l.id==='original-managed-line')?.includeInTotal).toBe(true);
 });

 it('keeps an old sink with no pricing flag uncharged through review, model edits and JSON reload',()=>{
  const old=quote();
  old.sections[0].scope={...old.sections[0].scope,takeoffSinks:[
   {id:'legacy-undefined',category:'vanity',name:'Legacy selection',count:1,unitPrice:225},
  ]};
  old.lines.push({id:'manual-extra',sectionId:'kitchen',kind:'sink',
    description:'Builder allowance',pricingMode:'direct',amount:150,
    customerVisible:true,includeInTotal:true});
  const initialJson=JSON.stringify(old);
  const initialTotal=quoteTotal(old);
  expect(takeoffSinkIncludedInQuote(old,'kitchen','legacy-undefined')).toBe(false);
  const proposal=reviewQuoteTakeoffSinkCharge(old,'kitchen','legacy-undefined',true);
  expect(proposal?.after).toBe(initialTotal+225);
  expect(JSON.stringify(old)).toBe(initialJson);
  // Cancel means no store mutation; viewing the proposal must be read-only.
  const reloaded=JSON.parse(JSON.stringify(old)) as Quote;
  expect(quoteTotal(reloaded)).toBe(initialTotal);
  expect(reloaded.lines).toEqual(old.lines);
  expect(reloaded.sections[0].scope?.takeoffSinks?.[0].includeInPricing).toBeUndefined();
  const edited=patchQuoteTakeoffSinks(reloaded,'kitchen',[
   {...reloaded.sections[0].scope!.takeoffSinks![0],name:'Model changed'},
  ]);
  expect(quoteTotal(edited)).toBe(initialTotal);
  expect(edited.lines).toEqual(old.lines);
  expect(edited.lines.filter(line=>line.takeoffSinkId==='legacy-undefined')).toHaveLength(0);
 });

 it('keeps a manual allowance and exact total intact after managed sink opt-out, reload and opt-in',()=>{
  const old=quote();
  old.sections[0].scope={...old.sections[0].scope,takeoffSinks:[
   {id:'managed-charge',category:'vanity',name:'Vanity',count:2,
     unitPrice:125,includeInPricing:true},
  ]};
  old.lines.push({id:'sink-existing',sectionId:'kitchen',takeoffSinkId:'managed-charge',
   kind:'sink',description:'Sink · Vanity',pricingMode:'quantity-rate',
   quantity:2,rate:125,customerVisible:false,includeInTotal:true});
  old.lines.push({id:'manual-extra',sectionId:'kitchen',kind:'sink',
   description:'Existing allowance',pricingMode:'direct',amount:150,
   customerVisible:true,includeInTotal:true});
  const before=quoteTotal(old);
  const preview=reviewQuoteTakeoffSinkCharge(old,'kitchen','managed-charge',false)!;
  expect(preview.before).toBe(before);
  expect(preview.after).toBe(before-250);
  expect(quoteTotal(old)).toBe(before);
  const removed=setQuoteTakeoffSinkCharge(old,'kitchen','managed-charge',false);
  const reloaded=JSON.parse(JSON.stringify(removed)) as Quote;
  expect(quoteTotal(reloaded)).toBe(before-250);
  expect(reloaded.lines.find(line=>line.id==='sink-existing')?.includeInTotal).toBe(false);
  expect(reloaded.lines.find(line=>line.id==='manual-extra'))
   .toEqual(old.lines.find(line=>line.id==='manual-extra'));
  const optedIn=setQuoteTakeoffSinkCharge(reloaded,'kitchen','managed-charge',true);
  expect(quoteTotal(optedIn)).toBe(before);
  expect(optedIn.lines.filter(line=>line.takeoffSinkId==='managed-charge').map(line=>line.id))
   .toEqual(['sink-existing']);
  expect(quoteTotal(old)).toBe(before);
 });
 it('requires explicit sink charge confirmation on both mobile and desktop editors',()=>{
  const files=['src/components/QuotesMobileBeta.tsx','src/components/QuoteBetaCompactSinks.tsx',
   'src/components/QuoteBetaMaterials.tsx','src/components/QuoteBetaSinkSelling.tsx'];
  for(const file of files)expect(readFileSync(join(process.cwd(),file),'utf8'))
   .toContain('quoteTakeoffSinkChargeConfirmation(');
  expect(readFileSync(join(process.cwd(),'src/components/QuotesMobileBeta.tsx'),'utf8'))
   .not.toContain('Sink charge is always included');
  expect(readFileSync(join(process.cwd(),'src/store/quoteStore.ts'),'utf8'))
   .toContain('!quoteIsCommerciallyEditable(current)');
 });
});
