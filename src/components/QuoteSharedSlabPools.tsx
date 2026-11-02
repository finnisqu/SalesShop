import {useMemo,useState} from 'react';
import type {Quote} from '../types/quote';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {projectAreaCost} from '../services/quoteAreaCost';
import {createQuoteSlabPool,estimateQuoteSlabPool,quoteSharedSlabEstimates,
 slabPoolMaterialKey} from '../services/quoteSharedSlabs';
import {totalBillableTakeoffSf} from '../services/quoteTakeoffsLite';
import {isGeneralTakeoffSection} from '../services/quoteCustomerPresentation';
import {useQuoteStore} from '../store/quoteStore';
import './quote-shared-slab-pools.css';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
export function QuoteSharedSlabPools({quote}:{quote:Quote}){
 const add=useQuoteStore(s=>s.addSlabPool),remove=useQuoteStore(s=>s.removeSlabPool);
 const editable=quoteIsCommerciallyEditable(quote);
 const [selected,setSelected]=useState<string[]>([]);
 const [label,setLabel]=useState('Shared slab batch');
 const [areaSfInput,setAreaSfInput]=useState('');
 const [unitCostInput,setUnitCostInput]=useState('');
 const [yieldInput,setYieldInput]=useState('65');
 const [countInput,setCountInput]=useState('');
 const [confirmRemove,setConfirmRemove]=useState<string|null>(null);
 const [error,setError]=useState('');
 const active=new Set(selected);
 const areas=quote.sections.filter(s=>!isGeneralTakeoffSection(s));
 const existing=quoteSharedSlabEstimates(quote);
 const occupied=new Set((quote.slabPools??[]).flatMap(p=>p.sectionIds));
 const first=areas.find(s=>active.has(s.id));
 const firstCost=first?projectAreaCost(quote,first):null;
 const slabArea=areaSfInput.trim()!==''?Number(areaSfInput):firstCost?.slabAreaSf;
 const slabCost=unitCostInput.trim()!==''?Number(unitCostInput):firstCost?.slabCost;
 const yieldFraction=Number(yieldInput)/100;
 const spec={id:'preview',label,slabAreaSf:slabArea??NaN,slabCost:slabCost??NaN,
   yield:yieldFraction,...(countInput.trim()?{slabCountOverride:Number(countInput)}:{})};
 const candidate=useMemo(()=>createQuoteSlabPool(quote,selected,spec),
   [quote,selected,label,slabArea,slabCost,yieldFraction,countInput]);
 const preview=candidate?estimateQuoteSlabPool(quote,candidate):null;
 const apply=()=>{
   if(!candidate||!preview?.valid)return;
   const result=add(quote.id,selected,{...spec,id:crypto.randomUUID()});
   if(!result){setError('Unable to save this slab pool. Check material and Area compatibility.');return;}
   setSelected([]);setAreaSfInput('');setUnitCostInput('');setCountInput('');setError('');
 };
 return <section className="qmb-slab-pools" aria-label="Shared slab buying planner">
   <header><div><h3>Shared slab buying</h3>
     <p>Count compatible Kitchen, Vanity and other Areas together. One physical slab can cover multiple Areas.
       Private buying costs are divided by measured SF; customer selling prices do not change automatically.</p></div>
     <span>Private estimate</span></header>
   {existing.map(group=><div className="qmb-slab-pool-existing" key={group.pool.id}>
     <div><strong>{group.pool.label}</strong>
       <small>{group.pool.sectionIds.map(id=>quote.sections.find(s=>s.id===id)?.title??'Removed Area').join(' + ')}</small>
       {group.valid?<span>{number.format(group.measuredSf)} SF together ·
         <b> {group.slabCount} physical slabs</b> vs {group.independentSlabCount} separately ·
         <b> {money.format(group.totalBuyingCost??0)} total buying</b></span>
         :<span className="is-warning">Recheck pool: {group.reason}. Individual Area costing is used until repaired.</span>}
     </div>
     {editable&&(confirmRemove===group.pool.id?
       <div className="qmb-pool-delete-actions">
         <button type="button" onClick={()=>{remove(quote.id,group.pool.id);setConfirmRemove(null);}}>Confirm ungroup</button>
         <button type="button" onClick={()=>setConfirmRemove(null)}>Cancel</button>
       </div>
       :<button type="button" onClick={()=>setConfirmRemove(group.pool.id)}>Ungroup</button>)}
   </div>)}
   {editable&&<div className="qmb-slab-pool-builder">
     <strong>Combine Areas into a new slab pool</strong>
     <small>Only Areas using the same material, variant, thickness, finish and purchase option can share a pool. Slab nesting and cut feasibility still need shop verification.</small>
     <div className="qmb-slab-area-choices">
       {areas.map(area=>{
         const sf=totalBillableTakeoffSf(area.scope?.takeoffPieces??[]);
         const key=slabPoolMaterialKey(area);
         const firstKey=first?slabPoolMaterialKey(first):null;
         const disabled=occupied.has(area.id)||!key||sf<=0||!!(firstKey&&!active.has(area.id)&&firstKey!==key);
         return <label key={area.id} className={disabled?'is-disabled':''}>
           <input type="checkbox" checked={active.has(area.id)} disabled={disabled}
             aria-label={'Pool Area '+(area.title||'Untitled Area')}
             onChange={e=>{setError('');setSelected(v=>e.target.checked?[...v,area.id]:v.filter(id=>id!==area.id));}}/>
           <span>{area.title||'Untitled Area'} <small>{number.format(sf)} SF · {area.scope?.takeoffMaterial||'No material'}</small></span>
         </label>;
       })}
     </div>
     <div className="qmb-slab-pool-fields">
       <label>Pool name<input type="text" value={label} maxLength={100} onChange={e=>setLabel(e.target.value)}/></label>
       <label>Slab area (SF)<input type="number" step=".01" min=".01" value={areaSfInput}
         placeholder={firstCost?.slabAreaSf?.toFixed(2)??'Required'}
         onChange={e=>setAreaSfInput(e.target.value)}/></label>
       <label>Buying cost / slab<input type="number" step=".01" min="0" value={unitCostInput}
         placeholder={firstCost?.slabCost!==undefined?String(firstCost.slabCost):'Required'}
         onChange={e=>setUnitCostInput(e.target.value)}/></label>
       <label>Usable yield %<input type="number" step="1" min="1" max="100" value={yieldInput}
         onChange={e=>setYieldInput(e.target.value)}/></label>
       <label>Manual whole slabs (optional)<input type="number" step="1" min="1" value={countInput}
         placeholder="Calculated" onChange={e=>setCountInput(e.target.value)}/></label>
     </div>
     <div className="qmb-slab-pool-preview" role="status">
       {preview?.valid?<><strong>{preview.slabCount} pooled slabs vs {preview.independentSlabCount} separately</strong>
         <span>{number.format(preview.measuredSf)} combined SF · {money.format(preview.totalBuyingCost??0)} total material purchase
           {preview.independentSlabCount>preview.slabCount!?' · '+(preview.independentSlabCount-preview.slabCount!)+' fewer slab(s) estimated':''}</span></>:
         <span>Select at least two measured compatible Areas and a slab size/cost to calculate one shared buying count.</span>}
     </div>
     {error&&<p role="alert">{error}</p>}
     <button type="button" className="qmb-slab-pool-apply" disabled={!preview?.valid}
       onClick={apply}>Save shared slab pool</button>
     <small>Slabs are counted once for buying. Allocated buying costs can inform a 30% margin scenario.
       An Area's existing multiplier selling price stays as quoted until explicitly reviewed.</small>
   </div>}
 </section>;
}
