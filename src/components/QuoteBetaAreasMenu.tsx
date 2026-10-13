import {useEffect,useState,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {useQuoteBetaCardDrag} from './quoteBetaCardMotion';
import {createPortal} from 'react-dom';
import type {Quote,QuoteSection} from '../types/quote';
import {quoteLinesTotal} from '../types/quote';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {useQuoteStore} from '../store/quoteStore';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
type DeleteChoice='transfer'|'delete';

/**
 * Shared desktop / phone inline Area mode. Reordering is a draft until Done,
 * Enter, or a click outside the Area workspace. Escape cancels the draft.
 * Deletions are explicit, immediate, independently undoable quote operations.
 */
export function useQuoteBetaAreaManager(quote:Quote|null){
  const [editing,setEditing]=useState(false);
  const [order,setOrder]=useState<string[]>([]);
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const setSectionOrder=useQuoteStore(s=>s.setSectionOrder);
  const deleteSection=useQuoteStore(s=>s.deleteSection);
  const editable=Boolean(quote&&quoteIsCommerciallyEditable(quote)&&quote.documentType!=='pricing-schedule');
  const original=quote?.sections.map(s=>s.id)??[];
  const syncedOrder=order.filter(id=>original.includes(id));
  for(const id of original)if(!syncedOrder.includes(id))syncedOrder.push(id);
  const orderedSections=syncedOrder.map(id=>quote?.sections.find(s=>s.id===id))
    .filter((s):s is QuoteSection=>Boolean(s));
  const dirty=syncedOrder.some((id,i)=>id!==original[i]);
  const start=()=>{
    if(!editable)return;
    setOrder(original);
    setDeletingId(null);
    setEditing(true);
  };
  const finish=()=>{
    if(quote&&editing&&dirty)setSectionOrder(quote.id,syncedOrder);
    setDeletingId(null);motion.clear();setEditing(false);
  };
  const cancel=()=>{
    setDeletingId(null);motion.clear();setEditing(false);setOrder([]);
  };
  const move=(id:string,toId:string)=>{
    if(id===toId)return;
    setOrder(previous=>{
      const result=previous.filter(s=>original.includes(s));
      for(const originalId of original)if(!result.includes(originalId))result.push(originalId);
      const from=result.indexOf(id),to=result.indexOf(toId);
      if(from<0||to<0||from===to)return previous;
      result.splice(from,1);
      result.splice(to,0,id);
      return result;
    });
  };
  const motion=useQuoteBetaCardDrag(move);
  const moveStep=(id:string,step:-1|1)=>{
    const current=syncedOrder.indexOf(id);
    const neighbor=syncedOrder[current+step];
    if(neighbor)move(id,neighbor);
  };
  useEffect(()=>{
    setEditing(false);setOrder([]);setDeletingId(null);motion.clear();
  },[quote?.id]);
  useEffect(()=>{
    if(!editing)return;
    const key=(event:globalThis.KeyboardEvent)=>{
      if(deletingId){
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDeletingId(null);}
        return;
      }
      if(event.key==='Escape'){
        event.preventDefault();event.stopPropagation();cancel();
      }else if(event.key==='Enter'&&!event.repeat&&
        !(event.target as Element)?.closest('button,input,select,textarea,[contenteditable="true"]')){
        event.preventDefault();finish();
      }
    };
    // The editing surfaces are marked in *both* renderers, but only one
    // is visible. Outside pointer-down commits before navigating elsewhere.
    const outside=(event:PointerEvent)=>{
      if(deletingId)return;
      const target=event.target;
      if(!(target instanceof Element))return;
      if(target.closest('[data-area-edit-workspace],[data-area-edit-toggle],[data-area-deletion-dialog]'))return;
      finish();
    };
    document.addEventListener('keydown',key);
    document.addEventListener('pointerdown',outside,true);
    return ()=>{document.removeEventListener('keydown',key);
      document.removeEventListener('pointerdown',outside,true);};
  },[editing,deletingId,quote?.id,dirty,syncedOrder.join('|')]);
  const requestDelete=(id:string)=>{if(editable&&editing)setDeletingId(id);};
  const chooseDelete=(choice:DeleteChoice)=>{
    if(!quote||!deletingId||!editable)return;
    deleteSection(quote.id,deletingId,choice);
    setOrder(old=>old.filter(id=>id!==deletingId));
    setDeletingId(null);
    if(quote.sections.length===1){setEditing(false);setOrder([]);}
  };
  const onGripKey=(id:string,event:ReactKeyboardEvent<HTMLButtonElement>)=>{
    if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      event.preventDefault();event.stopPropagation();
      moveStep(id,event.key==='ArrowUp'?-1:1);
    }else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();finish();}
  };
  return {editing,editable,dirty,orderedSections,dragging:motion.dragging,deletingId,
    start,finish,cancel,moveStep,requestDelete,chooseDelete,
    setDeletingId,onPointerDown:motion.onPointerDown,
    onPointerMove:motion.onPointerMove,onPointerEnd:motion.onPointerEnd,onGripKey};
}
export type QuoteBetaAreaManager=ReturnType<typeof useQuoteBetaAreaManager>;

