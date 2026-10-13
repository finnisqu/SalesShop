import {useEffect,useState,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import type {Quote,QuoteLine} from '../types/quote';
import {quoteLineAmount} from '../types/quote';
import {quoteIsCommerciallyEditable} from '../services/quoteIntegrity';
import {useQuoteStore} from '../store/quoteStore';
import {useQuoteBetaCardDrag} from './quoteBetaCardMotion';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});

export function useQuoteBetaGeneralManager(quote:Quote|null){
  const [editing,setEditing]=useState(false);
  const [order,setOrder]=useState<string[]>([]);
  const [deletingId,setDeletingId]=useState<string|null>(null);
  const setOrderInStore=useQuoteStore(s=>s.setGeneralLineOrder);
  const deleteLine=useQuoteStore(s=>s.deleteLine);
  const editable=Boolean(quote&&quoteIsCommerciallyEditable(quote)&&quote.documentType!=='pricing-schedule');
  const sections=new Set(quote?.sections.map(s=>s.id)??[]);
  const general=(quote?.lines??[]).filter(line=>!line.sectionId||!sections.has(line.sectionId));
  const original=general.map(line=>line.id);
  const current=order.filter(id=>original.includes(id));
  for(const id of original)if(!current.includes(id))current.push(id);
  const lines=current.map(id=>general.find(line=>line.id===id)).filter((l):l is QuoteLine=>Boolean(l));
  const dirty=current.some((id,i)=>id!==original[i]);
  const move=(id:string,to:string,after=false)=>{
    if(id===to)return;
    setOrder(old=>{
      const ids=old.filter(key=>original.includes(key));
      for(const key of original)if(!ids.includes(key))ids.push(key);
      const from=ids.indexOf(id),target=ids.indexOf(to);
      if(from<0||target<0||from===target)return old;
      ids.splice(from,1);ids.splice(target+(after?1:0),0,id);
      return ids;
    });
  };
  const motion=useQuoteBetaCardDrag(move);
  const start=()=>{if(!editable||!general.length)return;setOrder(original);setEditing(true);};
  const cancel=()=>{motion.clear();setEditing(false);setOrder([]);setDeletingId(null);};
  const finish=()=>{
    if(editing&&quote&&dirty)setOrderInStore(quote.id,current);
    motion.clear();setEditing(false);setDeletingId(null);setOrder([]);
  };
  const moveStep=(id:string,step:-1|1)=>{
    const i=current.indexOf(id),other=current[i+step];if(other)move(id,other,step===1);
  };
  useEffect(()=>{cancel();},[quote?.id]);
  useEffect(()=>{
    if(!editing)return;
    const key=(event:KeyboardEvent)=>{
      if(deletingId){
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDeletingId(null);}
        return;
      }
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}
      else if(event.key==='Enter'&&!event.repeat&&
        !(event.target as Element)?.closest('button,input,select,textarea,[contenteditable="true"]')){
        event.preventDefault();finish();
      }
    };
    const outside=(event:PointerEvent)=>{
      if(deletingId)return;
      const target=event.target;
      if(!(target instanceof Element))return;
      if(target.closest('[data-general-edit-workspace],[data-general-edit-toggle],[data-general-deletion-dialog]'))return;
      finish();
    };
    document.addEventListener('keydown',key);
    document.addEventListener('pointerdown',outside,true);
    return()=>{document.removeEventListener('keydown',key);
      document.removeEventListener('pointerdown',outside,true);};
  },[editing,deletingId,dirty,current.join('|')]);
  const chooseDelete=()=>{
    if(!quote||!deletingId||!editable)return;
    deleteLine(quote.id,deletingId);
    setOrder(ids=>ids.filter(id=>id!==deletingId));
    setDeletingId(null);
    if(general.length===1)cancel();
  };
  const onGripKey=(id:string,event:ReactKeyboardEvent<HTMLButtonElement>)=>{
    if(event.key==='ArrowUp'||event.key==='ArrowDown'){
      event.preventDefault();event.stopPropagation();
      moveStep(id,event.key==='ArrowUp'?-1:1);
    }else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();finish();}
  };
  return {editing,editable,lines,dragging:motion.dragging,start,cancel,finish,
    setDeletingId,deletingId,chooseDelete,onGripKey,
    onPointerDown:motion.onPointerDown,onPointerMove:motion.onPointerMove,
    onPointerEnd:motion.onPointerEnd};
}
export type QuoteBetaGeneralManager=ReturnType<typeof useQuoteBetaGeneralManager>;

export function QuoteBetaGeneralModeButton({manager}:{manager:QuoteBetaGeneralManager}){
  return <button type="button" data-general-edit-toggle className={'qmb-area-mode-button'+(manager.editing?' is-active':'')}
    aria-label={manager.editing?'Done reordering General':'Reorder or delete General'}
    aria-pressed={manager.editing} disabled={!manager.editable||(!manager.editing&&!manager.lines.length)}
    onClick={()=>manager.editing?manager.finish():manager.start()}>
    {manager.editing?'Done':'Reorder / Delete'}
  </button>;
}
export function QuoteBetaGeneralGrip({manager,line}:{manager:QuoteBetaGeneralManager;line:QuoteLine}){
  return <button type="button" className="qmb-area-grip" aria-label={'Drag General line '+(line.description||'Untitled line')+' to reorder'}
    title="Drag to reorder · arrow keys · Enter to save"
    onPointerDown={e=>manager.onPointerDown(line.id,e)}
    onPointerMove={e=>manager.onPointerMove(line.id,e)}
    onPointerUp={manager.onPointerEnd} onPointerCancel={manager.onPointerEnd}
    onKeyDown={e=>manager.onGripKey(line.id,e)}>⠿</button>;
}
export function QuoteBetaGeneralDelete({manager,line}:{manager:QuoteBetaGeneralManager;line:QuoteLine}){
  return <button type="button" className="qmb-area-remove-x"
    aria-label={'Delete General line '+(line.description||'Untitled line')}
    onClick={()=>manager.setDeletingId(line.id)}>×</button>;
}
export function QuoteBetaGeneralDeleteDialog({manager,quote}:{manager:QuoteBetaGeneralManager;quote:Quote|null}){
  const line=quote?.lines.find(item=>item.id===manager.deletingId);
  if(!line)return null;
  const cancel=()=>manager.setDeletingId(null);
  return createPortal(<div className="qmb qmb-area-manager-backdrop"
    onPointerDown={e=>{if(e.target===e.currentTarget)cancel();}}>
    <section className="qmb-area-manager qmb-inline-delete-dialog" role="dialog" aria-modal="true"
      data-general-deletion-dialog aria-label="Delete General line">
      <header className="qmb-area-manager-head"><div>
        <strong>Remove this General item?</strong>
        <small>{line.description||'Untitled line'} · {money.format(quoteLineAmount(line))}</small>
      </div><button type="button" aria-label="Cancel deleting General line" onClick={cancel}>×</button></header>
      <div className="qmb-area-manager-delete">
        <p className="qmb-inline-delete-explanation">This removes the line from the quote and updates its total. You can Undo afterward.</p>
        <button type="button" className="qmb-area-deletion-choice is-destructive" onClick={manager.chooseDelete}>
          <strong>Delete this line and its charge</strong>
          <small>Remove it completely from General.</small>
        </button>
      </div>
      <footer className="qmb-area-manager-foot"><button type="button" onClick={cancel}>Keep line</button></footer>
    </section>
  </div>,document.body);
}
