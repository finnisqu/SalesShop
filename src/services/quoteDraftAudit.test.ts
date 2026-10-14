import {describe,expect,it} from 'vitest';
import type {Quote,QuoteLine,QuoteSection} from '../types/quote';
import {auditQuoteDraft} from './quoteDraftAudit';

const quote=(patch?:Partial<Quote>):Quote=>({
  id:'q-test',title:'Kitchen proposal',quoteNumber:'DRAFT',
  status:'Draft',quoteDate:'2026-10-12',contactEmail:'buyer@example.com',
  companyName:'Example Builder',customerNotes:'',internalNotes:'',
  sections:[{id:'kitchen',title:'Kitchen',customerVisible:true,customerDisplayMode:'detail',
    scope:{takeoffPieces:[],takeoffSinks:[],takeoffMaterial:'Ashen White'}}],
  lines:[{id:'top',sectionId:'kitchen',kind:'material',description:'Ashen White countertops',
    pricingMode:'quantity-rate',quantity:20,rate:54,customerVisible:true,includeInTotal:true}],
  ...patch,
} as Quote);

const sink=(id:string,unitPrice:number|undefined)=>({
  id,category:'kitchen' as const,name:'Kitchen 3218',count:1,
  includeInPricing:true,unitPrice,faucetHoleOffsetsIn:[0],
});

const line=(id:string,patch?:Partial<QuoteLine>):QuoteLine=>({
  id,kind:'item',description:'Extra charge',includeInTotal:true,customerVisible:true,
  pricingMode:'direct',amount:100,...patch,
});

describe('Quotes Beta Review audit',()=>{
  it('keeps a complete quote clear of issues and does not mutate it',()=>{
    const input=quote();
    const before=JSON.stringify(input);
    const audit=auditQuoteDraft(input);
    expect(audit.findings).toEqual([]);
    expect(audit.total).toBe(1080);
    expect(JSON.stringify(input)).toBe(before);
  });
  it('blocks missing selling rates and selected sinks without prices, but not draft entry',()=>{
    const input=quote({
      lines:[line('top',{sectionId:'kitchen',pricingMode:'quantity-rate',quantity:20,rate:undefined})],
      sections:[{...quote().sections[0],scope:{takeoffSinks:[sink('s1',undefined)],takeoffPieces:[]}}],
    });
    const result=auditQuoteDraft(input);
    expect(result.blockers.map(issue=>issue.id)).toEqual(expect.arrayContaining([
      'line:top:rate','sink:s1:price',
    ]));
    expect(result.findings.find(issue=>issue.id==='sink:s1:price')?.destination)
      .toEqual({view:'area',areaId:'kitchen',tab:'materials'});
    expect(result.findings.find(issue=>issue.id==='line:top:rate')?.destination)
      .toEqual({view:'area',areaId:'kitchen',tab:'pricing'});
  });
  it('allows explicitly free sinks and flags them for acknowledgment instead of blocking',()=>{
    const input=quote({sections:[{...quote().sections[0],
      scope:{takeoffPieces:[],takeoffSinks:[sink('s1',0)]}}]});
    const result=auditQuoteDraft(input);
    expect(result.blockers).toHaveLength(0);
    expect(result.review.map(issue=>issue.id)).toContain('sink:s1:complimentary');
  });
  it('flags an intentionally zero-quantity piece and missing dimensions without inventing SF',()=>{
    const input=quote({sections:[{...quote().sections[0],
      scope:{takeoffMaterial:'Ashen White',takeoffPieces:[
        {id:'p1',name:'Future island',count:0,lengthIn:73,widthIn:36},
        {id:'p2',name:'Pending vanity',count:1,widthIn:22},
      ],takeoffSinks:[]}}]});
    const result=auditQuoteDraft(input);
    expect(result.blockers).toHaveLength(0);
    expect(result.review.map(issue=>issue.id)).toEqual(expect.arrayContaining([
      'piece:p1:zero','piece:p2:dimensions',
    ]));
    expect(result.review.find(issue=>issue.id==='piece:p2:dimensions')?.destination)
      .toEqual({view:'area',areaId:'kitchen',tab:'measure'});
  });
  it('warns when a hidden or fully de-itemized Area is still charged to the customer',()=>{
    const section:QuoteSection={...quote().sections[0],customerVisible:false,customerDisplayMode:'detail'};
    const result=auditQuoteDraft(quote({sections:[section],lines:[
      line('hidden',{sectionId:'kitchen',amount:220,customerVisible:false}),
    ]}));
    expect(result.review.map(issue=>issue.id)).toContain('area:kitchen:visibility');
    expect(result.review.map(issue=>issue.id)).toContain('area:kitchen:breakout');
  });
  it('prevents issuing with no priced work, but leaves email and title optional',()=>{
    const result=auditQuoteDraft(quote({title:'Untitled quote',contactEmail:'',
      lines:[],sections:[]}));
    expect(result.blockers.map(issue=>issue.id)).toContain('quote:work');
    expect(result.optional.map(issue=>issue.id)).toEqual(
      expect.arrayContaining(['quote:email','quote:title']));
  });
  it('reports a takeoff sink price once rather than duplicating the linked line warning',()=>{
    const selected=sink('s1',undefined);
    const section={...quote().sections[0],scope:{takeoffPieces:[],takeoffSinks:[selected]}};
    const linked=line('sink-line',{sectionId:'kitchen',kind:'sink',
      description:'Sink · Kitchen 3218',takeoffSinkId:'s1',pricingMode:'quantity-rate',
      quantity:1,rate:undefined});
    const missing=auditQuoteDraft(quote({sections:[section],lines:[...quote().lines,linked]}));
    expect(missing.blockers.map(issue=>issue.id)).toContain('sink:s1:price');
    expect(missing.blockers.map(issue=>issue.id)).not.toContain('line:sink-line:rate');
    const complimentary=auditQuoteDraft(quote({
      sections:[{...section,scope:{...section.scope,takeoffSinks:[sink('s1',0)]}}],
      lines:[...quote().lines,{...linked,rate:0}],
    }));
    expect(complimentary.review.map(issue=>issue.id)).toContain('sink:s1:complimentary');
    expect(complimentary.review.map(issue=>issue.id)).not.toContain('line:sink-line:zero');
  });
  it('does not block issuing because a legacy sink is specification-only',()=>{
    const reference={...sink('spec-only',undefined),includeInPricing:false};
    const input=quote({sections:[{...quote().sections[0],
      scope:{takeoffPieces:[],takeoffSinks:[reference]}}]});
    const report=auditQuoteDraft(input);
    expect(report.blockers).toHaveLength(0);
    expect(report.findings.some(issue=>issue.id.startsWith('sink:spec-only:'))).toBe(false);
  });
  it('ignores excluded, non-priced note rows instead of issuing false missing-rate blockers',()=>{
    const result=auditQuoteDraft(quote({lines:[
      ...quote().lines,
      line('excluded',{pricingMode:'quantity-rate',quantity:1,rate:undefined,includeInTotal:false}),
      line('note',{pricingMode:'none',amount:undefined,includeInTotal:false}),
    ]}));
    expect(result.blockers).toHaveLength(0);
  });
});
