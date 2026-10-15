import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import type {Quote} from '../types/quote';
import {QuoteCrmFields} from './QuoteCrmFields';
import './quote-customer-quick-edit.css';

/** A short customer-edit path from Build, without navigating to Board/Details.
 * All actual edits go through the existing quote+CRM field component. */
export function QuoteCustomerQuickEdit({quote,editable,onClose,onDetails}:{
  quote:Quote;editable:boolean;onClose:()=>void;onDetails:()=>void;
}){
  const dialogRef=useRef<HTMLElement>(null);
  const onCloseRef=useRef(onClose);
  onCloseRef.current=onClose;
  useEffect(()=>{
    const source=document.activeElement instanceof HTMLElement
      ?document.activeElement:null;
    (dialogRef.current?.querySelector<HTMLInputElement>('input:not([disabled])')
      ??dialogRef.current?.querySelector<HTMLButtonElement>('button'))?.focus();
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();
        onCloseRef.current();
      }
      if(event.key==='Tab'){
        const buttons=dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
        );
        const focusable=Array.from(buttons??[]).filter(node=>node.getClientRects().length>0);
        if(!focusable.length)return;
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&(document.activeElement===first
          ||!dialogRef.current?.contains(document.activeElement))){
          event.preventDefault();last.focus();
        }else if(!event.shiftKey&&(document.activeElement===last
          ||!dialogRef.current?.contains(document.activeElement))){
          event.preventDefault();first.focus();
        }
      }
    };
    document.addEventListener('keydown',handleKey);
    return ()=>{
      document.removeEventListener('keydown',handleKey);
      if(source?.isConnected)source.focus();
    };
  },[]);
  return createPortal(<div className="qmb qmb-customer-quick-backdrop"
    onPointerDown={event=>{if(event.currentTarget===event.target)onClose();}}>
    <section className="qmb-customer-quick-sheet" ref={dialogRef} role="dialog"
      aria-modal="true" aria-label="Quick customer details">
      <header className="qmb-customer-quick-head">
        <div><span className="qmb-customer-quick-kicker">QUICK QUOTE</span>
          <h2>Customer &amp; contact</h2>
          <p>Enter a name or choose a matching CRM record. Your quote stays open.</p>
        </div>
        <button type="button" className="qmb-customer-quick-close"
          aria-label="Close customer quick edit" onClick={onClose}>×</button>
      </header>
      <div className="qmb-customer-quick-content">
        <QuoteCrmFields quote={quote} compactSection="customer" editable={editable}/>
        {!editable&&<p className="qmb-customer-quick-note">
          This issued revision is read-only. Create a revision to edit customer details.
        </p>}
      </div>
      <footer className="qmb-customer-quick-actions">
        <button type="button" className="qmb-outline" onClick={onDetails}>
          More project details
        </button>
        <button type="button" className="qmb-primary" onClick={onClose}>
          Done · Continue quote
        </button>
      </footer>
    </section>
  </div>,document.body);
}
