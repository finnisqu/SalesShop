import {describe,expect,it} from 'vitest';
import type {Quote,QuoteLine,QuoteLineMaterialReference,QuoteTakeoffPiece,QuoteTakeoffSink} from '../types/quote';
import {quoteTotal,quoteLinesTotal,quoteLineAmount} from '../types/quote';
import {patchQuoteTakeoff,patchQuoteTakeoffMaterial,patchQuoteTakeoffSinks,ensureSmartTakeoffLine} from './quoteTakeoffsLite';
import {presentItemizedQuoteLines} from './quoteCustomerPresentation';
import {projectAreaCost,calculateAreaCustomerPrice} from './quoteAreaCost';
import {auditQuoteDraft} from './quoteDraftAudit';

const now='2026-10-15T14:00:00.000Z';
const start=():Quote=>({
 id:'estimate',quoteNumber:'DRAFT-estimate',documentType:'quote',originalQuoteDate:'2026-10-15',
 quoteDate:'2026-10-15',revision:0,status:'Draft',title:'Three-Area Pricing Regression',
 companyName:'Test Builder',contactName:'Pricing QA',contactEmail:'qa@example.test',
 sections:[
  {id:'k',title:'Kitchen',customerVisible:true,customerDisplayMode:'detail'},
  {id:'v',title:'Vanity',customerVisible:true,customerDisplayMode:'summary'},
  {id:'i',title:'Island',customerVisible:true,customerDisplayMode:'detail'},
 ],lines:[],customerColumns:{quantity:true,rate:true,lineAmount:true},
 customerNotes:'',internalNotes:'',history:[],createdAt:now,updatedAt:now,
});
const piece=(id:string,lengthIn:number,widthIn:number,backsplash=false):QuoteTakeoffPiece=>({
  id,name:id,count:1,lengthIn,widthIn,backsplash,
});
const material=(id:string,cost:number):QuoteLineMaterialReference=>({
  stockProgram:true,pricingSource:'manual-line-rate',sourceSlabCost:cost,
  snapshot:{capturedAt:now,materialId:id,materialName:'Quartz '+id,materialType:'Quartz',stockProgram:true,
    areaSf:50,slabCost:cost},
});
const sink=(id:string,name:string,price:number,cost:number,kind:'kitchen'|'vanity'):QuoteTakeoffSink=>({
 id,name,category:kind,count:1,unitPrice:price,includeInPricing:true,
 sinkReference:{snapshot:{capturedAt:now,sinkModelId:id,sinkModelName:name,
  category:kind,variantId:'standard',variantLabel:'Standard',configuration:'single',
  ada:false,internalCost:cost}},
});
const sell=(q:Quote,id:string,p:QuoteTakeoffPiece,rate:number,ref:QuoteLineMaterialReference):Quote=>{
  let next=patchQuoteTakeoff(q,id,[p],now);
  next=patchQuoteTakeoffMaterial(next,id,ref.snapshot?.materialName??'',ref);
  next=ensureSmartTakeoffLine(next,id);
  return {...next,lines:next.lines.map(line=>line.sectionId===id&&line.quantitySource?.syncMode==='live'
    ?{...line,rate}:line)};
};
const inArea=(q:Quote,id:string)=>q.lines.filter(line=>line.sectionId===id);
function threeArea():Quote {
 let q=start();
 q=sell(q,'k',piece('kitchen-run',120,25.5,true),50,material('white',700));
 q=sell(q,'v',piece('vanity',48,22,true),55,material('gray',450));
 q=sell(q,'i',piece('island',72,36),65,material('black',850));
 q=patchQuoteTakeoffSinks(q,'k',[sink('3218','Kitchen 3218',220,95,'kitchen')]);
 q=patchQuoteTakeoffSinks(q,'v',[sink('1714','Vanity 1714',95,40,'vanity')]);
 return {...q,lines:[
  ...q.lines,
  {id:'trip',kind:'rate',description:'Trip / mobilization',pricingMode:'direct',amount:150,
   internalCost:55,includeInTotal:true,customerVisible:true},
  {id:'discount',kind:'discount',description:'Builder discount',pricingMode:'direct',amount:125,
   includeInTotal:true,customerVisible:true},
  {id:'tax',kind:'tax',description:'Explicit sales tax',pricingMode:'direct',amount:70,
   includeInTotal:true,customerVisible:true},
 ]};
}
describe('18D Classic/Beta shared pricing-engine acceptance matrix',()=>{
 it('three Areas, checked splashes, two sinks, explicit add-on, discount and tax add exactly once',()=>{
  const q=threeArea();
  expect(q.sections.map(s=>s.scope?.countertopSf)).toEqual([24.58,8.67,18]);
  expect(quoteLinesTotal(inArea(q,'k'))).toBe(1449);
  expect(quoteLinesTotal(inArea(q,'v'))).toBe(571.85);
  expect(quoteLinesTotal(inArea(q,'i'))).toBe(1170);
  expect(quoteLineAmount(q.lines.find(l=>l.id==='discount')!)).toBe(-125);
  expect(quoteTotal(q)).toBe(3285.85);
  expect(quoteTotal(q)).toBe(quoteLinesTotal(q.lines));
  expect(q.lines.filter(l=>l.takeoffSinkId)).toHaveLength(2);
  expect(auditQuoteDraft(q).blockers).toEqual([]);
 });
 it('takeoff edits keep both SF sell rates and independent sink prices; no phantom duplicate sink',()=>{
  const before=threeArea();
  const k=before.sections.find(s=>s.id==='k')!;
  const stretched=patchQuoteTakeoff(before,'k',[{...k.scope!.takeoffPieces![0],lengthIn:144}],now);
  expect(stretched.lines.find(l=>l.sectionId==='k'&&l.quantitySource?.syncMode==='live')?.rate).toBe(50);
  expect(stretched.lines.filter(l=>l.takeoffSinkId==='3218')).toHaveLength(1);
  const next=patchQuoteTakeoffSinks(stretched,'k',[sink('3218','Kitchen 3218',245,95,'kitchen')]);
  expect(next.lines.filter(l=>l.takeoffSinkId==='3218')).toHaveLength(1);
  expect(quoteTotal(next)-quoteTotal(stretched)).toBe(25);
  expect(auditQuoteDraft(next).blockers).toEqual([]);
 });
 it('customer itemized presentation preserves total while never itemizing hidden sink prices',()=>{
  const q=threeArea();
  const kitchen=inArea(q,'k');
  const displayed=presentItemizedQuoteLines(kitchen);
  expect(displayed.reduce((n,row)=>n+row.amount,0)).toBe(quoteLinesTotal(kitchen));
  expect(displayed.some(row=>row.description.includes('Kitchen 3218'))).toBe(false);
  expect(displayed.some(row=>row.description.includes('Quartz white'))).toBe(true);
  expect(displayed.some(row=>row.aggregated)).toBe(true);
  expect(quoteTotal(q)).toBe(3285.85);
 });
 it('private slab/shop/install/sink costs affect margin completeness, never customer selling totals',()=>{
  const q=threeArea();
  const kitchen=q.sections.find(s=>s.id==='k')!;
  const original=projectAreaCost(q,kitchen);
  expect(original.materialCost).toBe(700);
  expect(original.sinkCost).toBe(95);
  expect(original.complete).toBe(false);
  expect(original.marginPercent).toBeUndefined();
  expect(original.priceTotal).toBe(1449);
  const costed={...kitchen,scope:{...kitchen.scope,shopCostRateSf:14.5,installCostRateSf:5,
    slabPurchaseQuantityOverride:1.5}};
  const revised=projectAreaCost(q,costed);
  expect(revised.materialCost).toBe(1050);
  expect(revised.sinkCost).toBe(95);
  expect(revised.shopCost).toBe(356.41);
  expect(revised.installCost).toBe(122.9);
  expect(revised.complete).toBe(true);
  expect(revised.priceTotal).toBe(1449);
  expect(quoteTotal(q)).toBe(3285.85);
 });
 it('manual, square-foot, and multiplier customer prices stay separate from purchase-slab cost',()=>{
  const q=threeArea(),k=q.sections[0];
  const buying=projectAreaCost(q,k).materialCost;
  const rate=calculateAreaCustomerPrice('sf',{sf:24.58,rate:50});
  const manual=calculateAreaCustomerPrice('manual',{sf:24.58,amount:2500});
  const multiplier=calculateAreaCustomerPrice('multiplier',{sf:24.58,slabs:2,costPerSlab:700,multiplier:2.25});
  expect([rate,manual,multiplier]).toEqual([1229,2500,3150]);
  const primary=q.lines.find(l=>l.sectionId==='k'&&l.quantitySource?.syncMode==='live')!;
  for(const [pricingMode,amount] of [['direct',manual],['slab-multiplier',multiplier]] as const){
    const changed={...q,lines:q.lines.map(l=>l.id===primary.id
      ?{...l,pricingMode,amount,rate:undefined}:l)};
    expect(projectAreaCost(changed,k).materialCost).toBe(buying);
    expect(quoteTotal(changed)).toBe(quoteTotal(q)-1229+amount!);
  }
 });
 it('cleared or invalid prices block issuing, while explicit zero prices require review',()=>{
  const q=threeArea();
  const primary=q.lines.find(l=>l.sectionId==='i'&&l.quantitySource?.syncMode==='live')!;
  const cleared={...q,lines:q.lines.map(l=>l.id===primary.id?{...l,rate:undefined}:l)};
  expect(auditQuoteDraft(cleared).blockers.map(x=>x.id)).toContain('line:'+primary.id+':rate');
  const zero={...q,lines:q.lines.map(l=>l.id===primary.id?{...l,rate:0}:l)};
  expect(auditQuoteDraft(zero).review.map(x=>x.id)).toContain('line:'+primary.id+':zero');
  expect(auditQuoteDraft(q).blockers).toEqual([]);
 });
});
