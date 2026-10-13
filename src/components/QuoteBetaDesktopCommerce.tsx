import type {Quote,QuoteSection} from '../types/quote';
import {QuoteBetaMaterials} from './QuoteBetaMaterials';
import {QuoteBetaDesktopPricing} from './QuoteBetaDesktopPricing';
import {QuoteBetaSinkSelling} from './QuoteBetaSinkSelling';

/** Desktop estimating follows the quote: material ↔ sell price, sinks ↔ sell
 * price, extra lines. Calculator keeps procurement/margin choices out of the
 * fast workflow while editing the same live quote and catalog selections. */
export function QuoteBetaDesktopCommerce({quote,section,editable,tab}:{
  quote:Quote;section:QuoteSection;editable:boolean;tab:'materials'|'calculator';
}){
  if(tab==='calculator')return <div className="qmb-commerce-stack qmb-calculator-workspace">
    <header className="qmb-commerce-heading">
      <div><h3>Calculator</h3><small>Internal buying costs, production and margin · optional</small></div>
    </header>
    <div className="qmb-calculator-main">
      <QuoteBetaDesktopPricing quote={quote} section={section} editable={editable} view="calculator"/>
    </div>
    <details className="qmb-calculator-source-editor" open>
      <summary>Adjust source material, selling price or sink pricing</summary>
      <div className="qmb-commerce-pair">
        <QuoteBetaMaterials quote={quote} section={section} editable={editable} part="material"/>
        <QuoteBetaDesktopPricing quote={quote} section={section} editable={editable} view="selling"/>
      </div>
      <div className="qmb-commerce-pair qmb-calculator-sink-pair">
        <QuoteBetaMaterials quote={quote} section={section} editable={editable} part="sinks" separateSinkPricing/>
        <QuoteBetaSinkSelling quote={quote} section={section} editable={editable} view="cost"/>
      </div>
    </details>
  </div>;
  return <div className="qmb-commerce-stack qmb-materials-commerce" aria-label="Materials and selling prices">
    <section className="qmb-commerce-segment" aria-label="Material and its selling price">
      <header className="qmb-commerce-heading"><div><h3>Material</h3>
        <small>Choose the material on the left, set its customer price on the right</small></div></header>
      <div className="qmb-commerce-pair">
        <QuoteBetaMaterials quote={quote} section={section} editable={editable} part="material"/>
        <QuoteBetaDesktopPricing quote={quote} section={section} editable={editable} view="selling"/>
      </div>
    </section>
    <section className="qmb-commerce-segment" aria-label="Sinks and their selling prices">
      <header className="qmb-commerce-heading"><div><h3>Sinks</h3>
        <small>Choose type and model beside quantity and selling price</small></div></header>
      <div className="qmb-commerce-pair qmb-commerce-sink-pair">
        <QuoteBetaMaterials quote={quote} section={section} editable={editable} part="sinks" separateSinkPricing/>
        <QuoteBetaSinkSelling quote={quote} section={section} editable={editable}/>
      </div>
    </section>
    <section className="qmb-commerce-segment" aria-label="Additional Area line items">
      <QuoteBetaDesktopPricing quote={quote} section={section} editable={editable} view="extras"/>
    </section>
  </div>;
}
