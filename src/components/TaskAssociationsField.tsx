import {useCallback,useEffect,useId,useMemo,useRef,useState,type CSSProperties,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {taskAssociationKey,type TaskAssociation} from '../store/personalTaskStore';
import {taskAssociationPopoverPlacement} from '../services/taskAssociationPopover';
import '../task-association-popover.css';

export interface AssociationOption {key:string;linked:TaskAssociation;label:string;}
const labels:Record<TaskAssociation['type'],string>={
 quote:'Quote',project:'Deal',company:'Company',contact:'Person',notebook:'Notebook',
};
const themeKeys=['--ss-theme-card','--ss-theme-base','--ss-theme-ink',
 '--ss-theme-muted','--ss-theme-tint','--ss-theme-border','--ss-theme-accent'];
/** Portal the matching results out of the scrolling task form without moving content. */
export function TaskAssociationsField({options,value,onChange}:{
 options:AssociationOption[];value:TaskAssociation[];onChange:(items:TaskAssociation[])=>void;
}){
 const [search,setSearch]=useState('');
 const [type,setType]=useState<'all'|TaskAssociation['type']>('all');
 const [open,setOpen]=useState(false);
 const [activeIndex,setActiveIndex]=useState(0);
 const [placement,setPlacement]=useState<(CSSProperties&{maxHeight:number})|null>(null);
 const searchRef=useRef<HTMLDivElement>(null);
 const inputRef=useRef<HTMLInputElement>(null);
 const popoverRef=useRef<HTMLDivElement>(null);
 const listboxId=useId();
 const selectedKeys=useMemo(()=>new Set(value.map(taskAssociationKey)),[value]);
 const matches=useMemo(()=>{
   const words=search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
   return options.filter(x=>!selectedKeys.has(x.key)&&(type==='all'||type===x.linked.type)
     &&words.every(word=>x.label.toLocaleLowerCase().includes(word))).slice(0,12);
 },[options,selectedKeys,type,search]);
 const positionPopover=useCallback(()=>{
   const anchor=searchRef.current;
   if(!anchor)return;
   const rect=anchor.getBoundingClientRect();
   const actualHeight=popoverRef.current?.scrollHeight;
   const pos=taskAssociationPopoverPlacement(rect,{width:window.innerWidth,height:window.innerHeight},actualHeight);
   const style=getComputedStyle(anchor);
   const colors=Object.fromEntries(themeKeys.map(key=>[key,style.getPropertyValue(key).trim()]));
   setPlacement({...pos,...colors,position:'fixed',zIndex:9500} as CSSProperties&{maxHeight:number});
 },[]);
 useEffect(()=>{
   if(!open){setPlacement(null);return;}
   positionPopover();
   const frame=requestAnimationFrame(positionPopover);
   const outside=(event:PointerEvent)=>{
     const target=event.target as Node;
     if(!searchRef.current?.contains(target)&&!popoverRef.current?.contains(target))setOpen(false);
   };
   const onFocus=(event:FocusEvent)=>{
     const target=event.target as Node;
     if(!searchRef.current?.contains(target)&&!popoverRef.current?.contains(target))setOpen(false);
   };
   const onEscape=(event:globalThis.KeyboardEvent)=>{
     if(event.key==='Escape'&&open){
       event.stopPropagation();setOpen(false);
       if(popoverRef.current?.contains(document.activeElement))inputRef.current?.focus();
     }
   };
   document.addEventListener('pointerdown',outside);
   document.addEventListener('focusin',onFocus);
   document.addEventListener('keydown',onEscape);
   window.addEventListener('resize',positionPopover);
   window.addEventListener('scroll',positionPopover,true);
   window.visualViewport?.addEventListener('resize',positionPopover);
   window.visualViewport?.addEventListener('scroll',positionPopover);
   return ()=>{
     cancelAnimationFrame(frame);
     document.removeEventListener('pointerdown',outside);
     document.removeEventListener('focusin',onFocus);
     document.removeEventListener('keydown',onEscape);
     window.removeEventListener('resize',positionPopover);
     window.removeEventListener('scroll',positionPopover,true);
     window.visualViewport?.removeEventListener('resize',positionPopover);
     window.visualViewport?.removeEventListener('scroll',positionPopover);
   };
 },[open,positionPopover,matches.length]);
 const add=(item:AssociationOption)=>{
   if(selectedKeys.has(item.key))return;
   onChange([...value,{...item.linked,label:item.label}]);
   setSearch('');setActiveIndex(0);setOpen(true);
   inputRef.current?.focus();
 };
 const submit=(event:KeyboardEvent<HTMLInputElement>)=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);return;}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
     event.preventDefault();
     if(!open){setOpen(true);setActiveIndex(0);return;}
     if(matches.length)setActiveIndex(index=>
       (index+(event.key==='ArrowDown'?1:-1)+matches.length)%matches.length);
   }
   if(event.key==='Enter'&&open){
     event.preventDefault();
     if(matches.length)add(matches[Math.min(activeIndex,matches.length-1)]);
   }
 };
 return <div className="tasks-associations" aria-label="Related records">
   <div className="tasks-associations-header"><strong>Related records</strong>
     <small>Link multiple Companies, People, Deals and Quotes</small></div>
   {value.length>0&&<div className="tasks-association-chips">
     {value.map((link,i)=><span className="tasks-association-chip" key={taskAssociationKey(link)+i}>
       <b>{labels[link.type]}</b> {link.label?.replace(/^(Quote|Deal|Company|Person|Notebook) · /,'')||link.id}
       <button type="button" title="Remove association" aria-label={'Remove '+(link.label||link.id)}
         onClick={()=>onChange(value.filter((_,j)=>j!==i))}>×</button>
     </span>)}
   </div>}
   <div className="tasks-associations-search" ref={searchRef}>
     <select value={type} aria-label="Related record type"
       onChange={e=>{setType(e.target.value as typeof type);setActiveIndex(0);setOpen(true);}}>
       <option value="all">All types</option>
       {Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
     </select>
     <input ref={inputRef} type="search" role="combobox" autoComplete="off"
       aria-autocomplete="list" aria-haspopup="listbox" aria-controls={listboxId}
       aria-expanded={open} aria-activedescendant={open&&matches.length?listboxId+'-item-'+Math.min(activeIndex,matches.length-1):undefined}
       aria-label="Search related records" placeholder="Search records to link…"
       value={search} onFocus={()=>{setOpen(true);setActiveIndex(0);}}
       onChange={e=>{setSearch(e.target.value);setActiveIndex(0);setOpen(true);}}
       onKeyDown={submit}/>
   </div>
   {open&&placement&&createPortal(
     <div ref={popoverRef} id={listboxId} style={placement}
       className="tasks-associations-results tasks-associations-popover"
       role="listbox" aria-label="Matching related records">
       {matches.length?matches.map((x,i)=><button type="button" role="option"
         aria-selected={activeIndex===i} id={listboxId+'-item-'+i}
         className={activeIndex===i?'is-active':''}
         key={x.key} onMouseEnter={()=>setActiveIndex(i)} onClick={()=>add(x)}>
         <span>{labels[x.linked.type]}</span>
         <strong>{x.label.replace(/^(Quote|Deal|Company|Person|Notebook) · /,'')}</strong>
         <b aria-hidden="true">+</b>
       </button>):<p>{search?'No matching unlinked records':'No more records to link'}</p>}
       <div className="tasks-associations-popover-foot">
         <small>{matches.length?String(matches.length)+' matches · ↑↓ to choose · Enter to link':'Try another name or record type'}</small>
         <button type="button" className="tasks-associations-close"
           onClick={()=>{setOpen(false);inputRef.current?.focus();}}>Done</button>
       </div>
     </div>,document.body)}
 </div>;
}
