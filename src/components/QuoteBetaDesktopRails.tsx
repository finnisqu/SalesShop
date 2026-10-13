import type {Quote} from '../types/quote';
import {quoteLinesTotal,quoteTotal,displayQuoteNumber} from '../types/quote';
import {auditQuoteDraft} from '../services/quoteDraftAudit';
import {totalBillableTakeoffSf} from '../services/quoteTakeoffsLite';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {QuoteBetaAreasMenu} from './QuoteBetaAreasMenu';

type QuoteTab='build'|'details'|'preview';
type AreaTab='measure'|'materials'|'pricing';
type Page='library'|'quote'|'area'|'review';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const sf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});

export function QuoteBetaDesktopRails({
  quote,page,quoteTab,areaTab,areaId,
  onLibrary,onQuoteTab,onArea,onAreaTab,onReview,onAddArea,onSelections,onReviewFinding,onReviewIssue,
}:{
  quote:Quote;page:Page;quoteTab:QuoteTab;areaTab:AreaTab;areaId:string|null;
  onLibrary:()=>void;onQuoteTab:(tab:QuoteTab)=>void;onArea:(id:string)=>void;
  onAreaTab:(tab:AreaTab)=>void;onReview:()=>void;onAddArea:()=>void;
  onSelections:()=>void;onReviewFinding:(kind:'blockers'|'review'|'optional')=>void;
  onReviewIssue:(id:string)=>void;
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
        <button type="button" className="qmb-desktop-selections-step" onClick={onSelections}>
          <span className="qmb-desktop-step-icon">◇</span> Job Selections
          {!!quote.projectMaterials?.length&&<small>{quote.projectMaterials.length}</small>}
        </button>
        <button type="button" onClick={onReview}>
          <span className="qmb-desktop-step-icon">✓</span> Review & issue
          {audit.blockers.length>0&&<span className="qmb-desktop-issue-count">{audit.blockers.length}</span>}
        </button>
      </nav>
      <div className="qmb-desktop-areas-head"><strong>Areas</strong>
        <QuoteBetaAreasMenu quote={quote}/>
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
        <div className="qmb-inspector-delivery">
          <strong>Customer delivery</strong>
          <small>{audit.blockers.length
            ?audit.blockers.length+' blocking issue'+(audit.blockers.length===1?'':'s')+' to resolve before sending'
            :'Check the customer document and issue or share the quote'}</small>
          <button type="button" onClick={onReview}>Open review &amp; delivery ›</button>
        </div>
      </section>
      <small className="qmb-desktop-autosaved">Review updates live as you edit. Internal pricing and measurements stay private.</small>
    </aside>
  </>;
}
