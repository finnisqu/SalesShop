import {useState} from 'react';
import type {Quote,QuoteLine,QuoteLineKind,QuoteSection,QuotePricingMode} from '../types/quote';
import {quoteLineAmount,quoteLinesTotal} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {calculateAreaCustomerPrice,projectAreaCost,type AreaPricingChoice} from '../services/quoteAreaCost';
import {QuoteSfRateChoices} from './QuoteSfRateChoices';
import {useCompanySettingsStore} from '../store/companySettingsStore';
import {selectedMaterialCost} from '../services/selectedMaterialCost';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const decimal=(n:number|undefined)=>n===undefined?'':String(n);
const numeric=(raw:string)=>raw===''?undefined:Number(raw);
const canUse=(n:number|undefined)=>n!==undefined&&Number.isFinite(n)&&n>=0;

/** Internal desktop sales math, distinct from the customer-facing quote paper.
 * Slab yield is an Area-specific override; absent means the 65% default. */
export function QuoteBetaDesktopPricing({quote,section,editable}:{
  quote:Quote;section:QuoteSection;editable:boolean;
}){
  const updateLine=useQuoteStore(s=>s.updateLine);
  const deleteLine=useQuoteStore(s=>s.deleteLine);
  const updateSection=useQuoteStore(s=>s.updateSection);
  const addCatalogLine=useQuoteStore(s=>s.addCatalogLine);
  const addLine=useQuoteStore(s=>s.addLine);
  const setTakeoffRate=useQuoteStore(s=>s.setTakeoffRate);
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
  const multiplier=primary?.materialReference?.slabMultiplier??2;
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
    const effectiveMultiplier=mult??previous?.materialReference?.slabMultiplier??2;
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
    const patch:Partial<Omit<QuoteLine,'id'>>={
      pricingMode:nextMode,materialReference:mat,
      ...(choice==='sf'?{rateReference:undefined}:{}),
      ...(choice==='sf'
        ?{rate:effectiveRate,amount:undefined}
        :{amount:value,rate:undefined}),
    };
    updateLine(quote.id,id,patch);
  };
  const areaTotal=quoteLinesTotal(lines);
  const priceDiff=projection.grossSpread;
  const perc=projection.marginPercent;
  const addCharge=(kind:QuoteLineKind)=>{
    addLine(quote.id,kind,section.id);
    setMoreLines(false);
  };
  return <section className="qmb-desktop-pricing-lab" aria-label="Area pricing and internal costs">
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
    <div className="qmb-private-cost" aria-label="Private Area cost and margin">
      <header><strong>Internal cost</strong><span>Private · never on the customer quote</span></header>
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
        <label>Buying cost / slab
          <input type="number" aria-label="Area buying cost per slab" min="0" step=".01"
            disabled={!editable} value={decimal(slabPrice)}
            onChange={e=>{const v=numeric(e.target.value);
              if(v===undefined||v>=0)updateScope({slabCostOverride:v});}}/>
        </label>
        <label>Slabs to purchase
          <input type="number" aria-label="Area slab quantity override" min="1" step="1"
            disabled={!editable} placeholder={decimal(projection.suggestedSlabs)}
            value={decimal(section.scope?.slabCountOverride)}
            onChange={e=>{const v=numeric(e.target.value);
              if(v===undefined||(Number.isInteger(v)&&v>0)){
                updateScope({slabCountOverride:v});
              }}}/>
        </label>
      </div>
      <p className="qmb-math-ledger">{projection.explanation}</p>
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
          <small>{projection.slabCount??'—'} slab(s) estimated</small></div>
      </div>
      <div className="qmb-private-cost-lines">
        <span>Known sink buying cost <b>{projection.sinkCost!==undefined?money.format(projection.sinkCost):'Missing'}</b></span>
        <span>Other known costs <b>{money.format(projection.otherCost)}</b></span>
        <span>Known total cost <b>{money.format(projection.totalKnownCost)}</b></span>
        <span>Spread on known costs <b>{money.format(priceDiff)}</b></span>
        <span className="qmb-private-margin">Gross margin <b>{perc!==undefined?perc.toFixed(1)+'%':'Incomplete cost coverage'}</b></span>
      </div>
      {!projection.complete&&<p className="qmb-cost-warning">Margin stays provisional until material, sink and other priced work have buying costs.</p>}
    </div>
    <div className="qmb-desktop-lab-customer">
      <strong>Customer presentation</strong>
      <div className="qmb-pricing-modes">
        <button type="button" disabled={!editable} aria-pressed={section.customerDisplayMode!=='detail'}
          onClick={()=>updateSection(quote.id,section.id,{customerDisplayMode:'summary'})}>Lump sum</button>
        <button type="button" disabled={!editable} aria-pressed={section.customerDisplayMode==='detail'}
          onClick={()=>updateSection(quote.id,section.id,{customerDisplayMode:'detail'})}>Itemized</button>
      </div>
    </div>
    <div className="qmb-desktop-lab-extras">
      <header><strong>Additional Area lines</strong><button type="button"
        aria-expanded={moreLines} disabled={!editable} onClick={()=>setMoreLines(v=>!v)}>+ Add</button></header>
      {moreLines&&<div className="qmb-area-extra-buttons">
        {([['item','Custom'],['material','Material'],['sink','Sink'],['rate','Rate'],['allowance','Allowance'],
          ['discount','Discount'],['tax','Tax'],['note','Note'],['scope','Scope'],['warranty','Warranty']] as const)
          .map(([kind,label])=><button type="button" key={kind} onClick={()=>addCharge(kind)}>{label}</button>)}
      </div>}
      {lines.filter(l=>l!==primary).map(l=><div className="qmb-desktop-extra-row" key={l.id}>
        <input type="text" value={l.description} aria-label={'Area line '+l.id+' description'}
          disabled={!editable} onChange={e=>updateLine(quote.id,l.id,{description:e.target.value})}/>
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
        <label>Cost · private<input type="number" step=".01" min="0"
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
      <small>Prices, source costs and customer visibility save on the quote. Sink quantities remain linked to Materials.</small>
    </div>
  </section>;
}
