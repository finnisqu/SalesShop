import {describe,expect,it} from 'vitest';
import type {Quote,QuoteLine,QuoteSection} from '../types/quote';
import {quoteLinesTotal} from '../types/quote';
import {buildAcceptedQuoteSnapshot} from '../types/signature';
import {createQuoteRevisionSnapshot} from './quoteIntegrity';
import {customerReceiptLines,customerReceiptSections} from './quoteCustomerReceipt';

const when='2026-11-14T10:00:00.000Z';
const line=(id:string,overrides:Partial<QuoteLine>={}):QuoteLine=>({
 id,sectionId:'kitchen',kind:'item',description:'Customer-visible work',
 pricingMode:'direct',amount:100,customerVisible:true,includeInTotal:true,
 ...overrides,
});
const sections:QuoteSection[]=[
 {id:'kitchen',title:'Kitchen',customerVisible:true,customerDisplayMode:'detail',
  scope:{takeoffMaterial:'Private supplier',takeoffPieces:[]} as QuoteSection['scope']},
 {id:'private',title:'Private job scope',customerVisible:false,
  scope:{takeoffMaterial:'Secret imported SKU'} as QuoteSection['scope']},
];
const quote=(rows:QuoteLine[]=[],history:Quote['history']=[]):Quote=>({
 id:'quote-347',quoteNumber:'Q-347',documentType:'quote',
 originalQuoteDate:'2026-11-14',quoteDate:'2026-11-14',revision:0,
 status:'Sent',title:'Accepted project',companyId:'company-a',
 customerNotes:'Approved payment terms',internalNotes:'Private margin and supplier',
 sections:structuredClone(sections),lines:rows,history,
 customerColumns:{quantity:true,rate:true,lineAmount:true},
 createdAt:when,updatedAt:when,
});

