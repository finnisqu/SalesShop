import {useRef,useState,type KeyboardEvent as ReactKeyboardEvent,
 type PointerEvent as ReactPointerEvent, type ReactNode} from 'react';
import type {Quote,QuoteSection,QuoteLine} from '../types/quote';
import {quoteLineAmount} from '../types/quote';
import {useQuoteStore} from '../store/quoteStore';
import {quickAreaSummary} from '../services/quoteQuickAreaSummary';
import {createQuoteTableOrder,type QuoteTableOrder} from '../services/quoteStructure';
import './quote-table-actions.css';

type RowKind='areas'|'pieces'|'sinks'|'charges';
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const sf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const general='__general';
const orderOf=(draft:QuoteTableOrder,kind:RowKind,group:string):string[] =>
 kind==='areas'?draft.areas:draft[kind][group]??[];
const moveId=(draft:QuoteTableOrder,kind:RowKind,group:string,id:string,target:string,after:boolean)=>{
 const ids=orderOf(draft,kind,group);
 const from=ids.indexOf(id),to=ids.indexOf(target);
 if(from<0||to<0||from===to)return draft;
 const next=[...ids];next.splice(from,1);next.splice(next.indexOf(target)+(after?1:0),0,id);
 return kind==='areas'?{...draft,areas:next}:{...draft,[kind]:{...draft[kind],[group]:next}};
};
/** Handle-only modal table; editing and selection do not mount until Done. */
export function QuoteReorderWorkspace({quote,kind,onDone,onCancel}:{
 quote:Quote;kind:'areas'|'takeoffs';onDone:()=>void;onCancel:()=>void;
}){
 const [draft,setDraft]=useState<QuoteTableOrder>(()=>createQuoteTableOrder(quote));
 const drag=useRef<{kind:RowKind;group:string;id:string;pointerId:number}|null>(null);
 const commit=()=>{useQuoteStore.getState().commitQuoteTableOrder(quote.id,draft);onDone();};
 const arrow=(rowKind:RowKind,group:string,id:string,event:ReactKeyboardEvent<HTMLButtonElement>)=>{
  if(event.key!=='ArrowUp'&&event.key!=='ArrowDown'&&event.key!=='Home'&&event.key!=='End')return;
  event.preventDefault();event.stopPropagation();
  setDraft(old=>{
   const ids=orderOf(old,rowKind,group),index=ids.indexOf(id);
   const to=event.key==='Home'?0:event.key==='End'?ids.length-1:index+(event.key==='ArrowUp'?-1:1);
   if(to<0||to>=ids.length||to===index)return old;
   const next=[...ids];next.splice(index,1);next.splice(to,0,id);
   return rowKind==='areas'?{...old,areas:next}:{...old,[rowKind]:{...old[rowKind],[group]:next}};
  });
 };
 const pointerStart=(rowKind:RowKind,group:string,id:string,e:ReactPointerEvent<HTMLButtonElement>)=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  drag.current={kind:rowKind,group,id,pointerId:e.pointerId};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const pointerMove=(e:ReactPointerEvent<HTMLButtonElement>)=>{
  const active=drag.current;
  if(!active||active.pointerId!==e.pointerId)return;
  const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>('[data-qtr-id]');
  if(!target||target.dataset.qtrKind!==active.kind||target.dataset.qtrGroup!==active.group)return;
  if(target.dataset.qtrId){
   const bounds=target.getBoundingClientRect();
   const after=e.clientY>=bounds.top+bounds.height/2;
   setDraft(old=>moveId(old,active.kind,active.group,active.id,target.dataset.qtrId!,after));
  }
 };
 const pointerEnd=()=>{drag.current=null;};
 const handle=(rowKind:RowKind,group:string,id:string,label:string)=>
  <button type="button" className="qtr-grab" title={'Drag '+label+' to reorder'}
   aria-label={'Move '+label+'; drag or use up/down arrow keys'} onKeyDown={e=>arrow(rowKind,group,id,e)}
   onPointerDown={e=>pointerStart(rowKind,group,id,e)} onPointerMove={pointerMove}
   onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>☷</button>;
 const row=(rowKind:RowKind,group:string,id:string,name:ReactNode,qty:ReactNode,
   length:ReactNode,width:ReactNode,total:ReactNode)=>
  <div className="qtr-row" key={rowKind+group+id} data-qtr-id={id}
   data-qtr-kind={rowKind} data-qtr-group={group}>
   <div className="qtr-handle-cell">{handle(rowKind,group,id,String(typeof name==='string'?name:id))}</div>
   <div className="qtr-row-title">{name}</div>
   <div className="qtr-number">{qty}</div><div className="qtr-number">{length}</div>
   <div className="qtr-number">{width}</div><div className="qtr-number">{total}</div>
  </div>;
 const sections=draft.areas.map(id=>quote.sections.find(s=>s.id===id)).filter((s):s is QuoteSection=>!!s);
 const pieceRows=(section:QuoteSection)=>{
  const byId=new Map((section.scope?.takeoffPieces??[]).map(p=>[p.id,p]));
  return (draft.pieces[section.id]??[]).map(id=>{
   const p=byId.get(id)!;
   const edges=([['Back','backsplash'],['Left','leftSplash'],['Right','rightSplash']] as const)
     .filter(([,key])=>p[key]);
   return <div key={p.id} className="qtr-piece-block">
    {row('pieces',section.id,p.id,p.name,p.count,p.lengthIn??'—',p.widthIn??'—',
      sf.format(p.count*(p.lengthIn??0)*(p.widthIn??0)/144)+' SF')}
    {edges.map(([label,edge])=><div className="qtr-row qtr-attached" key={p.id+edge}
      data-qtr-id={p.id} data-qtr-kind="pieces" data-qtr-group={section.id}>
     <div className="qtr-handle-cell">{handle('pieces',section.id,p.id,label+' splash with '+p.name)}</div>
     <div className="qtr-row-title">↳ {label} splash</div>
     <div className="qtr-number">{p.count}</div><div className="qtr-number">—</div>
     <div className="qtr-number">{p.splashEdgeHeightsIn?.[edge==='backsplash'?'back':edge==='leftSplash'?'left':'right']??p.splashHeightIn??4}</div>
     <div className="qtr-number">Included</div>
    </div>)}
   </div>;
  });
 };
 const chargeRows=(group:string)=>{
  const byId=new Map(quote.lines.map(l=>[l.id,l]));
  return (draft.charges[group]??[]).map(id=>{
   const line=byId.get(id) as QuoteLine;
   return row('charges',group,id,line?.description||'Charge',line?.quantity??1,'—','—',
     line?.includeInTotal?money.format(quoteLineAmount(line)):'Excluded');
  });
 };
 return <section className="qtr-workspace" aria-label={'Reorder '+kind+' without editing'}
  onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onCancel();}}}>
  <header className="qtr-floating-header">
   <div><strong>Reorder {kind==='areas'?'Areas':'Takeoffs'}</strong>
    <small>Drag ☷ or focus a handle and use ↑ / ↓. No cells are editable.</small></div>
   <div className="qtr-header-actions">
    <button type="button" onClick={onCancel}>Cancel</button>
    <button type="button" className="qtr-done" autoFocus onClick={commit}>✓ Done</button>
   </div>
  </header>
  <div className="qtr-scroll">
   <div className="qtr-row qtr-columns">
    <span>☷</span><span>{kind==='areas'?'Area / breakdown':'Piece / Item'}</span>
    <span>{kind==='areas'?'SF':'Qty'}</span><span>{kind==='areas'?'Material':'L'}</span>
    <span>{kind==='areas'?'Sinks':'W'}</span><span>Total</span>
   </div>
   {kind==='areas'?<>
    {sections.map(area=>{
     const summary=quickAreaSummary(quote,area);
     return row('areas','',area.id,
      <><strong>{area.title}</strong><small>{area.scope?.takeoffMaterial||'No material'}</small></>,
      sf.format(summary.measuredSf),money.format(summary.materialPrice),money.format(summary.sinkPrice),money.format(summary.total));
    })}
    <div className="qtr-group is-fixed">General <small>Fixed last</small></div>
   </>:<>
    {sections.map(section=><div key={section.id} className="qtr-group-section">
     <div className="qtr-group">{section.title}<small>Pieces · Sinks · Other</small></div>
     {pieceRows(section)}
     {(draft.sinks[section.id]??[]).map(id=>{
      const sink=section.scope?.takeoffSinks?.find(s=>s.id===id);
      return sink?row('sinks',section.id,id,sink.name||'Sink',sink.count,'—','—',
       money.format((sink.unitPrice??0)*sink.count)):null;
     })}
     {chargeRows(section.id)}
    </div>)}
    <div className="qtr-group">General <small>Project charges</small></div>
    {chargeRows(general)}
   </>}
  </div>
 </section>;
}
