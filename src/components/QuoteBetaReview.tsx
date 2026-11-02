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
import {QuotePricingScenarioReview} from './QuotePricingScenarioReview';
import {quickAreaSummary,quickGeneralSummary} from '../services/quoteQuickAreaSummary';
import {isGeneralTakeoffSection} from '../services/quoteCustomerPresentation';
import {projectAreaCost} from '../services/quoteAreaCost';
import './quote-pricing-review-workspace.css';
import {InitialOpenDetails} from './InitialOpenDetails';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});

export function QuoteBetaReview({quote,onBack,onFix,onPreview,initialFindingId,
  canIssue,sending,error,onIssue,previewedKey,approvedKey,onApprove,reviewedKey,onReview}:{
  quote:Quote;
  onBack:()=>void;onFix:(destination:QuoteAuditDestination)=>void;
  initialFindingId?:string|null;
  onPreview:()=>void;
  canIssue:boolean;sending:boolean;error:string;onIssue:()=>void;
  previewedKey:string|null;approvedKey:string|null;onApprove:(approved:boolean)=>void;
  reviewedKey:string|null;onReview:(key:string|null)=>void;
}){
  const [reviewStep,setReviewStep]=useState<number>(()=>initialFindingId?2:0);
  useEffect(()=>{if(initialFindingId)setReviewStep(2);},[initialFindingId]);
  const reviewSteps=['Area totals','Costs & margin','Pricing questions'] as const;
  const report=auditQuoteDraft(quote);
  const createRevision=useQuoteStore(state=>state.createRevision);
  const [signatureOpen,setSignatureOpen]=useState(false);
  const reviewNavRef=useRef<HTMLElement>(null);
  useEffect(()=>{
   if(quote.documentType!=='pricing-schedule')
    reviewNavRef.current?.scrollIntoView({block:'nearest',behavior:'instant'});
  },[reviewStep,quote.documentType]);
  const deliverySectionRef=useRef<HTMLElement>(null);
  const checklistSectionRef=useRef<HTMLElement>(null);
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
  const issued=['Sent','Viewed','Signed','Declined','Expired'].includes(quote.status);
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
        {signatureOpen&&createPortal(<QuoteSignatureDialog quote={quote} onClose={()=>setSignatureOpen(false)}/>,document.body)}
      </div>
      <footer className="qmb-footer qmb-footer-single"><button type="button" className="qmb-primary" onClick={onBack}>Done reviewing</button></footer>
    </div>;
  }
  return <div className="qmb-editor qmb-review-editor qqr-workspace">
    <header className="qmb-pagehead qqr-pagehead">
      <div><small>QUICK QUOTE</small><strong>Pricing Review</strong>
       <p>Confirm totals, costs, open questions and the exact customer contract.</p></div>
      <button type="button" className="qmb-back" onClick={onBack}>‹ Back to Build Quote</button>
    </header>
    <nav className="qqr-steps" aria-label="Pricing Review steps" ref={reviewNavRef}>
     {reviewSteps.map((label,index)=><button key={label} type="button"
       className={index===reviewStep?'is-active':''}
       aria-current={index===reviewStep?'step':undefined} onClick={()=>setReviewStep(index)}>
       <span>{index<reviewStep?'✓':index+1}</span><strong>{label}</strong>
       {index===2&&report.blockers.length>0&&<small>{report.blockers.length} issues</small>}
     </button>)}
    </nav>
    <div className="qmb-pad qmb-pagecontent qqr-body">
    {reviewStep===0&&<section className="qqr-stage">
     <h3>Confirm Area totals</h3><p>These are your existing customer selling amounts, not new charges.</p>
     <div className="qqr-table-scroll"><table><thead><tr>
      <th>Area</th><th>Material</th><th>Billable SF</th><th>Stone</th>
      <th>Sinks</th><th>Specialty</th><th>Total</th>
     </tr></thead><tbody>
      {quote.sections.filter(section=>!isGeneralTakeoffSection(section)).map(section=>{
       const data=quickAreaSummary(quote,section);
       return <tr key={section.id}><th>{section.title}</th>
        <td title={section.scope?.takeoffMaterial??''}>{section.scope?.takeoffMaterial||'Choose material'}</td>
        <td>{data.billedSf.toFixed(2)}</td><td>{money.format(data.materialPrice)}</td>
        <td>{money.format(data.sinkPrice)}</td><td>{money.format(data.specialtyPrice)}</td>
        <td><strong>{money.format(data.total)}</strong></td></tr>;
      })}
      <tr><th>General</th><td colSpan={5}>Unassigned charges and discounts</td>
       <td><strong>{money.format(quickGeneralSummary(quote).total)}</strong></td></tr>
     </tbody></table></div>
     <div className="qqr-grand-total"><span>Quote total</span><strong>{money.format(quoteTotal(quote))}</strong></div>
     <button type="button" className="qmb-outline" onClick={()=>onFix({view:'build'})}>Edit Areas in Build Quote ›</button>
    </section>}
    {reviewStep===1&&<section className="qqr-stage">
     <h3>Check buying costs and margin</h3>
     <p>Private estimates and alternative pricing scenarios. Changes are only applied when you explicitly choose them.</p>
     <div className="qqr-cost-rows">{quote.sections.filter(section=>!isGeneralTakeoffSection(section)).map(section=>{
      const value=projectAreaCost(quote,section);
      return <div className="qqr-cost-row" key={section.id}><strong>{section.title}</strong>
       <span>{value.materialCost===undefined?'Material buying cost missing':money.format(value.materialCost)+' buying cost'}</span>
       <span>{value.measuredSf.toFixed(2)} SF measured</span></div>;
     })}</div>
     <QuotePricingScenarioReview quote={quote}/>
    </section>}
      {reviewStep===2&&<div className="qqr-stage"><h3>Resolve or acknowledge questions</h3>
       <p>Blocking items must be fixed. Other decisions can be deliberately acknowledged.</p></div>}
      {reviewStep===2&&<section ref={checklistSectionRef} className="qmb-review-checklist" aria-label="Review quote findings">
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
      {!!report.optional.length&&<InitialOpenDetails key={quote.id+':'+(initialFindingId??'optional')}
        className="qmb-review-optional"
        initialOpen={Boolean(initialFindingId&&report.optional.some(f=>f.id===initialFindingId))}>
        <summary>Optional details <span>{report.optional.length}</span>
          <small>Can be left blank</small><span aria-hidden="true">⌄</span></summary>
        {renderFindings(report.optional,'Optional information',
          'Helpful for the customer, but not required for issuing.','is-optional')}
      </InitialOpenDetails>}
      {!!report.review.length&&<label className="qmb-audit-ack">
        <input type="checkbox" checked={acknowledged} onChange={event=>onReview(event.target.checked?reviewKey:null)}/>
        <span>I reviewed the remaining items and intend to leave them as shown.</span>
      </label>}
      </section>}
      {error&&<p role="alert" className="qmb-error">{error}</p>}
      {signatureOpen&&createPortal(<QuoteSignatureDialog quote={quote} onClose={()=>setSignatureOpen(false)}/>,document.body)}

    </div>
    <footer className="qmb-footer qqr-footer">
      <button type="button" className="qmb-outline" onClick={()=>reviewStep===0?onBack():setReviewStep(reviewStep-1)}>
       {reviewStep===0?'‹ Back to Build Quote':'‹ Previous'}</button>
      <div><small>Step {reviewStep+1} of 3 · {money.format(quoteTotal(quote))}</small>
       {reviewStep<2?<button type="button" className="qmb-primary" onClick={()=>setReviewStep(reviewStep+1)}>
        Next: {reviewSteps[reviewStep+1]} ›</button>
       :<button type="button" className="qmb-primary" onClick={onPreview}>Continue to Contract Review ›</button>}</div>
    </footer>
  </div>;
}
