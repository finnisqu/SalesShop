import type {Quote} from '../types/quote';
import {quoteLinesTotal,quoteTotal,displayQuoteNumber} from '../types/quote';
import {auditQuoteDraft} from '../services/quoteDraftAudit';
import {totalBillableTakeoffSf} from '../services/quoteTakeoffsLite';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {isGeneralTakeoffSection} from '../services/quoteCustomerPresentation';
import {projectAreaCost} from '../services/quoteAreaCost';
import {summarizeQuoteInternalPricing} from '../services/quoteInternalPricing';
import {useQuoteBetaCardReflow} from './quoteBetaCardMotion';
import {QuoteBetaAreaModeButton,QuoteBetaAreaGrip,QuoteBetaAreaDeleteButton,QuoteBetaAreaVisibilityButton,
  type QuoteBetaAreaManager} from './QuoteBetaAreasMenu';

type QuoteTab='build'|'details'|'preview';
type AreaTab='measure'|'materials'|'pricing'|'calculator';
type Page='library'|'quote'|'area'|'review';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const sf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});

export function QuoteBetaDesktopRails({
  quote,page,quoteTab,areaTab,areaId,
  onLibrary,onQuoteTab,onArea,onAreaTab,onReview,onAddArea,onSelections,onReviewFinding,onReviewIssue,
  onUndo,onRedo,undoDepth,redoDepth,onSend,canIssue,areaManager,
}:{
  quote:Quote;page:Page;quoteTab:QuoteTab;areaTab:AreaTab;areaId:string|null;
  onLibrary:()=>void;onQuoteTab:(tab:QuoteTab)=>void;onArea:(id:string)=>void;
  onAreaTab:(tab:AreaTab)=>void;onReview:()=>void;onAddArea:()=>void;
  onSelections:()=>void;onReviewFinding:(kind:'blockers'|'review'|'optional')=>void;
  onReviewIssue:(id:string)=>void;
  onUndo:()=>void;onRedo:()=>void;undoDepth:number;redoDepth:number;
  onSend:()=>void;canIssue:boolean;areaManager:QuoteBetaAreaManager;
}){
  const editable=quoteIsCommerciallyEditable(quote);
  const steps=[['build','Build quote'],['details','Customer & project'],['preview','Customer preview']] as const;
  const areas=areaManager.editing?areaManager.orderedSections:quote.sections.filter(s=>!isGeneralTakeoffSection(s));
  const desktopAreaRef=useQuoteBetaCardReflow<HTMLElement>(areas.map(s=>s.id));
  return <>
    <aside className="qmb-desktop-navigation" aria-label="Quote workspace navigation">
      <div className="qmb-desktop-rail-head">
        <button type="button" className="qmb-desktop-library-link" onClick={onLibrary}>‹ All quotes</button>
        <strong>Quotes <span>Beta</span></strong>
        <small>{displayQuoteNumber(quote)} · {quote.status}</small>
        <div className="qmb-desktop-history" role="toolbar" aria-label="Quote history controls">
          <button type="button" onClick={onUndo} disabled={!editable||!undoDepth}
            aria-label="Undo quote change">↶ Undo</button>
          <button type="button" onClick={onRedo} disabled={!editable||!redoDepth}
            aria-label="Redo quote change">↷ Redo</button>
        </div>
      </div>
      <nav className="qmb-desktop-mainsteps" aria-label="Quote workflow">
        {steps.map(([id,label])=><button type="button" key={id}
          className={page==='quote'&&quoteTab===id?'is-active':''}
          aria-current={page==='quote'&&quoteTab===id?'page':undefined}
          onClick={()=>onQuoteTab(id)}>
          <span className="qmb-desktop-step-icon">{id==='build'?'▤':id==='details'?'♙':'▧'}</span>
          {label}
        </button>)}
        <button type="button" className="qmb-desktop-selections-step" onClick={onSelections}>
          <span className="qmb-desktop-step-icon">◇</span> Job Selections
          {!!quote.projectMaterials?.length&&<small>{quote.projectMaterials.length}</small>}
        </button>
      </nav>
      <div className="qmb-desktop-areas-head" data-area-edit-workspace><strong>Areas</strong>
        <QuoteBetaAreaModeButton manager={areaManager}/>
        {!areaManager.editing&&<button type="button" disabled={!editable||quote.documentType==='pricing-schedule'}
          onClick={onAddArea} aria-label="Add Area from navigator">+ Add</button>}
      </div>
      <nav ref={desktopAreaRef} className={'qmb-desktop-area-list'+(areaManager.editing?' is-managing-areas':'')}
        aria-label="Quote Areas" data-area-edit-workspace>
        {areas.map(section=>{
          const active=page==='area'&&section.id===areaId;
          const lines=quote.lines.filter(l=>l.sectionId===section.id);
          return <div key={section.id} className="qmb-inline-area-row" data-qmb-sort-row={section.id} data-area-sort-id={section.id}>
            {areaManager.editing&&<QuoteBetaAreaGrip manager={areaManager} area={section}/>}
            <button type="button" className={'qmb-desktop-area-card'+(active?' is-active':'')}
              aria-disabled={areaManager.editing}
              aria-current={active?'page':undefined} onClick={()=>{if(!areaManager.editing)onArea(section.id);}}>
              <span className="qmb-desktop-area-dot">▤</span>
              <span className="qmb-desktop-area-title">
                <strong>{section.title.trim().toLowerCase()==='general takeoffs'?'General':section.title||'Untitled Area'}</strong>
                <small>{sf.format(section.scope?.countertopSf??0)} SF</small>
              </span>
              <span className="qmb-desktop-area-value">{money.format(quoteLinesTotal(lines))}</span>
            </button>
            {areaManager.editing&&<><QuoteBetaAreaVisibilityButton quote={quote} area={section}/>
              <QuoteBetaAreaDeleteButton manager={areaManager} area={section}/></>}
          </div>;
        })}
        {!areas.length&&<p className="qmb-desktop-empty">Add an Area to begin measuring and pricing.</p>}
        {areaManager.editing&&<p className="qmb-inline-area-hint">Drag to reorder · Esc cancels</p>}
      </nav>
    </aside>
    <QuoteBetaInspector quote={quote} page={page} areaTab={areaTab} areaId={areaId}
      onAreaTab={onAreaTab} onReview={onReview}
      onReviewFinding={onReviewFinding} onReviewIssue={onReviewIssue} onSend={onSend} canIssue={canIssue}/>

  </>;
}

