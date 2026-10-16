import type {Quote,QuoteLineMaterialReference} from '../types/quote';
import {patchQuoteTakeoff,patchQuoteTakeoffMaterial,upsertProjectMaterial} from './quoteTakeoffsLite';

export interface JobSelectionsPatch {
  edgeProfile:string;
  splashHeightIn:number;
  includeExistingPieces:boolean;
  material?:string;
  materialReference?:QuoteLineMaterialReference;
  assignMaterialToAreas:boolean;
}
/** Pure, atomic quote transformation. The caller persists one updated quote
 * and one history entry, preserving live SF links and all unrelated fields. */
export function applyJobSelectionsToQuote(quote:Quote,options:JobSelectionsPatch):Quote {
  if(!Number.isFinite(options.splashHeightIn)||options.splashHeightIn<0||options.splashHeightIn>120)
    throw new Error('Backsplash height must be between 0 and 120 inches.');
  if(!options.edgeProfile.trim())throw new Error('Select a valid edge profile.');
  let updated=quote;
  for(const area of quote.sections) {
    // Use the newest accumulated Area state, never a stale scope snapshot.
    const current=updated.sections.find(s=>s.id===area.id);
    if(!current)continue;
    updated={...updated,sections:updated.sections.map(section=>section.id===area.id
      ?{...section,scope:{...section.scope,takeoffDefaultEdgeProfile:options.edgeProfile,
        takeoffDefaultSplashHeightIn:options.splashHeightIn}}:section)};
    if(options.includeExistingPieces&&current.scope?.takeoffPieces?.length){
      const updatedPieces=current.scope.takeoffPieces.map(piece=>({...piece,
        edgeProfile:options.edgeProfile,splashHeightIn:options.splashHeightIn}));
      updated=patchQuoteTakeoff(updated,area.id,updatedPieces);
    }
    if(options.assignMaterialToAreas&&options.material?.trim()){
      updated=patchQuoteTakeoffMaterial(updated,area.id,options.material.trim(),options.materialReference);
    }
  }
  if(options.material?.trim())
    updated=upsertProjectMaterial(updated,options.material.trim(),options.materialReference);
  return updated;
}