export function QuoteBetaAreaModeButton({manager}:{manager:QuoteBetaAreaManager}){
  return <button type="button" data-area-edit-toggle className={'qmb-area-mode-button'+(manager.editing?' is-active':'')}
    aria-label={manager.editing?'Done reordering and deleting Areas':'Reorder or delete Areas'}
    aria-pressed={manager.editing}
    disabled={!manager.editable}
    onClick={()=>manager.editing?manager.finish():manager.start()}>
    {manager.editing?'Done':'Reorder / Delete'}
  </button>;
}

export function QuoteBetaAreaGrip({manager,area}:{manager:QuoteBetaAreaManager;area:QuoteSection}){
  return <button type="button" className={'qmb-area-grip'+(manager.dragging===area.id?' is-dragging':'')}
    aria-label={'Drag '+(area.title||'Untitled Area')+' to reorder; use arrow keys to move'}
    title="Drag to reorder · arrow keys to move · Enter to save" aria-roledescription="drag handle"
    onPointerDown={event=>manager.onPointerDown(area.id,event)}
    onPointerMove={event=>manager.onPointerMove(area.id,event)}
    onPointerUp={manager.onPointerEnd} onPointerCancel={manager.onPointerEnd}
    onKeyDown={event=>manager.onGripKey(area.id,event)}>⠿</button>;
}

export function QuoteBetaAreaDeleteButton({manager,area}:{manager:QuoteBetaAreaManager;area:QuoteSection}){
  return <button type="button" className="qmb-area-remove-x"
    aria-label={'Delete '+(area.title||'Untitled Area')+' Area'}
    title="Delete Area" onClick={()=>manager.requestDelete(area.id)}>×</button>;
}

export function QuoteBetaAreaDeleteDialog({manager,quote}:{
  manager:QuoteBetaAreaManager;quote:Quote|null;
}){
  const section=quote?.sections.find(s=>s.id===manager.deletingId);
  if(!section)return null;
  const lines=quote!.lines.filter(l=>l.sectionId===section.id);
  const close=()=>manager.setDeletingId(null);
  return createPortal(<div className="qmb qmb-area-manager-backdrop"
    onPointerDown={e=>{if(e.target===e.currentTarget)close();}}>
    <section className="qmb-area-manager qmb-inline-delete-dialog" role="dialog"
      data-area-deletion-dialog aria-modal="true" aria-label={'Delete Area '+(section.title||'Untitled Area')}>
      <header className="qmb-area-manager-head">
        <div><strong>Delete {section.title||'this Area'}?</strong>
          <small>How should SalesShop handle its contents?</small></div>
        <button type="button" onClick={close} aria-label="Cancel deleting Area">×</button>
      </header>
      <div className="qmb-area-manager-delete">
        <div className="qmb-area-manager-impact">
          <strong>{section.title||'Untitled Area'}</strong>
          <span>{lines.length} quote line{lines.length===1?'':'s'} · {money.format(quoteLinesTotal(lines))}</span>
          <small>Measurements, specifications and Area selections are removed with the Area in either choice.</small>
        </div>
        <button type="button" className="qmb-area-deletion-choice" onClick={()=>manager.chooseDelete('transfer')}>
          <strong>Delete Area only · keep contents</strong>
          <small>Move priced and informational lines to General. Keep their current prices and quote total.</small>
        </button>
        <button type="button" className="qmb-area-deletion-choice is-destructive"
          onClick={()=>manager.chooseDelete('delete')}>
          <strong>Delete Area and its contents</strong>
          <small>Remove its line items and charges from the quote total. You can Undo.</small>
        </button>
      </div>
      <footer className="qmb-area-manager-foot">
        <button type="button" onClick={close}>Cancel</button>
      </footer>
    </section>
  </div>,document.body);
}
