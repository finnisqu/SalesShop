import {lazy,Suspense} from 'react';
import type {Quote} from '../types/quote';
import {salesDocumentTemplate,salesTemplateLabel} from '../services/salesDocumentTemplates';

// Each template owns its own editor. Heavy spreadsheet code loads only for
// documents created as Custom Spreadsheet (or old workbook documents).
const BuilderRates=lazy(()=>import('./PricingRateSheet').then(m=>({default:m.PricingRateSheet})));
const Community=lazy(()=>import('./PricingScheduleBuilder').then(m=>({default:m.PricingScheduleBuilder})));
const Spreadsheet=lazy(()=>import('./PricingScheduleWorkbook').then(m=>({default:m.PricingScheduleWorkbook})));

export function PricingDocumentEditor({quote}:{quote:Quote}){
  const template=salesDocumentTemplate(quote);
  return <section className={'sales-document-editor sales-document-editor--'+template}
    aria-label={salesTemplateLabel(template)+' editor'}>
    <Suspense fallback={<div className="pricing-builder-empty">Opening {salesTemplateLabel(template)}…</div>}>
      {template==='builder-rates'?<BuilderRates quote={quote}/>:
        template==='community-pricing'?<Community quote={quote}/>:
        template==='spreadsheet'?<Spreadsheet quote={quote}/>:
        <p>Quick Quotes are edited in the standard quote workspace.</p>}
    </Suspense>
  </section>;
}
