import {useMemo,useState,type FormEvent} from 'react';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {createPortal} from 'react-dom';
import {DEAL_PIPELINES,PROJECT_STAGES,type CompanyKind,type DealPipeline,type ProjectStage} from '../types/crm';
import {useDealAssigneeDirectory} from '../services/dealAssignees';
import {useAuthStore} from '../store/authStore';
import type {Company} from '../types/crm';
import '../connections-bulk-edit.css';

export type BulkEditScope='companies'|'people'|'deals';
export type BulkEditChange =
 | {scope:'companies';property:'kind';value:CompanyKind}
 | {scope:'people';property:'companyId'|'title'|'phone';value:string}
 | {scope:'deals';property:'pipeline';pipeline:DealPipeline|undefined;stage:ProjectStage}
 | {scope:'deals';property:'stage';value:ProjectStage}
 | {scope:'deals';property:'dueDate'|'nextAction'|'amount'|'assignedUserId';value:string};

const fields:Record<BulkEditScope,ReadonlyArray<{key:string;label:string}>>={
 companies:[{key:'kind',label:'Relationship type'}],
 people:[{key:'companyId',label:'Company'},{key:'title',label:'Job title'},{key:'phone',label:'Phone number'}],
 deals:[{key:'pipeline',label:'Pipeline'},{key:'stage',label:'Deal stage'},
  {key:'dueDate',label:'Bid due date'},{key:'assignedUserId',label:'Deal owner'},
  {key:'amount',label:'Deal value'},{key:'nextAction',label:'Next action'}],
};

interface Props{
 scope:BulkEditScope;
 count:number;
 companies:readonly Company[];
 onClose:()=>void;
 onApply:(change:BulkEditChange)=>Promise<void>;
}

