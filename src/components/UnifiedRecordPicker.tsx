import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import '../record-unified-picker.css';

export interface RecordPickerOption{id:string;name:string;detail?:string;}
/** Search existing links and create from the same field, like Quote material selection. */
export function UnifiedRecordPicker({kind,items,onLink,onCreate,
  createLabel,helper,disabled,extra}:{
 kind:string;items:readonly RecordPickerOption[];
 onLink:(id:string)=>void|Promise<void>;
 onCreate?:(name:string)=>void|Promise<void>;
 createLabel?:string;helper?:string;disabled?:boolean;extra?:ReactNode;
}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),
  [saving,setSaving]=useState(false),[error,setError]=useState('');
 const inputRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(open)inputRef.current?.focus();},[open]);
 const needle=query.trim().toLowerCase();
 const matches=items.filter(item=>[item.name,item.detail??''].join(' ')
  .toLowerCase().includes(needle)).slice(0,12);
 const exact=items.some(item=>item.name.trim().toLowerCase()===needle);
 const run=async(action:()=>void|Promise<void>)=>{
  setSaving(true);setError('');
  try{await action();setOpen(false);setQuery('');}
  catch(e){setError(e instanceof Error?e.message:'Unable to update the record.');}
  finally{setSaving(false);}
 };
 return <div className="ss-unified-record-picker">
  <button type="button" className="connections-record-add ss-unified-picker-trigger"
   disabled={disabled} aria-expanded={open}
   onClick={()=>{setOpen(prev=>!prev);setError('');setQuery('');}}>
   {open?'Cancel':'+ Add '+kind}
  </button>
  {open&&<div className="ss-unified-picker-panel" role="group"
    aria-label={'Add '+kind}>
   <input ref={inputRef} type="search" value={query} maxLength={180}
     placeholder={'Search '+kind.toLowerCase()+' or enter a new name…'}
     aria-label={'Search or create '+kind} disabled={saving}
     onChange={e=>{setQuery(e.target.value);setError('');}}
     onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);}}}/>
   {extra}
   <div className="ss-unified-picker-results">
    <small>{needle?'Matching existing records':'Existing records'}</small>
    {matches.map(option=><button type="button" key={option.id}
      disabled={saving} onClick={()=>void run(()=>onLink(option.id))}>
      <strong>{option.name}</strong>{option.detail&&<span>{option.detail}</span>}
    </button>)}
    {!matches.length&&<p className="connections-record-helper">No existing matches.</p>}
   </div>
   {onCreate&&<button type="button" className="ss-unified-picker-create"
     disabled={saving||!needle||exact}
     title={exact?'An existing record already has this name. Select it above.':undefined}
     onClick={()=>void run(()=>onCreate(query.trim()))}>
     + Create New {createLabel??kind}{needle?' · '+query.trim():''}
   </button>}
   {helper&&<small className="ss-unified-picker-help">{helper}</small>}
   {error&&<p role="alert" className="ss-unified-picker-error">{error}</p>}
  </div>}
 </div>;
}
