import {useState} from 'react';
import type {Quote} from '../types/quote';
import {useAuthStore} from '../store/authStore';
import {useCrmStore} from '../store/crmStore';
import {recordQuoteDelivered} from '../services/quoteCrmService';
import {useQuoteStore} from '../store/quoteStore';
import {
  confirmedQuoteDeliveries,QUOTE_DELIVERY_METHOD_LABELS,
  quoteDeliveryLabel,quoteIssued,type QuoteDeliveryMethod,
} from '../services/quoteDeliveryLifecycle';

/** Seller-attested delivery. Copying a URL and opening the native share sheet
 * are intentionally NOT treated as proof that a customer received it. */
export function QuoteDeliveryConfirmation({quote,canRecord}:{quote:Quote;canRecord:boolean}){
  const [method,setMethod]=useState<QuoteDeliveryMethod>('email');
  const [error,setError]=useState('');
  const [confirming,setConfirming]=useState(false);
  const activities=useCrmStore(state=>state.activities);
  const mode=useAuthStore(state=>state.mode);
  const deliveries=confirmedQuoteDeliveries(quote,activities);
  if(!quoteIssued(quote))return null;

  const record=()=>{
    setError('');
    const latest=useQuoteStore.getState().quotes.find(item=>item.id===quote.id);
    if(!canRecord||!latest||latest.revision!==quote.revision||!quoteIssued(latest)){
      setError('This revision is no longer current. Reopen Review before confirming delivery.');
      return;
    }
    if(confirmedQuoteDeliveries(latest,useCrmStore.getState().activities).length){
      setError('Delivery has already been recorded for this revision.');
      return;
    }
    if(!window.confirm(
      'Confirm that revision '+quote.revision+' was actually delivered to the customer by '+
      QUOTE_DELIVERY_METHOD_LABELS[method].toLowerCase()+'? This records a CRM activity; it does not send anything.'
    ))return;
    setConfirming(true);
    try{
      if(!recordQuoteDelivered(latest,method)){
        setError('Customer delivery was already confirmed for this revision.');
      }
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Could not record customer delivery.');
    }finally{setConfirming(false);}
  };
  return <section className="qmb-delivery-confirmation" aria-label="Customer delivery confirmation">
    <strong>Actual customer delivery</strong>
    <p>Issued does not mean sent. Creating or copying a link never confirms delivery.</p>
    <div className="qmb-delivery-confirmation-state" role="status">
      {quoteDeliveryLabel(quote,deliveries)}
    </div>
    {deliveries.length>0?<small>
      Confirmed {new Date(deliveries[0].occurredAt).toLocaleString()} · {
      QUOTE_DELIVERY_METHOD_LABELS[deliveries[0].metadata?.deliveryMethod??'other']}
    </small>:<div className="qmb-delivery-confirmation-actions">
      <label>How did you deliver it?
        <select aria-label="Customer delivery method" value={method}
          disabled={!canRecord||confirming} onChange={e=>setMethod(e.target.value as QuoteDeliveryMethod)}>
          {Object.entries(QUOTE_DELIVERY_METHOD_LABELS).map(([value,label])=>
            <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      <button type="button" className="qmb-outline" onClick={record} disabled={!canRecord||confirming}>
        Confirm customer delivery
      </button>
      <small>{mode==='cloud'?'Recorded in the workspace CRM activity history.':'Recorded in local CRM history.'} No message is sent by SalesShop.</small>
    </div>}
    {error&&<p role="alert" className="qmb-error">{error}</p>}
  </section>;
}
