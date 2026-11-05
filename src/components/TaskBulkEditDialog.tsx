import {useState,type FormEvent} from 'react';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {createPortal} from 'react-dom';
import type {TaskChanges,TaskPriority,TaskStatus,TaskType} from '../store/personalTaskStore';
import '../connections-bulk-edit.css';

export type TaskBulkField='priority'|'status'|'type'|'queue'|'startDate'|'dueDate';
export type TaskBulkChange=Partial<Pick<TaskChanges,TaskBulkField|'dueTime'>>;
const properties:ReadonlyArray<{key:TaskBulkField;label:string}>=[
 {key:'priority',label:'Priority'},{key:'status',label:'Status'},{key:'type',label:'Task type'},
 {key:'queue',label:'Queue'},{key:'startDate',label:'Start date'},
 {key:'dueDate',label:'Due date'},
];
export function TaskBulkEditDialog({count,onApply,onClose}:{
 count:number;onApply:(change:TaskBulkChange)=>Promise<void>;onClose:()=>void;
}){
 const [property,setProperty]=useState<TaskBulkField|''>('');
 const [value,setValue]=useState('');
 const [clear,setClear]=useState(false);
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);
 const [notes,setNotes]=useState('');
 const clearable=['queue','startDate','dueDate'].includes(property);
 const valid=Boolean(property)&&!saving&&(
   clearable&&clear||Boolean(value.trim())
 );
 const dialogRef=useDismissibleLayer<HTMLElement>(true,()=>{if(!saving)onClose();});
 const apply=async(event:FormEvent)=>{
  event.preventDefault();if(!valid||!property)return;
  const next=clear&&clearable?undefined:value;
  let change:TaskBulkChange;
  switch(property){
   case 'priority':change={priority:next as TaskPriority};break;
   case 'status':change={status:next as TaskStatus};break;
   case 'type':change={type:next as TaskType};break;
   case 'queue':change={queue:next};break;
   case 'startDate':change={startDate:next};break;
   case 'dueDate':change={dueDate:next,dueTime:undefined};break;
  }
  setSaving(true);setError('');setNotes('');
  try{await onApply(change);}
  catch(reason){setError(reason instanceof Error?reason.message:'Unable to update selected tasks.');}
  finally{setSaving(false);}
 };
 return createPortal(<div className="connections-bulk-backdrop" onMouseDown={event=>{
  if(event.target===event.currentTarget&&!saving)onClose();
 }}>
 <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={'Bulk edit '+count+' tasks'} className="connections-bulk-dialog">
  <header className="connections-bulk-heading"><h2>Bulk edit {count} {count===1?'task':'tasks'}</h2>
   <button type="button" onClick={onClose} aria-label="Close task bulk editor" disabled={saving}>×</button>
  </header>
  <form onSubmit={event=>void apply(event)}>
   <label className="connections-bulk-field"><span>Property to update</span>
    <select autoFocus data-dialog-initial-focus value={property} disabled={saving} onChange={event=>{
     setProperty(event.target.value as TaskBulkField|'');setValue('');setClear(false);setError('');setNotes('');
    }}>
     <option value="">Select a property to edit</option>
     {properties.map(item=><option value={item.key} key={item.key}>{item.label}</option>)}
    </select>
   </label>
   {property&&<label className="connections-bulk-field"><span>{properties.find(item=>item.key===property)?.label}</span>
    {property==='priority'?<select value={value} disabled={saving} onChange={event=>setValue(event.target.value)}>
      <option value="">Select priority</option>
      {(['low','normal','high','urgent'] as const).map(item=><option key={item} value={item}>{item}</option>)}
     </select>
     :property==='status'?<select value={value} disabled={saving} onChange={event=>setValue(event.target.value)}>
      <option value="">Select status</option>
      {(['open','in-progress','waiting','completed','canceled'] as const).map(item=>
       <option key={item} value={item}>{item.replaceAll('-',' ')}</option>)}
     </select>
     :property==='type'?<select value={value} disabled={saving} onChange={event=>setValue(event.target.value)}>
      <option value="">Select type</option>
      {(['todo','call','email','meeting','follow-up'] as const).map(item=>
       <option key={item} value={item}>{item}</option>)}
     </select>
     :property==='queue'?<input type="text" value={value} disabled={saving||clear}
       maxLength={120} onChange={event=>setValue(event.target.value)} placeholder="Queue name"/>
     :<input type="date" value={value} disabled={saving||clear}
       onChange={event=>setValue(event.target.value)}/>}
   </label>}
   {clearable&&<label className="connections-bulk-clear">
     <input type="checkbox" disabled={saving} checked={clear} onChange={event=>setClear(event.target.checked)}/>
     Clear this property for selected tasks
   </label>}
   {property==='status'&&<p className="connections-bulk-hint">Completing or reopening tasks updates their completion state. This does not delete task history.</p>}
   {notes&&<p role="status" className="connections-bulk-hint">{notes}</p>}
   {error&&<p role="alert" className="connections-bulk-error">{error}</p>}
   <footer><button className="connections-bulk-primary" type="submit" disabled={!valid}>
    {saving?'Updating…':'Update '+count}
   </button><button type="button" onClick={onClose} disabled={saving}>Cancel</button></footer>
  </form>
 </section>
 </div>,document.body);
}
