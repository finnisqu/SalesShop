import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Quote,QuoteTakeoffPiece,QuoteLine } from '../types/quote';
import {
  patchQuoteTakeoff,ensureSmartTakeoffLine,splitTakeoffPieces,
  upsertProjectMaterial,totalBillableTakeoffSf,
} from './quoteTakeoffsLite';
const now='2026-10-12T15:00:00Z';
const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const p=(id:string,lengthIn:number,widthIn:number):QuoteTakeoffPiece=>
  ({id,name:id,lengthIn,widthIn,count:1,backsplash:true});
const initial=():Quote=>({
  id:'q',quoteNumber:'DRAFT-q',documentType:'quote',originalQuoteDate:'2026-10-12',
  quoteDate:'2026-10-12',revision:0,status:'Draft',title:'Test',
  sections:[{id:'a',title:'Kitchen',customerVisible:true,customerDisplayMode:'summary'}],
  lines:[],customerColumns:{quantity:true,rate:true,lineAmount:true},
  customerNotes:'',internalNotes:'',history:[],createdAt:now,updatedAt:now,
});
describe('Takeoffs v3 smart workflow',()=>{
  it('automatically supplies one live SF material row after valid measured piece; repeated calls do not add duplicates',()=>{
    const measured=patchQuoteTakeoff(initial(),'a',[p('one',96,24)],now);
    const ready=ensureSmartTakeoffLine(measured,'a');
    const next=ensureSmartTakeoffLine(ready,'a');
    expect(ready.lines).toHaveLength(1);
    expect(next.lines).toHaveLength(1);
    expect(next.lines[0]).toMatchObject({
      quantity:18.67,rate:undefined,pricingMode:'quantity-rate',customerVisible:true,
      quantitySource:{kind:'area-scope',field:'countertopSf',syncMode:'live'},
    });
    expect(ready.sections[0].customerDisplayMode).toBe('summary');
  });
  it('does not silently add an extra material charge to a manually priced Area',()=>{
    const base=patchQuoteTakeoff(initial(),'a',[p('one',60,25)],now);
    const manual:QuoteLine={
      id:'old',sectionId:'a',kind:'material',description:'Previous countertop price',
      pricingMode:'quantity-rate',quantity:13,rate:50,customerVisible:true,includeInTotal:true,
    };
    const withManual={...base,lines:[manual]};
    expect(ensureSmartTakeoffLine(withManual,'a')).toEqual(withManual); // no accidental duplicate
    const explicit=ensureSmartTakeoffLine(withManual,'a',true);
    expect(explicit.lines).toHaveLength(2);
  });
  it('moves selected pieces into a new Area with matching combined SF and preserves existing sell rate',()=>{
    const parts=[p('a1',96,24),p('a2',60,30),p('a3',48,25.5)];
    const first=ensureSmartTakeoffLine(patchQuoteTakeoff(initial(),'a',parts,now),'a');
    const priced={...first,lines:first.lines.map(l=>({...l,rate:42}))};
    const split=splitTakeoffPieces(priced,'a',['a2'],'Bath');
    expect(split.sections).toHaveLength(2);
    const kitchen=split.sections[0],bath=split.sections[1];
    expect(kitchen.scope?.takeoffPieces?.map(x=>x.id)).toEqual(['a1','a3']);
    expect(bath.scope?.takeoffPieces?.map(x=>x.id)).toEqual(['a2']);
    expect(bath.customerDisplayMode).toBe('summary');
    const twoLines=split.lines.filter(l=>l.quantitySource?.field==='countertopSf');
    expect(twoLines).toHaveLength(2);
    expect(twoLines.map(l=>l.rate)).toEqual([42,42]);
    expect(split.lines.find(l=>l.sectionId==='a')?.quantity).toBe(totalBillableTakeoffSf([parts[0],parts[2]]));
    expect(split.lines.find(l=>l.sectionId===bath.id)?.quantity).toBe(totalBillableTakeoffSf([parts[1]]));
  });
  it('pins selected materials per quote and ignores repeat material IDs + variants',()=>{
    const ref={materialId:'m1',variantId:'v1',stockProgram:true,
      pricingSource:'manual-line-rate' as const};
    const first=upsertProjectMaterial(initial(),'Demo Marble',ref);
    expect(first.projectMaterials).toHaveLength(1);
    const duplicate=upsertProjectMaterial(first,'Different label',ref);
    expect(duplicate).toBe(first);
    const variant={...ref,variantId:'v2'};
    expect(upsertProjectMaterial(first,'Demo Marble 2',variant).projectMaterials).toHaveLength(2);
    expect(upsertProjectMaterial(first,'  ').projectMaterials).toHaveLength(1);
  });
  it('persists project materials in tenant-scoped quote rows and keeps smart rows in existing schema',()=>{
    const sync=read('src/services/normalizedQuoteSync.ts');
    const migration=read('supabase/migrations/202610120004_quote_project_materials.sql');
    const editor=read('src/components/QuoteTakeoffsLite.tsx');
    const quoteCss=read('src/quote-takeoffs-lite.css');
    expect(sync).toContain('project_materials: quote.projectMaterials ?? []');
    expect(sync).toContain('projectMaterials: Array.isArray(row.project_materials)');
    expect(migration).toContain('alter table public.quotes add column');
    expect(editor).toContain('<TakeoffRatePicker');
    expect(editor).toContain('Move {selectedIds.length} to new Area');
    expect(editor).toContain('const allSelected=pieces.length>0');
    expect(editor).toContain('setRate(quote.id,section.id');
    expect(quoteCss).toContain('.qtl-piece');
    expect(quoteCss).toContain('.qtl-table-header');
  });
});
