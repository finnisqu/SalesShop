import {quoteReviewNextAction,type QuoteReviewJourneyInput,type QuoteReviewNextKind} from '../services/quoteReviewJourney';
import './quote-beta-review-guide.css';
type Props=QuoteReviewJourneyInput & {
  optional:number;onCheck:()=>void;onPreview:()=>void;onDelivery:()=>void;
};
/** Clickable orientation only. No automatic approve, issue, share or send. */
export function QuoteBetaReviewGuide({optional,onCheck,onPreview,onDelivery,...status}:Props){
  const next=quoteReviewNextAction(status);
  const checked=!status.needsRecheck&&status.blockers===0&&(!status.decisions||status.acknowledged);
  const visit=(kind:QuoteReviewNextKind)=>{
    if(kind==='check')onCheck();
    else if(kind==='preview')onPreview();
    else onDelivery();
  };
  const stages=[
    {kind:'check' as const,label:'Check',detail:checked?'Done':status.blockers?status.blockers+' to fix':status.needsRecheck?'Recheck':status.decisions?'Review items':'Ready',done:checked},
    {kind:'preview' as const,label:'Preview',detail:status.previewed?'Viewed':'Not viewed',done:status.previewed},
    {kind:'delivery' as const,label:'Approve & issue',detail:status.issued?'Issued':status.editable?(status.approved?'Approved':'Not approved'):'Read-only',done:status.issued},
  ];
  return <section className="qmb-review-guide" aria-label="Review progress and next action">
    <div className="qmb-review-guide-heading">
      <strong>Final review</strong><small>Check → Preview → Approve & issue → Share</small>
    </div>
    <nav className="qmb-review-guide-stages" aria-label="Review steps">
      {stages.map((step,i)=><button type="button" key={step.label}
        aria-label={step.label+': '+step.detail} onClick={()=>visit(step.kind)}
        className={step.done?'is-done':''}>
        <span className="qmb-review-guide-number">{step.done?'✓':i+1}</span>
        <strong>{step.label}</strong><small>{step.detail}</small>
      </button>)}
      <button type="button" disabled={!status.issued}
        title={status.issued?'View delivery options':'Available after issuing'}
        aria-label={status.issued?'Share and delivery options':'Share after issuing'}
        onClick={onDelivery}>
        <span className="qmb-review-guide-number">4</span>
        <strong>Share</strong><small>{status.issued?'Options':'After issue'}</small>
      </button>
    </nav>
    <div className="qmb-review-guide-next">
      <div><strong>{next.label}</strong><small>{next.description}</small></div>
      <button type="button" onClick={()=>visit(next.kind)}>{next.kind==='preview'?'Preview ›':'Continue ›'}</button>
    </div>
    {optional>0&&<small className="qmb-review-guide-footnote">
      {optional} optional {optional===1?'detail':'details'} can be left blank.
    </small>}
  </section>;
}
