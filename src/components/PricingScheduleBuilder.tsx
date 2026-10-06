import { useMemo, useState } from 'react';
import {
  calculatePlanOption,
  createPricingOptionPackage,
  createPricingOptionRule,
  createPricingPlan,
  createPricingRateItem,
  createPricingScheduleBuilderData,
  createPricingTakeoff,
  deriveBuilderCustomerItems,
  pricingBuilderHealth,
  pricingBuilderMatrix,
  takeoffSquareFeet,
} from '../services/pricingScheduleBuilder';
import { useQuoteStore } from '../store/quoteStore';
import {
  PRICING_BUILDER_PRODUCT_TYPES,
  type PricingBuilderProductType,
  type PricingOptionPackage,
  type PricingPlan,
  type PricingPlanTakeoff,
  type PricingRateItem,
  type PricingScheduleBuilderData,
  type Quote,
} from '../types/quote';
import { PricingScheduleCustomerTable } from './PricingScheduleCustomerTable';
import '../pricing-schedule.css';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
type BuilderTab = 'matrix' | 'plans' | 'options' | 'rates';

function numberValue(value: string) {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function builderFor(quote: Quote) {
  return quote.pricingSchedule?.builder ?? createPricingScheduleBuilderData();
}

export function PricingScheduleBuilder({ quote }: { quote: Quote }) {
  const updateQuote = useQuoteStore((state) => state.updateQuote);
  const builder = builderFor(quote);
  const [tab, setTab] = useState<BuilderTab>('matrix');
  const [selectedPlanId, setSelectedPlanId] = useState(builder.plans[0]?.id ?? '');
  const [selectedCell, setSelectedCell] = useState<{ planId: string; optionId: string } | null>(null);

  const saveBuilder = (next: PricingScheduleBuilderData) => {
    const customerItems = deriveBuilderCustomerItems(next);
    updateQuote(quote.id, {
      pricingSchedule: {
        ...quote.pricingSchedule,
        publishSource: 'builder',
        builder: next,
        customerItems,
      },
    });
  };

  const updateRate = (id: string, patch: Partial<PricingRateItem>) => saveBuilder({
    ...builder,
    rates: builder.rates.map((rate) => rate.id === id ? { ...rate, ...patch } : rate),
  });

  const updateOption = (id: string, patch: Partial<PricingOptionPackage>) => saveBuilder({
    ...builder,
    options: builder.options.map((option) => option.id === id ? { ...option, ...patch } : option),
  });

  const updatePlan = (id: string, patch: Partial<PricingPlan>) => saveBuilder({
    ...builder,
    plans: builder.plans.map((plan) => plan.id === id ? { ...plan, ...patch } : plan),
  });

  const updateTakeoff = (id: string, patch: Partial<PricingPlanTakeoff>) => saveBuilder({
    ...builder,
    takeoffs: builder.takeoffs.map((takeoff) => takeoff.id === id ? { ...takeoff, ...patch } : takeoff),
  });

  const warnings = useMemo(() => pricingBuilderHealth(builder), [builder]);
  const matrix = useMemo(() => pricingBuilderMatrix(builder), [builder]);
  const selectedPlan = builder.plans.find((plan) => plan.id === selectedPlanId) ?? builder.plans[0];
  const selectedCalculation = selectedCell
    ? matrix.find((calculation) => calculation.plan.id === selectedCell.planId && calculation.option.id === selectedCell.optionId)
    : undefined;
  const roomOptions = [...new Set(builder.takeoffs.map((takeoff) => takeoff.room).filter(Boolean))];

  const addRate = () => {
    const rate = createPricingRateItem();
    saveBuilder({ ...builder, rates: [...builder.rates, rate] });
    setTab('rates');
  };

  const addOption = () => {
    const option = createPricingOptionPackage(builder.options.length);
    saveBuilder({ ...builder, options: [...builder.options, option] });
    setTab('options');
  };

  const addPlan = () => {
    const plan = createPricingPlan();
    saveBuilder({ ...builder, plans: [...builder.plans, plan] });
    setSelectedPlanId(plan.id);
    setTab('plans');
  };

  return (
    <div className="pricing-builder">
      <header className="pricing-builder-header">
        <div>
          <span className="quote-control-heading">Structured schedule builder</span>
          <small>Rate Book → Option Packages → Plan Takeoffs → customer pricing matrix</small>
        </div>
        <div className="pricing-builder-header-meta">
          <span>{builder.plans.length} plans</span>
          <span>{builder.options.length} options</span>
          <span>{builder.rates.length} rates</span>
          <strong>{quote.pricingSchedule?.publishSource === 'builder' ? 'Publishing Builder' : 'Builder available'}</strong>
        </div>
      </header>

      <nav className="pricing-builder-tabs">
        {(['matrix', 'plans', 'options', 'rates'] as BuilderTab[]).map((item) => (
          <button type="button" className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>
            {item === 'matrix' ? 'Price Matrix' : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>

      {tab === 'rates' && (
        <section className="pricing-builder-panel">
          <header className="pricing-builder-panel-heading">
            <div><strong>Rate Book</strong><small>Reusable rates for stone, backsplash, sinks, bowls, supports, and flat items.</small></div>
            <button type="button" onClick={addRate}>+ Rate</button>
          </header>
          <label className="pricing-builder-name-field"><span>Rate Book name</span><input value={builder.rateBookName} onChange={(event) => saveBuilder({ ...builder, rateBookName: event.target.value })} /></label>
          <div className="pricing-builder-rate-list">
            <div className="pricing-builder-rate-row is-head"><span>Type</span><span>Product</span><span>Unit</span><span>Rate</span><span /></div>
            {builder.rates.map((rate) => (
              <div className="pricing-builder-rate-row" key={rate.id}>
                <select value={rate.productType} onChange={(event) => updateRate(rate.id, { productType: event.target.value as PricingBuilderProductType })}>
                  {PRICING_BUILDER_PRODUCT_TYPES.map((type) => <option value={type} key={type}>{type}</option>)}
                </select>
                <input value={rate.name} onChange={(event) => updateRate(rate.id, { name: event.target.value })} placeholder="Granite Lvl 1" />
                <select value={rate.unit} onChange={(event) => updateRate(rate.id, { unit: event.target.value as PricingRateItem['unit'] })}><option value="sf">SF</option><option value="each">Each</option><option value="flat">Flat</option></select>
                <label className="quote-money-input"><span>$</span><input type="number" step="0.01" value={rate.rate ?? ''} onChange={(event) => updateRate(rate.id, { rate: numberValue(event.target.value) })} /></label>
                <button type="button" className="pricing-builder-delete" onClick={() => saveBuilder({ ...builder, rates: builder.rates.filter((item) => item.id !== rate.id) })}>×</button>
              </div>
            ))}
            {!builder.rates.length && <div className="pricing-builder-empty">Add the products and rates you use for this agreement. Rates stay internal.</div>}
          </div>
        </section>
      )}

      {tab === 'options' && (
        <section className="pricing-builder-panel">
          <header className="pricing-builder-panel-heading">
            <div><strong>Option Packages</strong><small>Define a package once, then SalesShop applies it across every plan takeoff.</small></div>
            <button type="button" onClick={addOption}>+ Option</button>
          </header>
          <div className="pricing-builder-option-list">
            {builder.options.map((option) => (
              <article className="pricing-builder-option-card" key={option.id}>
                <header>
                  <input className="pricing-builder-option-code" value={option.code} onChange={(event) => updateOption(option.id, { code: event.target.value })} />
                  <input value={option.name} onChange={(event) => updateOption(option.id, { name: event.target.value })} placeholder="Base House" />
                  <label><input type="checkbox" checked={Boolean(option.isBase)} onChange={(event) => updateOption(option.id, { isBase: event.target.checked })} /> Base</label>
                  <button type="button" className="pricing-builder-delete" onClick={() => saveBuilder({ ...builder, options: builder.options.filter((item) => item.id !== option.id) })}>×</button>
                </header>
                <textarea value={option.description ?? ''} onChange={(event) => updateOption(option.id, { description: event.target.value })} placeholder="Customer-facing option description" />
                <div className="pricing-builder-flat-adjustment"><span>Flat adjustment</span><label className="quote-money-input"><span>$</span><input type="number" step="0.01" value={option.flatAdjustment ?? ''} onChange={(event) => updateOption(option.id, { flatAdjustment: numberValue(event.target.value) })} /></label></div>
                <div className="pricing-builder-rule-list">
                  <div className="pricing-builder-rule-row is-head"><span>Scope</span><span>Product type</span><span>Rate item</span><span /></div>
                  {option.rules.map((rule) => {
                    const matchingRates = builder.rates.filter((rate) => rate.productType === rule.productType);
                    return (
                      <div className="pricing-builder-rule-row" key={rule.id}>
                        <input list={`rooms-${option.id}`} value={rule.scope} onChange={(event) => updateOption(option.id, { rules: option.rules.map((item) => item.id === rule.id ? { ...item, scope: event.target.value } : item) })} />
                        <select value={rule.productType} onChange={(event) => updateOption(option.id, { rules: option.rules.map((item) => item.id === rule.id ? { ...item, productType: event.target.value as PricingBuilderProductType, rateItemId: '' } : item) })}>{PRICING_BUILDER_PRODUCT_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
                        <select value={rule.rateItemId} onChange={(event) => updateOption(option.id, { rules: option.rules.map((item) => item.id === rule.id ? { ...item, rateItemId: event.target.value } : item) })}><option value="">Choose rate…</option>{matchingRates.map((rate) => <option value={rate.id} key={rate.id}>{rate.name}{rate.rate === undefined ? '' : ` · ${money.format(rate.rate)}/${rate.unit === 'sf' ? 'SF' : 'EA'}`}</option>)}</select>
                        <button type="button" className="pricing-builder-delete" onClick={() => updateOption(option.id, { rules: option.rules.filter((item) => item.id !== rule.id) })}>×</button>
                      </div>
                    );
                  })}
                  <datalist id={`rooms-${option.id}`}><option value="All" /><option value="Kitchen" /><option value="Bathrooms" /><option value="Other" />{roomOptions.map((room) => <option value={room} key={room} />)}</datalist>
                  <button type="button" className="pricing-builder-inline-add" onClick={() => updateOption(option.id, { rules: [...option.rules, createPricingOptionRule()] })}>+ Pricing rule</button>
                </div>
              </article>
            ))}
            {!builder.options.length && <div className="pricing-builder-empty">Create Base, Quartz Kitchen, No Backsplash, or whatever packages this builder requires.</div>}
          </div>
        </section>
      )}

      {tab === 'plans' && (
        <section className="pricing-builder-plans-layout">
          <aside className="pricing-builder-plan-list">
            <header><strong>Plans</strong><button type="button" onClick={addPlan}>+ Plan</button></header>
            {builder.plans.map((plan) => <button type="button" className={selectedPlan?.id === plan.id ? 'active' : ''} key={plan.id} onClick={() => setSelectedPlanId(plan.id)}><strong>{plan.planNumber || 'No #'}</strong><span>{plan.name}</span></button>)}
            {!builder.plans.length && <div className="pricing-builder-empty">Add the house plans included in this agreement.</div>}
          </aside>
          <div className="pricing-builder-plan-editor">
            {selectedPlan ? (
              <>
                <header className="pricing-builder-panel-heading"><div><strong>{selectedPlan.planNumber || 'New plan'} · {selectedPlan.name}</strong><small>Enter only the lightweight quantities Sales needs for pricing.</small></div><button type="button" className="pricing-builder-delete-text" onClick={() => { saveBuilder({ ...builder, plans: builder.plans.filter((plan) => plan.id !== selectedPlan.id), takeoffs: builder.takeoffs.filter((takeoff) => takeoff.planId !== selectedPlan.id) }); setSelectedPlanId(''); }}>Delete plan</button></header>
                <div className="pricing-builder-plan-fields">
                  <label><span>Series</span><input value={selectedPlan.series ?? ''} onChange={(event) => updatePlan(selectedPlan.id, { series: event.target.value })} /></label>
                  <label><span>Plan #</span><input value={selectedPlan.planNumber} onChange={(event) => updatePlan(selectedPlan.id, { planNumber: event.target.value })} /></label>
                  <label><span>Plan name</span><input value={selectedPlan.name} onChange={(event) => updatePlan(selectedPlan.id, { name: event.target.value })} /></label>
                  <label className="wide"><span>Description</span><input value={selectedPlan.description ?? ''} onChange={(event) => updatePlan(selectedPlan.id, { description: event.target.value })} /></label>
                </div>
                <div className="pricing-builder-takeoff-table">
                  <div className="pricing-builder-takeoff-row is-head"><span>Room</span><span>Piece</span><span>L</span><span>W</span><span>SF</span><span>Kitchen sinks</span><span>Vanity bowls</span><span>Supports</span><span /></div>
                  {builder.takeoffs.filter((takeoff) => takeoff.planId === selectedPlan.id).map((takeoff) => (
                    <div className="pricing-builder-takeoff-row" key={takeoff.id}>
                      <input value={takeoff.room} onChange={(event) => updateTakeoff(takeoff.id, { room: event.target.value })} />
                      <input value={takeoff.piece ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { piece: event.target.value })} placeholder="Countertop / Splash" />
                      <input type="number" step="0.01" value={takeoff.length ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { length: numberValue(event.target.value) })} />
                      <input type="number" step="0.01" value={takeoff.width ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { width: numberValue(event.target.value) })} />
                      <label className="pricing-builder-sf"><input type="number" step="0.01" value={takeoff.squareFeet ?? ''} placeholder={takeoffSquareFeet(takeoff) ? takeoffSquareFeet(takeoff).toFixed(2) : 'Auto'} onChange={(event) => updateTakeoff(takeoff.id, { squareFeet: numberValue(event.target.value) })} /></label>
                      <input type="number" step="1" min="0" value={takeoff.kitchenSinks ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { kitchenSinks: numberValue(event.target.value) })} />
                      <input type="number" step="1" min="0" value={takeoff.vanityBowls ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { vanityBowls: numberValue(event.target.value) })} />
                      <input type="number" step="1" min="0" value={takeoff.supports ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { supports: numberValue(event.target.value) })} />
                      <button type="button" className="pricing-builder-delete" onClick={() => saveBuilder({ ...builder, takeoffs: builder.takeoffs.filter((item) => item.id !== takeoff.id) })}>×</button>
                    </div>
                  ))}
                  <button type="button" className="pricing-builder-inline-add" onClick={() => saveBuilder({ ...builder, takeoffs: [...builder.takeoffs, createPricingTakeoff(selectedPlan.id)] })}>+ Takeoff row</button>
                </div>
              </>
            ) : <div className="pricing-builder-empty">Select or add a plan to enter its takeoff.</div>}
          </div>
        </section>
      )}

      {tab === 'matrix' && (
        <section className="pricing-builder-matrix-layout">
          <div className="pricing-builder-matrix-main">
            <header className="pricing-builder-panel-heading"><div><strong>Calculated Plan × Option Matrix</strong><small>Click any price to see exactly how SalesShop calculated it.</small></div><div className="pricing-builder-quick-actions"><button type="button" onClick={addPlan}>+ Plan</button><button type="button" onClick={addOption}>+ Option</button><button type="button" onClick={addRate}>+ Rate</button></div></header>
            {builder.plans.length && builder.options.length ? (
              <div className="pricing-builder-matrix-scroll">
                <div className="pricing-builder-matrix" style={{ gridTemplateColumns: `minmax(180px, 1.4fr) repeat(${builder.options.length}, minmax(128px, 1fr))` }}>
                  <div className="pricing-builder-matrix-head">Plan</div>
                  {builder.options.map((option) => <div className="pricing-builder-matrix-head" key={option.id}><strong>{option.code}</strong><span>{option.name}</span></div>)}
                  {builder.plans.flatMap((plan) => [
                    <div className="pricing-builder-matrix-plan" key={`${plan.id}-label`}><strong>{plan.planNumber || '—'}</strong><span>{plan.name}</span></div>,
                    ...builder.options.map((option) => {
                      const calculation = matrix.find((item) => item.plan.id === plan.id && item.option.id === option.id)!;
                      return <button type="button" className={`pricing-builder-matrix-cell ${calculation.total === undefined ? 'has-warning' : ''}`} key={`${plan.id}-${option.id}`} onClick={() => setSelectedCell({ planId: plan.id, optionId: option.id })}>{calculation.total === undefined ? 'Review' : money.format(calculation.total)}</button>;
                    }),
                  ])}
                </div>
              </div>
            ) : <div className="pricing-builder-empty">Add at least one plan and one option to generate the price matrix.</div>}

            <section className="pricing-builder-published-preview">
              <header><strong>Published schedule</strong><small>The matrix above is converted into the same customer-safe contract rows used by secure links and signatures.</small></header>
              <PricingScheduleCustomerTable items={deriveBuilderCustomerItems(builder)} compact />
            </section>
          </div>

          <aside className="pricing-builder-audit">
            {selectedCalculation ? (
              <>
                <header><strong>{selectedCalculation.plan.planNumber} · {selectedCalculation.option.code}</strong><small>{selectedCalculation.plan.name} / {selectedCalculation.option.name}</small></header>
                <div className="pricing-builder-breakdown">
                  {selectedCalculation.lines.map((line) => <div className="pricing-builder-breakdown-row" key={line.id}><div><strong>{line.room} · {line.label}</strong><small>{line.productName || line.warning}</small></div><span>{line.quantity.toFixed(2)} {line.unit}</span><span>{line.rate === undefined ? '—' : money.format(line.rate)}</span><strong>{line.amount === undefined ? '—' : money.format(line.amount)}</strong></div>)}
                </div>
                <div className="pricing-builder-breakdown-total"><span>Calculated price</span><strong>{selectedCalculation.total === undefined ? 'Needs review' : money.format(selectedCalculation.total)}</strong></div>
                {selectedCalculation.warnings.map((warning) => <div className="pricing-builder-warning" key={warning}>{warning}</div>)}
              </>
            ) : (
              <>
                <header><strong>Schedule Health</strong><small>Resolve these before Send.</small></header>
                {warnings.length ? warnings.slice(0, 12).map((warning) => <div className="pricing-builder-warning" key={warning}>{warning}</div>) : <div className="pricing-builder-health-good">✓ All calculated schedule cells are complete.</div>}
                {warnings.length > 12 && <small>+ {warnings.length - 12} more warnings</small>}
              </>
            )}
          </aside>
        </section>
      )}
    </div>
  );
}
