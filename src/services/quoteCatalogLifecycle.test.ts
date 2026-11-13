import {describe,expect,it} from 'vitest';
import type {Quote,QuoteLine} from '../types/quote';
import {quoteTotal} from '../types/quote';
import type {StockMaterial} from '../types/settings';
import type {SinkModel} from '../types/sink';
import type {RateBookItem} from '../types/rateBook';
import type {OtherCatalogItem} from '../store/otherCatalogStore';
import {buildCatalogQuoteLinePatch} from './catalogQuoteInsertion';
import {createQuoteRateSnapshot} from './quoteRateSnapshot';
import {catalogSellingOverride,rateCatalogSelectionPatch} from './quoteCatalogLineEditing';
import {createQuoteRevisionSnapshot} from './quoteIntegrity';
import {frozenRevisionTotal,historicalCustomerQuote} from './quoteRevisionView';
import {summarizeQuoteInternalPricing} from './quoteInternalPricing';
import {quotePricingOverview} from './quotePricingOverview';

const material:StockMaterial={
 id:'stone-1',name:'White Quartz',brand:'Sample supplier',materialType:'Quartz',
 stockProgram:true,active:true,unit:'sf',variants:[{
 id:'3cm',active:true,default:true,thickness:'3cm',finish:'Polished',purchaseOptions:[{
 id:'std',label:'Stock',active:true,default:true,pricingBasis:'sf',costPerSf:12,
 }],
 }],
};
const sink:SinkModel={
 id:'model',name:'3218',category:'kitchen',material:'Stainless steel',
 active:true,createdAt:'2026-10-01',updatedAt:'2026-10-01',
 variants:[{id:'undermount',label:'Single',configuration:'single',ada:false,
  active:true,default:true,internalCost:105,sellPrice:220,history:[]}],
};
const rate:RateBookItem={
 id:'install',name:'Install',category:'fabrication-install',unit:'sf',
 pricingBehavior:'suggested',internalCost:4,sellRate:13.5,divisionOverrides:[],
 active:true,history:[],createdAt:'2026-10-01',updatedAt:'2026-10-01',
};
const other:OtherCatalogItem={
 id:'accessory',name:'Drain assembly',category:'Plumbing',
 brand:'Shop supplier',supplier:'Private distributor',unit:'each',
 active:true,updatedAt:'2026-10-01',
 variants:[{id:'matte',label:'Matte black',active:true,default:true,
  internalCost:42,sellPrice:95,material:'Brass'}],
};
const line=(id:string,kind:QuoteLine['kind'],patch:Partial<QuoteLine>):QuoteLine=>({
 id,kind,description:patch.description??id,pricingMode:'quantity-rate',
 customerVisible:true,includeInTotal:true,...patch,
});
function quote(lines:QuoteLine[]):Quote{
 return {
  id:'quote-1',quoteNumber:'Q-20261112-001',documentType:'quote',
  originalQuoteDate:'2026-11-12',quoteDate:'2026-11-12',
  revision:0,status:'Sent',title:'Builder kitchen',companyName:'Sample Builder',
  sections:[],lines,customerColumns:{quantity:true,rate:true,lineAmount:true},
  customerNotes:'Original terms',internalNotes:'Private',
  history:[],createdAt:'2026-11-12T10:00:00Z',updatedAt:'2026-11-12T10:00:00Z',
 };
}
const selected=()=>{
 const mat=line('mat','material',{...buildCatalogQuoteLinePatch({kind:'material',material},{quantity:20}),
  rate:40});
 const selectedRate=line('rate','rate',{...buildCatalogQuoteLinePatch({kind:'rate',item:rate},{quantity:20})});
 const selectedSink=line('sink','sink',{...buildCatalogQuoteLinePatch({kind:'sink',model:sink},{quantity:2})});
 const selectedOther=line('other','item',{...buildCatalogQuoteLinePatch({kind:'other',item:other},{quantity:2})});
 return [mat,selectedRate,selectedSink,selectedOther];
};

