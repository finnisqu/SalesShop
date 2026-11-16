import {useMemo,useState} from 'react';
import type { Quote } from '../types/quote';
import { quoteTotal } from '../types/quote';
import { auditQuoteDraft, type QuoteAuditDestination } from '../services/quoteDraftAudit';
import { quotePricingOverview } from '../services/quotePricingOverview';
import {projectAreaCost} from '../services/quoteAreaCost';
import {pricingAreaMarginLabel,pricingAreaMatches,nextInternalCostTab,type PricingAreaFilter} from '../services/quotePricingGuidance353e';
import './quote-beta-pricing-overview.css';
import './quote-pricing-table-polish.css';
import {QuoteSharedSlabPools} from './QuoteSharedSlabPools';

const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const sf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
type AreaTab='measure'|'materials'|'pricing'|'calculator';

/** Quote-wide overview; actual prices and selections stay in Area editors. */
export function QuoteBetaPricingOverview({quote,onArea,onGeneral,onResolve,onReview}:{
  quote: Quote;
  onArea:(areaId:string,tab:AreaTab)=>void;
  onGeneral:()=>void;
  onResolve:(destination:QuoteAuditDestination)=>void;
  onReview:()=>void;
}) {
  const [areaFilter,setAreaFilter]=useState<PricingAreaFilter>('all');
  const report=useMemo(()=>auditQuoteDraft(quote),[quote]);
  const overview=useMemo(()=>quotePricingOverview(quote,report),[quote,report]);
  // Area issue order remains blockers-first, matching the previous find().
  const issueByArea=useMemo(()=>{
    const index=new Map<string,(typeof report.blockers)[number]>();
    for(const finding of [...report.blockers,...report.review]){
      if(finding.destination.view!=='area'||!finding.destination.areaId||
        index.has(finding.destination.areaId))continue;
      index.set(finding.destination.areaId,finding);
    }
    return index;
  },[report]);
  const issueFor=(id:string)=>issueByArea.get(id);
  const measuredRows=useMemo(()=>overview.rows.filter(row=>row.measuredSf>0),[overview]);
  const costsByArea=useMemo(()=>new Map(measuredRows.map(row=>
    [row.section.id,projectAreaCost(quote,row.section)] as const)),[quote,measuredRows]);
  const incompleteCosts=useMemo(()=>measuredRows.filter(row=>
    !costsByArea.get(row.section.id)?.complete),[measuredRows,costsByArea]);
  const total=useMemo(()=>quoteTotal(quote),[quote]);
  const areaStatus=(row:(typeof overview.rows)[number])=>({
    blockers:row.blockers,measuredSf:row.measuredSf,
    costComplete:row.measuredSf>0?costsByArea.get(row.section.id)?.complete:false,
  });
  const counts={
    all:overview.rows.length,
    selling:overview.rows.filter(row=>pricingAreaMatches('selling',areaStatus(row))).length,
    cost:overview.rows.filter(row=>pricingAreaMatches('cost',areaStatus(row))).length,
    ready:overview.rows.filter(row=>pricingAreaMatches('ready',areaStatus(row))).length,
  };
  const filteredRows=overview.rows.filter(row=>pricingAreaMatches(areaFilter,areaStatus(row)));
  const firstCost=incompleteCosts[0]&&costsByArea.get(incompleteCosts[0].section.id);
  const nextBlocker=overview.blockers[0];
  const nextAction=nextBlocker
    ?{label:'Resolve next pricing issue',detail:nextBlocker.title,
      go:()=>nextBlocker.id==='quote:work'?onGeneral():onResolve(nextBlocker.destination)}
    :incompleteCosts.length
      ?{label:'Check next internal estimate',
        detail:(incompleteCosts[0].section.title||'Untitled Area')+' · '+(firstCost?.missingCostItems.join(', ')||'private costs are incomplete'),
        go:()=>onArea(incompleteCosts[0].section.id,firstCost?nextInternalCostTab(firstCost):'calculator')}
      :{label:'Continue to Review',detail:'No blocking selling-price findings or missing measured Area costs.',
        go:onReview};
  return <div className="qmb-pricing-overview" aria-label="Quote-wide materials and pricing">
    <header className="qmb-pricing-overview-intro">
      <div className="qmb-kicker">STEP 4 · PRICING REVIEW</div>
      <h2>Review quote pricing</h2>
      <p>Review buying-cost coverage, selling prices and pricing findings across all Areas. Edit everyday line items in Takeoffs, or open Calculator for advanced pricing.</p>
    </header>
    <div className="qmb-pricing-overview-summary">
      <div><small>Quote total</small><strong>{currency.format(total)}</strong></div>
      <div><small>Areas</small><strong>{overview.rows.length}</strong></div>
      <div><small>Pricing issues</small><strong>{overview.blockers.length}</strong></div>
      <div><small>Internal estimates</small><strong>{measuredRows.length-incompleteCosts.length}/{measuredRows.length}</strong></div>
    </div>
    <div className="qmb-pricing-overview-next" aria-label="Next quote pricing action">
      <div><strong>{nextAction.label}</strong><small>{nextAction.detail}</small></div>
      <button type="button" onClick={nextAction.go}>Continue ›</button>
    </div>
    {overview.blockers.length?<section className="qmb-pricing-overview-alert" aria-label="Pricing issues">
      <strong>{overview.blockers.length} pricing {overview.blockers.length===1?'issue':'issues'} to resolve</strong>
      <p>These are the same issues that appear at Review. Draft editing remains unrestricted.</p>
      <div className="qmb-pricing-overview-issue-list" aria-label="Resolve pricing items">
        {overview.blockers.slice(0,6).map(f=><button type="button" key={f.id}
          onClick={()=>f.id==='quote:work'?onGeneral():onResolve(f.destination)}>
          <span>{f.title}</span><strong>Resolve ›</strong>
        </button>)}
        {overview.blockers.length>6&&<button type="button" onClick={onReview}>
          <span>{overview.blockers.length-6} more pricing issues</span><strong>View in Review ›</strong>
        </button>}
      </div>
    </section>:<p className="qmb-pricing-overview-ok">{report.pricedLineCount
      ?'✓ No blocking pricing findings. Review the customer-facing details when ready.'
      :'No priced work yet. Add a General charge or an Area.'}</p>}
    <div className="qmb-pricing-overview-title"><h3>Area selections &amp; selling prices</h3>
      <small>{overview.rows.length?'Open any Area to edit':'Areas are optional for simple quotes'}</small></div>
    {overview.rows.length>0&&<div className="qmb-pricing-overview-filters"
      role="group" aria-label="Filter quote Areas by pricing readiness">
      {([['all','All Areas'],['selling','Needs sell price'],['cost','Missing internal costs'],
        ['ready','Ready for review']] as const).map(([id,label])=>
        <button type="button" key={id} aria-pressed={areaFilter===id}
          className={areaFilter===id?'is-active':''} onClick={()=>setAreaFilter(id)}>
          {label} <span>{counts[id]}</span>
        </button>)}
    </div>}
    <div className="qmb-pricing-overview-areas qmb-pricing-table">
      <div className="qmb-pricing-table-head" aria-hidden="true">
        <span>Area</span><span>Material / scope</span><span>Sell total</span>
      </div>
      {filteredRows.map(row=>{
        const issue=issueFor(row.section.id);
        // This is private estimating guidance, NOT a quote issuing requirement.
        // No slab/production estimate is implied for an unmeasured flat-fee Area.
        const cost=row.measuredSf>0?costsByArea.get(row.section.id)??null:null;
        const covered=cost?Object.values(cost.costCoverage).filter(Boolean).length:0;
        return <section className="qmb-pricing-overview-row" key={row.section.id} aria-label={row.section.title||'Untitled Area'}>
          <div className="qmb-pricing-overview-row-top">
            <h4>{row.section.title||'Untitled Area'}</h4>
            <span>{row.material} · {sf.format(row.measuredSf)} SF · {row.sinkCount} {row.sinkCount===1?'sink':'sinks'}</span>
            <strong>{currency.format(row.amount)}</strong>
          </div>
          {cost&&<div className="qmb-pricing-overview-cost" aria-label="Private Area cost coverage">
            <span>Private cost estimate · {covered}/5 categories entered
              {' · '+pricingAreaMarginLabel(cost)}
              {!cost.complete?' · Missing: '+cost.missingCostItems.join(', '):''}
            </span>
            <div className="qmb-pricing-overview-cost-actions">
              {cost&&!cost.complete&&<button type="button" className="is-priority"
                onClick={()=>onArea(row.section.id,nextInternalCostTab(cost))}>
                {nextInternalCostTab(cost)==='materials'?'Check material/sink costs ›':'Complete missing costs ›'}
              </button>}
              <button type="button" onClick={()=>onArea(row.section.id,'calculator')}>
                Open Calculator ›
              </button>
            </div>
          </div>}
          <div className="qmb-pricing-overview-row-actions">
            <button type="button" onClick={()=>onArea(row.section.id,'measure')}>Measurements ›</button>
            <button type="button" onClick={()=>onArea(row.section.id,'materials')}>Material &amp; sinks ›</button>
            <button type="button" onClick={()=>onArea(row.section.id,'pricing')}>Selling price ›</button>
            {issue&&<button type="button" className={row.blockers?'is-attention':''}
              onClick={()=>onResolve(issue.destination)}>
              {row.blockers?row.blockers+' to resolve':row.reviewItems+' to review'} ›
            </button>}
          </div>
        </section>;
      })}
      {overview.rows.length>0&&!filteredRows.length&&<div className="qmb-pricing-overview-empty">
        <strong>No Areas match this filter</strong>
        <p>Try another pricing state or return to the full Area list.</p>
        <button type="button" onClick={()=>setAreaFilter('all')}>Show all Areas ›</button>
      </div>}
      {!overview.rows.length&&<div className="qmb-pricing-overview-empty">
        <strong>No Areas yet</strong>
        <p>Flat-fee quotes can use General charges only. Add an Area when you need measurements or a separate scope.</p>
        <button type="button" onClick={onGeneral}>Go to Areas &amp; General ›</button>
      </div>}
    </div>
    <QuoteSharedSlabPools quote={quote}/>
    <section className="qmb-pricing-overview-general" aria-label="General quote charges">
      <div><h3>General charges</h3>
        <p>Trip charges, discounts, fees and work that doesn't belong to one Area.</p></div>
      <strong>{currency.format(overview.generalAmount)}</strong>
      <span>{overview.generalLineCount} {overview.generalLineCount===1?'line':'lines'}</span>
      <button type="button" onClick={onGeneral}>Edit General charges ›</button>
    </section>
    {overview.reviewItems.length>0&&<p className="qmb-pricing-overview-note">
      {overview.reviewItems.length} non-blocking {overview.reviewItems.length===1?'item':'items'} to check in Review.
    </p>}
    <button type="button" className="qmb-primary qmb-pricing-overview-review" onClick={onReview}>Review quote ›</button>
  </div>;
}
