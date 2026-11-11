import {useNavigationStore} from '../store/navigationStore';
import {useQuoteLibraryStore} from '../store/quoteLibraryStore';
import {useQuotesMobileBetaStore} from '../store/quotesMobileBetaStore';

export type QuoteCreateContext={kind:'company'|'person'|'deal';id:string;name:string};
const ASSOCIATION_KEY='salesshop:pending-quote-create-association-v1';
export function readQuoteCreateAssociation():QuoteCreateContext|null{
 try{
  const value=JSON.parse(sessionStorage.getItem(ASSOCIATION_KEY)??'null') as QuoteCreateContext|null;
  return value&&['company','person','deal'].includes(value.kind)&&typeof value.id==='string'&&value.id
    ?value:null;
 }catch{return null;}
}
export function clearQuoteCreateAssociation(){
 try{sessionStorage.removeItem(ASSOCIATION_KEY);}catch{/* optional browser storage */}
}
/** All quick-create entry points use the same guided quote template picker.
 * Navigation creates no document until the user chooses a template. */
export function openGuidedQuoteCreation(context?:QuoteCreateContext):void{
 try{
  if(context)sessionStorage.setItem(ASSOCIATION_KEY,JSON.stringify(context));
  else sessionStorage.removeItem(ASSOCIATION_KEY);
 }catch{/* optional browser storage */}
 useQuoteLibraryStore.getState().setMode('mine');
 useQuotesMobileBetaStore.getState().setEnabled(true);
 useQuotesMobileBetaStore.getState().setLocation({
   page:'library',quoteTab:'build',areaTab:'measure',areaId:null,
 });
 try{window.sessionStorage.setItem('salesshop-open-document-picker-v1','1');}
 catch{/* template selection is still available without session storage */}
 useNavigationStore.getState().setView('quotes');
 window.dispatchEvent(new Event('salesshop:open-document-picker'));
}
