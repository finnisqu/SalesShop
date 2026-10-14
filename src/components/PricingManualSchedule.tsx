import {useEffect,useMemo,useRef,useState} from 'react';
import type {PricingManualAddon,PricingScheduleBuilderData} from '../types/quote';
import {
  addManualAddon,addManualPackage,addManualPlan,duplicateManualPlan,
  effectiveManualAddonRate,manualAddonOffered,manualPackageOffered,
  manualPriceRow,manualPricingHealth,removeManualPackage,removeManualPlan,
  setManualMatrixPrice,setManualPackageOffered,standardManualPackages,
  updateManualPackage,updateManualPlan,
} from '../services/pricingScheduleManual';
import {contractPublishedPrice,deriveContractCustomerItems} from '../services/pricingScheduleContract';
import {PricingScheduleCustomerTable} from './PricingScheduleCustomerTable';
import '../pricing-schedule-manual.css';

const dollar=(value:number)=>new Intl.NumberFormat('en-US',{
  style:'currency',currency:'USD',maximumFractionDigits:2,
}).format(value);
const number=(value:string):number|undefined=>{
  if(!value.trim())return;
  const parsed=Number(value);
  return Number.isFinite(parsed)&&parsed>=0?parsed:undefined;
};
/** Blur/Tab commits; keeps intermediate decimal input from being rounded away
 * by quote-store re-renders while somebody is typing. Empty means unset. */
