import {useEffect,useState,type FormEvent} from 'react';
import type {Company} from '../types/crm';
import {companyAnnualPotential,companyEstimatedAnnualWork} from '../types/crm';
import {useCrmStore} from '../store/crmStore';

const fmt=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
type Fields={annualUnits:string;averageUnitValue:string;expectedSharePct:string};
const snapshot=(company:Company):Fields=>({
 annualUnits:company.annualUnits?.toString()??'',
 averageUnitValue:company.averageUnitValue?.toString()??'',
 expectedSharePct:company.expectedSharePct?.toString()??'',
});
function parseField(value:string,label:string,{max,integer=false}:{max?:number;integer?:boolean}={}){
 const s=value.trim();if(!s)return undefined;
 const n=Number(s);
 if(!Number.isFinite(n)||n<0||(max!==undefined&&n>max)||(integer&&!Number.isInteger(n)))
  throw new Error(label+' must be '+(integer?'a whole':'a valid')+' number'+
    (max===undefined?' of zero or greater':' between zero and '+max)+'.');
 return n;
}
/** Forecast controls are local to the Company Forecast tab; no global Edit Page mode. */
export function CompanyForecastEditor375({company,canEdit}:{company:Company;canEdit:boolean}){
 const updateCompany=useCrmStore(s=>s.updateCompany);
 const [editing,setEditing]=useState(false);
 const [draft,setDraft]=useState<Fields>(()=>snapshot(company));
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);
 useEffect(()=>{
  if(!editing)setDraft(snapshot(company));
 },[company.id,company.annualUnits,company.averageUnitValue,company.expectedSharePct,editing]);
 useEffect(()=>{if(!canEdit){setEditing(false);setError('');}},[canEdit]);
 const open=()=>{if(!canEdit)return;setError('');setDraft(snapshot(company));setEditing(true);};
 const close=()=>{if(saving)return;setError('');setEditing(false);};
 const save=async(event:FormEvent)=>{
  event.preventDefault();if(!canEdit||saving)return;
  try{
   const values={
    annualUnits:parseField(draft.annualUnits,'Annual units',{integer:true}),
    averageUnitValue:parseField(draft.averageUnitValue,'Revenue per unit'),
    expectedSharePct:parseField(draft.expectedSharePct,'Expected share (%)',{max:100}),
   };
   setSaving(true);setError('');
   await updateCompany(company.id,values);
   setEditing(false);
  }catch(e){setError(e instanceof Error?e.message:'Unable to update forecast.');}
  finally{setSaving(false);}
 };
 return <section className="ss-record-forecast" aria-label="Company account forecast">
  <div className="ss-record-local-actions">
   <small>Account planning</small>
   {canEdit&&<button type="button" onClick={editing?close:open}
    disabled={saving}>{editing?'Cancel':'Edit forecast'}</button>}
  </div>
  {editing?<form className="ss-record-forecast-form" onSubmit={event=>void save(event)}>
    <label>Annual units<input autoFocus type="number" min="0" step="1"
     value={draft.annualUnits} onChange={e=>setDraft(v=>({...v,annualUnits:e.target.value}))}/></label>
    <label>Revenue / unit<input type="number" min="0" step="0.01"
     value={draft.averageUnitValue} onChange={e=>setDraft(v=>({...v,averageUnitValue:e.target.value}))}/></label>
    <label>Expected share (%)<input type="number" min="0" max="100" step="0.1"
     value={draft.expectedSharePct} onChange={e=>setDraft(v=>({...v,expectedSharePct:e.target.value}))}/></label>
    {error&&<p role="alert" className="ss-record-error">{error}</p>}
    <div className="ss-record-local-actions">
     <button type="button" disabled={saving} onClick={close}>Cancel</button>
     <button type="submit" disabled={saving}>{saving?'Saving…':'Save forecast'}</button>
    </div>
   </form>:<div className="connections-record-properties-list">
    <div className="connections-record-property"><span>Annual units</span><strong>{company.annualUnits??'Not set'}</strong></div>
    <div className="connections-record-property"><span>Revenue / unit</span><strong>{company.averageUnitValue===undefined?'Not set':fmt.format(company.averageUnitValue)}</strong></div>
    <div className="connections-record-property"><span>Expected share (%)</span><strong>{company.expectedSharePct===undefined?'Not set':company.expectedSharePct+'%'}</strong></div>
    <div className="connections-record-property"><span>Annual potential</span><strong>{companyAnnualPotential(company)===undefined?'Not set':fmt.format(companyAnnualPotential(company)!)}</strong></div>
    <div className="connections-record-property"><span>Expected annual work</span><strong>{companyEstimatedAnnualWork(company)===undefined?'Not set':fmt.format(companyEstimatedAnnualWork(company)!)}</strong></div>
   </div>}
 </section>;
}
