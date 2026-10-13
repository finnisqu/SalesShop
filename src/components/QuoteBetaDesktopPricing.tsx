import {useEffect,useRef,useState} from 'react';
import type {Quote,QuoteLine,QuoteLineKind,QuoteSection,QuotePricingMode} from '../types/quote';
import {quoteLineAmount,quoteLinesTotal} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {calculateAreaCustomerPrice,projectAreaCost,type AreaPricingChoice} from '../services/quoteAreaCost';
import {QuoteSfRateChoices} from './QuoteSfRateChoices';
import {QuoteBetaRateCatalog,rateItemToQuotePatch} from './QuoteBetaRateCatalog';
import {useCompanySettingsStore} from '../store/companySettingsStore';
import {selectedMaterialCost} from '../services/selectedMaterialCost';
import {isDeveloperPlaygroundRoute} from '../lib/developerPlayground';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const decimal=(n:number|undefined)=>n===undefined?'':String(n);
const numeric=(raw:string)=>raw===''?undefined:Number(raw);
const canUse=(n:number|undefined)=>n!==undefined&&Number.isFinite(n)&&n>=0;

/** Dollar-formatted at rest, raw and non-jumping while the user types. */
function SlabBuyingCostInput({value,editable,onChange}:{
  value?:number;editable:boolean;onChange:(value:number|undefined)=>void;
}){
  const format=(n:number|undefined)=>n===undefined?'':n.toFixed(2);
  const [draft,setDraft]=useState(()=>format(value));
  const focused=useRef(false);
  useEffect(()=>{if(!focused.current)setDraft(format(value));},[value]);
  return <div className="qmb-currency-field"><span aria-hidden="true">$</span>
    <input type="number" aria-label="Area buying cost per slab" min="0" step=".01"
      disabled={!editable} value={draft} placeholder="0.00"
      onFocus={e=>{focused.current=true;e.currentTarget.select();}}
      onChange={e=>{
        const raw=e.target.value;
        if(raw!==''){
          const amount=Number(raw);
          if(!Number.isFinite(amount)||amount<0)return;
          setDraft(raw);onChange(amount);
        }else{setDraft('');onChange(undefined);}
      }}
      onBlur={()=>{focused.current=false;setDraft(format(value));}}/>
  </div>;
}


/** Internal desktop sales math, distinct from the customer-facing quote paper.
 * Slab yield is an Area-specific override; absent means the 65% default. */
