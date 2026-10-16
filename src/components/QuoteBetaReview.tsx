import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Quote} from '../types/quote';
import {quoteTotal,displayQuoteNumber} from '../types/quote';
import {approvedCustomerDraft,quoteDeliveryApprovalKey,quoteDeliveryReviewKey} from '../services/quoteDeliveryApproval';
import {QuoteShareControl} from './QuoteShareControl';
import {QuoteDeliveryConfirmation} from './QuoteDeliveryConfirmation';
import {QuoteSignatureDialog} from './QuoteSignatureDialog';
import {auditQuoteDraft,type QuoteAuditDestination,type QuoteAuditFinding} from '../services/quoteDraftAudit';
import {quoteCanCreateRevision,quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {quoteBetaStatusLabel} from '../services/quoteBetaLifecycleLanguage';
import {pricingScheduleValidationError} from '../services/pricingSchedule';
import {useQuoteStore} from '../store/quoteStore';
import { QuoteAuditInlineEditor, quickFixForFinding } from './QuoteAuditInlineEditor';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});

export function QuoteBetaReview({quote,onBack,onFix,onPreview,onClassic,initialFindingId,
  canIssue,sending,error,onIssue,previewedKey,approvedKey,onApprove,reviewedKey,onReview}:{
  quote:Quote;
  onBack:()=>void;onFix:(destination:QuoteAuditDestination)=>void;
  initialFindingId?:string|null;
  onPreview:()=>void;onClassic:()=>void;
  canIssue:boolean;sending:boolean;error:string;onIssue:()=>void;
  previewedKey:string|null;approvedKey:string|null;onApprove:(approved:boolean)=>void;
  reviewedKey:string|null;onReview:(key:string|null)=>void;
}){
  const report=auditQuoteDraft(quote);
  const createRevision=useQuoteStore(state=>state.createRevision);
  const [signatureOpen,setSignatureOpen]=useState(false);
  const deliverySectionRef=useRef<HTMLElement>(null);
  const previousStatusRef=useRef(quote.status);
  useEffect(()=>{
    const earlier=previousStatusRef.current;
    previousStatusRef.current=quote.status;
    if((earlier==='Draft'||earlier==='Ready')&&quote.status==='Sent'){
      // Issuing completes an internal step. Bring the real next action —
      // creating and sharing a link — into view without claiming delivery.
      deliverySectionRef.current?.scrollIntoView({block:'start',behavior:'instant'});
    }
  },[quote.status]);
  const [lastCheckedAt,setLastCheckedAt]=useState(quote.updatedAt);
  const needsRecheck=lastCheckedAt!==quote.updatedAt;
  const [expandedId,setExpandedId]=useState<string|null>(initialFindingId??null);
  const issueSet=report.findings.map(f=>f.id+':'+f.severity).join('|');
  const reviewKey=quoteDeliveryReviewKey(quote,report.findings);
  const acknowledged=reviewedKey===reviewKey;
  useEffect(()=>{setExpandedId(initialFindingId??null);},[initialFindingId]);
  useEffect(()=>{
    if(expandedId&&!report.findings.some(f=>f.id===expandedId))setExpandedId(null);
  },[expandedId,issueSet,report.findings]);
  const editable=quoteIsCommerciallyEditable(quote);
  const scheduleError=quote.documentType==='pricing-schedule'
    ?pricingScheduleValidationError(quote.pricingSchedule):null;
  const ready=!needsRecheck&&report.blockers.length===0&&(!report.review.length||acknowledged);
  const deliveryKey=quoteDeliveryApprovalKey(quote);
  const previewed=previewedKey===deliveryKey;
  const approved=approvedCustomerDraft(quote,previewedKey,approvedKey);
  const canApprove=editable&&previewed&&ready&&canIssue;
  const renderFindings=(items:QuoteAuditFinding[],heading:string,description:string,kind:string)=>(
    <section className="qmb-audit-group" aria-label={heading}>
      <div className="qmb-audit-group-heading">
        <strong>{heading}</strong><span>{items.length}</span>
      </div>
      <small className="qmb-audit-help">{description}</small>
      {items.map(finding=>{
        const fix=quickFixForFinding(finding,quote);
        const linkedQuantity=fix?.kind==='line'&&fix.field==='quantity'&&
          quote.lines.some(line=>line.id===fix.id&&line.quantitySource?.syncMode==='live');
        const hasInline=Boolean(fix&&!linkedQuantity&&editable);
        const expanded=expandedId===finding.id;
        return <article className={'qmb-audit-finding '+kind+(expanded?' is-expanded':'')} key={finding.id}
          data-audit-id={finding.id}>
          <div className="qmb-audit-finding-summary">
            <div className="qmb-audit-finding-copy">
              <strong>{finding.title}</strong>
              <p>{finding.detail}</p>
            </div>
            <button type="button" className="qmb-audit-resolve" aria-expanded={hasInline?expanded:undefined}
              aria-label={(hasInline?'Resolve ':'Go to ')+finding.title}
              onClick={()=>hasInline?setExpandedId(expanded?null:finding.id):onFix(finding.destination)}>
              {hasInline?(expanded?'Close':'Resolve'):'Go ›'}
            </button>
          </div>
          {hasInline&&expanded&&<QuoteAuditInlineEditor key={finding.id}
            quote={quote} finding={finding} onClose={()=>setExpandedId(null)}
            onGoTo={destination=>{setExpandedId(null);onFix(destination);}}/>}
        </article>;
      })}
    </section>
  );
  if(quote.documentType==='pricing-schedule'){
    const source=quote.pricingSchedule?.publishSource??'rate-sheet';
    const sourceLabel=source==='workbook'?'Spreadsheet':source==='builder'?'Plan Pricing':'Simple Rates';
    const published=quote.pricingSchedule?.customerItems.length??0;
    const scheduleReady=!needsRecheck&&!scheduleError;
    return <div className="qmb-editor qmb-review-editor">
      <header className="qmb-pagehead"><strong>Review Pricing Schedule</strong>
        <button type="button" className="qmb-back" onClick={onBack} aria-label="Close Review and Issue">× Close</button></header>
      <div className="qmb-pad qmb-pagecontent">
        <div className="qmb-audit-overview"><div className="qmb-audit-total">
          <span>Published customer price rows</span><strong>{published}</strong></div>
          <div className="qmb-audit-counts"><span>{sourceLabel}</span><span>{quoteBetaStatusLabel(quote)}</span></div>
        </div>
        {needsRecheck&&<section className="qmb-review-recheck" role="status">
          <div><strong>Schedule changed since this review</strong><small>Check the latest published prices before issuing.</small></div>
          <button type="button" onClick={()=>setLastCheckedAt(quote.updatedAt)}>Recheck now</button>
        </section>}
        {scheduleError?<section className="qmb-audit-group" aria-label="Pricing Schedule validation">
          <div className="qmb-audit-group-heading"><strong>Resolve before issuing</strong></div>
          <p className="qmb-cost-warning">{scheduleError}</p>
          <button type="button" className="qmb-outline qmb-block" onClick={()=>onFix({view:'build'})}>Open pricing workspace ›</button>
        </section>:<section className="qmb-audit-clean"><strong>✓ Pricing Schedule validated</strong>
          <p>Only the published customer rows appear in the customer document. Internal workbook formulas and cost details stay private.</p>
        </section>}
        {error&&<p role="alert" className="qmb-error">{error}</p>}
        <section className="qmb-card qmb-audit-delivery" data-review-delivery>
          <strong>Customer delivery</strong>
          {!editable&&<p className="qmb-audit-help">This issued schedule is frozen. Create a revision to change published pricing.</p>}
          {!editable&&!quote.archivedAt&&quoteCanCreateRevision(quote)&&<button type="button" className="qmb-outline qmb-block"
            onClick={()=>{createRevision(quote.id);onBack();}}>Create editable revision ›</button>}
          <button type="button" className="qmb-outline qmb-block" onClick={onPreview}>Customer schedule preview ›</button>
          <QuoteShareControl inline allowCreation={canIssue&&(!editable||scheduleReady)}/>
          {!editable&&<QuoteDeliveryConfirmation quote={quote} canRecord={canIssue&&['Sent','Viewed','Signed'].includes(quote.status)&&!quote.archivedAt}/>} 
          {canIssue&&['Sent','Viewed','Signed'].includes(quote.status)&&<button type="button" className="qmb-outline qmb-block"
            onClick={()=>setSignatureOpen(true)}>{quote.status==='Signed'?'View signed receipt':'Sign in person'}</button>}
          {editable&&<button type="button" className="qmb-primary qmb-block"
            disabled={sending||!canIssue||!scheduleReady} onClick={onIssue}>
            {sending?'Issuing…':needsRecheck?'Recheck changes before issuing':scheduleError?'Complete the schedule to issue':'Issue Pricing Schedule · no message sent'}</button>}
          {!canIssue&&editable&&<small className="qmb-audit-help">Your current team role cannot issue schedules.</small>}
        </section>
        <button type="button" className="qmb-quiet qmb-block" onClick={onClassic}>Continue in Classic Quotes</button>
        {signatureOpen&&createPortal(<QuoteSignatureDialog quote={quote} onClose={()=>setSignatureOpen(false)}/>,document.body)}
      </div>
      <footer className="qmb-footer qmb-footer-single"><button type="button" className="qmb-primary" onClick={onBack}>Done reviewing</button></footer>
    </div>;
  }
  return <div className="qmb-editor qmb-review-editor">
    <header className="qmb-pagehead">
      <strong>Review details &amp; delivery</strong>
      <button type="button" className="qmb-back" onClick={onBack} aria-label="Close Review and Issue">× Close</button>
    </header>
    <div className="qmb-pad qmb-pagecontent">
      <div className="qmb-audit-overview">
        <div className="qmb-audit-total"><span>Quote total</span><strong>{money.format(quoteTotal(quote))}</strong></div>
        <div className="qmb-audit-counts">
          <span className={report.blockers.length?'is-blocked':''}><b>{report.blockers.length}</b> To resolve</span>
          <span><b>{report.review.length}</b> Review</span>
          <span><b>{report.optional.length}</b> Optional</span>
        </div>
      </div>
      {needsRecheck&&<section className="qmb-review-recheck" role="status">
        <div><strong>Quote changed since this review</strong>
          <small>Recheck the latest amounts and findings before issuing or creating a new customer link.</small></div>
        <button type="button" onClick={()=>{setLastCheckedAt(quote.updatedAt);onReview(null);}}>Recheck now</button>
      </section>}
      {!report.findings.length&&<section className="qmb-audit-clean">
        <strong>{editable?'✓ Ready for customer review':'✓ No outstanding quote findings'}</strong>
        <p>{editable?'No missing pricing or unfinished details detected. Check the customer preview before issuing.':'Review the frozen customer document and its delivery or revision options below.'}</p>
      </section>}
      {!!report.blockers.length&&renderFindings(report.blockers,'Resolve before issuing',
        'These affect the price or completeness of billable work. Draft editing stays unrestricted.',
        'is-blocker')}
      {!!report.review.length&&renderFindings(report.review,'Review or intentionally leave blank',
        'These are not mandatory during drafting. You can fix them or explicitly acknowledge them.',
        'is-review')}
      {!!report.optional.length&&renderFindings(report.optional,'Optional details',
        'Helpful for the customer, but not required for issuing.',
        'is-optional')}
      {!!report.review.length&&<label className="qmb-audit-ack">
        <input type="checkbox" checked={acknowledged} onChange={event=>onReview(event.target.checked?reviewKey:null)}/>
        <span>I reviewed the remaining items and intend to leave them as shown.</span>
      </label>}
      {error&&<p role="alert" className="qmb-error">{error}</p>}
      <section ref={deliverySectionRef} className="qmb-card qmb-audit-delivery" data-review-delivery>
        <strong>Customer delivery · Preview → Approve → Issue → Share</strong>
        {!editable&&quote.status==='Sent'&&<div className="qmb-issued-next" role="status">
          <strong>✓ Quote issued successfully</strong>
          <p>The approved revision is frozen. No email or customer link was sent or
            created automatically. Create a secure link below, then share it using
            your preferred method.</p>
        </div>}
        <div className="qmb-delivery-version" aria-label="Customer document revision">
          <span>{editable?'Draft awaiting approval':quoteBetaStatusLabel(quote)+' customer revision'}</span>
          <strong>{displayQuoteNumber(quote)}</strong>
          <small>{quote.title}{quote.revisionLabel?' · '+quote.revisionLabel:''} · Revision {quote.revision} · {money.format(quoteTotal(quote))}</small>
        </div>
        {!editable&&<p className="qmb-audit-help">
          This customer-facing revision is frozen. The link below is created for the issued revision shown above.
        </p>}
        {!editable&&!quote.archivedAt&&quoteCanCreateRevision(quote)&&<button type="button" className="qmb-outline qmb-block"
          onClick={()=>{createRevision(quote.id);onBack();}}>Create editable revision ›</button>}
        {editable?<div className="qmb-delivery-steps" aria-label="Customer delivery steps">
          <div className="qmb-delivery-step">
            <div className="qmb-delivery-step-title"><span>1</span><strong>Preview customer copy</strong>
              <small>{previewed?'✓ Reviewed':'Required'}</small></div>
            <p>Check the customer name, visible scope, pricing, total and policies as the customer will see them.</p>
            <button type="button" className="qmb-outline qmb-block" onClick={onPreview}>
              {previewed?'Preview again ›':'Open customer preview ›'}</button>
          </div>
          <div className="qmb-delivery-step">
            <div className="qmb-delivery-step-title"><span>2</span><strong>Approve this draft</strong>
              <small>{approved?'✓ Approved':previewed?'Confirm':'Preview first'}</small></div>
            <label className="qmb-delivery-approval"><input type="checkbox"
              aria-label="Approve customer document for issuing"
              checked={approved} disabled={!canApprove}
              onChange={e=>onApprove(e.target.checked)}/>
              <span>I approve the customer document shown in Preview, including this revision's price and scope.</span>
            </label>
            {!previewed&&<small>Open Preview, then return to Review to confirm this exact draft.</small>}
            {previewed&&!ready&&<small>Resolve or acknowledge outstanding findings and recheck changes before approving.</small>}
            <small>Any new edit invalidates this approval until you preview the updated version again.</small>
          </div>
          <div className="qmb-delivery-step">
            <div className="qmb-delivery-step-title"><span>3</span><strong>Issue approved revision</strong><small>After approval</small></div>
            <p>Issuing freezes the approved revision. It does not send an email or automatically create a link.</p>
            <button type="button" className="qmb-primary qmb-block"
              disabled={sending||!canIssue||!ready||!approved} onClick={onIssue}>
              {sending?'Issuing…':needsRecheck?'Recheck changes before issuing':report.blockers.length?'Resolve pricing issues to issue':
                report.review.length&&!acknowledged?'Review remaining items to issue':
                !previewed?'Preview customer document to issue':!approved?'Approve customer document to issue':
                  'Issue quote · no message sent'}
            </button>
          </div>
        </div>:<button type="button" className="qmb-outline qmb-block" onClick={onPreview}>View issued customer revision ›</button>}
        {!editable&&['Sent','Viewed','Signed'].includes(quote.status)&&<div className="qmb-delivery-step" aria-label="Step 4 share and confirm customer delivery">
          <div className="qmb-delivery-step-title"><span>4</span><strong>Share and confirm delivery</strong><small>After issuing</small></div>
          <p>Create or reuse the secure link for this exact revision. Sharing the link is not proof of delivery; confirm receipt separately.</p>
        </div>}
        {!editable&&<p className="qmb-audit-help">A customer link never changes this frozen revision or sends a message automatically.</p>}
        <QuoteShareControl inline allowCreation={canIssue&&!editable} autoOpenOnIssue/>
        {!editable&&<QuoteDeliveryConfirmation quote={quote} canRecord={canIssue&&['Sent','Viewed','Signed'].includes(quote.status)&&!quote.archivedAt}/>} 
        {canIssue&&['Sent','Viewed','Signed'].includes(quote.status)&&
          <button type="button" className="qmb-outline qmb-block" onClick={()=>setSignatureOpen(true)}>
            {quote.status==='Signed'?'View signed receipt':'Sign in person'}
          </button>}
        {!canIssue&&editable&&<small className="qmb-audit-help">Your current team role cannot issue quotes.</small>}
        {report.blockers.length>0&&editable&&
          <small className="qmb-audit-help">Resolve {report.blockers.length} pricing issue{report.blockers.length===1?'':'s'} before issuing. Your draft is still saved.</small>}
      </section>
      <button type="button" className="qmb-quiet qmb-block" onClick={onClassic}>Continue in Classic Quotes</button>
      {signatureOpen&&createPortal(<QuoteSignatureDialog quote={quote} onClose={()=>setSignatureOpen(false)}/>,document.body)}

    </div>
    <footer className="qmb-footer qmb-footer-single">
      <button type="button" className="qmb-primary" onClick={onBack}>Done reviewing</button>
    </footer>
  </div>;
}
