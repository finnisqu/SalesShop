import {savedAreaLayoutScope} from './quoteSavedAreaLayouts';

/** Browser-local personal presentation, never quote content or company pricing. */
export type QuoteBuilderDensity='compact'|'comfortable';
export type QuoteGeneralQuickAdd='item'|'material'|'sink'|'rate'|'note';
export const QUOTE_GENERAL_QUICK_ADDS:readonly QuoteGeneralQuickAdd[]=['item','material','sink','rate','note'];
export const QUOTE_GENERAL_QUICK_ADD_LABELS:Record<QuoteGeneralQuickAdd,string>={
  item:'Custom',material:'Material',sink:'Sink',rate:'Rate',note:'Note',
};
export interface QuoteBuilderPreferences{
 density:QuoteBuilderDensity;
 favoriteQuickAdds:QuoteGeneralQuickAdd[];
}
const KEY='salesshop-quote-builder-preferences-v1:';
export const defaultQuoteBuilderPreferences=():QuoteBuilderPreferences=>({
 density:'compact',favoriteQuickAdds:['item','material','sink'],
});
export function parseQuoteBuilderPreferences(raw:unknown):QuoteBuilderPreferences{
 const defaults=defaultQuoteBuilderPreferences();
 if(!raw||typeof raw!=='object')return defaults;
 const item=raw as Record<string,unknown>;
 const density=item.density==='comfortable'?'comfortable':'compact';
 const favorites=Array.isArray(item.favoriteQuickAdds)
   ?item.favoriteQuickAdds.filter((v):v is QuoteGeneralQuickAdd=>
       typeof v==='string'&&QUOTE_GENERAL_QUICK_ADDS.some(k=>k===v))
   :defaults.favoriteQuickAdds;
 return {density,favoriteQuickAdds:[...new Set(favorites)]};
}
export const quoteBuilderPreferenceScope=savedAreaLayoutScope;
export function readQuoteBuilderPreferences(scope:string|null):QuoteBuilderPreferences{
 if(!scope)return defaultQuoteBuilderPreferences();
 try{return parseQuoteBuilderPreferences(JSON.parse(localStorage.getItem(KEY+scope)??'null'));}
 catch{return defaultQuoteBuilderPreferences();}
}
export function writeQuoteBuilderPreferences(scope:string|null,prefs:QuoteBuilderPreferences):boolean{
 if(!scope)return false;
 try{localStorage.setItem(KEY+scope,JSON.stringify(parseQuoteBuilderPreferences(prefs)));return true;}
 catch{return false;}
}
