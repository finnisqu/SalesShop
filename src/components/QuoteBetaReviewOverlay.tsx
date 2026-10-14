import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {Quote} from '../types/quote';
import type {QuoteAuditDestination} from '../services/quoteDraftAudit';
import {QuoteBetaReview} from './QuoteBetaReview';

/** Seller-only review sheet. Keeps Build or Preview mounted beneath a dimmed
 * backdrop so inline quick fixes can work without losing quote context. */
export function QuoteBetaReviewOverlay({quote,focusId,inspector,canIssue,sending,error,onIssue,
  onClose,onFix,onPreview,onClassic,previewedKey,approvedKey,onApprove}:{
  quote:Quote;focusId:string|null;inspector:ReactNode;canIssue:boolean;sending:boolean;error:string;
  onIssue:()=>void;onClose:()=>void;onFix:(destination:QuoteAuditDestination)=>void;
  onPreview:()=>void;onClassic:()=>void;
  previewedKey:string|null;approvedKey:string|null;onApprove:(approved:boolean)=>void;
}){
  const drawerRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};
    document.addEventListener('keydown',key);
    return ()=>document.removeEventListener('keydown',key);
  },[onClose]);
  useEffect(()=>{
    if(!focusId)return;
    const selected=focusId==='__delivery__'
      ?drawerRef.current?.querySelector<HTMLElement>('[data-review-delivery]')
      :Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('[data-audit-id]')??[])
        .find(el=>el.dataset.auditId===focusId);
    selected?.scrollIntoView({block:'center',behavior:'instant'});
  },[focusId,quote.id]);
  return createPortal(<div className="qmb qmb-review-overlay" onPointerDown={e=>{
    if(e.currentTarget===e.target)onClose();
  }}>
    <div className="qmb-review-flyout-shell">
      <div className="qmb-review-pulled-inspector">{inspector}</div>
      <div ref={drawerRef} className="qmb-review-sheet" role="dialog" aria-modal="true" aria-label="Review and issue quote">
      <QuoteBetaReview quote={quote} initialFindingId={focusId}
        onBack={onClose} onFix={onFix} onPreview={onPreview} onClassic={onClassic}
        canIssue={canIssue} sending={sending} error={error} onIssue={onIssue}
        previewedKey={previewedKey} approvedKey={approvedKey} onApprove={onApprove}/>
      </div>
    </div>
  </div>,document.body);
}
