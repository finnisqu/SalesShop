import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import type {Quote} from '../types/quote';
import {CustomerPreview} from './Quotes';
import './quote-print-preview.css';

/**
 * Always render the customer-facing document, without editor props.
 * The portal is a direct body child so print media rules can hide the
 * entire app without also hiding the printable content.
 */
export function QuotePrintPreview({quote,onClose,autoPrint=false}:{
 quote:Quote;onClose:()=>void;autoPrint?:boolean;
}){
 const [printing,setPrinting]=useState(false);
 useEffect(()=>{
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
  document.addEventListener('keydown',onKeyDown);
  return ()=>document.removeEventListener('keydown',onKeyDown);
 },[onClose]);
 useEffect(()=>{
  if(!autoPrint)return;
  // Wait for the portal to be painted before opening the browser's print dialog.
  const frame=requestAnimationFrame(()=>{window.print();});
  return ()=>cancelAnimationFrame(frame);
 },[autoPrint]);
 useEffect(()=>{
  const before=()=>setPrinting(true);
  const after=()=>setPrinting(false);
  window.addEventListener('beforeprint',before);
  window.addEventListener('afterprint',after);
  return ()=>{window.removeEventListener('beforeprint',before);
   window.removeEventListener('afterprint',after);};
 },[]);
 return createPortal(
  <div id="sales-quote-print-root" className="qpp-overlay"
   onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
   <section className="qpp-dialog" role="dialog" aria-modal="true" aria-label="Print preview">
    <header className="qpp-toolbar">
     <div><strong>Print preview</strong>
      <small>Customer-facing quote · Letter paper · Private costs and editing controls hidden</small>
     </div>
     <div className="qpp-actions">
      <button type="button" className="qpp-print-action" onClick={()=>window.print()}
       disabled={printing}>Print</button>
      <button type="button" className="qpp-close-action" onClick={onClose}
       aria-label="Close print preview">Close ×</button>
     </div>
    </header>
    <div className="qpp-scroll" role="region" aria-label="Printable customer document">
     <div className="qpp-print-sheet">
      <CustomerPreview quote={quote}/>
     </div>
    </div>
   </section>
  </div>,document.body);
}