export function QuoteBetaDesktopPricing({quote,section,editable,view='all'}:{
  quote:Quote;section:QuoteSection;editable:boolean;view?:'all'|'selling'|'calculator'|'extras';
}){
  const updateLine=useQuoteStore(s=>s.updateLine);
  const deleteLine=useQuoteStore(s=>s.deleteLine);
  const updateSection=useQuoteStore(s=>s.updateSection);
  const addCatalogLine=useQuoteStore(s=>s.addCatalogLine);
  const addLine=useQuoteStore(s=>s.addLine);
  const updatePieces=useQuoteStore(s=>s.updateTakeoffPieces);
  const lines=quote.lines.filter(l=>l.sectionId===section.id);
  const primary=lines.find(l=>l.quantitySource?.syncMode==='live'&&l.quantitySource.field==='countertopSf')
    ??lines.find(l=>l.kind==='material'&&!l.takeoffSinkId);
  const projection=projectAreaCost(quote,section);
  const catalogMaterials=useCompanySettingsStore(s=>s.settings.stockMaterials);
  const selectedCost=selectedMaterialCost(
    section.scope?.takeoffMaterial??'',section.scope?.takeoffMaterialReference,catalogMaterials);
  const [ratesOpen,setRatesOpen]=useState(false);
  const [moreLines,setMoreLines]=useState(false);
  const mode:AreaPricingChoice=primary?.pricingMode==='direct'?'manual':
    primary?.pricingMode==='slab-multiplier'?'multiplier':'sf';
  const multiplier=primary?.materialReference?.slabMultiplier??(isDeveloperPlaygroundRoute()?2.2:2);
  const slabPrice=section.scope?.slabCostOverride??projection.slabCost;
  const slabCount=projection.slabCount;
  const activeAmount=primary?quoteLineAmount(primary):0;
  const updateScope=(patch:Partial<NonNullable<QuoteSection['scope']>>)=>{
    const nextSection={...section,scope:{...section.scope,...patch}};
    const nextCost=projectAreaCost(quote,nextSection);
    updateSection(quote.id,section.id,{scope:nextSection.scope});
    // In multiplier mode, yield / cost / purchased slab-count edits affect
    // the actual customer price. Other pricing modes stay untouched.
    if(mode==='multiplier'&&primary){
      const updatedPrice=calculateAreaCustomerPrice('multiplier',{
        sf:nextCost.measuredSf,slabs:nextCost.slabCount,
        costPerSlab:nextCost.slabCost,multiplier,
      });
      if(updatedPrice!==undefined&&Math.abs((primary.amount??0)-updatedPrice)>=.005)
        updateLine(quote.id,primary.id,{
          amount:updatedPrice,materialReference:{
            ...(primary.materialReference??materialRef??{stockProgram:false,pricingSource:'slab-multiplier'}),
            pricingSource:'slab-multiplier',sourceSlabCost:nextCost.slabCost,
            slabCount:nextCost.slabCount,slabMultiplier:multiplier,
          },
        });
    }
  };
  const materialRef=section.scope?.takeoffMaterialReference;
  const ensurePrimary=(choice:AreaPricingChoice)=>{
    if(primary)return primary.id;
    return addCatalogLine(quote.id,'material',{
      sectionId:section.id,
      description:section.scope?.takeoffMaterial?.trim()||'Countertop material',
      materialReference:materialRef,
      pricingMode:choice==='sf'?'quantity-rate':choice==='multiplier'?'slab-multiplier':'direct',
      quantity:projection.measuredSf,
      quantitySource:section.scope?.takeoffPieces?.length?{
        kind:'area-scope',sectionId:section.id,field:'countertopSf',
        syncMode:'live',capturedValue:projection.measuredSf,appliedAt:new Date().toISOString(),
      }:undefined,
      amount:choice==='manual'?0:undefined,
      customerVisible:true,includeInTotal:true,
    });
  };
  const setPrice=(choice:AreaPricingChoice,amount?:number,rate?:number,qty?:number,
    mult?:number,sourceCost?:number)=>{
    const id=ensurePrimary(choice);if(!id)return;
    const previous=primary??useQuoteStore.getState().quotes.find(q=>q.id===quote.id)?.lines.find(l=>l.id===id);
    const nextMode:QuotePricingMode=choice==='manual'?'direct':
      choice==='sf'?'quantity-rate':'slab-multiplier';
    const effectiveSf=projection.measuredSf;
    const effectiveRate=rate??previous?.rate;
    const effectiveCount=qty??projection.slabCount;
    const effectiveMultiplier=mult??previous?.materialReference?.slabMultiplier??(isDeveloperPlaygroundRoute()?2.2:2);
    const effectiveCost=sourceCost??slabPrice;
    const value=calculateAreaCustomerPrice(choice,{
      amount:amount??(previous?.pricingMode==='direct'?previous.amount:activeAmount),
      sf:effectiveSf,rate:effectiveRate,slabs:effectiveCount,
      costPerSlab:effectiveCost,multiplier:effectiveMultiplier,
    });
    const mat={
      ...(previous?.materialReference??materialRef??{stockProgram:false,pricingSource:'manual-line-rate' as const}),
      slabCount:effectiveCount,sourceSlabCost:effectiveCost,
      slabMultiplier:effectiveMultiplier,
      pricingSource:(choice==='multiplier'?'slab-multiplier':'manual-line-rate') as 'slab-multiplier'|'manual-line-rate',
    };
    // The measured SF belongs to Takeoffs; the selling mode never removes
    // its source association or changes its measured quantity.
    const wasLive=previous?.quantitySource?.syncMode==='live';
    const addLink=choice==='sf'&&!wasLive&&section.scope?.takeoffPieces?.length?{
      quantity:projection.measuredSf,
      quantitySource:{
        kind:'area-scope' as const,sectionId:section.id,field:'countertopSf' as const,
        syncMode:'live' as const,capturedValue:projection.measuredSf,
        appliedAt:new Date().toISOString(),
      },
    }:{};
    const patch:Partial<Omit<QuoteLine,'id'>>={
      pricingMode:nextMode,materialReference:mat,
      ...addLink,
      ...(choice==='sf'?{rateReference:undefined}:{}),
      ...(choice==='sf'
        ?{rate:effectiveRate,amount:undefined}
        :{amount:value,rate:undefined}),
    };
    updateLine(quote.id,id,patch);
    // Re-entering SF mode after a manual or slab estimate must catch up with
    // any changed Takeoffs measurements, without detaching the live source.
    if(choice==='sf'&&wasLive&&section.scope?.takeoffPieces&&
      (previous?.pricingMode!=='quantity-rate'||previous?.quantity!==projection.measuredSf))
      updatePieces(quote.id,section.id,section.scope.takeoffPieces);
  };
  const areaTotal=quoteLinesTotal(lines);
  const priceDiff=projection.grossSpread;
  const perc=projection.marginPercent;
  const desiredMargin=section.scope?.targetMargin??.25;
  const separateSell=quoteLinesTotal(lines.filter(l=>l!==primary));
  const marginTotal=projection.complete&&desiredMargin<1?
    projection.totalKnownCost/(1-desiredMargin):undefined;
  const marginMaterialAmount=marginTotal===undefined?undefined:
    Math.max(0,Math.round((marginTotal-separateSell)*100)/100);
  const sfScenario=primary?.rate===undefined?undefined:
    projection.measuredSf*primary.rate+separateSell;
  const multiplierScenario=projection.slabCount!==undefined&&projection.slabCost!==undefined?
    projection.slabCount*projection.slabCost*multiplier+separateSell:undefined;
  const applyMargin=()=>{
    if(marginMaterialAmount===undefined)return;
    setPrice('manual',marginMaterialAmount);
  };

  const addCharge=(kind:QuoteLineKind)=>{
    addLine(quote.id,kind,section.id);
    setMoreLines(false);
  };
  return <section className={'qmb-desktop-pricing-lab qmb-lab-'+view} aria-label="Area pricing and internal costs">
    {view==='calculator'&&<header className="qmb-pricing-lab-heading">
      <div><h3>Buying costs & margin</h3><small>Optional private estimating · sell price stays unchanged</small></div>
      <strong>{perc!==undefined?perc.toFixed(1)+'%':'—'}</strong>
    </header>}
    {(view==='all'||view==='selling')&&<>
    <header className="qmb-pricing-lab-heading">
      <div><h3>Pricing</h3><small>Customer price and private production cost</small></div>
      <strong>{money.format(areaTotal)}</strong>
    </header>
    <div className="qmb-pricing-modes" aria-label="Area selling method">
      {([['manual','Manual'],['sf','Square feet'],['multiplier','Multiplier']] as const).map(([id,label])=>
        <button key={id} type="button" disabled={!editable} aria-pressed={mode===id}
          onClick={()=>setPrice(id)}>{label}</button>)}
    </div>
    {!primary&&<div className="qmb-pricing-hint">Choose a method to create the Area's countertop selling line. Extras can be added below.</div>}
    {mode==='manual'&&<div className="qmb-pricing-formula">
      <label>Manual selling price
        <input aria-label="Area manual selling price" type="number" step=".01" min="0"
          disabled={!editable||!primary} value={decimal(primary?.amount)}
          onChange={e=>setPrice('manual',numeric(e.target.value))}/>
      </label>
      <p className="qmb-math-ledger">Customer price = {money.format(activeAmount)} · slab buying costs still calculated separately.</p>
    </div>}
    {mode==='sf'&&<div className="qmb-pricing-formula">
      <label>Selling price per SF
        <input aria-label="Area selling rate per SF" type="number" step=".01" min="0"
          disabled={!editable||!primary} value={decimal(primary?.rate)}
          onChange={e=>setPrice('sf',undefined,numeric(e.target.value))}/>
      </label>
      <button type="button" className="qmb-pricing-rate-toggle" disabled={!editable}
        aria-expanded={ratesOpen} onClick={()=>setRatesOpen(!ratesOpen)}>Choose builder rate</button>
      {ratesOpen&&<div className="qmb-pricing-rate-popup">
        <QuoteSfRateChoices division={quote.pricingDivision}
          selectedRateId={primary?.rateReference?.rateBookItemId}
          materialType={selectedCost.materialType}
          materialCostPerSf={selectedCost.quotedCostPerSf??selectedCost.currentCatalogCostPerSf}
          onSelect={(price,ref)=>{
            const id=ensurePrimary('sf');
            if(id){setPrice('sf',undefined,price);if(ref)updateLine(quote.id,id,{rateReference:ref});}
            setRatesOpen(false);
          }}/>
      </div>}
      <p className="qmb-math-ledger">{projection.measuredSf.toFixed(2)} SF × {money.format(primary?.rate??0)}/SF = <strong>
        {money.format(projection.measuredSf*(primary?.rate??0))}</strong></p>
    </div>}
    {mode==='multiplier'&&<div className="qmb-pricing-formula">
      <div className="qmb-pricing-double">
        <label>Sell multiplier
          <input aria-label="Area sell multiplier" type="number" min=".01" step=".05"
            disabled={!editable||!primary} value={decimal(primary?.materialReference?.slabMultiplier??2)}
            onChange={e=>setPrice('multiplier',undefined,undefined,undefined,numeric(e.target.value))}/>
        </label>
        <label>Purchased slabs
          <input aria-label="Area multiplier slab count" type="number" min="1" step="1"
            disabled={!editable||!primary} value={decimal(slabCount)}
            onChange={e=>{const n=numeric(e.target.value);if(n!==undefined&&Number.isInteger(n)&&n>0){
              updateScope({slabCountOverride:n});
            }}}/>
        </label>
      </div>
      <p className="qmb-math-ledger">{slabCount??'—'} slabs × {money.format(slabPrice??0)}/slab × {multiplier} =
        <strong> {money.format(activeAmount)}</strong></p>
      {!canUse(slabPrice)&&<small className="qmb-cost-warning">Enter a slab cost below to calculate the selling price.</small>}
    </div>}
    </>}
    {(view==='all'||view==='calculator')&&<>
    <div className="qmb-private-cost" aria-label="Private Area cost and margin">
      {isDeveloperPlaygroundRoute()&&<button className="qmb-demo-preset" type="button" disabled={!editable}
        onClick={()=>updateScope({slabYield:.65,targetMargin:.25,
          shopCostRateSf:14,installCostRateSf:5.5,
          shopCostOverride:undefined,installCostOverride:undefined,
          ...(section.scope?.takeoffMaterialReference?{}:{
            slabAreaOverrideSf:section.scope?.slabAreaOverrideSf??(130*65/144),
            slabCostOverride:section.scope?.slabCostOverride??(39*130*65/144),
          }),
        })}>
        Use spreadsheet example assumptions · 65% yield · 25% margin · $14 shop / $5.50 install per SF
      </button>}
      <header><strong>Buying cost & production</strong><span>Internal only · not on customer quote</span></header>
      <div className="qmb-pricing-double">
        <label>Slab yield %
          <input type="number" aria-label="Area slab yield percent" min="1" max="100" step="1"
            disabled={!editable} value={Math.round(projection.yield*100)}
            onChange={e=>{const v=numeric(e.target.value);if(v!==undefined&&v>=1&&v<=100)updateScope({slabYield:v/100});}}/>
        </label>
        <label>Slab size (SF)
          <input type="number" aria-label="Area supplier slab area SF" min=".01" step=".01"
            disabled={!editable} value={decimal(section.scope?.slabAreaOverrideSf??projection.slabAreaSf)}
            onChange={e=>{const v=numeric(e.target.value);
              if(v===undefined||v>0)updateScope({slabAreaOverrideSf:v});}}/>
        </label>
        <label>Slab buying cost
          <SlabBuyingCostInput value={slabPrice} editable={editable}
            onChange={v=>updateScope({slabCostOverride:v})}/>
        </label>
        <label>Purchased slabs · manual
          <input type="number" aria-label="Area manually purchased slabs" min=".01" step=".25"
            disabled={!editable} placeholder={decimal(projection.suggestedSlabs)}
            value={decimal(section.scope?.slabPurchaseQuantityOverride)}
            onChange={e=>{const v=numeric(e.target.value);
              if(v===undefined||v>0)updateScope({slabPurchaseQuantityOverride:v});}}/>
        </label>
      </div>
      <p className="qmb-math-ledger">{projection.explanation}
        <br/>Buying basis: {projection.purchaseSlabs??'—'} slabs × {money.format(projection.slabCost??0)}
        = {projection.materialCost!==undefined?money.format(projection.materialCost):'Needs supplier cost'}.
        Manual buying quantity may be fractional; selling multiplier uses whole slabs.
      </p>
      <div className="qmb-pricing-double">
        <label>Manual material cost override
          <input type="number" aria-label="Area total material cost override" min="0" step=".01"
            disabled={!editable||!primary} placeholder="Calculated"
            value={decimal(primary?.internalCost)}
            onChange={e=>{if(primary){const v=numeric(e.target.value);
              if(v===undefined||v>=0)updateLine(quote.id,primary.id,{internalCost:v});}}}/>
        </label>
        <div className="qmb-private-calc-result"><small>Material purchase</small>
          <strong>{projection.materialCost!==undefined?money.format(projection.materialCost):'Needs slab cost & size'}</strong>
          <small>{projection.purchaseSlabs??'—'} slab(s) · buying basis</small></div>
      </div>
      <div className="qmb-optional-labor">
        <strong>Fabrication &amp; installation <small>Per-SF assumptions or optional total overrides</small></strong>
        <div className="qmb-pricing-double">
          <label>Shop cost / measured SF
            <div className="qmb-currency-field"><span>$</span><input type="number" min="0" step=".01"
              aria-label="Area shop cost per SF" disabled={!editable}
              value={decimal(section.scope?.shopCostRateSf)} placeholder="Not set"
              onChange={e=>{const v=numeric(e.target.value);if(v===undefined||v>=0)
                updateScope({shopCostRateSf:v,shopCostOverride:undefined});}}/></div>
          </label>
          <label>Install cost / measured SF
            <div className="qmb-currency-field"><span>$</span><input type="number" min="0" step=".01"
              aria-label="Area install cost per SF" disabled={!editable}
              value={decimal(section.scope?.installCostRateSf)} placeholder="Not set"
              onChange={e=>{const v=numeric(e.target.value);if(v===undefined||v>=0)
                updateScope({installCostRateSf:v,installCostOverride:undefined});}}/></div>
          </label>
        </div>
        <div className="qmb-pricing-double">
          <label>Shop / fabrication cost
            <div className="qmb-currency-field"><span aria-hidden="true">$</span>
              <input aria-label="Area shop cost" type="number" min="0" step=".01"
                disabled={!editable} value={decimal(section.scope?.shopCostOverride)}
                placeholder="Not included" onChange={e=>{const n=numeric(e.target.value);
                  if(n===undefined||n>=0)updateScope({shopCostOverride:n});}}/>
            </div>
          </label>
          <label>Installation cost
            <div className="qmb-currency-field"><span aria-hidden="true">$</span>
              <input aria-label="Area installation cost" type="number" min="0" step=".01"
                disabled={!editable} value={decimal(section.scope?.installCostOverride)}
                placeholder="Not included" onChange={e=>{const n=numeric(e.target.value);
                  if(n===undefined||n>=0)updateScope({installCostOverride:n});}}/>
            </div>
          </label>
        </div>
      </div>
      <div className="qmb-private-cost-lines">
        <span>Shop / fabrication cost <b>{money.format(projection.shopCost??0)}</b></span>
        <span>Installation cost <b>{money.format(projection.installCost??0)}</b></span>
        <span>Known sink buying cost <b>{projection.sinkCost!==undefined?money.format(projection.sinkCost):'Missing'}</b></span>
        <span>Other known costs <b>{money.format(projection.otherCost)}</b></span>
        <span>Known total cost <b>{money.format(projection.totalKnownCost)}</b></span>
        <span>Spread on known costs <b>{money.format(priceDiff)}</b></span>
        <span className="qmb-private-margin">Gross margin <b>{perc!==undefined?perc.toFixed(1)+'%':'Incomplete cost coverage'}</b></span>
      </div>
      {!projection.complete&&<p className="qmb-cost-warning">Margin stays provisional until material, sink and other priced work have buying costs.</p>}
    </div>
    <div className="qmb-pricing-comparison" aria-label="Compare project selling methods">
      <header><strong>Compare pricing methods</strong>
        <small>Suggested totals · no change until applied</small>
      </header>
      <label>Target gross margin %
        <input type="number" min="0" max="95" step=".5" aria-label="Area target margin"
          disabled={!editable} value={Math.round(desiredMargin*10000)/100}
          onChange={e=>{const v=numeric(e.target.value);
            if(v!==undefined&&v>=0&&v<=95)updateScope({targetMargin:v/100});}}/>
      </label>
      <div className="qmb-pricing-comparison-grid">
        <div><small>Margin</small>
          <strong>{marginTotal===undefined?'Costs incomplete':money.format(marginTotal)}</strong>
          <span>{Math.round(desiredMargin*100)}% of customer price retained as gross spread</span>
        </div>
        <div><small>Square feet</small>
          <strong>{sfScenario===undefined?'Set SF rate':money.format(sfScenario)}</strong>
          <span>{projection.measuredSf.toFixed(2)} SF × {money.format(primary?.rate??0)}/SF + other charges</span>
        </div>
        <div><small>Multiplier</small>
          <strong>{multiplierScenario===undefined?'Slab data missing':money.format(multiplierScenario)}</strong>
          <span>{projection.slabCount??'—'} whole slabs × {money.format(projection.slabCost??0)} × {multiplier} + others</span>
        </div>
      </div>
      <button type="button" className="qmb-apply-margin" disabled={!editable||marginMaterialAmount===undefined}
        onClick={applyMargin}>Apply margin estimate to quote</button>
      <small>Applying Margin sets the countertop material price, subtracting separately charged Sinks and Add-ons. Later cost changes do not silently reprice the customer quote.</small>
    </div>

    </>}
    {(view==='all'||view==='extras')&&<div className="qmb-desktop-lab-extras">
      <header><strong>Additional line prices</strong>
        <div className="qmb-addon-toolbar qmb-addon-price-toolbar">
          <QuoteBetaRateCatalog label="Add another item from Rates" division={quote.pricingDivision} disabled={!editable}
            onChoose={item=>{if(item)addCatalogLine(quote.id,'rate',{
              ...rateItemToQuotePatch(item,quote),sectionId:section.id,quantity:1,
            });}}/>
          <button type="button" disabled={!editable} onClick={()=>addCharge('item')}>+ Custom</button>
          <button type="button" aria-expanded={moreLines} disabled={!editable}
            onClick={()=>setMoreLines(v=>!v)}>Other…</button>
        </div>
      </header>
      {moreLines&&<div className="qmb-area-extra-buttons">
        {([['item','Custom'],['material','Material'],['sink','Sink'],['rate','Rate'],['allowance','Allowance'],
          ['discount','Discount'],['tax','Tax'],['note','Note'],['scope','Scope'],['warranty','Warranty']] as const)
          .map(([kind,label])=><button type="button" key={kind} onClick={()=>addCharge(kind)}>{label}</button>)}
      </div>}
      {lines.filter(l=>l!==primary&&!l.takeoffSinkId).map(l=><div className="qmb-desktop-extra-row" key={l.id}>
        <div className="qmb-extra-description">
          <input type="text" value={l.description} aria-label={'Area line '+l.id+' description'}
            disabled={!editable} onChange={e=>updateLine(quote.id,l.id,{description:e.target.value})}/>
          <QuoteBetaRateCatalog division={quote.pricingDivision} label={'Choose Rates item for '+l.id}
            disabled={!editable} value={l.rateReference?.rateBookItemId??''}
            onChoose={item=>{if(item)updateLine(quote.id,l.id,{
              ...rateItemToQuotePatch(item,quote),quantity:l.quantity??1,
              customerVisible:l.customerVisible,includeInTotal:l.includeInTotal,
            });}}/>
        </div>
        {l.pricingMode==='quantity-rate'?<div className="qmb-extra-qty-rate">
          <label>Qty<input type="number" step="1" min="0" value={l.quantity??''}
            aria-label={'Area line '+l.id+' quantity'} disabled={!editable||!!l.takeoffSinkId}
            onChange={e=>updateLine(quote.id,l.id,{quantity:numeric(e.target.value)})}/></label>
          <label>Rate<input type="number" step=".01" min="0" value={l.rate??''}
            aria-label={'Area line '+l.id+' sell rate'} disabled={!editable}
            onChange={e=>updateLine(quote.id,l.id,{rate:numeric(e.target.value)})}/></label>
        </div>:l.pricingMode!=='none'?<label>Price<input type="number" step=".01"
          value={l.amount??''} aria-label={'Area line '+l.id+' price'} disabled={!editable}
          onChange={e=>updateLine(quote.id,l.id,{amount:numeric(e.target.value)})}/></label>:<small>No price</small>}
        <label>Buying cost<input type="number" step=".01" min="0"
          aria-label={'Area line '+l.id+' private cost'} disabled={!editable}
          value={l.internalCost??''} placeholder="—"
          onChange={e=>updateLine(quote.id,l.id,{internalCost:numeric(e.target.value)})}/></label>
        <div className="qmb-extra-line-actions">
          <strong>{money.format(quoteLineAmount(l))}</strong>
          <label className="qmb-check"><input type="checkbox" checked={l.customerVisible}
            disabled={!editable} aria-label={'Area line '+l.id+' show to customer'}
            onChange={e=>updateLine(quote.id,l.id,{customerVisible:e.target.checked})}/>Show</label>
          {!l.takeoffSinkId&&<button type="button" className="qmb-extra-delete" disabled={!editable}
            aria-label={'Remove Area line '+l.id} onClick={()=>{
              if(window.confirm('Remove this Area line? You can Undo.'))deleteLine(quote.id,l.id);
            }}>Remove</button>}
        </div>
      </div>)}
      <small>Selling prices, buying costs and customer visibility save together. Managed sink charges stay with their sink selections.</small>
    </div>}
  </section>;
}
