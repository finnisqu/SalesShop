import { describe,expect,it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { patchQuoteTakeoffSinks,syncManagedSinkLineEdit,unpriceDeletedTakeoffSink } from './quoteTakeoffsLite';
import type { Quote,QuoteTakeoffSink } from '../types/quote';

const at='2026-10-12T13:00:00Z';
function quote():Quote{
 return {id:'q',quoteNumber:'DRAFT-q',documentType:'quote',originalQuoteDate:'2026-10-12',
   quoteDate:'2026-10-12',revision:0,status:'Draft',title:'Kitchen',
   sections:[{id:'kitchen',title:'Kitchen',customerVisible:true,
     customerDisplayMode:'detail',scope:{takeoffSinks:[]}}],
   lines:[{id:'manual',sectionId:'kitchen',kind:'item',description:'Manual labor',
     pricingMode:'direct',amount:100,customerVisible:true,includeInTotal:true}],
   customerColumns:{quantity:true,rate:true,lineAmount:true},customerNotes:'',
   internalNotes:'',history:[],createdAt:at,updatedAt:at};
}
const sink=(extra:Partial<QuoteTakeoffSink>={}):QuoteTakeoffSink=>({
 id:'s1',category:'kitchen',name:'3218 Single',count:1,unitPrice:220,includeInPricing:true,...extra,
});
describe('Takeoffs Lite small polish batch',()=>{
 it('preserves an individual customer breakout decision when editing a sink quantity',()=>{
   const first=patchQuoteTakeoffSinks(quote(),'kitchen',[sink()]);
   const line=first.lines.find(l=>l.takeoffSinkId==='s1')!;
   const hidden={...first,lines:first.lines.map(l=>l.id===line.id
     ?{...l,customerVisible:false}:l)};
   const changed=patchQuoteTakeoffSinks(hidden,'kitchen',[sink({count:3,unitPrice:235})]);
   expect(changed.lines.find(l=>l.takeoffSinkId==='s1')).toMatchObject({
      quantity:3,rate:235,customerVisible:false,includeInTotal:true});
   expect(changed.lines.find(l=>l.id==='manual')).toEqual(first.lines[0]);
 });
 it('keeps a non-billable takeoff sink non-billable on subsequent edits',()=>{
   const first=patchQuoteTakeoffSinks(quote(),'kitchen',[sink()]);
   const hidden={...first,lines:first.lines.map(l=>l.takeoffSinkId==='s1'
      ?{...l,includeInTotal:false}:l)};
   const saved=patchQuoteTakeoffSinks(hidden,'kitchen',[sink({count:2})]);
   expect(saved.lines.find(l=>l.takeoffSinkId==='s1')?.includeInTotal).toBe(false);
 });
 it('syncs regular Quote price, quantity, name and snapshot edits into the managed sink selection',()=>{
   const before=patchQuoteTakeoffSinks(quote(),'kitchen',[sink()]);
   const row=before.lines.find(l=>l.takeoffSinkId==='s1')!;
   const synced=syncManagedSinkLineEdit(before,row.id,{
      rate:275,quantity:2,description:'Sink · 3218 Undermount',
   });
   expect(synced.sections[0].scope?.takeoffSinks?.[0]).toMatchObject({
      unitPrice:275,count:2,name:'3218 Undermount'});
   const after=patchQuoteTakeoffSinks(synced,'kitchen',synced.sections[0].scope?.takeoffSinks??[]);
   expect(after.lines.find(l=>l.takeoffSinkId==='s1')).toMatchObject({
      rate:275,quantity:2,description:'Sink · 3218 Undermount'});
   expect(after.lines.find(l=>l.id==='manual')?.amount).toBe(100);
 });
 it('does not resurrect a sink charge after deleting its linked Quote line',()=>{
   const priced=patchQuoteTakeoffSinks(quote(),'kitchen',[sink()]);
   const linked=priced.lines.find(l=>l.takeoffSinkId==='s1')!;
   const unpriced=unpriceDeletedTakeoffSink(priced,linked.id);
   expect(unpriced.sections[0].scope?.takeoffSinks?.[0]).toMatchObject({
      id:'s1',includeInPricing:false,unitPrice:220
   });
   const withoutRow={...unpriced,lines:unpriced.lines.filter(l=>l.id!==linked.id)};
   const afterEdit=patchQuoteTakeoffSinks(withoutRow,'kitchen',withoutRow.sections[0].scope?.takeoffSinks??[]);
   expect(afterEdit.lines).toHaveLength(1);
   expect(afterEdit.lines[0].id).toBe('manual');
   expect(unpriceDeletedTakeoffSink(priced,'manual')).toEqual(priced);
 });
 it('does not change unrelated manual lines or invalid sink counts in storage',()=>{
   const first=patchQuoteTakeoffSinks(quote(),'kitchen',[sink()]);
   const line=first.lines.find(l=>l.takeoffSinkId==='s1')!;
   expect(syncManagedSinkLineEdit(first,'manual',{rate:10})).toEqual(first);
   const updated=syncManagedSinkLineEdit(first,line.id,{quantity:0});
   expect(updated.sections[0].scope?.takeoffSinks?.[0]?.count).toBe(1);
 });
 it('provides fast batch selection, Enter navigation, and safe Escape behavior for Catalog menus',()=>{
   const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
   const modal=read('src/components/QuoteTakeoffsLite.tsx');
   const catalogs=read('src/components/TakeoffCatalogPickers.tsx');
   const style=read('src/quote-takeoffs-lite.css');
   expect(modal).toContain('Select all (');
   expect(modal).toContain('Clear selection');
   expect(modal).toContain('fields[index+1].focus()');
   expect(catalogs).toContain('event.stopPropagation()');
   expect(catalogs).toContain('event.key===\'ArrowDown\'');
   expect(catalogs).toContain('useId()');
   expect(style).toContain('.qtl-selection-toggle');
 });
});
