import {useQuoteStore} from '../store/quoteStore';
import {useNavigationStore} from '../store/navigationStore';
import {useQuotesMobileBetaStore} from '../store/quotesMobileBetaStore';

/** Legacy caller compatibility: preserve the selected document, but always
 * open the current Quick Quote workspace. The old editor is not reachable. */
export function openDetailedQuoteEditor(quoteId?:string):void{
 if(quoteId)useQuoteStore.getState().selectQuote(quoteId);
 useNavigationStore.getState().setView('quotes');
 useQuotesMobileBetaStore.getState().setEnabled(true);
}
