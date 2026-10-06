import type { PricingScheduleItem } from '../types/quote';

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

interface PricingScheduleCustomerTableProps {
  items: PricingScheduleItem[];
  compact?: boolean;
}

function groupKey(item: PricingScheduleItem) {
  return [item.planNumber?.trim(), item.planName?.trim()].filter(Boolean).join(' · ') || 'General pricing';
}

export function PricingScheduleCustomerTable({ items, compact = false }: PricingScheduleCustomerTableProps) {
  const groups = new Map<string, PricingScheduleItem[]>();
  items.forEach((item) => {
    const key = groupKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  if (!items.length) {
    return <div className="pricing-schedule-empty-customer">No customer pricing rows are mapped yet.</div>;
  }

  return (
    <div className={`pricing-schedule-customer-table ${compact ? 'is-compact' : ''}`}>
      {[...groups.entries()].map(([group, rows]) => (
        <section className="pricing-schedule-customer-group" key={group}>
          <header>{group}</header>
          <div className="pricing-schedule-customer-head">
            <span>Series</span>
            <span>Type</span>
            <span>Option</span>
            <span>Description</span>
            <span>Price</span>
          </div>
          {rows.map((item) => (
            <div className="pricing-schedule-customer-row" key={`${item.sourceRow}-${item.optionCode ?? ''}-${item.description ?? ''}`}>
              <span>{item.series || '—'}</span>
              <span>{item.itemType || '—'}</span>
              <span>{item.optionCode || '—'}</span>
              <span>{item.description || item.planName || '—'}</span>
              <strong>{item.customerPrice === undefined ? '—' : money.format(item.customerPrice)}</strong>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
