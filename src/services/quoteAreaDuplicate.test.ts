import {describe,expect,it} from 'vitest';
import type {Quote} from '../types/quote';
import {duplicateQuoteArea,duplicateQuoteAreas,copyQuoteAreaFromSource,copyQuoteAreasFromSource} from './quoteAreaDuplicate';
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
  it('duplicates selected Areas together and remaps every child and charge in one operation',()=>{
    const source=sample();
    source.sections.push({
      id:'area-b',title:'Bath',customerVisible:true,
      scope:{takeoffPieces:[{id:'piece-b',name:'Vanity',count:1,lengthIn:60,widthIn:22.5}],
       takeoffSinks:[]},
    });
    source.lines.push({id:'line-c',sectionId:'area-b',kind:'item',description:'Template charge',
     pricingMode:'direct',amount:75,customerVisible:true,includeInTotal:true});
    const used=new Map<string,number>();
    const ids=(kind:string)=>{const n=(used.get(kind)??0)+1;used.set(kind,n);return kind+'-'+n;};
    const before=quoteTotal(source);
    const result=duplicateQuoteAreas(source,['area-a','area-b'],ids)!;
    expect(result.newAreaIds).toEqual(['section-1','section-2']);
    expect(result.quote.sections.map(s=>s.title)).toEqual([
      'Unit A Kitchen','Unit A Kitchen copy','Bath','Bath copy',
    ]);
    expect(result.quote.lines.filter(l=>l.sectionId==='section-1')).toHaveLength(2);
    expect(result.quote.lines.filter(l=>l.sectionId==='section-2')).toHaveLength(1);
    expect(result.quote.sections[1].scope?.takeoffPieces?.[0].id).not.toBe('piece-a');
    expect(result.quote.sections[3].scope?.takeoffPieces?.[0].id).not.toBe('piece-b');
    expect(quoteTotal(result.quote)).toBeCloseTo(before*2,2);
    expect(source.sections).toHaveLength(2);
    expect(source.lines).toHaveLength(3);
  });
  it('rejects invalid bulk Area selections without modifying the quote',()=>{
    const original=sample();
    expect(duplicateQuoteAreas(original,['area-a','missing'])).toBeUndefined();
    expect(duplicateQuoteAreas(original,['area-a','area-a'])).toBeUndefined();
    expect(duplicateQuoteAreas(original,[])).toBeUndefined();
    expect(original.sections).toHaveLength(1);
  });
  it('copies another quote\'s measurements and selections without automatically carrying selling prices',()=>{
    const source=sample(),target={...sample(),id:'quote-b',sections:[],lines:[]};
    const ids=new Map<string,number>();
    const created=copyQuoteAreaFromSource(target,source,'area-a',false,
      kind=>{const n=(ids.get(kind)??0)+1;ids.set(kind,n);return kind+'-new-'+n;})!;
    const section=created.quote.sections[0];
    expect(created.newAreaId).toBe('section-new-1');
    expect(section.title).toBe('Unit A Kitchen');
    expect(section.scope?.takeoffPieces?.[0].id).toBe('piece-new-1');
    expect(section.scope?.takeoffSinks?.[0]).toMatchObject({
      id:'sinktakeoff-new-1',includeInPricing:false,unitPrice:undefined,
    });
    expect(created.quote.lines[0]).toMatchObject({sectionId:'section-new-1',rate:undefined});
    expect(created.quote.lines[1]).toMatchObject({
      sectionId:'section-new-1',takeoffSinkId:'sinktakeoff-new-1',includeInTotal:false,rate:undefined,
    });
    expect(quoteTotal(created.quote)).toBe(0);
    expect(quoteTotal(source)).toBeGreaterThan(0);
    expect(target.sections).toHaveLength(0);
    created.quote.sections[0].scope!.takeoffPieces![0].lengthIn=10;
    expect(source.sections[0].scope?.takeoffPieces?.[0].lengthIn).toBe(48);
  });
  it('preserves selling prices only when explicitly requested by the salesperson',()=>{
    const source=sample(),target={...sample(),id:'quote-b',sections:[],lines:[]};
    const ids=new Map<string,number>();
    const created=copyQuoteAreaFromSource(target,source,'area-a',true,
      kind=>{const n=(ids.get(kind)??0)+1;ids.set(kind,n);return kind+'-copy-'+n;})!;
    expect(quoteTotal(created.quote)).toBeCloseTo(quoteTotal(source),2);
    expect(created.quote.lines[0].quantitySource?.sectionId).toBe('section-copy-1');
    expect(created.quote.sections[0].scope?.takeoffSinks?.[0].id).toBe('sinktakeoff-copy-1');
    expect(source.lines[0].id).toBe('line-a');
  });
  it('copies an entire collection in one transformation without reusing child IDs',()=>{
    const source=sample();
    const first=source.sections[0];
    source.sections.push({...first,id:'area-b',title:'Unit B Bathroom',scope:{
      ...first.scope,takeoffPieces:[{...first.scope!.takeoffPieces![0],id:'piece-b'}],
      takeoffSinks:[],
    }});
    const target={...sample(),id:'quote-b',sections:[],lines:[]};
    const next=new Map<string,number>();
    const ids=(kind:string)=>{const n=(next.get(kind)??0)+1;next.set(kind,n);return kind+'-'+n;};
    const copied=copyQuoteAreasFromSource(target,source,['area-a','area-b'],false,ids)!;
    expect(copied.newAreaIds).toEqual(['section-1','section-2']);
    expect(copied.quote.sections.map(a=>a.title)).toEqual(['Unit A Kitchen','Unit B Bathroom']);
    expect(copied.quote.sections[0].scope?.takeoffPieces?.[0].id)
      .not.toBe(copied.quote.sections[1].scope?.takeoffPieces?.[0].id);
    expect(quoteTotal(copied.quote)).toBe(0);
    expect(source.sections).toHaveLength(2);
    expect(target.sections).toHaveLength(0);
    expect(copyQuoteAreasFromSource(target,source,['area-a','missing'])).toBeUndefined();
    expect(copyQuoteAreasFromSource(target,source,['area-a','area-a'])).toBeUndefined();
  });
  it('refuses self-copy and missing Areas without changing the destination',()=>{
    const source=sample(),target={...sample(),id:'quote-b',sections:[],lines:[]};
    expect(copyQuoteAreaFromSource(source,source,'area-a')).toBeUndefined();
    expect(copyQuoteAreaFromSource(target,source,'unknown')).toBeUndefined();
    expect(target.sections).toHaveLength(0);
  });
  it('does not clone the special General takeoffs section or missing Areas',()=>{
    const q=sample();
    q.sections[0].title='General takeoffs';
    expect(duplicateQuoteArea(q,'area-a')).toBeUndefined();
    expect(duplicateQuoteArea(q,'not-here')).toBeUndefined();
  });
});
