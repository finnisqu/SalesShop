import type {Quote,QuoteSection} from '../types/quote';
import {QuoteBetaMaterials} from './QuoteBetaMaterials';
import {QuoteBetaDesktopPricing} from './QuoteBetaDesktopPricing';

/** One scrollable center workspace, one column. Selection precedes price inside
 * each category; Calculator is optional detailed costing, not a right-rail panel. */
export function QuoteBetaDesktopCommerce({quote,section,editable,tab}:{
  quote:Quote;section:QuoteSection;editable:boolean;tab:'materials'|'calculator';
}){
  if(tab==='calculator')return <div className="qmb-commerce-stack qmb-calculator-workspace" data-center-calculator="true">
    <header className="qmb-workspace-intro">
      <div className="qmb-kicker">ADVANCED ESTIMATING</div>
      <h2>Cost &amp; margin calculator</h2>
      <p>Private buying, fabrication and installation estimates. Changes here update the quote, but do not add charges or automatically change your selling method.</p>
    </header>
    <div className="qmb-calculator-main">
      <QuoteBetaDesktopPricing quote={quote} section={section} editable={editable} view="calculator"/>
    </div>
    <details className="qmb-calculator-source-editor">
      <summary>Edit material, selling prices and sink selections here</summary>
      <div className="qmb-calculator-source-stack">
        <section><h3>Material selection</h3>
          <QuoteBetaMaterials quote={quote} section={section} editable={editable} part="material" showHeading={false}/></section>
        <section><h3>Material selling price</h3>
          <QuoteBetaDesktopPricing quote={quote} section={section} editable={editable} view="selling"/></section>
        <section><h3>Sinks &amp; selling prices</h3>
          <QuoteBetaMaterials quote={quote} section={section} editable={editable} part="sinks" showHeading={false}/></section>
      </div>
    </details>
  </div>;
  return <div className="qmb-commerce-stack qmb-materials-commerce" aria-label="Area selections and pricing">
    <header className="qmb-workspace-intro"><div className="qmb-kicker">SELLING WORKSPACE</div>
      <h2>Selections &amp; pricing</h2>
      <p>Each section keeps its selection and selling price together. Internal buying and margin details live in Calculator.</p>
    </header>
    <section className="qmb-commerce-segment" aria-label="Material selection and pricing">
      <header className="qmb-commerce-heading"><h3>Material</h3>
        <span>01</span></header>
      <div className="qmb-commerce-stage">
        <div className="qmb-stage-heading"><b>Selection</b><small>Catalog material or custom description</small></div>
        <QuoteBetaMaterials quote={quote} section={section} editable={editable} part="material" showHeading={false}/>
      </div>
      <div className="qmb-commerce-stage is-pricing">
        <div className="qmb-stage-heading"><b>Pricing</b><small>Customer selling price</small></div>
        <QuoteBetaDesktopPricing quote={quote} section={section} editable={editable} view="selling"/>
      </div>
    </section>
    <section className="qmb-commerce-segment" aria-label="Sink selection and pricing">
      <header className="qmb-commerce-heading"><h3>Sinks</h3><span>02</span></header>
      <QuoteBetaMaterials quote={quote} section={section} editable={editable} part="sinks" showHeading={false}/>
    </section>
    <section className="qmb-commerce-segment" aria-label="Additional work and pricing">
      <header className="qmb-commerce-heading"><h3>Additional</h3><span>03</span></header>
      <QuoteBetaDesktopPricing quote={quote} section={section} editable={editable} view="extras"/>
    </section>
  </div>;
}
