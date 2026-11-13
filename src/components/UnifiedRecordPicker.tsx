import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import '../record-unified-picker.css';
import {useDismissiblePopover} from './useDismissibleDetails';

export interface RecordPickerOption{id:string;name:string;detail?:string;}
/** Search existing links and create from the same field, like Quote material selection. */
export function UnifiedRecordPicker({kind,items,onLink,onCreate,
  createLabel,triggerLabel,helper,disabled,extra}:{
 kind:string;items:readonly RecordPickerOption[];
 onLink:(id:string)=>void|Promise<void>;
 onCreate?:(name:string)=>void|Promise<void>;
 createLabel?:string;triggerLabel?:string;helper?:string;disabled?:boolean;extra?:ReactNode;
}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),
  [saving,setSaving]=useState(false),[error,setError]=useState('');
 const inputRef=useRef<HTMLInputElement>(null);
 const rootRef=useRef<HTMLDivElement>(null);
 const triggerRef=useRef<HTMLButtonElement>(null);
 const pendingRef=useRef(false);
 useDismissiblePopover(rootRef,open,()=>{if(!pendingRef.current){setOpen(false);setQuery('');setError('');}},'.ss-unified-picker-trigger');
 useEffect(()=>{if(open)inputRef.current?.focus();},[open]);
 const needle=query.trim().toLowerCase();
 const matches=items.filter(item=>[item.name,item.detail??''].join(' ')
  .toLowerCase().includes(needle)).slice(0,12);
 const exactMatch=items.find(item=>item.name.trim().toLowerCase()===needle);
 const exact=Boolean(exactMatch);
 const run=async(action:()=>void|Promise<void>)=>{
  // React state updates can be batched: an immediate ref guard prevents
  // duplicate cloud records when Enter and click happen in the same frame.
  if(pendingRef.current||disabled)return;
  pendingRef.current=true;
  setSaving(true);setError('');
  try{
   await action();
   // Some create actions open a new editor/dialog. Never steal its focus
   // back to the picker after the async action finishes.
   const stillInside=Boolean(rootRef.current?.contains(document.activeElement));
   setOpen(false);setQuery('');
   if(stillInside)window.requestAnimationFrame(()=>{
    const trigger=triggerRef.current;
    // React has re-enabled the trigger by now. Leave focus alone if a
    // newly opened Task/Quote editor claimed it in the meantime.
    const focused=document.activeElement;
    if(!trigger?.isConnected||trigger.disabled)return;
    if(focused!==document.body&&!rootRef.current?.contains(focused))return;
    trigger.focus({preventScroll:true});
   });
  }catch(e){setError(e instanceof Error?e.message:'Unable to update the record.');}
  finally{pendingRef.current=false;setSaving(false);}
 };
 return <div className="ss-unified-record-picker" ref={rootRef}>
  <button type="button" ref={triggerRef}
   className="connections-record-add ss-unified-picker-trigger"
   disabled={disabled||saving} aria-expanded={open} aria-haspopup="true"
   onClick={()=>{setOpen(prev=>!prev);setError('');setQuery('');}}> 
   {open?'Cancel':triggerLabel??'+ Add '+kind}
  </button>
  {open&&<div className="ss-unified-picker-panel" role="group"
    aria-label={'Add '+kind}>
   <input ref={inputRef} type="search" value={query} maxLength={180}
     placeholder={'Search '+kind.toLowerCase()+' or enter a new name…'}
     aria-label={'Search or create '+kind} disabled={saving}
     onChange={e=>{setQuery(e.target.value);setError('');}}
     onKeyDown={e=>{
       if(e.key==='Enter'){
         // Never submit the parent Activity/Deal form from a relationship picker.
         // Keyboard selection is unambiguous only for an exact or sole match;
         // creating a new name requires no existing matching records.
         e.preventDefault();e.stopPropagation();
         if(saving||!needle)return;
         const one=exactMatch??(matches.length===1?matches[0]:null);
         if(one){void run(()=>onLink(one.id));return;}
         if(!matches.length&&onCreate&&needle){void run(()=>onCreate(query.trim()));}
         return;
       }
       if(e.key==='Escape'){
         e.preventDefault();e.stopPropagation();
         if(!saving){setOpen(false);setQuery('');triggerRef.current?.focus({preventScroll:true});}
       }
     }}/>
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
