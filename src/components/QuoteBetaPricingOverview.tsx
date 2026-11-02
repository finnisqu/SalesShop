import type { Quote } from '../types/quote';
import { quoteTotal } from '../types/quote';
import { auditQuoteDraft, type QuoteAuditDestination } from '../services/quoteDraftAudit';
import { quotePricingOverview } from '../services/quotePricingOverview';
import {projectAreaCost} from '../services/quoteAreaCost';
import './quote-beta-pricing-overview.css';

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
  const report=auditQuoteDraft(quote);
  const overview=quotePricingOverview(quote,report);
  const issueFor=(id:string)=>report.blockers.find(f=>f.destination.view==='area'&&f.destination.areaId===id)
    ??report.review.find(f=>f.destination.view==='area'&&f.destination.areaId===id);
  const incompleteCosts=overview.rows.filter(row=>row.measuredSf>0
    &&!projectAreaCost(quote,row.section).complete);
  const nextBlocker=overview.blockers[0];
  const nextAction=nextBlocker
    ?{label:'Resolve next pricing issue',detail:nextBlocker.title,
      go:()=>nextBlocker.id==='quote:work'?onGeneral():onResolve(nextBlocker.destination)}
    :incompleteCosts.length
      ?{label:'Check next internal estimate',
        detail:(incompleteCosts[0].section.title||'Untitled Area')+' · private costs are incomplete',
        go:()=>onArea(incompleteCosts[0].section.id,'calculator')}
      :{label:'Continue to Review',detail:'No blocking selling-price findings or missing measured Area costs.',
        go:onReview};
  return <div className="qmb-pricing-overview" aria-label="Quote-wide materials and pricing">
    <header className="qmb-pricing-overview-intro">
      <div className="qmb-kicker">STEP 3 · MATERIALS &amp; PRICING</div>
      <h2>Price the whole quote</h2>
      <p>See selections and selling prices for every Area. Open one to change material, sinks, add-ons or rates. You can work in any order.</p>
    </header>
    <div className="qmb-pricing-overview-summary">
      <div><small>Quote total</small><strong>{currency.format(quoteTotal(quote))}</strong></div>
      <div><small>Areas</small><strong>{overview.rows.length}</strong></div>
      <div><small>Pricing issues</small><strong>{overview.blockers.length}</strong></div>
      <div><small>Internal estimates</small><strong>{overview.rows.filter(row=>row.measuredSf>0).length-incompleteCosts.length}/{overview.rows.filter(row=>row.measuredSf>0).length}</strong></div>
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
    <div className="qmb-pricing-overview-areas">
      {overview.rows.map(row=>{
        const issue=issueFor(row.section.id);
        // This is private estimating guidance, NOT a quote issuing requirement.
        // No slab/production estimate is implied for an unmeasured flat-fee Area.
        const cost=row.measuredSf>0?projectAreaCost(quote,row.section):null;
        const covered=cost?Object.values(cost.costCoverage).filter(Boolean).length:0;
        return <section className="qmb-pricing-overview-row" key={row.section.id} aria-label={row.section.title||'Untitled Area'}>
          <div className="qmb-pricing-overview-row-top">
            <div><h4>{row.section.title||'Untitled Area'}</h4>
              <span>{row.material} · {sf.format(row.measuredSf)} SF · {row.sinkCount} {row.sinkCount===1?'sink':'sinks'}</span>
            </div>
            <strong>{currency.format(row.amount)}</strong>
          </div>
          {cost&&<div className="qmb-pricing-overview-cost" aria-label="Private Area cost coverage">
            <span>Private cost estimate · {covered}/5 categories entered
              {cost.marginPercent!==undefined?' · Estimated margin '+cost.marginPercent.toFixed(1)+'%':' · Margin incomplete'}
              {!cost.complete?' · Missing: '+cost.missingCostItems.join(', '):''}
            </span>
            <button type="button" onClick={()=>onArea(row.section.id,'calculator')}>
              Open Calculator ›
            </button>
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
      {!overview.rows.length&&<div className="qmb-pricing-overview-empty">
        <strong>No Areas yet</strong>
        <p>Flat-fee quotes can use General charges only. Add an Area when you need measurements or a separate scope.</p>
        <button type="button" onClick={onGeneral}>Go to Areas &amp; General ›</button>
      </div>}
    </div>
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
