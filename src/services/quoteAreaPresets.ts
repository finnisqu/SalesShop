import type {QuoteSection,QuoteTakeoffPiece} from '../types/quote';

/** Starter geometry only, never a source of quote prices or buyer costs. */
export type QuoteAreaPresetId='kitchen'|'vanity'|'island'|'laundry'|'unit';
export interface QuoteAreaPreset {
  id:QuoteAreaPresetId; label:string; description:string; pieces:readonly string[];
}
export const QUOTE_AREA_PRESETS:readonly QuoteAreaPreset[]=[
  {id:'kitchen',label:'Kitchen',description:'Two editable runs; add sink and splash details when known.',
    pieces:['Main run','Additional run']},
  {id:'vanity',label:'Bathroom vanity',description:'One vanity top; choose bowls and their prices separately.',
    pieces:['Vanity top']},
  {id:'island',label:'Island',description:'One island piece without an assumed edge, cutout or slab.',
    pieces:['Island top']},
  {id:'laundry',label:'Laundry',description:'One laundry counter; measurements and fixtures are optional.',
    pieces:['Laundry top']},
  {id:'unit',label:'Unit type',description:'Start a repeated unit with kitchen and vanity placeholders.',
    pieces:['Kitchen top','Vanity top']},
];

/** No dimensions, prices, catalog/sink references, or live quantity links are created. */
export function sectionFromQuoteAreaPreset(presetId:QuoteAreaPresetId,
 sectionId:string,createPieceId:()=>string):QuoteSection|undefined {
  const preset=QUOTE_AREA_PRESETS.find(item=>item.id===presetId);
  if(!preset)return undefined;
  const pieces:QuoteTakeoffPiece[]=preset.pieces.map(name=>({
    id:createPieceId(),name,count:1,backsplash:false,leftSplash:false,rightSplash:false,
    splashHeightIn:4,edgeProfile:'Flat',
  }));
  return {id:sectionId,title:preset.label,customerVisible:true,customerDisplayMode:'detail',
    scope:{takeoffPieces:pieces,takeoffDefaultSplashHeightIn:4,takeoffDefaultEdgeProfile:'Flat'}};
}
