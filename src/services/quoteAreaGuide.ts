import type {Quote,QuoteSection} from '../types/quote';
import {isGeneralTakeoffSection} from './quoteCustomerPresentation';

/** Guidance only: flat-fee Areas do not require pieces, materials or sinks. */
export function quoteAreaGuide(quote:Quote,section:QuoteSection){
 const pieces=section.scope?.takeoffPieces?.length??0;
 const sinks=section.scope?.takeoffSinks?.length??0;
 const material=section.scope?.takeoffMaterial?.trim()||'';
 const lines=quote.lines.filter(l=>l.sectionId===section.id).length;
 const fresh=!isGeneralTakeoffSection(section)&&!pieces&&!sinks&&!material&&!lines;
 const next=fresh?'Add a piece, choose material, or start with a selling price.'
   :pieces&&!material?'Material selection is optional while you measure.'
   :lines?'Keep editing or return to all pricing.'
   :'Continue with material, sinks, or a manual selling price.';
 return {pieces,sinks,material,lines,fresh,next};
}
