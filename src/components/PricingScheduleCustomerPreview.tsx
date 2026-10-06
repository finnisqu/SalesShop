import { commercialDocumentLabel, displayQuoteNumber, type Quote } from '../types/quote';
import { PricingScheduleCustomerTable } from './PricingScheduleCustomerTable';
import '../pricing-schedule.css';

export function PricingScheduleCustomerPreview({ quote }: { quote: Quote }) {
  const documentLabel = commercialDocumentLabel(quote);
  const items = quote.pricingSchedule?.customerItems ?? [];

  return (
    <article className="customer-quote-paper pricing-schedule-customer-preview">
      <header className="customer-quote-letterhead">
        <div>
          <span className="customer-company-placeholder">YOUR COMPANY</span>
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
          <span>Project</span>
          <strong>{quote.title}</strong>
          {quote.revisionLabel && <p>{quote.revisionLabel}</p>}
        </div>
      </section>

      <div className="pricing-schedule-contract-intro">
        <strong>Contract pricing schedule</strong>
        <p>Pricing below applies to the listed plans, options, and configurations. Internal estimating and takeoff details are not included in this customer copy.</p>
      </div>

      <PricingScheduleCustomerTable items={items} />
      {quote.customerNotes && <div className="customer-quote-notes"><strong>Notes</strong><p>{quote.customerNotes}</p></div>}
      <footer>{quote.status === 'Signed' ? 'Accepted electronically with SalesShop.' : 'Prepared with SalesShop · Electronic acceptance applies to this pricing schedule.'}</footer>
    </article>
  );
}
