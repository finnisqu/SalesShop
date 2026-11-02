import {describe,expect,it} from 'vitest';
import {QUOTE_AREA_PRESETS,sectionFromQuoteAreaPreset} from './quoteAreaPresets';

describe('safe Quick Quote Area starters',()=>{
 it('offers the common layouts without assuming a sale or dimensions',()=>{
  expect(QUOTE_AREA_PRESETS.map(x=>x.id)).toEqual(['kitchen','vanity','island','laundry','unit']);
  for(const preset of QUOTE_AREA_PRESETS){
   let i=0;
   const area=sectionFromQuoteAreaPreset(preset.id,'area',()=>String(++i))!;
   expect(area.title).toBe(preset.label);
   expect(area.scope?.takeoffPieces).toHaveLength(preset.pieces.length);
   expect(area.scope?.takeoffPieces?.every(piece=>
     piece.lengthIn===undefined&&piece.widthIn===undefined&&piece.count===1)).toBe(true);
   expect(area.scope?.takeoffSinks).toBeUndefined();
   expect(area.scope?.takeoffMaterialReference).toBeUndefined();
   expect(area.scope?.slabCostOverride).toBeUndefined();
   expect(area.scope?.countertopSf).toBeUndefined();
   expect(area.customerVisible).toBe(true);
  }
 });
 it('generates distinct child identities and never invents a price',()=>{
  let n=0;
  const first=sectionFromQuoteAreaPreset('kitchen','a',()=>String(++n))!;
  const second=sectionFromQuoteAreaPreset('kitchen','b',()=>String(++n))!;
  expect(first.scope?.takeoffPieces?.[0].id).not.toBe(second.scope?.takeoffPieces?.[0].id);
  expect(first.id).not.toBe(second.id);
 });
});
