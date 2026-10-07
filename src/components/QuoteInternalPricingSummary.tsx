import { summarizeQuoteInternalPricing } from '../services/quoteInternalPricing';
import type { Quote, QuoteLine } from '../types/quote';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function PricingMetrics({ lines, compact = false }: { lines: QuoteLine[]; compact?: boolean }) {
  const summary = summarizeQuoteInternalPricing(lines);
  const missing = Math.max(0, summary.costRequiredLineCount - summary.costedLineCount);

  return (
    <div className={compact ? 'quote-internal-area-metrics' : 'quote-internal-pricing-metrics'}>
      <div>
        <span>Customer</span>
        <strong>{money.format(summary.customerTotal)}</strong>
      </div>
      <div>
        <span>Known cost</span>
        <strong>{money.format(summary.knownInternalCost)}</strong>
      </div>
      <div>
        <span>{summary.complete ? 'Gross profit' : 'Known spread'}</span>
        <strong>{money.format(summary.grossSpread)}</strong>
      </div>
      <div>
        <span>{summary.complete && summary.marginPercent !== undefined ? 'Gross margin' : 'Cost coverage'}</span>
        <strong>{summary.complete && summary.marginPercent !== undefined
          ? `${summary.marginPercent}%`
          : summary.costRequiredLineCount
            ? `${summary.costedLineCount}/${summary.costRequiredLineCount}`
            : '—'}</strong>
      </div>
      {!compact && missing > 0 && (
        <small className="quote-internal-pricing-warning">
          {missing} priced scope line{missing === 1 ? '' : 's'} still {missing === 1 ? 'needs' : 'need'} an internal cost before SalesShop shows a gross-margin percentage.
        </small>
      )}
    </div>
  );
}

export function QuoteInternalPricingSummary({ quote }: { quote: Quote }) {
  const validAreaIds = new Set(quote.sections.map((section) => section.id));
  const generalLines = quote.lines.filter((line) => !line.sectionId || !validAreaIds.has(line.sectionId));
  const groups = [
    ...(generalLines.length ? [{ id: 'general', title: 'General', lines: generalLines }] : []),
    ...quote.sections
      .map((section) => ({
        id: section.id,
        title: section.title || 'Untitled area',
        lines: quote.lines.filter((line) => line.sectionId === section.id),
      }))
      .filter((group) => group.lines.length),
  ];
  const overall = summarizeQuoteInternalPricing(quote.lines);
  const trackedCosts = overall.lines.some((line) => line.internalCost !== undefined || line.requiresCost);

  if (!trackedCosts) return null;

  return (
    <section className="quote-internal-pricing" aria-label="Internal pricing summary">
      <header>
        <div>
          <span className="quote-control-heading">Internal pricing · private</span>
          <small>Uses the frozen Material and Rate Book cost snapshots on this quote. Customer pricing is unchanged.</small>
        </div>
        <span className="quote-internal-private-badge">Not customer visible</span>
      </header>
      <PricingMetrics lines={quote.lines} />
      {groups.length > 1 && (
        <div className="quote-internal-area-list">
          {groups.map((group) => (
            <div className="quote-internal-area-row" key={group.id}>
              <div>
                <strong>{group.title}</strong>
                <small>{group.lines.length} line{group.lines.length === 1 ? '' : 's'}</small>
              </div>
              <PricingMetrics lines={group.lines} compact />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
