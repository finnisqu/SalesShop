import {useQuoteStore} from '../store/quoteStore';
import {useNavigationStore} from '../store/navigationStore';
import {useQuotesMobileBetaStore} from '../store/quotesMobileBetaStore';

/** Same quote record in either editor; no duplication or data migration. */
export function openDetailedQuoteEditor(quoteId?:string):void{
 if(quoteId)useQuoteStore.getState().selectQuote(quoteId);
 useNavigationStore.getState().setView('quotes');
 useQuotesMobileBetaStore.getState().setEnabled(false);
}
