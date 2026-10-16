import { describe, expect, it } from 'vitest';
import { quoteTotal, type Quote } from '../types/quote';
import { deleteQuoteAreaToGeneral, deleteQuoteAreaWithContents, moveQuoteLineToArea, reorderQuoteLine, setQuoteAreaOrder, setQuoteGeneralLineOrder } from './quoteStructure';

function sample(): Quote {
  return {
    id: 'q', status: 'Draft',
    sections: [
      {id: 'k', title: 'Kitchen', customerVisible: true},
      {id: 'b', title: 'Bath', customerVisible: true},
    ],
    lines: [
      {id:'a',sectionId:'k',kind:'material',description:'Quartz',pricingMode:'quantity-rate',quantity:20,rate:50,customerVisible:true,includeInTotal:true,
        quantitySource:{kind:'area-scope',sectionId:'k',field:'countertopSf',capturedValue:20,appliedAt:'2026-10-13'}},
      {id:'g',kind:'item',description:'Delivery',pricingMode:'direct',amount:150,customerVisible:true,includeInTotal:true},
      {id:'s',sectionId:'k',kind:'sink',description:'3218',pricingMode:'direct',amount:220,customerVisible:true,includeInTotal:true,takeoffSinkId:'sink1'},
      {id:'l',sectionId:'k',kind:'material',description:'Live SF',pricingMode:'quantity-rate',quantity:20,rate:40,customerVisible:true,includeInTotal:true,
        quantitySource:{kind:'area-scope',sectionId:'k',field:'countertopSf',capturedValue:20,appliedAt:'2026-10-13',syncMode:'live'}},
      {id:'b1',sectionId:'b',kind:'note',description:'Warranty',pricingMode:'none',customerVisible:true,includeInTotal:false},
    ],
  } as Quote;
}
describe('Quotes Beta structure parity',()=>{
  it('reorders only peers within an Area, preserving the total and quote snapshots',()=>{
    const subject=sample();
    const updated=reorderQuoteLine(subject,'l',-1);
    expect(updated.lines.filter(l=>l.sectionId==='k').map(l=>l.id)).toEqual(['a','l','s']);
    expect(quoteTotal(updated)).toBe(quoteTotal(subject));
    expect(updated.lines.find(l=>l.id==='l')?.quantitySource).toEqual(subject.lines.find(l=>l.id==='l')?.quantitySource);
    expect(reorderQuoteLine(subject,'a',-1)).toBe(subject);
    expect(reorderQuoteLine(subject,'missing',1)).toBe(subject);
  });
  it('moves a regular line between Areas or General while freezing its captured SF',()=>{
    const subject=sample();
    const moved=moveQuoteLineToArea(subject,'a','b');
    expect(moved.lines.find(l=>l.id==='a')).toMatchObject({sectionId:'b',quantity:20,rate:50});
    expect(moved.lines.find(l=>l.id==='a')?.quantitySource).toBeUndefined();
    expect(moved.lines.filter(l=>l.sectionId==='b').map(l=>l.id)).toEqual(['b1','a']);
    expect(quoteTotal(moved)).toBe(quoteTotal(subject));
    const general=moveQuoteLineToArea(moved,'a');
    expect(general.lines.find(l=>l.id==='a')?.sectionId).toBeUndefined();
    expect(general.lines.filter(l=>!l.sectionId).map(l=>l.id)).toEqual(['g','a']);
    expect(moveQuoteLineToArea(subject,'a','not-an-area')).toBe(subject);
  });
  it('rejects moving live takeoff pricing or managed sinks independently',()=>{
    const subject=sample();
    expect(moveQuoteLineToArea(subject,'s','b')).toBe(subject);
    expect(moveQuoteLineToArea(subject,'l','b')).toBe(subject);
    expect(moveQuoteLineToArea(subject,'l')).toBe(subject);
  });
  it('deleting an Area preserves charges in General, unlinks orphan takeoffs, and keeps totals',()=>{
    const subject=sample();
    const removed=deleteQuoteAreaToGeneral(subject,'k');
    expect(removed.sections.map(s=>s.id)).toEqual(['b']);
    expect(removed.lines.filter(l=>l.id==='s')[0]).toMatchObject({sectionId:undefined,takeoffSinkId:undefined,amount:220});
    expect(removed.lines.find(l=>l.id==='l')?.quantitySource).toBeUndefined();
    expect(quoteTotal(removed)).toBe(quoteTotal(subject));
    expect(deleteQuoteAreaToGeneral(subject,'not-an-area')).toBe(subject);
  });
});

describe('explicit Area deletion and atomic order',()=>{
  it('deletes Area and all billable rows only when chosen',()=>{
    const q=sample();
    const removed=deleteQuoteAreaWithContents(q,'k');
    expect(removed.sections.map(x=>x.id)).toEqual(['b']);
    expect(removed.lines.map(x=>x.id)).toEqual(['g','b1']);
    expect(quoteTotal(removed)).toBe(150);
    expect(quoteTotal(q)).toBe(2170);
    expect(deleteQuoteAreaWithContents(q,'missing')).toBe(q);
  });
  it('reorders in one operation and rejects duplicate, unknown or partial ids',()=>{
    const q=sample();
    const ordered=setQuoteAreaOrder(q,['b','k']);
    expect(ordered.sections.map(x=>x.id)).toEqual(['b','k']);
    expect(quoteTotal(ordered)).toBe(quoteTotal(q));
    expect(setQuoteAreaOrder(q,['k','k'])).toBe(q);
    expect(setQuoteAreaOrder(q,['k'])).toBe(q);
    expect(setQuoteAreaOrder(q,['k','bogus'])).toBe(q);
    expect(setQuoteAreaOrder(q,['k','b'])).toBe(q);
  });
});


describe('General charge management',()=>{
  it('reorders only General slots while preserving every Area line and amount',()=>{
    const q=sample();
    const extra={
      id:'g2',kind:'item',description:'Delivery upgrade',
      pricingMode:'direct',amount:42,customerVisible:true,includeInTotal:true,
    } as Quote['lines'][number];
    const orphan={...extra,id:'orphan',sectionId:'historical-deleted-area'};
    const source={...q,lines:[...q.lines,extra,orphan]};
    const result=setQuoteGeneralLineOrder(source,['orphan','g2','g']);
    expect(result.lines.map(l=>l.id)).toEqual(['a','orphan','s','l','b1','g2','g']);
    expect(result.lines.find(l=>l.id==='orphan')?.sectionId).toBe('historical-deleted-area');
    expect(result.lines.find(l=>l.id==='l')).toEqual(q.lines.find(l=>l.id==='l'));
    expect(quoteTotal(result)).toBe(quoteTotal(source));
    expect(setQuoteGeneralLineOrder(source,['g','g2'])).toBe(source);
    expect(setQuoteGeneralLineOrder(source,['g','g','orphan'])).toBe(source);
    expect(setQuoteGeneralLineOrder(source,['g','g2','unknown'])).toBe(source);
    expect(setQuoteGeneralLineOrder(source,['g','g2','orphan'])).toBe(source);
  });
});
