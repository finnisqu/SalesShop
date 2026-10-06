import { useMemo } from 'react';
import {
  createPricingRateItem,
  createPricingScheduleBuilderData,
  deriveRateSheetCustomerItems,
  rateItemPriceLabel,
  rateSheetHealth,
} from '../services/pricingScheduleBuilder';
import { useQuoteStore } from '../store/quoteStore';
import {
  PRICING_BUILDER_PRODUCT_TYPES,
  type PricingBuilderProductType,
  type PricingMaterialType,
  type PricingRateItem,
  type PricingRatePriceMode,
  type PricingScheduleBuilderData,
  type Quote,
} from '../types/quote';
import { PricingScheduleCustomerTable } from './PricingScheduleCustomerTable';

const MATERIAL_TYPES: PricingMaterialType[] = ['Granite', 'Quartz', 'Marble', 'Quartzite', 'Other'];
const PRICE_MODES: Array<{ value: PricingRatePriceMode; label: string }> = [
  { value: 'priced', label: 'Priced' },
  { value: 'included', label: 'Included' },
  { value: 'no-charge', label: 'NC' },
  { value: 'tbd', label: 'TBD / quote separately' },
];

function numberValue(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function builderFor(quote: Quote) {
  return quote.pricingSchedule?.builder ?? createPricingScheduleBuilderData();
}

function priceDisplay(rate: PricingRateItem) {
  const label = rateItemPriceLabel(rate);
  if (label) return label;
  if (rate.rate === undefined) return 'No price';
  if (rate.unit === 'sf') return `$${rate.rate.toFixed(2)} / SF`;
  if (rate.unit === 'each') return `$${rate.rate.toFixed(2)} / EA`;
  return `$${rate.rate.toFixed(2)} flat`;
}

export function PricingRateSheet({ quote }: { quote: Quote }) {
  const updateQuote = useQuoteStore((state) => state.updateQuote);
  const builder = builderFor(quote);
  const materials = builder.rates.filter((rate) => rate.kind === 'material-level');
  const addOns = builder.rates.filter((rate) => rate.kind !== 'material-level');
  const warnings = useMemo(() => rateSheetHealth(builder), [builder]);

  const saveBuilder = (next: PricingScheduleBuilderData) => {
    updateQuote(quote.id, {
      pricingSchedule: {
        ...quote.pricingSchedule,
        route: 'rate-sheet',
        publishSource: 'rate-sheet',
        builder: next,
        customerItems: deriveRateSheetCustomerItems(next),
      },
    });
  };

  const updateRate = (id: string, patch: Partial<PricingRateItem>) => saveBuilder({
    ...builder,
    rates: builder.rates.map((rate) => rate.id === id ? { ...rate, ...patch } : rate),
  });

  const removeRate = (id: string) => saveBuilder({ ...builder, rates: builder.rates.filter((rate) => rate.id !== id) });

  const addMaterialLevel = () => {
    const rate = createPricingRateItem('Countertops', 'material-level');
    rate.materialType = 'Granite';
    rate.level = `Level ${materials.length + 1}`;
    rate.name = `${rate.level} Granite`;
    rate.unit = 'sf';
    saveBuilder({ ...builder, rates: [...builder.rates, rate] });
  };

  const addAddOn = () => {
    const rate = createPricingRateItem('Kitchen Sink', 'add-on');
    rate.name = 'Standard Kitchen Sink';
    rate.unit = 'each';
    saveBuilder({ ...builder, rates: [...builder.rates, rate] });
  };

  return (
    <div className="pricing-rate-sheet">
      <header className="pricing-builder-header">
        <div>
          <span className="quote-control-heading">Simple Rate Sheet</span>
          <small>Material levels + approved colors + sinks and add-ons. No plan takeoffs required.</small>
        </div>
        <div className="pricing-builder-header-meta">
          <span>{materials.length} material levels</span>
          <span>{addOns.length} add-ons</span>
          <strong>Published source</strong>
        </div>
      </header>

      <section className="pricing-builder-panel rate-book-name-panel">
        <label className="pricing-builder-name-field">
          <span>Rate Book name</span>
          <input value={builder.rateBookName} onChange={(event) => saveBuilder({ ...builder, rateBookName: event.target.value })} placeholder="DeVane Builders 2026" />
        </label>
        <small>This same Rate Book can be reused by the Plan Builder route if this account later needs plan-level pricing.</small>
      </section>

      <section className="pricing-builder-panel">
        <header className="pricing-builder-panel-heading">
          <div><strong>Material levels</strong><small>Group approved colors under a level and publish one contractual rate for the group.</small></div>
          <button type="button" onClick={addMaterialLevel}>+ Material level</button>
        </header>
        <div className="pricing-rate-level-list">
          {materials.map((rate) => (
            <article className="pricing-rate-level-card" key={rate.id}>
              <div className="pricing-rate-level-main">
                <label><span>Material</span><select value={rate.materialType ?? 'Granite'} onChange={(event) => updateRate(rate.id, { materialType: event.target.value as PricingMaterialType })}>{MATERIAL_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>Level</span><input value={rate.level ?? ''} onChange={(event) => updateRate(rate.id, { level: event.target.value })} placeholder="Level 1" /></label>
                <label className="wide"><span>Customer label</span><input value={rate.name} onChange={(event) => updateRate(rate.id, { name: event.target.value })} placeholder="Level 1 Granite" /></label>
                <label><span>Price state</span><select value={rate.priceMode ?? 'priced'} onChange={(event) => updateRate(rate.id, { priceMode: event.target.value as PricingRatePriceMode })}>{PRICE_MODES.map((mode) => <option value={mode.value} key={mode.value}>{mode.label}</option>)}</select></label>
                <label><span>Unit</span><select value={rate.unit} onChange={(event) => updateRate(rate.id, { unit: event.target.value as PricingRateItem['unit'] })}><option value="sf">SF</option><option value="each">Each</option><option value="flat">Flat</option></select></label>
                <label><span>Rate</span><div className="quote-money-input"><span>$</span><input type="number" step="0.01" disabled={(rate.priceMode ?? 'priced') !== 'priced'} value={rate.rate ?? ''} onChange={(event) => updateRate(rate.id, { rate: numberValue(event.target.value) })} /></div></label>
              </div>
              <label className="pricing-rate-colors"><span>Approved colors</span><textarea rows={3} value={(rate.colors ?? []).join('\n')} onChange={(event) => updateRate(rate.id, { colors: event.target.value.split(/\n|,/).map((color) => color.trim()).filter(Boolean) })} placeholder={'Ashen White\nWhite Ice\nAzul Platino'} /></label>
              <div className="pricing-rate-level-footer">
                <span>{priceDisplay(rate)}</span>
                <label><input type="checkbox" checked={rate.customerVisible !== false} onChange={(event) => updateRate(rate.id, { customerVisible: event.target.checked })} /> Customer visible</label>
                <button type="button" className="pricing-builder-delete-text" onClick={() => removeRate(rate.id)}>Delete</button>
              </div>
            </article>
          ))}
          {!materials.length && <div className="pricing-builder-empty">Add Level 1 Granite, Level 2 Quartz, or whatever groups this builder buys from.</div>}
        </div>
      </section>

      <section className="pricing-builder-panel">
        <header className="pricing-builder-panel-heading">
          <div><strong>Sinks & add-ons</strong><small>Fixed, per-SF, per-each, Included, NC, or TBD pricing.</small></div>
          <button type="button" onClick={addAddOn}>+ Add-on</button>
        </header>
        <div className="pricing-rate-addon-list">
          <div className="pricing-rate-addon-row is-head"><span>Type</span><span>Item</span><span>Description</span><span>Unit</span><span>Price state</span><span>Rate</span><span /></div>
          {addOns.map((rate) => (
            <div className="pricing-rate-addon-row" key={rate.id}>
              <select value={rate.productType} onChange={(event) => updateRate(rate.id, { productType: event.target.value as PricingBuilderProductType })}>{PRICING_BUILDER_PRODUCT_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
              <input value={rate.name} onChange={(event) => updateRate(rate.id, { name: event.target.value })} />
              <input value={rate.description ?? ''} onChange={(event) => updateRate(rate.id, { description: event.target.value })} placeholder="Includes cutout and undermounting" />
              <select value={rate.unit} onChange={(event) => updateRate(rate.id, { unit: event.target.value as PricingRateItem['unit'] })}><option value="sf">SF</option><option value="each">Each</option><option value="flat">Flat</option></select>
              <select value={rate.priceMode ?? 'priced'} onChange={(event) => updateRate(rate.id, { priceMode: event.target.value as PricingRatePriceMode })}>{PRICE_MODES.map((mode) => <option value={mode.value} key={mode.value}>{mode.label}</option>)}</select>
              <label className="quote-money-input"><span>$</span><input type="number" step="0.01" disabled={(rate.priceMode ?? 'priced') !== 'priced'} value={rate.rate ?? ''} onChange={(event) => updateRate(rate.id, { rate: numberValue(event.target.value) })} /></label>
              <div className="pricing-rate-addon-actions"><label title="Customer visible"><input type="checkbox" checked={rate.customerVisible !== false} onChange={(event) => updateRate(rate.id, { customerVisible: event.target.checked })} /> Show</label><button type="button" className="pricing-builder-delete" onClick={() => removeRate(rate.id)}>×</button></div>
            </div>
          ))}
          {!addOns.length && <div className="pricing-builder-empty">Add standard sinks, upgraded edges, brackets, handling charges, cutouts, or other recurring terms.</div>}
        </div>
      </section>

      <section className={`pricing-builder-health ${warnings.length ? 'has-warnings' : 'is-clear'}`}>
        <header><strong>Rate Sheet Health</strong><span>{warnings.length ? `${warnings.length} item${warnings.length === 1 ? '' : 's'} to review` : 'Ready to publish'}</span></header>
        {warnings.length ? <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>Every customer-visible Rate Book item has a valid contractual price state.</p>}
      </section>

      <section className="pricing-schedule-mapped-preview">
        <header><div><span className="quote-control-heading">Customer rate sheet preview</span><small>This is what will be frozen and signed. Internal Rate Book metadata stays private.</small></div></header>
        <PricingScheduleCustomerTable items={deriveRateSheetCustomerItems(builder)} compact />
      </section>
    </div>
  );
}
