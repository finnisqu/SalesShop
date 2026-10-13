import type {Quote} from '../types/quote';
import {quoteLinesTotal,quoteTotal,displayQuoteNumber} from '../types/quote';
import {auditQuoteDraft} from '../services/quoteDraftAudit';
import {totalBillableTakeoffSf} from '../services/quoteTakeoffsLite';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';

type QuoteTab='build'|'details'|'preview';
type AreaTab='measure'|'materials'|'pricing';
type Page='library'|'quote'|'area'|'review';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const sf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});

export function QuoteBetaDesktopRails({
  quote,page,quoteTab,areaTab,areaId,
  onLibrary,onQuoteTab,onArea,onAreaTab,onReview,onAddArea,onSelections,onUndo,onRedo,
  undoDepth,redoDepth,
}:{
  quote:Quote;page:Page;quoteTab:QuoteTab;areaTab:AreaTab;areaId:string|null;
  onLibrary:()=>void;onQuoteTab:(tab:QuoteTab)=>void;onArea:(id:string)=>void;
  onAreaTab:(tab:AreaTab)=>void;onReview:()=>void;onAddArea:()=>void;
  onSelections:()=>void;onUndo:()=>void;onRedo:()=>void;
  undoDepth:number;redoDepth:number;
}){
  const audit=auditQuoteDraft(quote);
  const area=quote.sections.find(s=>s.id===areaId);
  const editable=quoteIsCommerciallyEditable(quote);
  const totalSf=quote.sections.reduce((sum,section)=>
    sum+totalBillableTakeoffSf(section.scope?.takeoffPieces??[]),0);
  const sinkCount=quote.sections.reduce((sum,s)=>
    sum+(s.scope?.takeoffSinks??[]).reduce((n,sink)=>n+sink.count,0),0);
  const steps=[['build','Build quote'],['details','Customer & project'],['preview','Customer preview']] as const;
  const areas=quote.sections;
  return <>
    <aside className="qmb-desktop-navigation" aria-label="Quote workspace navigation">
      <div className="qmb-desktop-rail-head">
        <button type="button" className="qmb-desktop-library-link" onClick={onLibrary}>‹ All quotes</button>
        <strong>Quotes <span>Beta</span></strong>
        <small>{displayQuoteNumber(quote)} · {quote.status}</small>
      </div>
      <nav className="qmb-desktop-mainsteps" aria-label="Quote workflow">
        {steps.map(([id,label])=><button type="button" key={id}
          className={page==='quote'&&quoteTab===id?'is-active':''}
          aria-current={page==='quote'&&quoteTab===id?'page':undefined}
          onClick={()=>onQuoteTab(id)}>
          <span className="qmb-desktop-step-icon">{id==='build'?'▤':id==='details'?'♙':'▧'}</span>
          {label}
        </button>)}
        <button type="button" className={page==='review'?'is-active':''}
          aria-current={page==='review'?'page':undefined} onClick={onReview}>
          <span className="qmb-desktop-step-icon">✓</span> Review & issue
          {audit.blockers.length>0&&<span className="qmb-desktop-issue-count">{audit.blockers.length}</span>}
        </button>
      </nav>
      <div className="qmb-desktop-areas-head"><strong>Areas</strong>
        <button type="button" disabled={!editable||quote.documentType==='pricing-schedule'}
          onClick={onAddArea} aria-label="Add Area from navigator">+ Add</button>
      </div>
      <nav className="qmb-desktop-area-list" aria-label="Quote Areas">
        {areas.map(section=>{
          const active=page==='area'&&section.id===areaId;
          const lines=quote.lines.filter(l=>l.sectionId===section.id);
          return <button type="button" key={section.id} className={active?'is-active':''}
            aria-current={active?'page':undefined} onClick={()=>onArea(section.id)}>
            <span className="qmb-desktop-area-dot">▤</span>
            <span className="qmb-desktop-area-title">
              <strong>{section.title.trim().toLowerCase()==='general takeoffs'?'General':section.title||'Untitled Area'}</strong>
              <small>{sf.format(section.scope?.countertopSf??0)} SF</small>
            </span>
            <span className="qmb-desktop-area-value">{money.format(quoteLinesTotal(lines))}</span>
          </button>;
        })}
        {!areas.length&&<p className="qmb-desktop-empty">Add an Area to begin measuring and pricing.</p>}
      </nav>
      <div className="qmb-desktop-rail-bottom">
        <button type="button" className="qmb-outline" onClick={onSelections}>◇ Job selections</button>
        <div className="qmb-desktop-undo">
          <button type="button" onClick={onUndo} disabled={!editable||!undoDepth} aria-label="Undo quote change">↶ Undo</button>
          <button type="button" onClick={onRedo} disabled={!editable||!redoDepth} aria-label="Redo quote change">↷ Redo</button>
        </div>
      </div>
    </aside>
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
          {([['measure','Measure'],['materials','Materials'],['pricing','Pricing']] as const)
            .map(([id,label])=><button key={id} type="button" aria-pressed={areaTab===id}
              onClick={()=>onAreaTab(id)}>{label}</button>)}
        </nav>
      </section>}
      <section className="qmb-desktop-readiness">
        <strong>Quote readiness</strong>
        <div className="qmb-desktop-review-row"><span>Pricing to resolve</span>
          <b className={audit.blockers.length?'is-warning':''}>{audit.blockers.length}</b></div>
        <div className="qmb-desktop-review-row"><span>Review items</span><b>{audit.review.length}</b></div>
        <div className="qmb-desktop-review-row"><span>Optional details</span><b>{audit.optional.length}</b></div>
        {!audit.findings.length&&<small className="qmb-desktop-ready">✓ No audit findings</small>}
      </section>
      <div className="qmb-desktop-inspector-actions">
        <button type="button" className="qmb-outline" onClick={()=>onQuoteTab('preview')}>View customer quote ↗</button>
        <button type="button" className="qmb-primary" onClick={onReview}>
          Review & issue {audit.blockers.length?'· '+audit.blockers.length+' to resolve':'›'}
        </button>
      </div>
      <small className="qmb-desktop-autosaved">Changes save automatically. Internal costs and measurements stay out of the customer document.</small>
    </aside>
  </>;
}
