import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {applyJobSelectionsToQuote} from './quoteJobSelections';
import {auditQuoteDraft,assertQuoteHasNoPricingBlockers} from './quoteDraftAudit';
import {customerSelectionsForQuote} from './quoteCustomerSelections';
const quote=():Quote=>({
  id:'q1',documentType:'quote',quoteNumber:'DRAFT-q1',quoteDate:'2026-10-12',
  originalQuoteDate:'2026-10-12',revision:0,status:'Draft',title:'Kitchen',
  sections:[{id:'a',title:'Kitchen',customerVisible:true,customerDisplayMode:'summary',
    scope:{takeoffMaterial:'Ashen White',takeoffDefaultSplashHeightIn:4,
      takeoffPieces:[{id:'p1',name:'Island',count:1,lengthIn:48,widthIn:24,backsplash:true,
        edgeProfile:'Flat',splashHeightIn:4}],
      takeoffSinks:[{id:'s1',name:'Kitchen 3218',category:'kitchen',count:1,
        includeInPricing:true,unitPrice:220,faucetHoleOffsetsIn:[-2,0,2]}]}}],
  lines:[{id:'l1',sectionId:'a',kind:'material',description:'Kitchen countertops',
    pricingMode:'quantity-rate',quantity:9.33,rate:54,includeInTotal:true,
    customerVisible:true,quantitySource:{kind:'area-scope',sectionId:'a',
      field:'countertopSf',capturedValue:9.33,appliedAt:'2026-10-12',syncMode:'live'}}],
  customerColumns:{quantity:false,rate:false,lineAmount:true},
  customerNotes:'',internalNotes:'',history:[],
  createdAt:'2026-10-12T12:00:00Z',updatedAt:'2026-10-12T12:00:00Z',
});
describe('Atomic bulk selections and safe appendix',()=>{
  it('changes all piece defaults in one pure transformation and resyncs live SF',()=>{
    const original=quote();
    const next=applyJobSelectionsToQuote(original,{
      edgeProfile:'Eased',splashHeightIn:6,includeExistingPieces:true,
      assignMaterialToAreas:false,
    });
    expect(next.sections[0].scope?.takeoffPieces?.[0]).toMatchObject({
      edgeProfile:'Eased',splashHeightIn:6});
    expect(next.lines[0].quantity).toBe(10);
    expect(original.lines[0].quantity).toBe(9.33);
    expect(next.lines).toHaveLength(1);
  });
  it('sets future defaults without changing individual piece overrides',()=>{
    const next=applyJobSelectionsToQuote(quote(),{
      edgeProfile:'Eased',splashHeightIn:6,includeExistingPieces:false,
      assignMaterialToAreas:false,
    });
    expect(next.sections[0].scope?.takeoffDefaultEdgeProfile).toBe('Eased');
    expect(next.sections[0].scope?.takeoffPieces?.[0].edgeProfile).toBe('Flat');
    expect(next.lines[0].quantity).toBe(9.33);
  });
  it('allows customer-visible appendix without costs, faucet holes, or raw measurements',()=>{
    const q=quote();
    q.attachSelectionsSheet=true;
    const rows=customerSelectionsForQuote(q);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({material:'Ashen White',sinkModels:['1 × Kitchen 3218'],edgeProfiles:['Flat']});
    expect(JSON.stringify(rows)).not.toMatch(/unitPrice|sourceCost|faucet|lengthIn|widthIn|220/);
    q.attachSelectionsSheet=false;
    expect(customerSelectionsForQuote(q)).toEqual([]);
  });
  it('never issues an unpriced or zero-quantity included material',()=>{
    const q=quote();
    q.lines[0]={...q.lines[0],quantity:0};
    expect(auditQuoteDraft(q).blockers.some(x=>x.id==='line:l1:quantity')).toBe(true);
    expect(()=>assertQuoteHasNoPricingBlockers(q)).toThrow(/Cannot issue quote/);
    q.lines[0]={...q.lines[0],quantity:9.33,rate:undefined};
    expect(()=>assertQuoteHasNoPricingBlockers(q)).toThrow(/Missing sell rate/);
  });
  it('treats deliberately free direct work as a warning, not a missing-price blocker',()=>{
    const q=quote();
    q.lines.push({id:'free',kind:'item',description:'Complimentary service',
      pricingMode:'direct',amount:0,customerVisible:true,includeInTotal:true});
    const report=auditQuoteDraft(q);
    expect(report.review.some(x=>x.id==='line:free:zero')).toBe(true);
    expect(report.blockers).toHaveLength(0);
  });
});