/** One inspector component is used both at rest and when pulled left by Review. */
export function QuoteBetaInspector({quote,page,areaTab,areaId,onAreaTab,onReview,
  onReviewFinding,onReviewIssue,onSend,canIssue}:{
  quote:Quote;page:Page;areaTab:AreaTab;areaId:string|null;
  onAreaTab:(tab:AreaTab)=>void;onReview:()=>void;
  onReviewFinding:(kind:'blockers'|'review'|'optional')=>void;
  onReviewIssue:(id:string)=>void;onSend:()=>void;canIssue:boolean;
}){
  const audit=auditQuoteDraft(quote);
  const area=quote.sections.find(s=>s.id===areaId);
  const editable=quoteIsCommerciallyEditable(quote);
  const areas=quote.sections.filter(s=>!isGeneralTakeoffSection(s));
  const totalSf=quote.sections.reduce((sum,section)=>sum+totalBillableTakeoffSf(section.scope?.takeoffPieces??[]),0);
  const assigned=new Set(quote.sections.map(s=>s.id));
  const generalLines=quote.lines.filter(line=>!line.sectionId||!assigned.has(line.sectionId));
  const generalCost=summarizeQuoteInternalPricing(generalLines);
  const projections=quote.sections.map(s=>projectAreaCost(quote,s));
  const knownCost=projections.reduce((sum,p)=>sum+p.totalKnownCost,0)+generalCost.knownInternalCost;
  const coverage=projections.every(p=>p.complete)&&generalCost.costRequiredLineCount===generalCost.costedLineCount;
  const customerTotal=quoteTotal(quote);
  const privateMargin=coverage&&customerTotal>0?(customerTotal-knownCost)/customerTotal*100:undefined;
  const sinkCount=areas.reduce((sum,s)=>
    sum+(s.scope?.takeoffSinks??[]).reduce((n,sink)=>n+sink.count,0),0);
  return (
    <aside className="qmb-desktop-inspector" aria-label="Live quote summary">
      <div className="qmb-desktop-inspector-heading">
        <span>LIVE ESTIMATE</span><span className="qmb-chip">{quote.status}</span>
      </div>
      <div className="qmb-desktop-grand-total">
        <small>Quote total</small><strong>{money.format(quoteTotal(quote))}</strong>
        <span>{quote.companyName||'Customer not selected'}</span>
      </div>
      <div className="qmb-desktop-stat-grid">
        <div><strong>{areas.length}</strong><small>Areas</small></div>
        <div><strong>{sf.format(totalSf)}</strong><small>Measured SF</small></div>
        <div><strong>{sinkCount}</strong><small>Sinks</small></div>
      </div>
      {area&&page==='area'&&<section className="qmb-desktop-active-area">
        <span>WORKING AREA</span><strong>{area.title||'Untitled Area'}</strong>
        <small>{money.format(quoteLinesTotal(quote.lines.filter(l=>l.sectionId===area.id)))}</small>
        <nav aria-label="Area workflow shortcuts">
          {([['measure','Measure'],['materials','Materials'],['calculator','Calculator']] as const)
            .map(([id,label])=><button key={id} type="button" aria-pressed={areaTab===id}
              onClick={()=>onAreaTab(id)}>{label}</button>)}
        </nav>
      </section>}
      {area&&page==='area'&&<button type="button" className="qmb-inspector-open-calculator"
        onClick={()=>onAreaTab('calculator')}>Open Calculator in workspace <span>›</span></button>}
      <details className="qmb-desktop-private-profit" aria-label="Private quote cost and margin">
        <summary>Private cost &amp; margin <span>{privateMargin===undefined?'Cost coverage needed':privateMargin.toFixed(1)+'% margin'}</span></summary>
        <div><span>Known buying cost</span><strong>{money.format(knownCost)}</strong></div>
        <div><span>Gross spread on known cost</span><strong>{money.format(customerTotal-knownCost)}</strong></div>
        <div><span>Gross margin</span><strong>{privateMargin!==undefined?privateMargin.toFixed(1)+'%':'Incomplete'}</strong></div>
        {!coverage&&<small>Complete supplier slab sizes, sink costs and other internal costs in each Area to finalize margin.</small>}
      </details>
      <section className="qmb-desktop-readiness" aria-label="Live quote review">
        <div className="qmb-inspector-review-heading">
          <strong>Review &amp; readiness</strong>
          <small>{audit.blockers.length?'Needs attention':'Live checked'}</small>
        </div>
        <div className="qmb-inspector-review-categories" aria-label="Review categories">
          {([['blockers','Resolve',audit.blockers.length],['review','Review',audit.review.length],['optional','Optional',audit.optional.length]] as const)
            .map(([kind,label,count])=><button type="button" key={kind}
              aria-label={'Open '+label.toLowerCase()+' items'} onClick={()=>onReviewFinding(kind)}>
              <strong>{count}</strong><span>{label}</span>
            </button>)}
        </div>
        <div className="qmb-inspector-finding-list" aria-label="Current quote findings">
          {!audit.findings.length&&<p className="qmb-inspector-no-issues">✓ No outstanding review findings. Customer delivery is ready to check.</p>}
          {audit.findings.slice(0,9).map(f=><button type="button" key={f.id}
            className={'qmb-inspector-finding is-'+f.severity}
            aria-label={'Resolve '+f.title} onClick={()=>onReviewIssue(f.id)}>
            <span className="qmb-inspector-finding-dot" aria-hidden="true">{f.severity==='blocker'?'!':f.severity==='review'?'•':'○'}</span>
            <span>{f.title}</span><span className="qmb-inspector-finding-chevron" aria-hidden="true">›</span>
          </button>)}
          {audit.findings.length>9&&<button type="button" className="qmb-inspector-more"
            onClick={onReview}>View all {audit.findings.length} findings ›</button>}
        </div>
      </section>
      <div className="qmb-inspector-send-block">
        <button type="button" className="qmb-inspector-send" onClick={onSend}
          aria-label="Send quote">{editable?'Send quote':'Share issued quote'} <span aria-hidden="true">›</span></button>
        <small>{!canIssue?'Your team role cannot issue quotes.':audit.blockers.length
          ?audit.blockers.length+' pricing blocker'+(audit.blockers.length===1?'':'s')+' must be resolved'
          :audit.review.length?'Review items before sending'
          :'Opens delivery options and customer sharing'}</small>
      </div>
    </aside>
  );
}
