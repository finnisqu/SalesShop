import {useNavigationStore} from '../store/navigationStore';
import {useQuoteLibraryStore} from '../store/quoteLibraryStore';
import {useQuotesMobileBetaStore} from '../store/quotesMobileBetaStore';

/** All quick-create entry points use the same guided quote template picker.
 * Navigation creates no document until the user chooses a template. */
export function openGuidedQuoteCreation():void{
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