function PriceInput({value,onCommit,label,placeholder,disabled}:{
  value?:number;onCommit:(value:number|undefined)=>void;
  label:string;placeholder?:string;disabled?:boolean;
}){
  const [draft,setDraft]=useState(value===undefined?'':String(value));
  const [invalid,setInvalid]=useState(false);
  useEffect(()=>{setDraft(value===undefined?'':String(value));setInvalid(false);},[value]);
  const commit=()=>{
    const clean=draft.trim();
    if(clean&&number(clean)===undefined){setInvalid(true);return;}
    setInvalid(false);
    const parsed=number(clean);
    if(parsed!==value)onCommit(parsed);
  };
  return <label className="pricing-manual-money">
    <span aria-hidden="true">$</span>
    <input aria-label={label} type="number" step="0.01" min="0"
      value={draft} placeholder={placeholder??'—'} disabled={disabled}
      aria-invalid={invalid} title={invalid?'Enter a nonnegative amount':undefined}
      onChange={e=>{setDraft(e.target.value);setInvalid(false);}}
      onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>
  </label>;
}
function TextCommit({value,onCommit,label,placeholder}:{
  value:string;onCommit:(value:string)=>void;label:string;placeholder?:string;
}){
  const [draft,setDraft]=useState(value);
  useEffect(()=>setDraft(value),[value]);
  const commit=()=>{if(draft.trim()!==value)onCommit(draft.trim());};
  return <input aria-label={label} value={draft} placeholder={placeholder}
    onChange={e=>setDraft(e.target.value)} onBlur={commit}
    onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>;
}
type Mode='matrix'|'addons';
export function PricingManualSchedule({builder,onChange,mode}:{
  builder:PricingScheduleBuilderData;onChange:(next:PricingScheduleBuilderData)=>void;mode:Mode;
}){
  const plans=builder.manualPlans??[],packages=builder.manualPackages??[],addons=builder.manualAddons??[];
  const [newName,setNewName]=useState('');
  const [newNumber,setNewNumber]=useState('');
  const [newSeries,setNewSeries]=useState('');
  const [newPackageCode,setNewPackageCode]=useState('');
  const [newPackageName,setNewPackageName]=useState('');
  const [newAddonName,setNewAddonName]=useState('');
  const [newAddonCode,setNewAddonCode]=useState('');
  const [newAddonUnit,setNewAddonUnit]=useState<PricingManualAddon['unit']>('flat');
  const [newAddonBehavior,setNewAddonBehavior]=useState<PricingManualAddon['behavior']>('increment');
  const [feedback,setFeedback]=useState('');
  const nameRef=useRef<HTMLInputElement>(null);
  const review=useMemo(()=>manualPricingHealth(builder),[builder]);
  const activeCells=plans.reduce((count,plan)=>count+packages.filter(p=>manualPackageOffered(plan,p)).length,0);
  const pricedCells=plans.reduce((count,plan)=>count+packages.filter(p=>{
    if(!manualPackageOffered(plan,p))return false;
    const r=manualPriceRow(builder,plan.id,p.id);
    return r?.priceMode==='manual'
      ?r.customerPrice!==undefined:Number.isFinite(r?.customerPrice??NaN)
      :r!==undefined&&contractPublishedPrice(r,builder.contractRates??{})!==undefined;
  }).length,0);
  const run=(fn:()=>PricingScheduleBuilderData,success?:string)=>{
    try{onChange(fn());setFeedback(success??'');return true;}
    catch(e){setFeedback(e instanceof Error?e.message:'Could not save changes.');return false;}
  };
  const startPackages=()=>run(()=>({
    ...builder,manualPackages:standardManualPackages(),outputMode:'contract',
    // This starter is offered only when no package definitions or plan rows
    // exist, so no previously entered prices are ever destroyed.
  }),'Six standard material/splash packages are ready. Add a house plan to begin.');
  const createPlan=()=>{
    if(run(()=>addManualPlan(builder,{name:newName,planNumber:newNumber,series:newSeries}),
      'House plan added. Enter prices across its offered packages.')){
      setNewName('');setNewNumber('');nameRef.current?.focus();
    }
  };
  const createPackage=()=>{
    if(run(()=>addManualPackage(builder,newPackageCode,newPackageName),
      'Package added to each house plan, without inventing any prices.')){
      setNewPackageCode('');setNewPackageName('');
    }
  };
  const createAddon=(details?:{name:string;code:string;unit:PricingManualAddon['unit'];behavior:PricingManualAddon['behavior']})=>{
    const v=details??{name:newAddonName,code:newAddonCode,unit:newAddonUnit,behavior:newAddonBehavior};
    if(run(()=>addManualAddon(builder,v),'Add-on added. Set its standard rate or an individual plan override.')){
      setNewAddonName('');setNewAddonCode('');
    }
  };
  const changeAddon=(addonId:string,patch:Partial<PricingManualAddon>)=>{
    onChange({...builder,outputMode:'contract',manualAddons:addons.map(a=>a.id===addonId?{...a,...patch}:a)});
  };
  const addonOffered=(addon:PricingManualAddon,planId:string,offered:boolean)=>{
    const excluded=new Set(addon.excludedPlanIds??[]);
    if(offered)excluded.delete(planId);else excluded.add(planId);
    changeAddon(addon.id,{excludedPlanIds:[...excluded]});
  };
  const addonOverride=(addon:PricingManualAddon,planId:string,value:number|undefined)=>{
    const rates={...addon.planRates};
    if(value===undefined)delete rates[planId];else rates[planId]=value;
    changeAddon(addon.id,{planRates:rates});
  };
  return <section className="pricing-manual" aria-label={mode==='matrix'?'Manual pricing matrix':'Manual add-on rates'}>
    {mode==='matrix'?<>
      <header className="pricing-manual-heading">
        <div><strong>Build the house price matrix</strong>
          <small>One house plan per row, one material/splash package per column. Every price is a complete house price—not an add-on.</small>
        </div>
        <div className="pricing-manual-progress">
          <strong>{pricedCells} / {activeCells}</strong><span>prices entered</span>
        </div>
      </header>
      {feedback&&<div className="pricing-schedule-message" role="status">{feedback}</div>}
      {packages.length===0&&<div className="pricing-manual-start">
        <div><strong>Start with the six countertop configurations</strong>
          <small>All granite, granite kitchen/quartz bathrooms, and all quartz; with all splashes or bathroom splashes only.</small></div>
        <button type="button" onClick={startPackages}>Use six standard packages</button>
      </div>}
      <form className="pricing-manual-new-plan" onSubmit={e=>{e.preventDefault();createPlan();}}>
        <strong>+ House plan</strong>
        <label><span>Plan name</span><input ref={nameRef} value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Sanford" required/></label>
        <label><span>Plan #</span><input value={newNumber} onChange={e=>setNewNumber(e.target.value)} placeholder="1183"/></label>
        <label><span>Series</span><input value={newSeries} onChange={e=>setNewSeries(e.target.value)} placeholder="DRH-e"/></label>
        <button type="submit">Add plan</button>
      </form>
      <div className="pricing-manual-table-scroll">
        <table className="pricing-manual-matrix">
          <thead><tr><th>House plan</th>
            {packages.map(pkg=><th key={pkg.id}><strong>{pkg.code}</strong><span>{pkg.name}</span></th>)}
            <th>Actions</th>
          </tr></thead>
          <tbody>{plans.map(plan=><tr key={plan.id}>
            <th scope="row">
              <TextCommit value={plan.name} label={'Plan name for '+plan.name} onCommit={name=>
                run(()=>updateManualPlan(builder,plan.id,{name}))}/>
              <div className="pricing-manual-plan-sub">
                <TextCommit value={plan.planNumber} label={'Plan number for '+plan.name} placeholder="Plan #"
                  onCommit={planNumber=>run(()=>updateManualPlan(builder,plan.id,{planNumber}))}/>
                <TextCommit value={plan.series} label={'Series for '+plan.name} placeholder="Series"
                  onCommit={series=>run(()=>updateManualPlan(builder,plan.id,{series}))}/>
              </div>
            </th>
            {packages.map(pkg=>{
              const offered=manualPackageOffered(plan,pkg);
              const row=manualPriceRow(builder,plan.id,pkg.id);
              const value=row?.priceMode==='manual'?row.customerPrice:
                row?contractPublishedPrice(row,builder.contractRates??{}):undefined;
              return <td key={pkg.id} className={offered?(value===undefined?'needs-price':'is-priced'):'not-offered'}>
                <label className="pricing-manual-offer"><input type="checkbox" checked={offered}
                  onChange={e=>run(()=>setManualPackageOffered(builder,plan.id,pkg.id,e.target.checked))}/>
                  <span>{offered?'Offered':'Not offered'}</span></label>
                {offered&&(row?.priceMode==='calculated'?
                  <div className="pricing-manual-calculated" title="Calculated using Contract Table quantities and rates">
                    <strong>{value===undefined?'Needs rates':dollar(value)}</strong><small>Calculated</small>
                  </div>:
                  <PriceInput label={'Price for '+plan.name+' option '+pkg.code}
                    value={value} onCommit={price=>run(()=>setManualMatrixPrice(builder,plan.id,pkg.id,price))}/>)}
              </td>;
            })}
            <td className="pricing-manual-row-actions">
              <button type="button" onClick={()=>run(()=>duplicateManualPlan(builder,plan.id),
                'Plan duplicated with measurements, but prices left blank for review.')}>Duplicate</button>
              <button type="button" onClick={()=>{
                if(window.confirm('Delete '+plan.name+' and its package prices? This cannot be undone.'))
                  run(()=>removeManualPlan(builder,plan.id));
              }}>Delete</button>
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      {!plans.length&&<div className="pricing-builder-empty">Add Sanford or another house plan above. Six standard packages can be created automatically, and every price starts blank.</div>}
      <details className="pricing-manual-packages">
        <summary>Manage option columns <small>({packages.length} packages)</small></summary>
        <div className="pricing-manual-package-list">
          {packages.map(pkg=><div key={pkg.id} className="pricing-manual-package">
            <TextCommit label={'Code for '+pkg.name} value={pkg.code} onCommit={code=>
              run(()=>updateManualPackage(builder,pkg.id,{code}))}/>
            <TextCommit label={'Package '+pkg.code+' name'} value={pkg.name} onCommit={name=>
              run(()=>updateManualPackage(builder,pkg.id,{name}))}/>
            <button type="button" onClick={()=>{
              if(window.confirm('Remove '+pkg.code+' from every plan? Its existing prices will be deleted.'))
                run(()=>removeManualPackage(builder,pkg.id));
            }}>Remove</button>
          </div>)}
        </div>
        <form className="pricing-manual-add-package" onSubmit={e=>{e.preventDefault();createPackage();}}>
          <label><span>Code</span><input value={newPackageCode} required placeholder="G"
            onChange={e=>setNewPackageCode(e.target.value)}/></label>
          <label><span>Package description</span><input value={newPackageName} required
            placeholder="Quartz kitchen upgrade" onChange={e=>setNewPackageName(e.target.value)}/></label>
          <button type="submit">+ Add option column</button>
        </form>
      </details>
      <details className="pricing-manual-preview">
        <summary>Customer price schedule preview</summary>
        <PricingScheduleCustomerTable items={deriveContractCustomerItems(builder)} compact/>
      </details>
      {!!review.length&&<div className="pricing-manual-review"><strong>To review: {review.length}</strong>
        <span>{review.slice(0,3).join(' · ')}{review.length>3?' · +'+(review.length-3)+' more':''}</span>
      </div>}
    </>:<>
      <header className="pricing-manual-heading">
        <div><strong>Add-on rate book</strong>
          <small>Create reusable upgrade rates, then override them for particular plans only when necessary. These are separate from full-house option prices.</small>
        </div>
      </header>
      {feedback&&<div className="pricing-schedule-message" role="status">{feedback}</div>}
      <div className="pricing-manual-templates">
        <strong>Quick add</strong>
        <button type="button" onClick={()=>createAddon({
          name:'Master bathroom double-bowl upgrade',code:'DBL-BOWL',unit:'flat',behavior:'increment',
        })}>+ Double-bowl master</button>
        <button type="button" onClick={()=>createAddon({
          name:'Additional vanity sink',code:'ADD-BOWL',unit:'each',behavior:'increment',
        })}>+ Vanity bowl</button>
        <button type="button" onClick={()=>createAddon({
          name:'Corbel / support',code:'CORBEL',unit:'each',behavior:'increment',
        })}>+ Corbel</button>
        <button type="button" onClick={()=>createAddon({
          name:'Kitchen sink upgrade',code:'K-SINK-UP',unit:'flat',behavior:'increment',
        })}>+ Kitchen sink upgrade</button>
      </div>
      <form className="pricing-manual-new-addon" onSubmit={e=>{e.preventDefault();createAddon();}}>
        <label><span>New add-on</span><input required value={newAddonName} placeholder="Waterfall edge"
          onChange={e=>setNewAddonName(e.target.value)}/></label>
        <label><span>Code</span><input value={newAddonCode} placeholder="ADD-05"
          onChange={e=>setNewAddonCode(e.target.value)}/></label>
        <label><span>Pricing unit</span><select value={newAddonUnit}
          onChange={e=>setNewAddonUnit(e.target.value as PricingManualAddon['unit'])}>
          <option value="flat">Flat</option><option value="each">Each</option><option value="sf">SF</option>
        </select></label>
        <label><span>Meaning</span><select value={newAddonBehavior}
          onChange={e=>setNewAddonBehavior(e.target.value as PricingManualAddon['behavior'])}>
          <option value="increment">Additional charge</option>
          <option value="standalone">Replacement price</option>
        </select></label>
        <button type="submit">+ Add rate</button>
      </form>
      <div className="pricing-manual-addon-list">
        {addons.map(addon=><div key={addon.id} className="pricing-manual-addon-card">
          <div className="pricing-manual-addon-line">
            <TextCommit label={'Add-on code '+addon.name} value={addon.code}
              onCommit={code=>{if(addons.some(a=>a.id!==addon.id&&a.code.toLowerCase()===code.toLowerCase()))
                setFeedback('Add-on codes must be unique.');
              else if(code)changeAddon(addon.id,{code});}}/>
            <TextCommit label={'Add-on name '+addon.code} value={addon.name}
              onCommit={name=>{if(name)changeAddon(addon.id,{name});}}/>
            <label><span>Unit</span><select value={addon.unit} onChange={e=>
              changeAddon(addon.id,{unit:e.target.value as PricingManualAddon['unit']})}>
              <option value="flat">Flat</option><option value="each">Each</option><option value="sf">SF</option>
            </select></label>
            <label><span>Type</span><select value={addon.behavior} onChange={e=>
              changeAddon(addon.id,{behavior:e.target.value as PricingManualAddon['behavior']})}>
              <option value="increment">Additional charge</option><option value="standalone">Replacement price</option>
            </select></label>
            <div className="pricing-manual-addon-default">
              <span>Standard rate</span><PriceInput label={'Standard rate for '+addon.name}
                value={addon.defaultRate} onCommit={defaultRate=>changeAddon(addon.id,{defaultRate})}/>
            </div>
            <button type="button" onClick={()=>{
              if(window.confirm('Delete '+addon.name+' and all its plan-specific rates?'))
                onChange({...builder,outputMode:'contract',manualAddons:addons.filter(a=>a.id!==addon.id)});
            }}>Delete</button>
          </div>
        </div>)}
      </div>
      {addons.length===0&&<div className="pricing-builder-empty">Use a quick-add template or create an add-on above. Prices are blank until you enter them.</div>}
      {addons.length>0&&plans.length>0&&<>
        <div className="pricing-manual-addon-heading"><strong>Rates by plan</strong>
          <small>Blank overrides inherit the standard rate. Uncheck Offered if the add-on is unavailable for a particular plan.</small></div>
        <div className="pricing-manual-table-scroll">
          <table className="pricing-manual-matrix pricing-manual-addon-matrix">
            <thead><tr><th>House plan</th>{addons.map(addon=>
              <th key={addon.id}><strong>{addon.code}</strong><span>{addon.name}</span></th>)}</tr></thead>
            <tbody>{plans.map(plan=><tr key={plan.id}>
              <th scope="row"><strong>{plan.name}</strong><small>{plan.planNumber} {plan.series}</small></th>
              {addons.map(addon=>{
                const offered=manualAddonOffered(addon,plan.id);
                const overridden=addon.planRates?.[plan.id];
                const rate=effectiveManualAddonRate(addon,plan.id);
                return <td key={addon.id} className={!offered?'not-offered':rate===undefined?'needs-price':'is-priced'}>
                  <label className="pricing-manual-offer"><input type="checkbox" checked={offered}
                    onChange={e=>addonOffered(addon,plan.id,e.target.checked)}/>
                    <span>{offered?'Offered':'Not offered'}</span></label>
                  {offered&&<><PriceInput label={addon.name+' override for '+plan.name}
                    value={overridden} placeholder={addon.defaultRate!==undefined?dollar(addon.defaultRate):'Rate'}
                    onCommit={price=>addonOverride(addon,plan.id,price)}/>
                    <small className="pricing-manual-inheritance">
                      {overridden!==undefined?'Plan override':rate===undefined?'Needs rate':'Using standard'}
                    </small></>}
                </td>;
              })}</tr>)}</tbody>
          </table>
        </div>
      </>}
      {!plans.length&&addons.length>0&&<div className="pricing-builder-empty">Add house plans in Manual Matrix to set plan-specific add-on rates. Standard rates can be set above now.</div>}
      <details className="pricing-manual-preview"><summary>Customer add-on schedule preview</summary>
        <PricingScheduleCustomerTable items={deriveContractCustomerItems(builder).filter(item=>item.itemType==='Add-on')} compact/>
      </details>
    </>}
  </section>;
}
