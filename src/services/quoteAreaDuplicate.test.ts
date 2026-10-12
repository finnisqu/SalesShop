import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {duplicateQuoteArea} from './quoteAreaDuplicate';
import {quoteTotal} from '../types/quote';

function sample():Quote {
  return {
    id:'quote-a',status:'Draft',
    sections:[{
      id:'area-a',title:'Unit A Kitchen',customerVisible:true,customerDisplayMode:'summary',
      scope:{
        takeoffMaterial:'Ashen White',takeoffDefaultEdgeProfile:'Flat',
        takeoffPieces:[{id:'piece-a',name:'Range',lengthIn:48,widthIn:24,count:1,
          backsplash:true,splashHeightIn:4,edgeProfile:'Flat'}],
        takeoffSinks:[{id:'sink-a',name:'Kitchen 3218',category:'kitchen',count:1,
          unitPrice:220,includeInPricing:true,faucetHoleOffsetsIn:[-2,0,2]}],
      },
    }],
    lines:[
      {id:'line-a',sectionId:'area-a',kind:'material',description:'Ashen White',
        pricingMode:'quantity-rate',quantity:9.33,rate:54,
        includeInTotal:true,customerVisible:true,
        quantitySource:{kind:'area-scope',sectionId:'area-a',field:'countertopSf',
          capturedValue:9.33,appliedAt:'2026-10-12',syncMode:'live'}},
      {id:'line-b',sectionId:'area-a',kind:'sink',description:'Kitchen 3218',
        takeoffSinkId:'sink-a',pricingMode:'quantity-rate',quantity:1,rate:220,
        includeInTotal:true,customerVisible:false},
    ],
  } as Quote;
}
describe('Duplicate Area for mobile quote speed',()=>{
  it('creates independent pieces, sinks, and linked billable rows in one transformation',()=>{
    const source=sample();
    const seq=new Map<string,number>();
    const nextId=(kind:string)=>{const n=(seq.get(kind)??0)+1;seq.set(kind,n);return kind+'-copy-'+n;};
    const result=duplicateQuoteArea(source,'area-a',nextId)!;
    expect(result.newAreaId).toBe('section-copy-1');
    expect(result.quote.sections.map(s=>s.id)).toEqual(['area-a','section-copy-1']);
    expect(result.quote.sections[1].title).toBe('Unit A Kitchen copy');
    const clonedPieces=result.quote.sections[1].scope?.takeoffPieces??[];
    const clonedSinks=result.quote.sections[1].scope?.takeoffSinks??[];
    expect(clonedPieces[0]).toMatchObject({id:'piece-copy-1',name:'Range',lengthIn:48,widthIn:24});
    expect(clonedSinks[0]).toMatchObject({id:'sinktakeoff-copy-1',unitPrice:220});
    const clonedLines=result.quote.lines.filter(l=>l.sectionId===result.newAreaId);
    expect(clonedLines.map(l=>l.id)).toEqual(['line-copy-1','line-copy-2']);
    expect(clonedLines[0].quantitySource?.sectionId).toBe('section-copy-1');
    expect(clonedLines[1].takeoffSinkId).toBe('sinktakeoff-copy-1');
    expect(quoteTotal(result.quote)).toBeCloseTo(2*quoteTotal(source),2);
    clonedPieces[0].lengthIn=100;
    expect(source.sections[0].scope?.takeoffPieces?.[0].lengthIn).toBe(48);
    expect(source.lines).toHaveLength(2);
  });
  it('does not clone the special General takeoffs section or missing Areas',()=>{
    const q=sample();
    q.sections[0].title='General takeoffs';
    expect(duplicateQuoteArea(q,'area-a')).toBeUndefined();
    expect(duplicateQuoteArea(q,'not-here')).toBeUndefined();
  });
});
