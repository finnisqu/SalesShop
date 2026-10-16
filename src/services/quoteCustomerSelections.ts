import type {Quote,QuoteSection} from '../types/quote';

/** Strict allowlist of customer-facing choices; never exports raw Area scope,
 * supplier costs, manufacturing geometry, notes, or drilling positions. */
export interface CustomerSelectionRow {
  id:string;
  area:string;
  material?:string;
  sinkModels:string[];
  edgeProfiles:string[];
  splashHeights:string[];
}
export function customerSelectionsForSections(sections:readonly QuoteSection[]):CustomerSelectionRow[] {
  return sections.filter(section=>section.customerVisible).map(section=>{
    const scope=section.scope;
    const material=scope?.takeoffMaterial?.trim();
    const snap=scope?.takeoffMaterialReference?.snapshot;
    const variant=[snap?.thickness,snap?.finish].filter(Boolean).join(' · ');
    const materialLabel=material?[material,variant].filter(Boolean).join(' · '):undefined;
    const sinks=(scope?.takeoffSinks??[]).filter(sink=>sink.count>0)
      .map(sink=>sink.count+' × '+(sink.name.trim()||(
        sink.category==='vanity'?'Vanity sink':'Kitchen sink')));
    const edges=new Set<string>();
    const splashes=new Set<string>();
    for(const piece of scope?.takeoffPieces??[]){
      if(piece.count<=0)continue;
      edges.add(piece.edgeProfile?.trim()||scope?.takeoffDefaultEdgeProfile||'Flat');
      const hasSplash=piece.backsplash||piece.leftSplash||piece.rightSplash;
      if(hasSplash)splashes.add((piece.splashHeightIn??scope?.takeoffDefaultSplashHeightIn??4)+'″');
    }
    if(!edges.size&&scope?.takeoffDefaultEdgeProfile)edges.add(scope.takeoffDefaultEdgeProfile);
    return {id:section.id,area:section.title.toLowerCase()==='general takeoffs'?'General':section.title,
      material:materialLabel,sinkModels:sinks,edgeProfiles:[...edges],splashHeights:[...splashes]};
  }).filter(row=>row.material||row.sinkModels.length||row.edgeProfiles.length||row.splashHeights.length);
}
export function customerSelectionsForQuote(quote:Quote):CustomerSelectionRow[]{
  return quote.attachSelectionsSheet?customerSelectionsForSections(quote.sections):[];
}