describe('Batch 347 — signed customer receipt privacy and price integrity',()=>{
 it('strips private cost, supplier, takeoff and Catalog provenance from the acceptance payload',()=>{
  const priced=line('stone',{kind:'material',pricingMode:'quantity-rate',
   quantity:20,rate:100,amount:undefined,internalCost:900,
   costCategory:'product',supplierName:'Distributor private',unitCost:45,
   internalOnlyCost:true,productCode:'PRIVATE-SKU',unitLabel:'sheet',
   takeoffSinkId:'sink-private',quantitySource:{
    kind:'area-scope',sectionId:'kitchen',field:'piece-sf',
    capturedValue:20,appliedAt:when,
   } as QuoteLine['quantitySource'],
   materialReference:{materialId:'mat',variantId:'special',purchaseOptionId:'tier',
    stockProgram:true,pricingSource:'manual-line-rate',sourceCostPerSf:45,
    snapshot:{capturedAt:when,materialId:'mat',materialName:'Supplier item',
     materialType:'Quartz',stockProgram:true,costPerSf:45}},
  });
  const q=quote([priced]);
  q.history=[createQuoteRevisionSnapshot(q,when,'Sent')];
  const accepted=buildAcceptedQuoteSnapshot(q);
  expect(accepted.acceptedTotal).toBe(2000);
  expect(accepted.lines).toEqual([{
   id:'stone',sectionId:'kitchen',kind:'material',
   description:'Customer-visible work',pricingMode:'quantity-rate',
   quantity:20,rate:100,amount:undefined,
   customerVisible:true,includeInTotal:true,
  }]);
  expect(accepted.sections).toEqual([{
   id:'kitchen',title:'Kitchen',customerVisible:true,customerDisplayMode:'detail',
  }]);
  const contents=JSON.stringify(accepted);
  for(const secret of ['internalCost','unitCost','materialReference','supplierName',
   'Private supplier','Secret imported SKU','Private margin and supplier',
   'PRIVATE-SKU','costCategory','takeoffSinkId','quantitySource'])
   expect(contents).not.toContain(secret);
  // Internal frozen evidence remains intact and independently immutable.
  expect(q.history[0].lines[0].materialReference?.snapshot?.costPerSf).toBe(45);
  expect(q.lines[0].internalCost).toBe(900);
 });
 it('rolls hidden billable work into the visible material and reconciles receipt total',()=>{
  const rows=[
   line('top',{kind:'material',pricingMode:'quantity-rate',quantity:2,rate:500,
    amount:undefined}),
   line('hidden-sink',{kind:'sink',customerVisible:false,amount:225,
    description:'Private supplier 3218',internalCost:78}),
   line('excluded',{kind:'rate',includeInTotal:false,amount:600,
    description:'Excluded cost option'}),
   line('internal-labor',{kind:'rate',customerVisible:false,amount:150,
    description:'Private shop labor'}),
  ];
  const accepted=buildAcceptedQuoteSnapshot(quote(rows));
  expect(accepted.acceptedTotal).toBe(1375);
  expect(accepted.lines).toMatchObject([{
   id:'top',pricingMode:'direct',amount:1375,includeInTotal:true,
  }]);
  expect(accepted.lines[0].rate).toBeUndefined();
  expect(quoteLinesTotal(accepted.lines)).toBe(accepted.acceptedTotal);
  expect(JSON.stringify(accepted)).not.toMatch(/Private supplier|Private shop labor|Excluded cost option/);
 });
 it('creates a generic included-work row when every charge is hidden',()=>{
  const rows=[
   line('secret',{description:'Supplier negotiated labor',customerVisible:false,
    amount:800,internalCost:200}),
   line('private-2',{description:'Private supplier metal',customerVisible:false,
    amount:150}),
  ];
  const accepted=buildAcceptedQuoteSnapshot(quote(rows));
  expect(accepted.lines).toEqual([{
   id:'accepted-included-work',kind:'item',description:'Included work',
   pricingMode:'direct',amount:950,customerVisible:true,includeInTotal:true,
  }]);
  expect(quoteLinesTotal(accepted.lines)).toBe(950);
 });
 it('does not include excluded billable lines, but retains harmless note rows',()=>{
  const rows=[
   line('included',{amount:200}),
   line('excluded',{amount:10000,includeInTotal:false}),
   line('note',{description:'Installation date to be confirmed',
    pricingMode:'none',amount:undefined,includeInTotal:false}),
  ];
  const accepted=customerReceiptLines(rows,sections);
  expect(accepted.map(item=>item.id)).toEqual(['included','note']);
  expect(quoteLinesTotal(accepted)).toBe(200);
  expect(accepted[1]).toMatchObject({pricingMode:'none',includeInTotal:false});
 });
 it('hides an entire private Area while preserving the agreed total',()=>{
  const rows=[line('top',{amount:400}),
   line('secret-area',{sectionId:'private',customerVisible:true,
    amount:200,description:'Internal-only Area purchase',supplierName:'Private'})];
  const accepted=customerReceiptLines(rows,sections);
  expect(accepted).toMatchObject([{id:'top',amount:600}]);
  expect(quoteLinesTotal(accepted)).toBe(600);
  expect(customerReceiptSections(sections).map(s=>s.id)).toEqual(['kitchen']);
 });
 it('keeps a negative hidden discount in the signed customer total',()=>{
  const rows=[
   line('top',{amount:1000,kind:'material'}),
   line('discount',{amount:100,kind:'discount',customerVisible:false}),
  ];
  const accepted=buildAcceptedQuoteSnapshot(quote(rows));
  expect(accepted.acceptedTotal).toBe(900);
  expect(quoteLinesTotal(accepted.lines)).toBe(900);
  expect(accepted.lines[0]).toMatchObject({id:'top',amount:900});
 });
 it('freezes the issued revision instead of borrowing later draft prices or notes',()=>{
  const original=quote([line('approved',{amount:1000,internalCost:600})]);
  const frozen=createQuoteRevisionSnapshot(original,when,'Sent');
  const updated:Quote={...original,revision:1,status:'Draft',
   customerNotes:'New unapproved terms',internalNotes:'Later supplier terms',
   lines:[line('approved',{amount:9999,internalCost:15})],history:[frozen]};
  const accepted=buildAcceptedQuoteSnapshot({...updated,revision:0,status:'Sent'});
  expect(accepted.acceptedTotal).toBe(1000);
  expect(accepted.customerNotes).toBe('Approved payment terms');
  expect(quoteLinesTotal(accepted.lines)).toBe(1000);
  expect(JSON.stringify(accepted)).not.toContain('Later supplier terms');
  expect(JSON.stringify(accepted)).not.toContain('internalCost');
  expect(updated.history[0].lines[0].internalCost).toBe(600);
 });
});
