import {useMemo,useRef,useState} from 'react';
import type {PricingContractRateKey,PricingContractQuantities,PricingContractRow,PricingScheduleBuilderData} from '../types/quote';
import {importExcelPricingWorkbook} from '../services/pricingSchedule';
import {
  calculateContractRow,contractPublishedPrice,contractScheduleHealth,
  CONTRACT_COLUMNS,newContractRow,parseContractPricingWorkbook,
} from '../services/pricingScheduleContract';
import {downloadContractPricingXlsx} from '../services/pricingScheduleContractXlsx';
import {generateHouseConfigurations} from '../services/pricingScheduleCombinations';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const RATE_LABELS:Record<PricingContractRateKey,string>={
  corbels:'Corbels / EA',kitchenSinks:'Kitchen sink / EA',
  graniteKitchenSf:'Granite kitchen / SF',quartzKitchenSf:'Quartz kitchen / SF',
  bathSf:'Legacy bath tops / SF',bathBowls:'Vanity bowls / EA',
  graniteBathSf:'Granite bathrooms / SF',quartzBathSf:'Quartz bathrooms / SF',
  kitchenSplashSf:'Kitchen splash / SF (informational)',
  bathSplashSf:'Bath splash / SF (informational)',
};
const valueOrBlank=(v?:number)=>v??'';
function numeric(raw:string){
  if(!raw.trim())return undefined;
  const n=Number(raw);return Number.isFinite(n)?n:undefined;
}
function cloned(row:PricingContractRow):PricingContractRow{
  return {...row,id:crypto.randomUUID(),itemType:'Option',sourceRow:undefined,
    optionCode:row.optionCode+'-ALT',description:row.description+' (alternate)',
    quantities:{...row.quantities},sourceCells:row.sourceCells?.slice()};
}
export function PricingContractTable({builder,onChange}:{builder:PricingScheduleBuilderData;onChange:(next:PricingScheduleBuilderData)=>void}){
  const inputRef=useRef<HTMLInputElement>(null);
  const rows=builder.contractRows??[];
  const rates=builder.contractRates??{};
  const [selectedId,setSelectedId]=useState('');
  const [filter,setFilter]=useState('all');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [splashSf,setSplashSf]=useState('0');
  const [showTakeoffs,setShowTakeoffs]=useState(false);
  const selected=rows.find(r=>r.id===selectedId)??rows[0];
  const plans=useMemo(()=>[...new Map(rows.map(r=>[(r.planNumber||r.planName),r.planName+' · '+r.planNumber])).entries()], [rows]);
  const visible=filter==='all'?rows:rows.filter(r=>(r.planNumber||r.planName)===filter);
  const issues=contractScheduleHealth(builder);
  const save=(patch:Partial<PricingScheduleBuilderData>)=>onChange({...builder,...patch,outputMode:'contract'});
  const patchRow=(id:string,patch:Partial<PricingContractRow>)=>
    save({contractRows:rows.map(r=>r.id===id?{...r,...patch}:r)});
  const patchQuantity=(r:PricingContractRow,key:PricingContractRateKey,text:string)=>{
    const quantities={...r.quantities};const v=numeric(text);
    if(v===undefined)delete quantities[key];else quantities[key]=v;
    patchRow(r.id,{quantities});
  };
  const patchDetail=(r:PricingContractRow,index:number,text:string)=>{
    const sourceCells=(r.sourceCells??Array(40).fill(null)).slice();
    const n=numeric(text);
    sourceCells[index]=n===undefined?(text.trim()?text:null):n;
    patchRow(r.id,{sourceCells});
  };
  const addRow=()=>{
    const row=newContractRow();
    if(selected){row.planNumber=selected.planNumber;row.planName=selected.planName;row.series=selected.series;}
    save({contractRows:[...rows,row]});setSelectedId(row.id);setFilter('all');
  };
  const duplicate=()=>{
    if(!selected)return;
    const copy=cloned(selected);
    save({contractRows:[...rows,copy]});setSelectedId(copy.id);setFilter('all');
  };
  const importFile=async(file:File)=>{
    setBusy(true);setMessage('');
    try{
      const workbook=await importExcelPricingWorkbook(file);
      const parsed=parseContractPricingWorkbook(workbook);
      save({contractRows:parsed.rows,contractRates:parsed.rates,sourceContractFile:file.name});
      setSelectedId(parsed.rows[0]?.id??'');setFilter('all');
      setMessage('Imported '+parsed.rows.length+' base / option rows. Original contract prices are retained; rates and takeoffs can be edited.');
    }catch(e){setMessage(e instanceof Error?e.message:'Could not import this contract worksheet.');}
    finally{setBusy(false);if(inputRef.current)inputRef.current.value='';}
  };
  const exportFile=async()=>{
    setBusy(true);setMessage('');
    try{
      await downloadContractPricingXlsx(builder,builder.sourceContractFile||'builder-contract-pricing.xlsx');
      setMessage('Exported a customer-pricing and takeoff worksheet. Original workbook graphics and advanced styling are not preserved.');
    }catch(e){setMessage(e instanceof Error?e.message:'Could not export the contract worksheet.');}
    finally{setBusy(false);}
  };
  const generate=()=>{
    if(!selected)return;
    try{
      const base=selected.itemType==='Base'?selected:rows.find(r=>
        r.itemType==='Base'&&r.planNumber===selected.planNumber&&r.series===selected.series);
      if(!base)throw new Error('Select a base-house takeoff for this plan.');
      const generated=generateHouseConfigurations(base,Number(splashSf));
      const cleaned=rows.filter(r=>!(r.planNumber===base.planNumber&&r.series===base.series&&/^CFG-[A-F][12]$/.test(r.optionCode)));
      save({contractRows:[...cleaned,...generated]});
      setFilter(base.planNumber||base.planName);setSelectedId(generated[0].id);
      setMessage('Generated 12 separately priced house choices. Enter the Quartz bathrooms / SF rate before publishing.');
    }catch(e){setMessage(e instanceof Error?e.message:'Cannot generate options from that takeoff.');}
  };
  const selectRow=(id:string)=>{
    setSelectedId(id);
    const next=rows.find(r=>r.id===id);
    const alternate=rows.find(r=>r.planNumber===next?.planNumber&&r.itemType==='Base'&&
      typeof r.sourceCells?.[19]==='number'&&Number(r.sourceCells?.[19])>0);
    setSplashSf(String(alternate?.sourceCells?.[19]??next?.sourceCells?.[19]??0));
  };
  return <section className="pricing-contract" aria-label="Builder contract schedule">
    <header className="pricing-builder-panel-heading">
      <div><strong>Builder Contract Table</strong>
        <small>Base houses, independently priced options and detailed takeoffs — compatible with the D.R. Horton A:AJ price-file layout.</small>
      </div>
      <div className="pricing-contract-actions">
        <input ref={inputRef} type="file" accept=".xlsx" hidden
          onChange={e=>{const f=e.target.files?.[0];if(f)void importFile(f);}}/>
        <button type="button" disabled={busy} onClick={()=>inputRef.current?.click()}>Import contract .xlsx</button>
        <button type="button" disabled={busy||!rows.length} onClick={()=>void exportFile()}>Export contract .xlsx</button>
        <button type="button" onClick={addRow}>+ Contract row</button>
      </div>
    </header>
    <div className="pricing-contract-status">
      <span>{rows.length} contract rows</span>
      <span>{plans.length} house plans</span>
      <span>{rows.filter(r=>r.itemType==='Base').length} base · {rows.filter(r=>r.itemType==='Option').length} options</span>
      <span>{builder.sourceContractFile||'Created in SalesShop'}</span>
    </div>
    {message&&<div className="pricing-schedule-message" role="status">{message}</div>}
    <details className="pricing-contract-rates">
      <summary>Contract unit rates <small>(internal · click to edit or add quartz bathroom pricing)</small></summary>
      <div className="pricing-contract-rates-grid">
        {CONTRACT_COLUMNS.map(key=><label key={key}><span>{RATE_LABELS[key]}</span>
          <input type="number" step="0.01" value={valueOrBlank(rates[key])}
            onChange={e=>{
              const next:PricingContractQuantities={...rates};const v=numeric(e.target.value);
              if(v===undefined)delete next[key];else next[key]=v;
              save({contractRates:next});
            }} />
        </label>)}
      </div>
      <small>Kitchen splash SF is already included in the selected kitchen top SF. Bath splashes are already included in the original bath top measurements. No double charges are added.</small>
    </details>
    <div className="pricing-contract-filter">
      <label><span>House plan</span><select value={filter} onChange={e=>setFilter(e.target.value)}>
        <option value="all">All plans ({rows.length})</option>
        {plans.map(([key,title])=><option key={key} value={key}>{title}</option>)}
      </select></label>
      <small>Options are independent contract prices unless explicitly marked as an increment.</small>
    </div>
    <div className="pricing-contract-scroller">
      <table className="pricing-contract-table">
        <thead><tr><th>Series</th><th>Base / Opt</th><th>Plan #</th><th>Plan</th><th>Code</th><th>Description</th><th>Contract price</th><th>Mode</th></tr></thead>
        <tbody>{visible.map(r=>{
          const amount=contractPublishedPrice(r,rates);
          return <tr key={r.id} className={selected?.id===r.id?'active':''}>
            <td>{r.series}</td><td>{r.itemType}</td><td>{r.planNumber}</td>
            <td><button type="button" className="pricing-contract-row-open" onClick={()=>selectRow(r.id)}>{r.planName}</button></td>
            <td>{r.optionCode}</td><td>{r.description}</td>
            <td><strong>{amount===undefined?'Review':money.format(amount)}</strong></td>
            <td>{r.priceMode==='manual'?'Approved':'Calculated'}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {!rows.length&&<div className="pricing-builder-empty">Import a D.R. Horton contract workbook or add a base-house row to begin.</div>}
    {selected&&<section className="pricing-contract-editor">
      <header><strong>Edit contract entry · {selected.planName||'New plan'}</strong>
        <div className="pricing-contract-actions">
          <button type="button" onClick={duplicate}>Duplicate option</button>
          <button type="button" onClick={()=>{
            const next=rows.filter(r=>r.id!==selected.id);
            save({contractRows:next});setSelectedId(next[0]?.id??'');
          }}>Delete row</button>
        </div>
      </header>
      <div className="pricing-contract-fields">
        {([['series','Series'],['planNumber','Plan #'],['planName','Plan name'],['optionCode','Option code'],['description','Description']] as const)
          .map(([key,label])=><label key={key}><span>{label}</span>
            <input value={selected[key]} onChange={e=>patchRow(selected.id,{[key]:e.target.value})}/>
          </label>)}
        <label><span>Line type</span><select value={selected.itemType} onChange={e=>patchRow(selected.id,{itemType:e.target.value as 'Base'|'Option'})}>
          <option value="Base">Base</option><option value="Option">Option</option>
        </select></label>
        <label><span>Customer price method</span><select value={selected.priceMode} onChange={e=>patchRow(selected.id,{priceMode:e.target.value as 'manual'|'calculated'})}>
          <option value="manual">Approved / manual</option><option value="calculated">Calculated from unit rates</option>
        </select></label>
        <label><span>Approved contract price</span><input type="number" step="0.01" value={valueOrBlank(selected.customerPrice)}
          disabled={selected.priceMode!=='manual'} onChange={e=>patchRow(selected.id,{customerPrice:numeric(e.target.value)})}/></label>
      </div>
      <div className="pricing-contract-quantity-title"><strong>Contract quantities</strong><small>Blank quantity means not included. Negative replacement markers are preserved but not automatically deducted.</small></div>
      <div className="pricing-contract-quantities">
        {CONTRACT_COLUMNS.map(key=><label key={key}><span>{RATE_LABELS[key]}</span><input type="number" step="0.01"
          value={valueOrBlank(selected.quantities[key])} onChange={e=>patchQuantity(selected,key,e.target.value)}/></label>)}
      </div>
      <div className="pricing-contract-price-check">
        <span>Calculated from included quantities: <strong>{calculateContractRow(selected,rates).total===undefined?'Needs rates':money.format(calculateContractRow(selected,rates).total!)}</strong></span>
        <span>Customer contract amount: <strong>{contractPublishedPrice(selected,rates)===undefined?'Review':money.format(contractPublishedPrice(selected,rates)!)}</strong></span>
      </div>
      <button type="button" className="pricing-builder-inline-add" onClick={()=>setShowTakeoffs(v=>!v)}>
        {showTakeoffs?'Hide':'Edit'} kitchen / bathroom takeoff details
      </button>
      {showTakeoffs&&<div className="pricing-contract-takeoffs">
        {[['Kitchen sink count',16],['Kitchen perimeter SF',17],['Kitchen island SF',18],['Kitchen splash SF',19],
          ['Owner vanity size',20],['Owner splash sides',21],['Owner top SF',22],['Owner bowls',23],
          ['Bath 2 vanity size',24],['Bath 2 splash sides',25],['Bath 2 top SF',26],['Bath 2 bowls',27],
          ['Bath 3 vanity size',28],['Bath 3 splash sides',29],['Bath 3 top SF',30],['Bath 3 bowls',31],
          ['Bath 4 vanity size',32],['Bath 4 splash sides',33],['Bath 4 top SF',34],['Bath 4 bowls',35],
        ] as const).map(([label,index])=><label key={index}><span>{label}</span>
          <input value={selected.sourceCells?.[index]??''}
            onChange={e=>patchDetail(selected,index,e.target.value)}/></label>)}
        <small>Detailed takeoffs remain attached to this specific contract entry. Editing them does not silently rewrite an approved price.</small>
      </div>}
      <div className="pricing-contract-generator">
        <div><strong>Generate Sanford-style house combinations</strong>
          <small>3 stone mixes × 2 kitchen splash scopes × 2 owner-bath bowl counts = 12 separately priced house configurations.</small>
        </div>
        <label><span>Kitchen backsplash SF (when included)</span>
          <input type="number" step="0.01" min="0" value={splashSf} onChange={e=>setSplashSf(e.target.value)}/>
        </label>
        <button type="button" onClick={generate}>Generate 12 configurations</button>
        <small>Uses this plan's base measurements. Existing CFG-A1 through CFG-F2 rows for the same plan/series are replaced. Quartz bathroom pricing must be set in contract unit rates.</small>
      </div>
    </section>}
    {issues.length>0&&<aside className="pricing-contract-issues">
      <strong>Schedule review · {issues.length} issue{issues.length===1?'':'s'}</strong>
      {issues.slice(0,8).map((issue,i)=><p key={i}>{issue}</p>)}
      {issues.length>8&&<small>+ {issues.length-8} more. Resolve before issuing this schedule.</small>}
    </aside>}
  </section>;
}
