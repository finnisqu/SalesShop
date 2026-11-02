import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {QUOTE_AREA_PRESETS,type QuoteAreaPresetId} from '../services/quoteAreaPresets';
import './quote-area-preset-picker.css';

export function QuoteAreaPresetPicker({onSelect,onBlank,onClose}:{
 onSelect:(id:QuoteAreaPresetId)=>void;onBlank:()=>void;onClose:()=>void;
}){
 const dialogRef=useRef<HTMLElement>(null);
 const closeRef=useRef(onClose);
 closeRef.current=onClose;
 useEffect(()=>{
   const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
   dialogRef.current?.querySelector<HTMLButtonElement>('.qmb-area-preset-list button')?.focus();
   const key=(event:KeyboardEvent)=>{
     if(event.key==='Escape'){event.preventDefault();closeRef.current();return;}
     if(event.key!=='Tab')return;
     const buttons=Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
     if(!buttons.length)return;
     const first=buttons[0],last=buttons[buttons.length-1];
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   };
   document.addEventListener('keydown',key);
   return ()=>{document.removeEventListener('keydown',key);previous?.focus();};
 },[]);
 return createPortal(<div className="qmb qmb-area-manager-backdrop" onPointerDown={event=>{
   if(event.currentTarget===event.target)onClose();
 }}>
   <section ref={dialogRef} className="qmb-area-preset-dialog" role="dialog" aria-modal="true"
     aria-label="Choose Area starting layout">
     <header><div><strong>Start an Area</strong><small>Layouts add editable placeholders only.
       No measurements, material, sink charges or selling prices are guessed.</small></div>
       <button type="button" onClick={onClose} aria-label="Close Area layouts">×</button>
     </header>
     <div className="qmb-area-preset-list">
       {QUOTE_AREA_PRESETS.map(preset=><button type="button" key={preset.id}
         onClick={()=>onSelect(preset.id)}>
         <strong>{preset.label}</strong><span>{preset.description}</span>
         <small>{preset.pieces.length} named {preset.pieces.length===1?'piece':'pieces'} · dimensions not entered</small>
       </button>)}
     </div>
     <footer><button type="button" onClick={onBlank}>Blank Area</button>
       <button type="button" onClick={onClose}>Cancel</button></footer>
   </section>
 </div>,document.body);
}
