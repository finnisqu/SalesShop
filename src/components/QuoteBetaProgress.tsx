import {useState} from 'react';
import type {Quote} from '../types/quote';
import {auditQuoteDraft} from '../services/quoteDraftAudit';
import {quoteBuilderProgress,type QuoteBuilderStageId} from '../services/quoteBuilderProgress';
import './quote-beta-progress.css';

type Props={
 quote:Quote;current:QuoteBuilderStageId;editable:boolean;onDetails:()=>void;
 onAreas:()=>void;onOpenArea:(id:string)=>void;onAddArea:()=>void;
 onPricing:()=>void;onReview:()=>void;
};
export function QuoteBetaProgress({quote,current,editable,onDetails,onAreas,onOpenArea,onAddArea,onPricing,onReview}:Props){
 const [areasExpanded,setAreasExpanded]=useState(false);
 const report=auditQuoteDraft(quote);
 const progress=quoteBuilderProgress(quote,report);
 const visit=(stage:QuoteBuilderStageId)=>{
  if(stage==='areas'){setAreasExpanded(true);onAreas();return;}
  setAreasExpanded(false);
  if(stage==='details')onDetails();
  if(stage==='pricing')onAreas();
  if(stage==='review')onPricing();
  if(stage==='contract')onReview();
 };
 const order=progress.stages.map(s=>s.id);
 const next=order[order.indexOf(current)+1];
 const nextStage=progress.stages.find(s=>s.id===next);
 return <section className="qmb-guide qmb-guide-five" aria-label="Quote builder progress">
   <div className="qmb-guide-heading"><strong>Quote builder</strong><small>Work in any order · autosaved</small></div>
   <nav className="qmb-guide-steps" aria-label="Jump to quote stage">
    {progress.stages.map((stage,index)=><button type="button" key={stage.id}
      className={'qmb-guide-step is-'+stage.state+(current===stage.id?' is-current':'')}
      aria-current={current===stage.id?'step':undefined}
      aria-label={stage.label+': '+stage.status} onClick={()=>visit(stage.id)}>
      <span className="qmb-guide-step-number" aria-hidden="true">{stage.state==='done'?'✓':
       stage.state==='attention'?'!':index+1}</span>
      <span className="qmb-guide-step-text"><strong>{stage.label}</strong><small>{stage.status}</small></span>
    </button>)}
   </nav>
   <div className="qmb-guide-progress" role="progressbar" aria-label="Quote milestones reached"
     aria-valuemin={0} aria-valuemax={progress.stages.length} aria-valuenow={progress.readyCount}>
     {progress.stages.map(stage=><span key={stage.id} className={'qmb-guide-progress-piece is-'+stage.state}/>)}
   </div>
   {areasExpanded&&<div className="qmb-guide-area-links" aria-label="Quick access to quote Areas">
     <button type="button" className="qmb-guide-area-link" onClick={()=>{setAreasExpanded(false);onAreas();}}>All takeoff tables</button>
     {progress.areas.map(area=><button type="button" key={area.id} className="qmb-guide-area-link"
      onClick={()=>{setAreasExpanded(false);onOpenArea(area.id);}}>{area.title||'Untitled Area'}</button>)}
     {editable&&<button type="button" className="qmb-guide-area-link is-add"
       onClick={()=>{setAreasExpanded(false);onAddArea();}}>+ Add Area</button>}
     <button type="button" className="qmb-guide-area-close" aria-label="Close Area shortcuts"
       onClick={()=>setAreasExpanded(false)}>×</button>
   </div>}
   <div className="qmb-guide-caption"><small>Missing prices are highlighted in the tables. Contract issuing remains gated by Review.</small>
     {nextStage&&<button type="button" className="qmb-guide-next" onClick={()=>visit(nextStage.id)}>
       Continue: {nextStage.label} <span aria-hidden="true">›</span></button>}
   </div>
 </section>;
}
