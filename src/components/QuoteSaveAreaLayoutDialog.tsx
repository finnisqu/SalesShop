import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import type {QuoteSection} from '../types/quote';
import {SAVED_AREA_PIECE_LIMIT} from '../services/quoteSavedAreaLayouts';

export function QuoteSaveAreaLayoutDialog({section,onSave,onClose}:{
 section:QuoteSection;onSave:(name:string)=>boolean;onClose:()=>void;
}){
 const [name,setName]=useState((section.title||'Area layout').slice(0,100));
 const [error,setError]=useState('');
 const inputRef=useRef<HTMLInputElement>(null);
 const closeRef=useRef(onClose);
 closeRef.current=onClose;
 useEffect(()=>{
   const old=document.activeElement instanceof HTMLElement?document.activeElement:null;
   inputRef.current?.focus();
   const handle=(e:KeyboardEvent)=>{
     if(e.key==='Escape'){e.preventDefault();closeRef.current();return;}
     if(e.key!=='Tab')return;
     const buttons=Array.from(inputRef.current?.closest<HTMLElement>('[role="dialog"]')
       ?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')??[]);
     if(!buttons.length)return;
     const first=buttons[0],last=buttons[buttons.length-1];
     if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
     else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   };
   document.addEventListener('keydown',handle);
   return ()=>{document.removeEventListener('keydown',handle);old?.focus();};
 },[]);
 const save=()=>{
   if(!name.trim()){setError('Name your reusable Area layout.');return;}
   if((section.scope?.takeoffPieces?.length??0)>SAVED_AREA_PIECE_LIMIT){
     setError('This Area has too many pieces for a saved layout.');return;
   }
   if(!onSave(name.trim())){setError('Could not save this layout. Check browser storage and try again.');return;}
   onClose();
 };
 return createPortal(<div className="qmb qmb-area-manager-backdrop"
   onPointerDown={e=>{if(e.currentTarget===e.target)onClose();}}>
   <section className="qmb-save-area-layout" role="dialog" aria-modal="true"
     aria-label="Save reusable Area layout">
     <header><strong>Save Area layout</strong>
       <button type="button" aria-label="Close save layout" onClick={onClose}>×</button></header>
     <p>Save this Area's piece names, measurements, splash selections and edge defaults for reuse.
       <strong> Prices, material and sink choices, private costs and customer data are never saved.</strong></p>
     <p>Personal to this account and this browser. Other devices and teammates will not see it.</p>
     <label>Layout name
       <input ref={inputRef} type="text" maxLength={100} value={name}
         onChange={e=>{setName(e.target.value);setError('');}}
         onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();save();}}}/>
     </label>
     {error&&<p role="alert" className="qmb-save-area-error">{error}</p>}
     <footer><button type="button" onClick={onClose}>Cancel</button>
       <button type="button" className="is-primary" disabled={!name.trim()} onClick={save}>Save layout</button>
     </footer>
   </section>
 </div>,document.body);
}
