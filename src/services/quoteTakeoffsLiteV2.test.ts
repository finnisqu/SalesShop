import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Quote,QuoteLine,QuoteTakeoffPiece,QuoteTakeoffSink } from '../types/quote';
import {
  totalSplashLf,patchQuoteTakeoff,patchQuoteTakeoffSinks,
  takeoffCustomerSpecs,detachQuoteTakeoff,
} from './quoteTakeoffsLite';
const now='2026-10-12T15:00:00Z';
function quote():Quote {
  const custom:QuoteLine={id:'manual',kind:'sink',sectionId:'k',description:'Manual custom sink',
    pricingMode:'direct',amount:265,customerVisible:true,includeInTotal:true};
  return {
    id:'quote',quoteNumber:'DRAFT-quote',documentType:'quote',originalQuoteDate:'2026-10-12',
    quoteDate:'2026-10-12',revision:0,status:'Draft',title:'Example',sections:[
      {id:'k',title:'Kitchen',customerVisible:true,customerDisplayMode:'detail',
       scope:{countertopSf:24,splashLf:0,kitchenSinkCount:0,vanitySinkCount:0}},
    ],lines:[custom],customerColumns:{quantity:true,rate:true,lineAmount:true},customerNotes:'',
    internalNotes:'',history:[],createdAt:now,updatedAt:now,
  };
}
const sink=(overrides:Partial<QuoteTakeoffSink>={}):QuoteTakeoffSink=>({
  id:'sink-one',name:'3218 Single',category:'kitchen',count:1,unitPrice:220,includeInPricing:false,...overrides,
});
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
describe('Takeoffs Lite 2 — splash choices, sinks, presentations and privacy',()=>{
  it('calculates backsplash length and left/right edge width with repeats',()=>{
    const pieces:QuoteTakeoffPiece[]=[
      {id:'a',name:'Island',lengthIn:96,widthIn:36,count:1,backsplash:true,leftSplash:true,rightSplash:true},
      {id:'b',name:'Run',lengthIn:120,widthIn:25.5,count:2,backsplash:true,leftSplash:true},
    ];
    expect(totalSplashLf(pieces)).toBe( (96+36+36+2*(120+25.5))/12 );
    const result=patchQuoteTakeoff(quote(),'k',pieces,now);
    expect(result.sections[0].scope?.countertopSf).toBe(66.5);
    expect(result.sections[0].scope?.splashLf).toBe(38.25);
    expect(result.lines[0].amount).toBe(265);
  });
  it('can add sinks as specifications only without charging twice',()=>{
    const original=quote();
    const result=patchQuoteTakeoffSinks(original,'k',[sink()]);
    expect(result.lines).toEqual(original.lines);
    expect(result.sections[0].scope?.kitchenSinkCount).toBe(1);
    expect(result.sections[0].scope?.vanitySinkCount).toBe(0);
    expect(takeoffCustomerSpecs(result.sections[0])).toBe('1 × 3218 Single');
  });
  it('only creates and updates managed priced rows for opted-in sinks',()=>{
    const first=patchQuoteTakeoffSinks(quote(),'k',[sink({includeInPricing:true})]);
    const created=first.lines.find(l=>l.takeoffSinkId==='sink-one');
    expect(created).toMatchObject({sectionId:'k',kind:'item',description:'Sink · 3218 Single',
      quantity:1,rate:220,pricingMode:'quantity-rate'});
    expect(first.lines.find(l=>l.id==='manual')?.amount).toBe(265);
    const edited=patchQuoteTakeoffSinks(first,'k',[sink({includeInPricing:true,count:2,unitPrice:245})]);
    expect(edited.lines.filter(l=>l.takeoffSinkId==='sink-one')).toHaveLength(1);
    expect(edited.lines.find(l=>l.takeoffSinkId==='sink-one')?.id).toBe(created?.id);
    expect(edited.lines.find(l=>l.takeoffSinkId==='sink-one')).toMatchObject({quantity:2,rate:245});
    const off=patchQuoteTakeoffSinks(edited,'k',[sink({includeInPricing:false})]);
    expect(off.lines).toEqual([quote().lines[0]]);
    expect(off.sections[0].scope?.kitchenSinkCount).toBe(1);
  });
  it('includes material/sink specs without exposing internal dimensions or sell prices',()=>{
    const filled=patchQuoteTakeoffSinks(quote(),'k',[
      sink(),sink({id:'sink-two',category:'vanity',name:'',count:2,unitPrice:88}),
    ]);
    const area={...filled.sections[0],scope:{...filled.sections[0].scope,takeoffMaterial:'White Quartz · Polished'}};
    expect(takeoffCustomerSpecs(area)).toBe('White Quartz · Polished · 1 × 3218 Single · 2 × Vanity sink');
    expect(takeoffCustomerSpecs(area)).not.toContain('220');
    expect(takeoffCustomerSpecs(area)).not.toContain('25.5');
  });
  it('preserves sink specs while detaching countertop measurements and splash links',()=>{
    const original=quote();
    const combined=patchQuoteTakeoffSinks(original,'k',[sink()]);
    const measured=patchQuoteTakeoff(combined,'k',[{id:'p',name:'',lengthIn:60,widthIn:30,count:1,backsplash:true}],now);
    const manual=detachQuoteTakeoff(measured,'k');
    expect(manual.sections[0].scope?.takeoffPieces).toBeUndefined();
    expect(manual.sections[0].scope?.takeoffSinks).toHaveLength(1);
    expect(manual.sections[0].scope?.splashLf).toBe(5);
  });
  it('has a modal with large mobile controls and sanitizes public share specifications',()=>{
    const component=read('src/components/QuoteTakeoffsLite.tsx');
    const css=read('src/quote-takeoffs-lite.css');
    const edge=read('supabase/functions/quote-share-public/index.ts');
    expect(component).toContain('createPortal(');
    expect(component).toContain('role="dialog"');
    expect(component).toContain('aria-modal="true"');
    expect(component).toContain('onFocus={e=>e.currentTarget.select()}');
    expect(component).toContain('One line · Lump sum');
    expect(component).toContain('Area header · Itemized');
    expect(component).toContain('backsplash');
    expect(component).toContain('leftSplash');
    expect(component).toContain('rightSplash');
    expect(css).toContain('height:100dvh');
    expect(css).toContain('min-height:43px');
    expect(edge).toContain('safeSectionSpecs(');
    expect(edge).not.toContain('return { ...scope');
  });
});
