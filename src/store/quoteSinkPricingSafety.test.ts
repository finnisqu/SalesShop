import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Quote,QuoteDocument} from '../types/quote';
import {quoteTotal} from '../types/quote';
import {localQuoteRepository} from '../data/quoteRepository';
import {useQuoteStore} from './quoteStore';

const date='2026-11-10T15:00:00.000Z';
const originalQuote=():Quote=>({
  id:'legacy-sink-quote',quoteNumber:'DRAFT-LEGACY',title:'Legacy pricing QC',
  status:'Draft',documentType:'quote',revision:0,quoteDate:'2026-11-10',
  originalQuoteDate:'2026-11-10',createdAt:date,updatedAt:date,
  customerNotes:'',internalNotes:'',history:[],
  customerColumns:{quantity:true,rate:true,lineAmount:true},
  sections:[{id:'bath',title:'Bathroom',customerVisible:true,scope:{
    takeoffSinks:[{id:'legacy-vanity',name:'Legacy undermount',category:'vanity',
      count:1,unitPrice:225}],countertopSf:8}}],
  lines:[
    {id:'top',sectionId:'bath',kind:'material',description:'Quartz top',
      pricingMode:'quantity-rate',quantity:8,rate:60,
      customerVisible:true,includeInTotal:true},
    {id:'manual-sink',sectionId:'bath',kind:'sink',description:'Builder sink allowance',
      pricingMode:'direct',amount:150,
      customerVisible:true,includeInTotal:true},
  ],
});

describe('Legacy sink quote: store hydration, opt-in, undo and frozen prices',()=>{
  let saved:QuoteDocument;
  const current=()=>useQuoteStore.getState().quotes[0];

  beforeEach(()=>{
    saved={schemaVersion:2,quotes:[originalQuote()],activeQuoteId:'legacy-sink-quote'};
    vi.spyOn(localQuoteRepository,'load').mockImplementation(()=>structuredClone(saved));
    vi.spyOn(localQuoteRepository,'save').mockImplementation(document=>{
      saved=structuredClone(document);
    });
    useQuoteStore.setState({quotes:[],activeQuoteId:null,hydrated:false,
      undoStacks:{},redoStacks:{}});
  });
  afterEach(()=>{vi.restoreAllMocks();});

  it.skip('opens and reselects a legacy quote without silently adding a sink charge or changing its total',()=>{
    const original=structuredClone(saved.quotes[0]);
    const before=quoteTotal(original);
    useQuoteStore.getState().hydrate();
    expect(quoteTotal(current())).toBe(before);
    expect(current().lines).toEqual(original.lines);
    expect(current().sections).toEqual(original.sections);
    useQuoteStore.getState().selectQuote(original.id);
    expect(current().lines).toEqual(original.lines);
    expect(quoteTotal(saved.quotes[0])).toBe(before);
    expect(saved.quotes[0].sections[0].scope?.takeoffSinks?.[0].includeInPricing).toBeUndefined();
  });

  it.skip('keeps legacy sinks specification-only while editing the model and persisting a round trip',()=>{
    useQuoteStore.getState().hydrate();
    const before=quoteTotal(current());
    const source=current().sections[0].scope!.takeoffSinks![0];
    useQuoteStore.getState().updateTakeoffSinks(current().id,'bath',[{...source,name:'Edited model'}]);
    expect(quoteTotal(current())).toBe(before);
    expect(current().lines.some(line=>line.takeoffSinkId==='legacy-vanity')).toBe(false);
    expect(saved.quotes[0].lines.find(line=>line.id==='manual-sink')?.amount).toBe(150);
    useQuoteStore.setState({quotes:[],activeQuoteId:null,hydrated:false,undoStacks:{},redoStacks:{}});
    useQuoteStore.getState().hydrate();
    expect(quoteTotal(current())).toBe(before);
    expect(current().sections[0].scope?.takeoffSinks?.[0].name).toBe('Edited model');
  });

  it.skip('applies a charge only through explicit store action, with undo and redo preserving the manual allowance',()=>{
    useQuoteStore.getState().hydrate();
    const before=quoteTotal(current());
    expect(before).toBe(630);
    // The confirmation preview is read-only; cancel means never calling this action.
    expect(useQuoteStore.getState().undoStacks['legacy-sink-quote']).toBeUndefined();
    expect(quoteTotal(saved.quotes[0])).toBe(before);
    useQuoteStore.getState().setTakeoffSinkCharge(current().id,'bath','legacy-vanity',true);
    expect(quoteTotal(current())).toBe(855);
    expect(quoteTotal(saved.quotes[0])).toBe(855);
    expect(current().lines.find(line=>line.id==='manual-sink')?.amount).toBe(150);
    expect(useQuoteStore.getState().undoStacks['legacy-sink-quote']).toHaveLength(1);
    useQuoteStore.getState().undoQuote('legacy-sink-quote');
    expect(quoteTotal(current())).toBe(before);
    expect(quoteTotal(saved.quotes[0])).toBe(before);
    expect(current().lines.some(line=>line.takeoffSinkId==='legacy-vanity')).toBe(false);
    useQuoteStore.getState().redoQuote('legacy-sink-quote');
    expect(quoteTotal(current())).toBe(855);
    expect(quoteTotal(saved.quotes[0])).toBe(855);
    useQuoteStore.getState().setTakeoffSinkCharge(current().id,'bath','legacy-vanity',false);
    expect(quoteTotal(current())).toBe(before);
    expect(current().lines.find(line=>line.takeoffSinkId==='legacy-vanity')?.includeInTotal).toBe(false);
    useQuoteStore.setState({quotes:[],activeQuoteId:null,hydrated:false,undoStacks:{},redoStacks:{}});
    useQuoteStore.getState().hydrate();
    expect(quoteTotal(current())).toBe(before);
    expect(current().lines.find(line=>line.takeoffSinkId==='legacy-vanity')?.includeInTotal).toBe(false);
  });

  it.skip('refuses to change already issued or archived customer quotes',()=>{
    for(const state of [{status:'Sent' as const},{status:'Draft' as const,archivedAt:date}]){
      saved={schemaVersion:2,quotes:[{...originalQuote(),...state}],activeQuoteId:'legacy-sink-quote'};
      useQuoteStore.setState({quotes:[],activeQuoteId:null,hydrated:false,undoStacks:{},redoStacks:{}});
      useQuoteStore.getState().hydrate();
      const original=structuredClone(current());
      useQuoteStore.getState().setTakeoffSinkCharge(original.id,'bath','legacy-vanity',true);
      expect(current()).toEqual(original);
      expect(saved.quotes[0]).toEqual(original);
    }
  });
});
