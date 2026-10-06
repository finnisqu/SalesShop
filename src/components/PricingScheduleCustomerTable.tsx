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
  return item.groupLabel || [item.planNumber?.trim(), item.planName?.trim()].filter(Boolean).join(' · ') || 'General pricing';
}

function priceText(item: PricingScheduleItem) {
  if (item.priceLabel) return item.priceLabel;
  if (item.customerPrice === undefined) return '—';
  return `${money.format(item.customerPrice)}${item.unitLabel ? ` ${item.unitLabel}` : ''}`;
}

function itemDetails(item: PricingScheduleItem) {
  const details = item.details?.length ? item.details : item.colors ?? [];
  if (!details.length) return <span>—</span>;
  if (item.detailsLayout === 'list') {
    return <ul className="pricing-rate-detail-list">{details.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}</ul>;
  }
  return <span>{details.join(' · ')}</span>;
}

function RateSheetTable({ items, compact }: PricingScheduleCustomerTableProps) {
  const groups = new Map<string, PricingScheduleItem[]>();
  items.forEach((item) => {
    const key = groupKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  return (
    <div className={`pricing-schedule-customer-table pricing-rate-customer-table ${compact ? 'is-compact' : ''}`}>
      {[...groups.entries()].map(([group, rows]) => (
        <section className="pricing-schedule-customer-group" key={group}>
          <header>{group}</header>
          <div className="pricing-rate-customer-head"><span>Item</span><span>Details</span><span>Price</span></div>
          {rows.map((item) => (
            <div className="pricing-rate-customer-row" key={`${item.sourceRow}-${item.description ?? ''}`}>
              <div>
                <strong>{item.description || '—'}</strong>
                {item.itemType && <small>{item.itemType}</small>}
              </div>
              <div className="pricing-rate-customer-details">{itemDetails(item)}</div>
              <strong>{priceText(item)}</strong>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export function PricingScheduleCustomerTable({ items, compact = false }: PricingScheduleCustomerTableProps) {
  if (!items.length) {
    return <div className="pricing-schedule-empty-customer">No customer pricing rows are mapped yet.</div>;
  }

  if (items.some((item) => item.displayType === 'rate-level' || item.displayType === 'rate-add-on')) {
    return <RateSheetTable items={items} compact={compact} />;
  }

  const groups = new Map<string, PricingScheduleItem[]>();
  items.forEach((item) => {
    const key = groupKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

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
              <strong>{priceText(item)}</strong>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