describe('Catalog items across Quick Quote edit, review, reload and historical revisions',()=>{
 it('keeps four Catalog sources in General totals and separates private costs from selling',()=>{
  const q=quote(selected());
  expect(quoteTotal(q)).toBe(20*40+20*13.5+2*220+2*95);
  expect(quotePricingOverview(q).generalAmount).toBe(1700);
  const pricing=summarizeQuoteInternalPricing(q.lines);
  expect(pricing).toMatchObject({
   customerTotal:1700,knownInternalCost:20*12+20*4+2*105+2*42,
   costedLineCount:4,costRequiredLineCount:4,complete:true,
  });
  expect(q.lines.find(v=>v.id==='mat')?.materialReference?.snapshot?.costPerSf).toBe(12);
  expect(q.lines.find(v=>v.id==='other')?.otherReference?.snapshot?.internalCost).toBe(42);
 });
 it('preserves quantity for same-unit Rate Book replacement but resets on unit change',()=>{
  const original=selected()[1];
  const replacement=createQuoteRateSnapshot({...rate,id:'new-install',sellRate:16});
  const patch=rateCatalogSelectionPatch(original,replacement);
  expect(patch.quantity).toBe(20);
  expect(patch.rate).toBe(16);
  expect(patch.rateReference?.snapshot?.rateBookItemId).toBe('new-install');
  expect(patch.rateReference?.snapshot?.internalCost).toBe(4);
  const unitChanged=rateCatalogSelectionPatch(original,createQuoteRateSnapshot({
   ...rate,id:'trip',unit:'each',sellRate:85,
  }));
  expect(unitChanged.quantity).toBe(1);
  const flat=rateCatalogSelectionPatch(original,createQuoteRateSnapshot({
   ...rate,id:'mobilization',unit:'flat',sellRate:150,
  }));
  expect(flat.quantity).toBeUndefined();
  expect(flat.amount).toBe(150);
  expect(flat.pricingMode).toBe('direct');
 });
 it('keeps quoted source metadata after a manual selling edit, including other products',()=>{
  const lines=selected();
  for(const id of ['rate','sink','other']){
   const current=lines.find(v=>v.id===id)!;
   const oldSource=JSON.stringify(current.rateReference??current.sinkReference??current.otherReference);
   const changed={...current,rate:(current.rate??0)+25};
   expect(catalogSellingOverride(changed)).toBe(true);
   expect(JSON.stringify(changed.rateReference??changed.sinkReference??changed.otherReference))
    .toBe(oldSource);
   expect(catalogSellingOverride(current)).toBe(false);
  }
  expect(catalogSellingOverride(lines[0])).toBe(false);
 });
 it('reconstructs original Catalog prices and snapshots after a new quote revision',()=>{
  const original=quote(selected());
  const frozen=createQuoteRevisionSnapshot(original,'2026-11-12T11:00:00Z','Sent');
  const revised:Quote={...original,revision:1,status:'Draft',
   lines:original.lines.map(row=>row.id==='other'?{...row,rate:140}:row.id==='sink'
    ?{...row,rate:250}:row),
   history:[frozen],customerNotes:'Revised terms',
  };
  other.variants[0].sellPrice=200;
  sink.variants[0].sellPrice=300;
  const restored=historicalCustomerQuote(revised,frozen);
  expect(frozenRevisionTotal(frozen)).toBe(1700);
  expect(quoteTotal(restored)).toBe(1700);
  expect(quoteTotal(revised)).toBe(1700+2*45+2*30);
  expect(restored.lines.find(v=>v.id==='other')?.otherReference?.snapshot?.sellPrice).toBe(95);
  expect(restored.lines.find(v=>v.id==='sink')?.sinkReference?.snapshot?.sellPrice).toBe(220);
  expect(restored.customerNotes).toBe('Original terms');
  expect(restored.internalNotes).toBe('');
  expect(revised.lines.find(v=>v.id==='other')?.rate).toBe(140);
  other.variants[0].sellPrice=95;
  sink.variants[0].sellPrice=220;
 });
 it('recovers the private buying cost from a frozen OTHER snapshot when unitCost metadata is absent',()=>{
  const product=selected()[3];
  const oldCloudLine={...product,unitCost:undefined};
  expect(summarizeQuoteInternalPricing([oldCloudLine])).toMatchObject({
   customerTotal:190,knownInternalCost:84,complete:true,
  });
 });
});
