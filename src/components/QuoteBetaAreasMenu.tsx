import { useEffect, useState, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Quote } from '../types/quote';
import { quoteLinesTotal } from '../types/quote';
import { quoteIsCommerciallyEditable } from '../services/quoteIntegrity';
import { useQuoteStore } from '../store/quoteStore';

type Panel = 'menu' | 'reorder' | 'delete';
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/**
 * One Area-level entry point for reordering and deleting in Quotes Beta.
 * The reorder is local until Save, and deletion always asks how to handle
 * the contents rather than hiding a destructive choice behind a confirmation.
 */
export function QuoteBetaAreasMenu({quote,onDeleted}:{quote:Quote;onDeleted?:(areaId:string)=>void}) {
  const [open,setOpen] = useState(false);
  const [panel,setPanel] = useState<Panel>('menu');
  const [order,setOrder] = useState<string[]>([]);
  const [selected,setSelected] = useState('');
  const [dragging,setDragging] = useState<string|null>(null);
  const setSectionOrder=useQuoteStore(s=>s.setSectionOrder);
  const deleteSection=useQuoteStore(s=>s.deleteSection);
  const editable=quoteIsCommerciallyEditable(quote)&&quote.documentType!=='pricing-schedule';
  const originalOrder=quote.sections.map(s=>s.id);
  const validOrder=order.length===originalOrder.length&&
    order.every(id=>originalOrder.includes(id))&&new Set(order).size===order.length;
  const dirty=validOrder&&order.some((id,i)=>id!==originalOrder[i]);
  const target=quote.sections.find(s=>s.id===selected);
  const targetLines=quote.lines.filter(line=>line.sectionId===selected);
  const close=()=>{setOpen(false);setDragging(null);setPanel('menu');};
  useEffect(()=>{
    if(!open)return;
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape')close();};
    document.addEventListener('keydown',key);
    return ()=>document.removeEventListener('keydown',key);
  },[open]);
  const show=(next:Panel)=>{
    setPanel(next);
    if(next==='reorder')setOrder(originalOrder);
    if(next==='delete')setSelected(quote.sections[0]?.id??'');
  };
  const move=(from:number,to:number)=>{
    if(from<0||to<0||from>=order.length||to>=order.length||from===to)return;
    setOrder(current=>{
      const result=[...current], [area]=result.splice(from,1);
      result.splice(to,0,area);
      return result;
    });
  };
  const drop=(event:DragEvent,onto:string)=>{
    event.preventDefault();
    if(!dragging)return;
    move(order.indexOf(dragging),order.indexOf(onto));
    setDragging(null);
  };
  const deleteArea=(disposition:'transfer'|'delete')=>{
    if(!target)return;
    deleteSection(quote.id,target.id,disposition);
    onDeleted?.(target.id);
    close();
  };
  return <>
    <button type="button" className="qmb-area-menu-trigger"
      aria-label="Manage Areas" title="Reorder or delete Areas"
      disabled={!editable||!quote.sections.length}
      onClick={()=>show('menu')||setOpen(true)}>⋯</button>
    {open&&createPortal(<div className="qmb qmb-area-manager-backdrop"
      onPointerDown={event=>{if(event.target===event.currentTarget)close();}}>
      <section className="qmb-area-manager" role="dialog" aria-modal="true" aria-label="Manage quote Areas">
        <header className="qmb-area-manager-head">
          <div><strong>{panel==='menu'?'Manage Areas':panel==='reorder'?'Reorder Areas':'Delete an Area'}</strong>
            <small>{panel==='menu'?'Choose how to organize your quote':panel==='reorder'?'Drag a row or use the arrows, then Save':'Choose what happens to its contents'}</small></div>
          <button type="button" onClick={close} aria-label="Close Area management">×</button>
        </header>
        {panel==='menu'&&<div className="qmb-area-manager-menu">
          <button type="button" onClick={()=>show('reorder')}><strong>↕ Reorder Areas</strong><small>Arrange the quote before saving</small></button>
          <button type="button" onClick={()=>show('delete')}><strong>⊗ Delete an Area</strong><small>Keep its charges or remove them</small></button>
        </div>}
        {panel==='reorder'&&<>
          <div className="qmb-area-manager-list" role="list" aria-label="Area reorder list">
            {order.map((id,index)=>{
              const area=quote.sections.find(s=>s.id===id);
              if(!area)return null;
              return <div key={id} role="listitem" className="qmb-area-reorder-row"
                onDragOver={event=>{if(dragging)event.preventDefault();}}
                onDrop={event=>drop(event,id)}>
                <span className="qmb-area-reorder-handle" draggable
                  onDragStart={event=>{setDragging(id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);}}
                  onDragEnd={()=>setDragging(null)} title="Drag to reorder" aria-hidden="true">⠿</span>
                <span className="qmb-area-reorder-label"><strong>{area.title||'Untitled Area'}</strong><small>{index+1} of {order.length}</small></span>
                <button type="button" aria-label={'Move '+area.title+' up'} disabled={index===0}
                  onClick={()=>move(index,index-1)}>↑</button>
                <button type="button" aria-label={'Move '+area.title+' down'} disabled={index===order.length-1}
                  onClick={()=>move(index,index+1)}>↓</button>
              </div>;
            })}
          </div>
          <footer className="qmb-area-manager-foot">
            <button type="button" onClick={()=>show('menu')}>Back</button>
            <button type="button" className="qmb-primary" disabled={!dirty}
              onClick={()=>{setSectionOrder(quote.id,order);close();}}>Save order</button>
          </footer>
        </>}
        {panel==='delete'&&<>
          <div className="qmb-area-manager-delete">
            <label className="qmb-field"><span>Area to delete</span>
              <select aria-label="Area to delete" value={selected} onChange={e=>setSelected(e.target.value)}>
                {quote.sections.map(s=><option key={s.id} value={s.id}>{s.title||'Untitled Area'}</option>)}
              </select></label>
            {target&&<div className="qmb-area-manager-impact">
              <strong>{target.title||'Untitled Area'}</strong>
              <span>{targetLines.length} line{targetLines.length===1?'':'s'} · {money.format(quoteLinesTotal(targetLines))}</span>
              <small>Area measurements, sink specifications, and selections belong to this Area and will be removed with it.</small>
            </div>}
            <button type="button" className="qmb-area-deletion-choice"
              onClick={()=>deleteArea('transfer')} disabled={!target}>
              <strong>Move charges to General</strong>
              <small>Keep every existing priced and informational line in General. Remove the Area and its takeoff data.</small>
            </button>
            <button type="button" className="qmb-area-deletion-choice is-destructive"
              onClick={()=>deleteArea('delete')} disabled={!target}>
              <strong>Delete Area and all contents</strong>
              <small>Remove its lines and charges from the quote total, along with the takeoff data. You can Undo.</small>
            </button>
          </div>
          <footer className="qmb-area-manager-foot">
            <button type="button" onClick={()=>show('menu')}>Back</button>
            <button type="button" onClick={close}>Cancel</button>
          </footer>
        </>}
      </section>
    </div>,document.body)}
  </>;
}
