import {useEffect,useState} from 'react';
import type {Quote} from '../types/quote';
import {quoteTotal} from '../types/quote';
import {QuoteShareControl} from './QuoteShareControl';
import {auditQuoteDraft,type QuoteAuditDestination,type QuoteAuditFinding} from '../services/quoteDraftAudit';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});

export function QuoteBetaReview({quote,onBack,onFix,onPreview,onClassic,
  canIssue,sending,error,onIssue}:{
  quote:Quote;
  onBack:()=>void;onFix:(destination:QuoteAuditDestination)=>void;
  onPreview:()=>void;onClassic:()=>void;
  canIssue:boolean;sending:boolean;error:string;onIssue:()=>void;
}){
  const report=auditQuoteDraft(quote);
  const [acknowledged,setAcknowledged]=useState(false);
  const issueSet=report.findings.map(f=>f.id+':'+f.severity).join('|');
  useEffect(()=>setAcknowledged(false),[quote.id,issueSet]);
  const editable=quote.status==='Draft'||quote.status==='Ready';
  const ready=report.blockers.length===0&&(!report.review.length||acknowledged);
  const renderFindings=(items:QuoteAuditFinding[],heading:string,description:string,kind:string)=>(
    <section className="qmb-audit-group" aria-label={heading}>
      <div className="qmb-audit-group-heading">
        <strong>{heading}</strong><span>{items.length}</span>
      </div>
      <small className="qmb-audit-help">{description}</small>
      {items.map(finding=><article className={'qmb-audit-finding '+kind} key={finding.id}>
        <div className="qmb-audit-finding-copy">
          <strong>{finding.title}</strong>
          <p>{finding.detail}</p>
        </div>
        <button type="button" onClick={()=>onFix(finding.destination)}
          aria-label={'Fix '+finding.title}>Fix ›</button>
      </article>)}
    </section>
  );
  return <div className="qmb-editor qmb-review-editor">
    <header className="qmb-pagehead">
      <button type="button" className="qmb-back" onClick={onBack}>‹ Quote</button>
      <span className="qmb-chip">Review</span>
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
      {!report.findings.length&&<section className="qmb-audit-clean">
        <strong>✓ Ready to issue</strong>
        <p>No missing pricing or unfinished details detected. Check the customer preview before sending.</p>
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
        <input type="checkbox" checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)}/>
        <span>I reviewed the remaining items and intend to leave them as shown.</span>
      </label>}
      {error&&<p role="alert" className="qmb-error">{error}</p>}
      <section className="qmb-card qmb-audit-delivery">
        <strong>Customer delivery</strong>
        <p className="qmb-help">Preview and draft links are available at any time. Issuing records a formal quote revision.</p>
        <button type="button" className="qmb-outline qmb-block" onClick={onPreview}>Customer preview ›</button>
        <QuoteShareControl/>
        {editable&&<button type="button" className="qmb-primary qmb-block"
          disabled={sending||!canIssue||!ready} onClick={onIssue}>
          {sending?'Issuing…':report.blockers.length?'Resolve pricing issues to issue':
            report.review.length&&!acknowledged?'Review remaining items to issue':'Issue quote / mark sent'}
        </button>}
        {!canIssue&&editable&&<small className="qmb-audit-help">Your current team role cannot issue quotes.</small>}
        {report.blockers.length>0&&editable&&
          <small className="qmb-audit-help">Resolve {report.blockers.length} pricing issue{report.blockers.length===1?'':'s'} before issuing. Your draft is still saved.</small>}
      </section>
      <button type="button" className="qmb-quiet qmb-block" onClick={onClassic}>Continue in Classic Quotes</button>
    </div>
    <footer className="qmb-footer qmb-footer-single">
      <button type="button" className="qmb-primary" onClick={onBack}>Back to draft</button>
    </footer>
  </div>;
}
