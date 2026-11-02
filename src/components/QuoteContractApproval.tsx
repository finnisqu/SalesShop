import {useState} from 'react';
import {createPortal} from 'react-dom';
import type {Quote} from '../types/quote';
import {quoteTotal} from '../types/quote';
import {auditQuoteDraft} from '../services/quoteDraftAudit';
import {approvedCustomerDraft,quoteDeliveryReviewKey} from '../services/quoteDeliveryApproval';
import {quoteIsCommerciallyEditable,quoteCanCreateRevision} from '../services/quoteIntegrity';
import {QuoteShareControl} from './QuoteShareControl';
import {QuoteDeliveryConfirmation} from './QuoteDeliveryConfirmation';
import {QuoteSignatureDialog} from './QuoteSignatureDialog';
import {useQuoteStore} from '../store/quoteStore';
import './quote-contract-approval.css';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});

/** Final seller-only gate immediately below the actual customer preview.
 * Approval is content-keyed in QuotesMobileBeta and becomes stale after edits. */
export function QuoteContractApproval({quote,canIssue,sending,error,
  previewedKey,approvedKey,reviewedKey,onApprove,onIssue,onPricingReview}:{
 quote:Quote;canIssue:boolean;sending:boolean;error:string;
 previewedKey:string|null;approvedKey:string|null;reviewedKey:string|null;
 onApprove:(next:boolean)=>void;onIssue:()=>void;onPricingReview:()=>void;
}){
 const [signatureOpen,setSignatureOpen]=useState(false);
 const createRevision=useQuoteStore(state=>state.createRevision);
 const editable=quoteIsCommerciallyEditable(quote);
 const report=auditQuoteDraft(quote);
 const blockers=report.blockers.length;
 const unanswered=report.review.length>0&&
  reviewedKey!==quoteDeliveryReviewKey(quote,report.findings);
 const approved=approvedCustomerDraft(quote,previewedKey,approvedKey);
 const ready=blockers===0&&!unanswered;
 const canApprove=editable&&canIssue&&ready;
 const canIssueNow=canApprove&&approved&&!sending;
 return <section className={'qca-workspace'+(editable?'':' is-issued')}
  aria-label={editable?'Contract Review and approval':'Issued quote delivery and sharing'}>
  <header><div><small>{editable?'CONTRACT REVIEW · STEP 4 OF 4':'CONTRACT REVIEW · ISSUED REVISION'}</small>
   <h3>{editable?'Approve this customer quote':'Delivery & sharing'}</h3>
   <p>{editable?'Review the actual customer document above before authorizing this exact revision.'
     :'This revision is frozen. Share the customer copy, then record delivery when it actually happens.'}</p></div>
   <strong>{money.format(quoteTotal(quote))}</strong>
  </header>
  {editable?<div className="qca-card">
   {!ready&&<div className="qca-not-ready" role="status">
    <strong>{blockers>0?blockers+' pricing issue(s) must be resolved':'Pricing questions still need acknowledgment'}</strong>
    <span>Finish Pricing Review before issuing. Your draft stays saved.</span>
    <button type="button" onClick={onPricingReview}>Return to Pricing Review ›</button>
   </div>}
   <label className="qca-approval">
    <input type="checkbox" aria-label="I approve this quote"
     checked={approved} disabled={!canApprove}
     onChange={event=>onApprove(event.target.checked)}/>
    <span><strong>I approve this quote</strong>
     <small>I have reviewed the visible scope, price, customer details and terms in the preview above.</small></span>
   </label>
   <div className="qca-actions">
    <button type="button" className="qmb-outline" onClick={onPricingReview}>‹ Pricing Review</button>
    <button type="button" className="qmb-primary" disabled={!canIssueNow} onClick={onIssue}>
     {sending?'Issuing…':approved?'Issue approved quote':'Approve quote to issue'}
    </button>
   </div>
   <small className="qca-caption">Issuing freezes this revision. It does not send an email or create a customer link. Edits invalidate approval until reviewed again.</small>
   {!canIssue&&<small className="qca-caption">Your current team role cannot issue quotes.</small>}
  </div>:<div className="qca-issued-flow">
   <section className="qca-issued-summary" aria-label="Issued revision">
    <div className="qca-issued-summary-main">
     <span className="qca-issued-check" aria-hidden="true">✓</span>
     <div><strong>Quote issued</strong>
      <p>Revision {quote.revision} is read-only. Issuing does not send the quote to the customer.</p></div>
    </div>
    <div className="qca-issued-summary-actions">
     <span className="qca-issued-pill">{quote.status==='Signed'?'Signed':
      quote.status==='Viewed'?'Viewed':'Issued'}</span>
     {!quote.archivedAt&&quoteCanCreateRevision(quote)&&
      <button type="button" className="qmb-outline" onClick={()=>createRevision(quote.id)}>
       Create editable revision ›
      </button>}
    </div>
   </section>
   <div className="qca-issued-grid">
    <section className="qca-issued-section qca-issued-sharing" aria-label="Customer link and sharing">
     <header className="qca-issued-section-head">
      <span className="qca-issued-step" aria-hidden="true">1</span>
      <div><h4>Customer link &amp; sharing</h4>
       <p>Create or manage a secure link to this exact issued revision.</p></div>
     </header>
     <QuoteShareControl inline allowCreation={canIssue}/>
    </section>
    <section className="qca-issued-section qca-issued-delivery" aria-label="Customer delivery">
     <header className="qca-issued-section-head">
      <span className="qca-issued-step" aria-hidden="true">2</span>
      <div><h4>Confirm delivery</h4>
       <p>Record delivery only after you've actually sent or handed over the quote.</p></div>
     </header>
     <QuoteDeliveryConfirmation quote={quote}
      canRecord={canIssue&&['Sent','Viewed','Signed'].includes(quote.status)&&!quote.archivedAt}/>
    </section>
   </div>
   {canIssue&&['Sent','Viewed','Signed'].includes(quote.status)&&
    <section className="qca-issued-signing" aria-label="In-person acceptance">
     <div><strong>In-person acceptance</strong>
      <span>Record the customer's signature separately from delivery.</span></div>
     <button type="button" className="qmb-outline" onClick={()=>setSignatureOpen(true)}>
      {quote.status==='Signed'?'View signed receipt':'Sign in person'} ›
     </button>
    </section>}
  </div>}
  {error&&<p role="alert" className="qmb-error">{error}</p>}
  {signatureOpen&&createPortal(<QuoteSignatureDialog quote={quote} onClose={()=>setSignatureOpen(false)}/>,document.body)}
 </section>;
}
