import { commercialDocumentLabel, displayQuoteNumber, type Quote } from '../types/quote';
import { CustomerDocumentBrand } from './CustomerDocumentBrand';
import { PricingScheduleCustomerTable } from './PricingScheduleCustomerTable';
import '../pricing-schedule.css';

export function PricingScheduleCustomerPreview({ quote }: { quote: Quote }) {
  const documentLabel = commercialDocumentLabel(quote);
  const items = quote.pricingSchedule?.customerItems ?? [];
  const rateSheet = items.some((item) => item.displayType === 'rate-level' || item.displayType === 'rate-add-on');

  return (
    <article className="customer-quote-paper pricing-schedule-customer-preview">
      <header className="customer-quote-letterhead">
        <div>
          <CustomerDocumentBrand />
          <strong>{documentLabel.toUpperCase()}</strong>
        </div>
        <dl>
          <div><dt>Document</dt><dd>{displayQuoteNumber(quote)}</dd></div>
          <div><dt>Date</dt><dd>{quote.quoteDate}</dd></div>
        </dl>
      </header>

      <section className="customer-quote-recipient">
        <div>
          <span>Prepared for</span>
          <strong>{quote.companyName || quote.contactName || 'Customer'}</strong>
          {quote.contactName && quote.companyName && <p>{quote.contactName}</p>}
          {quote.address && <p>{quote.address}</p>}
        </div>
        <div>
          <span>Project / account</span>
          <strong>{quote.title}</strong>
          {quote.revisionLabel && <p>{quote.revisionLabel}</p>}
        </div>
      </section>

      <div className="pricing-schedule-contract-intro">
        <strong>{rateSheet ? 'Builder rate sheet' : 'Contract pricing schedule'}</strong>
        <p>{rateSheet
          ? 'Pricing below establishes the material levels, approved selections, sinks, and recurring add-on rates for this account.'
          : 'Pricing below applies to the listed plans, options, and configurations. Internal estimating and takeoff details are not included in this customer copy.'}</p>
      </div>

      <PricingScheduleCustomerTable items={items} />
      {quote.customerNotes && <div className="customer-quote-notes"><strong>Notes</strong><p>{quote.customerNotes}</p></div>}
      <footer>{quote.status === 'Signed' ? 'Accepted electronically with SalesShop.' : 'Prepared with SalesShop · Electronic acceptance applies to this pricing schedule.'}</footer>
    </article>
  );
}
