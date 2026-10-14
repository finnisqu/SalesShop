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
  planOptionEnabled,
  pricingBuilderHealth,
  pricingBuilderMatrix,
  pricingTakeoffGroups,
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
  type PricingMaterialType,
  type PricingScheduleBuilderData,
  type Quote,
} from '../types/quote';
import { PricingScheduleCustomerTable } from './PricingScheduleCustomerTable';
import { PricingContractTable } from './PricingContractTable';
import {PricingManualSchedule} from './PricingManualSchedule';
import '../pricing-schedule.css';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
type BuilderTab = 'manual' | 'addons' | 'matrix' | 'plans' | 'options' | 'rates' | 'contract';
const CALCULATED_TABS: Array<{key:BuilderTab;label:string;caption:string}> = [
  {key:'rates',label:'1 · Rates',caption:'Material $/SF and add-on prices'},
  {key:'plans',label:'2 · Plan Takeoffs',caption:'Measurements and replacement variants'},
  {key:'options',label:'3 · Options & Scope',caption:'Materials, splashes and alternate vanities'},
  {key:'matrix',label:'4 · Calculated Matrix',caption:'Auditable prices and customer preview'},
];
const CONTRACT_TABS: Array<{key:BuilderTab;label:string;caption:string}> = [
  {key:'manual',label:'Manual Matrix',caption:'Enter negotiated full-house prices'},
  {key:'addons',label:'Add-on Rates',caption:'Separate contract upgrade price list'},
  {key:'contract',label:'Contract Table',caption:'Edit/import/export contract rows'},
];

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
  const [tab, setTab] = useState<BuilderTab>(builder.outputMode==='contract'&&builder.contractRows?.length&&!builder.manualPlans?.length?'contract':builder.outputMode==='contract'?'manual':'rates');
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

  const togglePlanOption = (plan: PricingPlan, option: PricingOptionPackage, enabled: boolean) => {
    const excluded = new Set(plan.excludedOptionIds ?? []);
    if (enabled) excluded.delete(option.id);
    else excluded.add(option.id);
    updatePlan(plan.id, { excludedOptionIds: [...excluded] });
    if (!enabled && selectedCell?.planId === plan.id && selectedCell.optionId === option.id) setSelectedCell(null);
  };

  const warnings = useMemo(() => pricingBuilderHealth(builder), [builder]);
  const matrix = useMemo(() => pricingBuilderMatrix(builder), [builder]);
  const selectedPlan = builder.plans.find((plan) => plan.id === selectedPlanId) ?? builder.plans[0];
  const selectedCalculation = selectedCell
    ? matrix.find((calculation) => calculation.plan.id === selectedCell.planId && calculation.option.id === selectedCell.optionId)
    : undefined;
  const roomOptions = [...new Set(builder.takeoffs.map((takeoff) => takeoff.room).filter(Boolean))];
  const variantGroups = pricingTakeoffGroups(builder);
  const materialRates = builder.rates.filter(rate=>rate.kind==='material-level' && rate.unit==='sf');
  const otherRateItems = builder.rates.filter(rate=>rate.kind!=='material-level');
  const addMaterialRate = (label='New material',type:PricingMaterialType='Other',rate?:number) => {
    const next = createPricingRateItem('Countertops','material-level');
    next.name=label;next.materialType=type;next.rate=rate;next.unit='sf';
    saveBuilder({...builder,outputMode:'matrix',rates:[...builder.rates,next]});
  };
  const addAddonRate = (productType:PricingBuilderProductType='Other') => {
    const next=createPricingRateItem(productType,'add-on');
    next.name=productType==='Other'?'New add-on':productType;
    saveBuilder({...builder,outputMode:'matrix',rates:[...builder.rates,next]});
  };
  const addStarterRates = () => {
    const presets: Array<[string,PricingMaterialType,number]> = [
      ['Cultured Marble','Cultured Marble',20],['Granite','Granite',25],['Quartz','Quartz',32],
    ];
    const missing=presets.filter(([name])=>!builder.rates.some(r=>r.kind==='material-level'&&r.name.toLowerCase()===name.toLowerCase()));
    const rows=missing.map(([name,type,amount])=>{
      const item=createPricingRateItem('Countertops','material-level');
      return {...item,name,materialType:type,rate:amount};
    });
    saveBuilder({...builder,outputMode:'matrix',rates:[...builder.rates,...rows]});
  };
  const addSixPackages=()=>{
    const granite=materialRates.find(r=>r.materialType==='Granite');
    const quartz=materialRates.find(r=>r.materialType==='Quartz');
    if(!granite||!quartz)return;
    const mixes=[['Granite','Granite',true],['Granite','Granite',false],
      ['Granite','Quartz',true],['Granite','Quartz',false],
      ['Quartz','Quartz',true],['Quartz','Quartz',false]] as const;
    const next=mixes.map(([kitchen,bath,allSplashes],index)=>{
      const option=createPricingOptionPackage(index);
      option.name=`${kitchen} kitchen · ${bath} bathrooms · ${allSplashes?'All splashes':'Bathroom splashes only'}`;
      option.description=option.name;
      option.kitchenMaterialRateId=kitchen==='Granite'?granite.id:quartz.id;
      option.bathroomMaterialRateId=bath==='Granite'?granite.id:quartz.id;
      option.includeKitchenSplash=allSplashes;
      option.includeBathroomSplash=true;
      return option;
    });
    saveBuilder({...builder,outputMode:'matrix',options:next});
  };
  const addMasterVanityChoices=(plan:PricingPlan)=>{
    const existing=builder.takeoffs.some(t=>t.planId===plan.id&&t.variantGroup==='Master Vanity');
    if(existing)return;
    const make=(code:string,length:number,bowls:number):PricingPlanTakeoff=>({
      ...createPricingTakeoff(plan.id),room:'Master Bathroom',piece:'Vanity Top',
      category:'Master Vanity',variantGroup:'Master Vanity',variantCode:code,
      length,vanityBowls:bowls,
    });
    saveBuilder({...builder,outputMode:'matrix',takeoffs:[
      ...builder.takeoffs,make('BASE',48,1),make('DOUBLE',72,2),
    ]});
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
          <small>Enter complete house prices in a matrix, set shared add-on rates, or use calculated plan takeoffs when needed.</small>
        </div>
        <div className="pricing-builder-header-meta">
          <span>{builder.manualPlans?.length??builder.plans.length} house plans</span>
          <span>{builder.manualPackages?.length??builder.options.length} packages</span>
          <span>{builder.manualAddons?.length??0} add-on rates</span>
          {builder.outputMode==='contract'&&<span>{builder.contractRows?.length??0} contract rows</span>}
          <strong>{quote.pricingSchedule?.publishSource === 'builder' ? 'Publishing Builder' : 'Builder available'}</strong>
        </div>
      </header>

      <section className="pricing-builder-workflow">
        <header><strong>Calculated builder · recommended</strong>
          <small>One rate per material, shared by kitchen, bathrooms and splashes. Create physical takeoffs once; choose which variants each option uses.</small>
        </header>
        <nav className="pricing-builder-step-tabs" aria-label="Calculated builder workflow">
          {CALCULATED_TABS.map(item=><button type="button" key={item.key}
            className={tab===item.key?'active':''}
            onClick={()=>{setTab(item.key);
              if(builder.outputMode!=='matrix')saveBuilder({...builder,outputMode:'matrix'});
            }}>
            <strong>{item.label}</strong><small>{item.caption}</small>
          </button>)}
        </nav>
        <details className="pricing-builder-alternatives" open={['manual','addons','contract'].includes(tab)}>
          <summary>Alternative agreement workflows <small>· Manual negotiated prices and contract rows</small></summary>
          <p>These are alternatives to automatic calculations. Manual Matrix is for approved complete-house prices; Add-on Rates is its optional, separate upgrade schedule. Contract Table is the row editor/export for manual or imported agreements. Your data stays saved when switching methods.</p>
          <nav className="pricing-builder-tabs">
            {CONTRACT_TABS.map(item=><button type="button" key={item.key}
              className={tab===item.key?'active':''}
              onClick={()=>{setTab(item.key);
                if(builder.outputMode!=='contract')saveBuilder({...builder,outputMode:'contract'});
              }} title={item.caption}>{item.label}</button>)}
          </nav>
        </details>
        <div className="pricing-builder-mode-indicator">
          Customer schedule source: <strong>{builder.outputMode==='contract'?'Manual / contract prices':'Calculated plan × option prices'}</strong>
        </div>
      </section>

      {tab === 'manual' && <PricingManualSchedule builder={builder} onChange={saveBuilder} mode="matrix"/>}
      {tab === 'addons' && <PricingManualSchedule builder={builder} onChange={saveBuilder} mode="addons"/>}
      {tab === 'contract' && <PricingContractTable builder={builder} onChange={saveBuilder}/>}

      {tab === 'rates' && (
        <section className="pricing-builder-panel pricing-builder-simple-rates">
          <header className="pricing-builder-panel-heading">
            <div><strong>1 · Set your material and add-on rates</strong>
              <small>Enter one rate per material in $/SF. It applies to kitchen tops, bath tops, and every included 4-inch or full-height splash. Sink bowls, supports, and other add-ons are charged separately.</small>
            </div>
            <div className="pricing-builder-quick-actions">
              <button type="button" onClick={addStarterRates}>Add example $20 / $25 / $32 materials</button>
              <button type="button" onClick={()=>addMaterialRate()}>+ Material</button>
            </div>
          </header>
          <label className="pricing-builder-name-field"><span>Agreement rate book name</span>
            <input value={builder.rateBookName} onChange={e=>saveBuilder({...builder,rateBookName:e.target.value})}/>
          </label>
          <div className="pricing-builder-rate-section">
            <header><strong>Materials · universal $/SF</strong><small>Examples: Cultured Marble $20, Granite $25, Quartz $32. These are example sell prices, not automatically applied.</small></header>
            <div className="pricing-builder-material-list">
              {materialRates.map(rate=><div key={rate.id} className="pricing-builder-material-rate">
                <label><span>Material</span><input aria-label={`Material name ${rate.id}`} value={rate.name}
                  onChange={e=>updateRate(rate.id,{name:e.target.value})}/></label>
                <label><span>Family</span><select value={rate.materialType??'Other'}
                  onChange={e=>updateRate(rate.id,{materialType:e.target.value as PricingMaterialType})}>
                  {(['Cultured Marble','Granite','Quartz','Quartzite','Marble','Dolomite','Natural Stone',
                    'Porcelain','Sintered Stone','Solid Surface','Other'] as PricingMaterialType[]).map(type=>
                    <option key={type} value={type}>{type}</option>)}
                </select></label>
                <label><span>Price per SF</span><input aria-label={`${rate.name} per SF`} type="number" min="0" step="0.01"
                  value={rate.rate??''} onChange={e=>updateRate(rate.id,{rate:numberValue(e.target.value)})}/></label>
                <button type="button" className="pricing-builder-delete-text" onClick={()=>saveBuilder({
                  ...builder,rates:builder.rates.filter(item=>item.id!==rate.id),
                })}>Remove</button>
              </div>)}
            </div>
            {!materialRates.length&&<div className="pricing-builder-empty">Start here: add Cultured Marble, Granite and Quartz (or whatever material families the builder offers).</div>}
          </div>
          <div className="pricing-builder-rate-section">
            <header><strong>Add-on unit rates</strong><small>Vanity bowls and sinks are counted from the selected physical takeoffs; other extra charges can be added to specific option packages.</small></header>
            <div className="pricing-builder-quick-actions">
              <button type="button" onClick={()=>addAddonRate('Vanity Sink')}>+ Vanity bowl</button>
              <button type="button" onClick={()=>addAddonRate('Kitchen Sink')}>+ Kitchen sink</button>
              <button type="button" onClick={()=>addAddonRate('Support')}>+ Support</button>
              <button type="button" onClick={()=>addAddonRate('Other')}>+ Other add-on</button>
            </div>
            <div className="pricing-builder-material-list">
              {otherRateItems.map(rate=><div key={rate.id} className="pricing-builder-material-rate">
                <label><span>Add-on</span><input value={rate.name} aria-label={`Add-on name ${rate.id}`}
                  onChange={e=>updateRate(rate.id,{name:e.target.value})}/></label>
                <label><span>Type</span><select value={rate.productType}
                  onChange={e=>updateRate(rate.id,{productType:e.target.value as PricingBuilderProductType})}>
                  {PRICING_BUILDER_PRODUCT_TYPES.filter(t=>t!=='Countertops'&&t!=='Backsplash').map(t=>
                    <option key={t} value={t}>{t}</option>)}
                </select></label>
                <label><span>Unit</span><select value={rate.unit}
                  onChange={e=>updateRate(rate.id,{unit:e.target.value as PricingRateItem['unit']})}>
                  <option value="each">Each</option><option value="sf">SF</option><option value="flat">Flat</option>
                </select></label>
                <label><span>Sell rate</span><input type="number" min="0" step="0.01"
                  aria-label={`${rate.name} sell rate`} value={rate.rate??''}
                  onChange={e=>updateRate(rate.id,{rate:numberValue(e.target.value)})}/></label>
                <button type="button" className="pricing-builder-delete-text" onClick={()=>saveBuilder({
                  ...builder,rates:builder.rates.filter(item=>item.id!==rate.id),
                })}>Remove</button>
              </div>)}
            </div>
          </div>
          <div className="pricing-builder-step-footer"><button type="button" onClick={()=>setTab('plans')}>
            Next: Enter plan takeoffs →
          </button></div>
        </section>
      )}

      {tab === 'options' && (
        <section className="pricing-builder-panel pricing-builder-option-scope">
          <header className="pricing-builder-panel-heading">
            <div><strong>3 · Configure materials and scope</strong>
              <small>Package selections reuse your universal $/SF prices. A different vanity variant replaces—not adds to—the base vanity. You can reuse the same package across many house plans.</small>
            </div>
            <div className="pricing-builder-quick-actions">
              <button type="button" disabled={builder.options.length>0||!materialRates.some(r=>r.materialType==='Granite')||!materialRates.some(r=>r.materialType==='Quartz')}
                onClick={addSixPackages}>Create six stone/splash packages</button>
              <button type="button" onClick={addOption}>+ Option package</button>
            </div>
          </header>
          {!builder.options.length&&<div className="pricing-builder-empty">Create the six standard packages after entering Granite and Quartz rates, or add a custom option. Each package chooses kitchen and bathroom materials plus included scope.</div>}
          <div className="pricing-builder-option-list">
            {builder.options.map(option=><article className="pricing-builder-option-card" key={option.id}>
              <header>
                <label><span>Code</span><input className="pricing-builder-option-code" aria-label="Option code" value={option.code}
                  onChange={e=>updateOption(option.id,{code:e.target.value})}/></label>
                <label className="pricing-builder-option-name"><span>Package</span><input aria-label="Package name"
                  value={option.name} onChange={e=>updateOption(option.id,{name:e.target.value})}/></label>
                <label><input type="checkbox" checked={!!option.isBase}
                  onChange={e=>updateOption(option.id,{isBase:e.target.checked})}/> Base</label>
                <button type="button" className="pricing-builder-delete" title="Delete package"
                  onClick={()=>saveBuilder({...builder,options:builder.options.filter(item=>item.id!==option.id)})}>×</button>
              </header>
              <div className="pricing-builder-option-config">
                <label><span>Kitchen tops and splashes</span>
                  <select aria-label={`${option.code} kitchen material`} value={option.kitchenMaterialRateId??''}
                    onChange={e=>updateOption(option.id,{kitchenMaterialRateId:e.target.value||undefined})}>
                    <option value="">Select material rate</option>
                    {materialRates.map(rate=><option key={rate.id} value={rate.id}>{rate.name} · {rate.rate===undefined?'Needs rate':money.format(rate.rate)+'/SF'}</option>)}
                  </select></label>
                <label><span>Bathroom tops and splashes</span>
                  <select aria-label={`${option.code} bathroom material`} value={option.bathroomMaterialRateId??''}
                    onChange={e=>updateOption(option.id,{bathroomMaterialRateId:e.target.value||undefined})}>
                    <option value="">Select material rate</option>
                    {materialRates.map(rate=><option key={rate.id} value={rate.id}>{rate.name} · {rate.rate===undefined?'Needs rate':money.format(rate.rate)+'/SF'}</option>)}
                  </select></label>
                <label className="pricing-builder-option-check"><input type="checkbox"
                  checked={option.includeKitchenSplash!==false}
                  onChange={e=>updateOption(option.id,{includeKitchenSplash:e.target.checked})}/>
                  <span>Include kitchen splashes</span></label>
                <label className="pricing-builder-option-check"><input type="checkbox"
                  checked={option.includeBathroomSplash!==false}
                  onChange={e=>updateOption(option.id,{includeBathroomSplash:e.target.checked})}/>
                  <span>Include bathroom splashes</span></label>
              </div>
              {variantGroups.length>0&&<div className="pricing-builder-variant-choices">
                <strong>Choose takeoff alternatives</strong>
                <small>Only one variant in each category is billed. BASE is the default unless you select a replacement.</small>
                {variantGroups.map(group=><label key={group.name}>
                  <span>{group.name}</span><select aria-label={`${option.code} ${group.name} variant`}
                    value={option.takeoffVariants?.[group.name]??group.defaultCode??''}
                    onChange={e=>updateOption(option.id,{takeoffVariants:{
                      ...option.takeoffVariants,[group.name]:e.target.value,
                    }})}>
                    {!group.defaultCode&&<option value="">Choose a variant</option>}
                    {group.codes.map(code=><option key={code} value={code}>{code}</option>)}
                  </select>
                </label>)}
              </div>}
              {otherRateItems.filter(rate=>rate.productType==='Other').length>0&&
                <details className="pricing-builder-option-extras"><summary>Additional package charges</summary>
                  <div className="pricing-builder-variant-choices">
                    {otherRateItems.filter(rate=>rate.productType==='Other').map(rate=><label key={rate.id}>
                      <span>{rate.name} · {rate.rate===undefined?'Needs rate':money.format(rate.rate)} / {rate.unit}</span>
                      <input type="number" min="0" step={rate.unit==='sf'?'0.01':'1'}
                        aria-label={`${option.code} ${rate.name} quantity`}
                        value={option.extraRateQuantities?.[rate.id]??0}
                        onChange={e=>updateOption(option.id,{extraRateQuantities:{
                          ...option.extraRateQuantities,[rate.id]:Math.max(0,Number(e.target.value)||0),
                        }})}/>
                    </label>)}
                  </div></details>}
              <label className="pricing-builder-option-note"><span>Customer-facing description (optional)</span>
                <input value={option.description??''} onChange={e=>updateOption(option.id,{description:e.target.value})}
                  placeholder="Granite kitchen, quartz bathrooms, all splashes"/></label>
              <details className="pricing-builder-legacy-rules">
                <summary>Advanced / legacy rate rules <small>(optional: existing negotiated overrides)</small></summary>
                <div className="pricing-builder-rule-list">
                  <div className="pricing-builder-rule-row is-head"><span>Scope</span><span>Product type</span><span>Rate item</span><span/></div>
                  {option.rules.map(rule=>{
                    const matchingRates=builder.rates.filter(rate=>rate.productType===rule.productType);
                    return <div className="pricing-builder-rule-row" key={rule.id}>
                      <input list={`rooms-${option.id}`} value={rule.scope} onChange={e=>updateOption(option.id,{rules:
                        option.rules.map(item=>item.id===rule.id?{...item,scope:e.target.value}:item)})}/>
                      <select value={rule.productType} onChange={e=>updateOption(option.id,{rules:option.rules.map(item=>
                        item.id===rule.id?{...item,productType:e.target.value as PricingBuilderProductType,rateItemId:''}:item)})}>
                        {PRICING_BUILDER_PRODUCT_TYPES.map(type=><option key={type}>{type}</option>)}
                      </select>
                      <select value={rule.rateItemId} onChange={e=>updateOption(option.id,{rules:option.rules.map(item=>
                        item.id===rule.id?{...item,rateItemId:e.target.value}:item)})}>
                        <option value="">Choose rate…</option>
                        {matchingRates.map(rate=><option key={rate.id} value={rate.id}>{rate.name}</option>)}
                      </select>
                      <button type="button" className="pricing-builder-delete" onClick={()=>updateOption(option.id,{rules:
                        option.rules.filter(item=>item.id!==rule.id)})}>×</button>
                    </div>;
                  })}
                  <datalist id={`rooms-${option.id}`}><option value="All"/><option value="Kitchen"/><option value="Bathrooms"/>
                    {roomOptions.map(room=><option key={room} value={room}/>)}</datalist>
                  <button type="button" className="pricing-builder-inline-add" onClick={()=>updateOption(option.id,{rules:[
                    ...option.rules,createPricingOptionRule(),
                  ]})}>+ Advanced pricing rule</button>
                </div>
              </details>
            </article>)}
          </div>
          <div className="pricing-builder-step-footer">
            <button type="button" onClick={()=>setTab('plans')}>← Plan takeoffs</button>
            <button type="button" onClick={()=>setTab('matrix')}>Next: Review calculated matrix →</button>
          </div>
        </section>
      )}

      {tab === 'plans' && (
        <section className="pricing-builder-plans-layout">
          <aside className="pricing-builder-plan-list">
            <header><strong>2 · House plans</strong><button type="button" onClick={addPlan}>+ Plan</button></header>
            {builder.plans.map((plan) => <button type="button" className={selectedPlan?.id === plan.id ? 'active' : ''} key={plan.id} onClick={() => setSelectedPlanId(plan.id)}><strong>{plan.planNumber || 'No #'}</strong><span>{plan.name}</span></button>)}
            {!builder.plans.length && <div className="pricing-builder-empty">Add the house plans included in this agreement.</div>}
          </aside>
          <div className="pricing-builder-plan-editor">
            {selectedPlan ? (
              <>
                <header className="pricing-builder-panel-heading"><div>
                    <strong>{selectedPlan.planNumber || 'New plan'} · {selectedPlan.name}</strong>
                    <small>Measure each top and splash as a separate row. Give interchangeable pieces the same Variant group and distinct Variant labels (BASE and DOUBLE). Selecting DOUBLE replaces BASE, including both surface area and sink quantities.</small>
                  </div><button type="button" className="pricing-builder-delete-text" onClick={() => { saveBuilder({ ...builder, plans: builder.plans.filter((plan) => plan.id !== selectedPlan.id), takeoffs: builder.takeoffs.filter((takeoff) => takeoff.planId !== selectedPlan.id) }); setSelectedPlanId(''); }}>Delete plan</button></header>
                <div className="pricing-builder-plan-fields">
                  <label><span>Series</span><input value={selectedPlan.series ?? ''} onChange={(event) => updatePlan(selectedPlan.id, { series: event.target.value })} /></label>
                  <label><span>Plan #</span><input value={selectedPlan.planNumber} onChange={(event) => updatePlan(selectedPlan.id, { planNumber: event.target.value })} /></label>
                  <label><span>Plan name</span><input value={selectedPlan.name} onChange={(event) => updatePlan(selectedPlan.id, { name: event.target.value })} /></label>
                  <label className="wide"><span>Description</span><input value={selectedPlan.description ?? ''} onChange={(event) => updatePlan(selectedPlan.id, { description: event.target.value })} /></label>
                </div>

                <section className="pricing-builder-plan-options">
                  <header><div><strong>Available options</strong><small>Only checked packages appear for this plan on the customer schedule.</small></div><span>{builder.options.filter((option) => planOptionEnabled(selectedPlan, option)).length}/{builder.options.length} offered</span></header>
                  <div className="pricing-builder-plan-option-grid">
                    {builder.options.map((option) => (
                      <label key={option.id} className={planOptionEnabled(selectedPlan, option) ? 'is-enabled' : ''}>
                        <input type="checkbox" checked={planOptionEnabled(selectedPlan, option)} onChange={(event) => togglePlanOption(selectedPlan, option, event.target.checked)} />
                        <strong>{option.code || '—'}</strong>
                        <span>{option.name}</span>
                      </label>
                    ))}
                  </div>
                  {!builder.options.length && <div className="pricing-builder-empty">Add option packages first, then choose which ones this plan offers.</div>}
                </section>

                <div className="pricing-builder-takeoff-actions">
                  <strong>Measured components</strong>
                  <div className="pricing-builder-quick-actions">
                    <button type="button" disabled={builder.takeoffs.some(t=>t.planId===selectedPlan.id&&t.variantGroup==='Master Vanity')}
                      onClick={()=>addMasterVanityChoices(selectedPlan)}>+ Master Vanity BASE / DOUBLE</button>
                    <button type="button" onClick={()=>saveBuilder({...builder,takeoffs:[...builder.takeoffs,{
                      ...createPricingTakeoff(selectedPlan.id),piece:'Backsplash',category:'Backsplash',
                    }]})}>+ Splash</button>
                    <button type="button" onClick={()=>saveBuilder({...builder,takeoffs:[
                      ...builder.takeoffs,createPricingTakeoff(selectedPlan.id),
                    ]})}>+ Component</button>
                  </div>
                </div>
                <p className="pricing-builder-takeoff-hint">Example: Master Vanity · BASE · 48” long · 1 bowl, and Master Vanity · DOUBLE · 72” long · 2 bowls. Enter the actual width; only the selected row is priced. For backsplashes, enter their own dimensions or SF.</p>
                <div className="pricing-builder-takeoff-scroller"><div className="pricing-builder-takeoff-table">
                  <div className="pricing-builder-takeoff-row is-head">
                    <span>Room</span><span>Component</span><span>Category</span><span>Variant group</span><span>Variant</span>
                    <span>L (in)</span><span>W (in)</span><span>SF</span>
                    <span>Kitchen sinks</span><span>Vanity bowls</span><span>Supports</span><span />
                  </div>
                  {builder.takeoffs.filter((takeoff) => takeoff.planId === selectedPlan.id).map((takeoff) => (
                    <div className="pricing-builder-takeoff-row" key={takeoff.id}>
                      <input value={takeoff.room} onChange={(event) => updateTakeoff(takeoff.id, { room: event.target.value })} />
                      <input value={takeoff.piece ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { piece: event.target.value })} placeholder="Countertop / Backsplash" />
                      <input aria-label="Component category" value={takeoff.category??''}
                        onChange={e=>updateTakeoff(takeoff.id,{category:e.target.value})} placeholder="Master Vanity" />
                      <input aria-label="Variant group" value={takeoff.variantGroup??''}
                        onChange={e=>updateTakeoff(takeoff.id,{variantGroup:e.target.value})} placeholder="Master Vanity / blank" />
                      <input aria-label="Variant" value={takeoff.variantCode??'BASE'}
                        onChange={e=>updateTakeoff(takeoff.id,{variantCode:e.target.value})} placeholder="BASE / DOUBLE" />
                      <input type="number" step="0.01" value={takeoff.length ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { length: numberValue(event.target.value) })} />
                      <input type="number" step="0.01" value={takeoff.width ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { width: numberValue(event.target.value) })} />
                      <label className="pricing-builder-sf"><input type="number" step="0.01" value={takeoff.squareFeet ?? ''} placeholder={takeoffSquareFeet(takeoff) ? takeoffSquareFeet(takeoff).toFixed(2) : 'Auto'} onChange={(event) => updateTakeoff(takeoff.id, { squareFeet: numberValue(event.target.value) })} /></label>
                      <input type="number" step="1" min="0" value={takeoff.kitchenSinks ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { kitchenSinks: numberValue(event.target.value) })} />
                      <input type="number" step="1" min="0" value={takeoff.vanityBowls ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { vanityBowls: numberValue(event.target.value) })} />
                      <input type="number" step="1" min="0" value={takeoff.supports ?? ''} onChange={(event) => updateTakeoff(takeoff.id, { supports: numberValue(event.target.value) })} />
                      <button type="button" className="pricing-builder-delete" onClick={() => saveBuilder({ ...builder, takeoffs: builder.takeoffs.filter((item) => item.id !== takeoff.id) })}>×</button>
                    </div>
                  ))}
                </div></div>
                <div className="pricing-builder-step-footer">
                  <button type="button" onClick={()=>setTab('rates')}>← Material and add-on rates</button>
                  <button type="button" onClick={()=>setTab('options')}>Next: Configure option scope →</button>
                </div>
              </>
            ) : <div className="pricing-builder-empty">Select or add a plan to enter its takeoff.</div>}
          </div>
        </section>
      )}

      {tab === 'matrix' && (
        <section className="pricing-builder-matrix-layout">
          <div className="pricing-builder-matrix-main">
            <header className="pricing-builder-panel-heading"><div><strong>4 · Calculated house price matrix</strong>
              <small>Each amount sums only the takeoff pieces selected by that option, using one material $/SF rate for tops and included splashes, plus sink and add-on counts. Click any price to audit every line.</small></div>
              <div className="pricing-builder-quick-actions"><button type="button" onClick={()=>setTab('rates')}>Edit rates</button><button type="button" onClick={()=>setTab('plans')}>Edit takeoffs</button><button type="button" onClick={()=>setTab('options')}>Edit scope</button></div></header>
            {builder.plans.length && builder.options.length ? (
              <div className="pricing-builder-matrix-scroll">
                <div className="pricing-builder-matrix" style={{ gridTemplateColumns: `minmax(180px, 1.4fr) repeat(${builder.options.length}, minmax(128px, 1fr))` }}>
                  <div className="pricing-builder-matrix-head">Plan</div>
                  {builder.options.map((option) => <div className="pricing-builder-matrix-head" key={option.id}><strong>{option.code}</strong><span>{option.name}</span></div>)}
                  {builder.plans.flatMap((plan) => [
                    <div className="pricing-builder-matrix-plan" key={`${plan.id}-label`}><strong>{plan.planNumber || '—'}</strong><span>{plan.name}</span></div>,
                    ...builder.options.map((option) => {
                      if (!planOptionEnabled(plan, option)) return <div className="pricing-builder-matrix-cell is-not-offered" key={`${plan.id}-${option.id}`}>Not offered</div>;
                      const calculation = matrix.find((item) => item.plan.id === plan.id && item.option.id === option.id) ?? calculatePlanOption(builder, plan, option);
                      return <button type="button" className={`pricing-builder-matrix-cell ${calculation.total === undefined ? 'has-warning' : ''}`} key={`${plan.id}-${option.id}`} onClick={() => setSelectedCell({ planId: plan.id, optionId: option.id })}>{calculation.total === undefined ? 'Review' : money.format(calculation.total)}</button>;
                    }),
                  ])}
                </div>
              </div>
            ) : <div className="pricing-builder-empty">Add at least one plan and one option to generate the price matrix.</div>}

            <section className="pricing-builder-published-preview">
              <header><strong>Published schedule</strong><small>Only plan/package combinations marked available are converted into customer contract rows.</small></header>
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
                {warnings.length ? warnings.slice(0, 12).map((warning) => <div className="pricing-builder-warning" key={warning}>{warning}</div>) : <div className="pricing-builder-health-good">✓ All offered schedule cells are complete.</div>}
                {warnings.length > 12 && <small>+ {warnings.length - 12} more warnings</small>}
              </>
            )}
          </aside>
        </section>
      )}
    </div>
  );
}