export function ConnectionsBulkEditDialog({scope,count,companies,onClose,onApply}:Props){
 const [property,setProperty]=useState('');
 const [value,setValue]=useState('');
 const [stage,setStage]=useState<ProjectStage|''>('');
 const [clearValue,setClearValue]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [ownerSearch,setOwnerSearch]=useState('');
 const {mode,members,loading, error:directoryError}=useDealAssigneeDirectory();
 const roleMode=useAuthStore(s=>s.mode);
 const ownerMatches=useMemo(()=>members.filter(member=>member.name.toLowerCase()
  .includes(ownerSearch.trim().toLowerCase())),[members,ownerSearch]);
 const selectedOwner=members.find(member=>member.userId===value);
 const label=fields[scope].find(field=>field.key===property)?.label??'';
 const requiresText=['title','phone','dueDate','nextAction','amount'].includes(property);
 const eligible=value!=='__choose__'&&(
   property==='pipeline'?Boolean(stage):
   property==='assignedUserId'?mode==='cloud'&&!loading&&!directoryError:
   property==='stage'?Boolean(value):
   requiresText?(clearValue||Boolean(value.trim())):true
 );
 const amountValid=property!=='amount'||clearValue||
   (value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0);
 const canSubmit=Boolean(property&&eligible&&amountValid&&!saving);
 const dialogRef=useDismissibleLayer<HTMLElement>(true,()=>{if(!saving)onClose();});
 const chooseProperty=(key:string)=>{
  setProperty(key);setValue(key==='kind'||key==='pipeline'||key==='companyId'||key==='assignedUserId'?'__choose__':'');
  setStage('');setClearValue(false);setError('');setOwnerSearch('');
 };
 async function submit(event:FormEvent){
  event.preventDefault();
  if(!canSubmit)return;
  let change:BulkEditChange;
  if(scope==='companies'){
   change={scope,property:'kind',value:value as CompanyKind};
  }else if(scope==='people'){
   change={scope,property:property as 'companyId'|'title'|'phone',
     value:requiresText&&clearValue?'':value};
  }else if(property==='pipeline'){
   change={scope,property,pipeline:value?value as DealPipeline:undefined,stage:stage as ProjectStage};
  }else if(property==='stage'){
   change={scope,property:'stage',value:value as ProjectStage};
  }else{
   change={scope,property:property as 'dueDate'|'nextAction'|'amount'|'assignedUserId',
    value:requiresText&&clearValue?'':value};
  }
  setSaving(true);setError('');
  try{
   await onApply(change);
  }catch(reason){
   setError(reason instanceof Error?reason.message:'Could not update the selected records.');
  }finally{setSaving(false);}
 }
 const chooseText=property==='title'||property==='phone'||property==='nextAction';
 const inputLabel=property==='title'?'Job title':property==='phone'?'Phone number':'Next action';
 return createPortal(<div className="connections-bulk-backdrop" onMouseDown={event=>{
   if(event.target===event.currentTarget&&!saving)onClose();
  }}>
  <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="connections-bulk-title"
   className="connections-bulk-dialog">
   <header className="connections-bulk-heading">
    <h2 id="connections-bulk-title">Bulk edit {count} {count===1?'record':'records'}</h2>
    <button type="button" aria-label="Close bulk editor" disabled={saving} onClick={onClose}>×</button>
   </header>
   <form onSubmit={event=>void submit(event)}>
    <label className="connections-bulk-field">
     <span>Property to update</span>
     <select autoFocus data-dialog-initial-focus value={property} disabled={saving} onChange={event=>chooseProperty(event.target.value)}
      aria-label="Property to update">
      <option value="">Select a property to edit</option>
      {fields[scope].map(field=><option key={field.key} value={field.key}>{field.label}</option>)}
     </select>
    </label>
    {property==='pipeline'&&<>
     <p className="connections-bulk-hint">Moving deals to a pipeline also sets their stage. Choose both values for all {count} records.</p>
     <label className="connections-bulk-field"><span>Pipeline</span>
      <select value={value} disabled={saving} onChange={event=>setValue(event.target.value)}>
       <option value="__choose__">Select a pipeline</option>
       {DEAL_PIPELINES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
       <option value="">Unassigned</option>
      </select>
     </label>
     <label className="connections-bulk-field"><span>Deal stage</span>
      <select value={stage} disabled={saving} onChange={event=>setStage(event.target.value as ProjectStage|'')}>
       <option value="">Select a stage</option>
       {PROJECT_STAGES.map(item=><option key={item} value={item}>{item}</option>)}
      </select>
     </label>
    </>}
    {property==='stage'&&<label className="connections-bulk-field"><span>Deal stage</span>
     <select value={value} disabled={saving} onChange={event=>setValue(event.target.value)}>
      <option value="">Select a stage</option>
      {PROJECT_STAGES.map(item=><option key={item} value={item}>{item}</option>)}
     </select>
    </label>}
    {property==='kind'&&<label className="connections-bulk-field"><span>Relationship type</span>
     <select value={value} disabled={saving} onChange={event=>setValue(event.target.value)}>
      <option value="__choose__">Choose relationship</option>
      <option value="customer">Customer / prospect</option>
      <option value="non-customer">Partner / other</option>
     </select>
    </label>}
    {property==='companyId'&&<label className="connections-bulk-field"><span>Company</span>
     <select value={value} disabled={saving} onChange={event=>setValue(event.target.value)}>
      <option value="__choose__">Select a company</option>
      <option value="">No company (clear link)</option>
      {companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}
     </select>
    </label>}
    {property==='assignedUserId'&&<>
     <label className="connections-bulk-field"><span>Deal owner</span>
      <input type="search" value={ownerSearch} onChange={event=>setOwnerSearch(event.target.value)}
       disabled={saving||loading||mode!=='cloud'||Boolean(directoryError)} placeholder="Search eligible teammates" />
     </label>
     <div className="connections-bulk-owner-options" aria-label="Eligible deal owners">
      {mode!=='cloud'||roleMode!=='cloud'
        ?<p>Deal ownership requires a cloud workspace.</p>
        :loading?<p>Loading eligible teammates…</p>
        :directoryError?<p role="alert">{directoryError}</p>
        :<>
         {(!ownerSearch.trim()||'no owner'.includes(ownerSearch.trim().toLowerCase()))&&
          <button type="button" className={value===''?'is-selected':''}
           disabled={saving} onClick={()=>setValue('')}>No owner {value===''?'✓':''}</button>}
         {ownerMatches.map(member=><button key={member.userId} type="button"
           className={value===member.userId?'is-selected':''} disabled={saving}
           onClick={()=>setValue(member.userId)}>
            {member.name}{value===member.userId?' ✓':''}
          </button>)}
         {!ownerMatches.length&&ownerSearch.trim()&&<p>No matching team members.</p>}
        </>}
     </div>
     {selectedOwner&&<small className="connections-bulk-chosen">Selected owner: {selectedOwner.name}</small>}
    </>}
    {requiresText&&<>
     <label className="connections-bulk-field"><span>{label||inputLabel}</span>
      {property==='dueDate'
       ?<input type="date" value={value} onChange={event=>setValue(event.target.value)}
         disabled={saving||clearValue}/>
       :property==='amount'
        ?<input type="number" min="0" step="0.01" value={value} disabled={saving||clearValue}
          onChange={event=>setValue(event.target.value)} placeholder="0.00"/>
        :<input type="text" value={value} disabled={saving||clearValue}
          onChange={event=>setValue(event.target.value)}
          placeholder={inputLabel}/>}
     </label>
     <label className="connections-bulk-clear">
      <input type="checkbox" checked={clearValue} disabled={saving}
       onChange={event=>setClearValue(event.target.checked)}/>
      Clear this property on selected records
     </label>
    </>}
    {error&&<p role="alert" className="connections-bulk-error">{error}</p>}
    <footer>
     <button type="submit" className="connections-bulk-primary" disabled={!canSubmit}>
      {saving?'Updating…':'Update '+count}
     </button>
     <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
    </footer>
   </form>
  </section>
 </div>,document.body);
}
