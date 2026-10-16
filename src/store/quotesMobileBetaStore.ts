import { create } from 'zustand';

/**
 * Presentation-only opt-in. The beta and classic editors share quoteStore,
 * tenant/cloud permissions, catalog stores and quote data.
 * No quote is duplicated or migrated by switching this preference.
 */
const KEY = 'salesshop:quotes-mobile-beta-v1';
const LOCATION_KEY='salesshop:quotes-mobile-beta-location-v1';

function readOptIn(): boolean {
  try { return typeof window !== 'undefined' && window.localStorage.getItem(KEY) === '1'; }
  catch { return false; }
}

export interface QuotesBetaLocation {
  quoteId?:string;
  page:'library'|'quote'|'area'|'review';
  quoteTab:'build'|'details'|'preview';
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
      quoteTab:['build','details','preview'].includes(String(value.quoteTab))
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
  enabled: readOptIn(),
  location:readLocation(),
  setLocation:location=>{saveLocation(location);set({location});},
  setEnabled: (enabled) => {
    try { window.localStorage.setItem(KEY, enabled ? '1' : '0'); } catch { /* private mode */ }
    const location=enabled?readLocation():{...DEFAULT_LOCATION};
    if(!enabled)try{window.sessionStorage.removeItem(LOCATION_KEY);}catch{ /* private mode */ }
    set({enabled,location});
  },
}));
