import { create } from 'zustand';

/** Quick Quote is the sole customer-facing editor. Retain the old state API
 * for older internal call sites, but never honor the retired classic preference. */
const LOCATION_KEY='salesshop:quotes-mobile-beta-location-v1';

export interface QuotesBetaLocation {
  quoteId?:string;
  page:'library'|'quote'|'area'|'review';
  quoteTab:'build'|'details'|'pricing'|'preview';
  areaTab:'measure'|'materials'|'pricing'|'calculator';
  areaId:string|null;
}

const DEFAULT_LOCATION:QuotesBetaLocation={
  page:'library',quoteTab:'build',areaTab:'measure',areaId:null,
};
function readLocation():QuotesBetaLocation{
  try{
    if(typeof window==='undefined')return {...DEFAULT_LOCATION};
    const value=JSON.parse(window.sessionStorage.getItem(LOCATION_KEY)??'null') as Partial<QuotesBetaLocation>|null;
    if(!value||!['library','quote','area','review'].includes(String(value.page)))return {...DEFAULT_LOCATION};
    if(value.page!=='library'&&!value.quoteId)return {...DEFAULT_LOCATION};
    return {
      quoteId:typeof value.quoteId==='string'?value.quoteId:undefined,
      // Runtime validator above guarantees this is a supported page.
      page:value.page as QuotesBetaLocation['page'],
      quoteTab:['build','details','pricing','preview'].includes(String(value.quoteTab))
        ?value.quoteTab as QuotesBetaLocation['quoteTab']:'build',
      areaTab:['measure','materials','pricing','calculator'].includes(String(value.areaTab))
        ?value.areaTab as QuotesBetaLocation['areaTab']:'measure',
      areaId:typeof value.areaId==='string'?value.areaId:null,
    };
  }catch{return {...DEFAULT_LOCATION};}
}
function saveLocation(location:QuotesBetaLocation){
  try{if(typeof window!=='undefined')window.sessionStorage.setItem(LOCATION_KEY,JSON.stringify(location));}
  catch{ /* session storage is an optional navigation convenience */ }
}

interface QuotesMobileBetaState {
  enabled: boolean;
  location:QuotesBetaLocation;
  setLocation:(location:QuotesBetaLocation)=>void;
  setEnabled: (enabled: boolean) => void;
}

export const useQuotesMobileBetaStore = create<QuotesMobileBetaState>((set) => ({
  enabled: true,
  location:readLocation(),
  setLocation:location=>{saveLocation(location);set({location});},
  // Obsolete editor-toggle calls cannot reactivate the legacy builder.
  setEnabled: () => set({enabled:true}),
}));
