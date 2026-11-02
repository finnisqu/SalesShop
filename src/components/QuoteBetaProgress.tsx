import type {Quote} from '../types/quote';
import {auditQuoteDraft} from '../services/quoteDraftAudit';
import {quoteBuilderProgress,type QuoteBuilderStageId} from '../services/quoteBuilderProgress';
import './quote-beta-progress.css';

type Props={
 quote:Quote;current:QuoteBuilderStageId;editable:boolean;onDetails:()=>void;
 onAreas:()=>void;onOpenArea:(id:string)=>void;onAddArea:()=>void;
 /** Open the dedicated Pricing Review stage; no separate Materials & Pricing step. */
 onPricing:()=>void;
 /** Open the customer preview with its presentation choices. */
 onReview:()=>void;
};
export function QuoteBetaProgress({quote,current,onDetails,onAreas,onPricing,onReview}:Props){
 const progress=quoteBuilderProgress(quote,auditQuoteDraft(quote));
 const visit=(stage:QuoteBuilderStageId)=>{
  if(stage==='details')onDetails();
  else if(stage==='areas')onAreas();
  else if(stage==='review')onPricing();
  else onReview();
 };
 const order=progress.stages.map(stage=>stage.id);
 const next=order[order.indexOf(current)+1];
 const nextStage=progress.stages.find(stage=>stage.id===next);
 return <section className="qmb-guide qmb-guide-four" aria-label="Quote builder progress">
  <div className="qmb-guide-heading"><strong>Quote builder</strong><small>Work in any order · autosaved</small></div>
  <nav className="qmb-guide-steps" aria-label="Jump to quote stage">
   {progress.stages.map((stage,index)=><button type="button" key={stage.id}
    className={'qmb-guide-step is-'+stage.state+(current===stage.id?' is-current':'')}
    aria-current={current===stage.id?'step':undefined}
    aria-label={stage.label+': '+stage.status} onClick={()=>visit(stage.id)}>
    <span className="qmb-guide-step-number" aria-hidden="true">
     {stage.state==='done'?'✓':stage.state==='attention'?'!':index+1}
    </span><span className="qmb-guide-step-text"><strong>{stage.label}</strong>
     <small>{stage.status}</small></span>
   </button>)}
  </nav>
  <div className="qmb-guide-progress" role="progressbar" aria-label="Quote milestones reached"
   aria-valuemin={0} aria-valuemax={progress.stages.length} aria-valuenow={progress.readyCount}>
   {progress.stages.map(stage=><span key={stage.id} className={'qmb-guide-progress-piece is-'+stage.state}/>)}
  </div>
  <div className="qmb-guide-caption">
   <small>Edit Takeoffs, selections and selling prices together. Pricing Review opens a dedicated page; Contract Review opens the customer preview.</small>
   {nextStage&&<button type="button" className="qmb-guide-next" onClick={()=>visit(nextStage.id)}>
    Continue: {nextStage.label} <span aria-hidden="true">›</span></button>}
  </div>
 </section>;
}
