import {useEffect,useMemo,useRef,useState} from 'react';
import type {TaskDuePreset} from '../services/taskSchedule';
import type {TaskAssociation} from '../store/personalTaskStore';
import '../connections-table.css';
import {visibleConnectionColumns,compareConnectionSortValues} from '../services/connectionsTablePreferences';
export interface ConnectionColumn {key:string;label:string;}
export interface ConnectionTableRow {id:string;name:string;association?:TaskAssociation;values:Record<string,string>;sortValues?:Record<string,string|number>;archived?:boolean;}
interface Props {tableKey:'companies'|'people'|'deals'|'quotes'|'documents'|'tasks'|'tags';columns:ConnectionColumn[];rows:ConnectionTableRow[];
 onOpen:(id:string)=>void;onBulkTask?:(records:ConnectionTableRow[])=>void;
 onBulkComplete?:(records:ConnectionTableRow[])=>void;
 onTaskDuePreset?:(id:string,preset:TaskDuePreset)=>void;
 onTaskToggleComplete?:(id:string,finished:boolean)=>void;
 onDocumentArchive?:(id:string)=>void;onDocumentRestore?:(id:string)=>void;}
const PAGE_SIZE=25;
const storage=(tab:string,suffix:string)=>'salesshop-connections-grid-v1:'+tab+':'+suffix;
function read(key:string):string[]{
 try{const data=JSON.parse(localStorage.getItem(key)??'[]') as unknown;
 return Array.isArray(data)?data.filter((x):x is string=>typeof x==='string'):[];}
 catch{return[];}
}
export function ConnectionsTable({tableKey,columns,rows,onOpen,onBulkTask,onBulkComplete,
 onTaskDuePreset,onTaskToggleComplete,onDocumentArchive,onDocumentRestore}:Props){
 const [keys,setKeys]=useState<string[]>(()=>read(storage(tableKey,'cols')));
 const [pinned,setPinned]=useState<string[]>(()=>read(storage(tableKey,'pins')));
 const [selected,setSelected]=useState<string[]>([]);
 const [sort,setSort]=useState({
   key:tableKey==='documents'?'updated':tableKey==='tasks'?'due':'name',
   reverse:tableKey==='documents',
 });
 const [page,setPage]=useState(1);
 const columnsMenuRef=useRef<HTMLDetailsElement>(null);
 // The native details element remains keyboard accessible; dismiss it like other popovers.
 useEffect(()=>{
   const outside=(event:PointerEvent)=>{
     if(!columnsMenuRef.current?.contains(event.target as Node))columnsMenuRef.current?.removeAttribute('open');
   };
   const escape=(event:KeyboardEvent)=>{
     if(event.key!=='Escape'||!columnsMenuRef.current?.open)return;
     event.stopPropagation();
     columnsMenuRef.current.open=false;
     columnsMenuRef.current.querySelector('summary')?.focus();
   };
   document.addEventListener('pointerdown',outside);
   document.addEventListener('keydown',escape);
   return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[]);
 // Preserve selections across pages, but never act on records removed by a new filter.
 useEffect(()=>{
   const ids=new Set(rows.map(row=>row.id));
   setSelected(old=>old.every(id=>ids.has(id))?old:old.filter(id=>ids.has(id)));
 },[rows]);
 const hasTaskActions=tableKey==='tasks'&&Boolean(onTaskDuePreset||onTaskToggleComplete);
 const hasDocumentActions=tableKey==='documents'&&Boolean(onDocumentArchive||onDocumentRestore);
 const hasRowActions=hasTaskActions||hasDocumentActions;
 useEffect(()=>{try{localStorage.setItem(storage(tableKey,'cols'),JSON.stringify(keys));}catch{/* preference storage is optional */}},[tableKey,keys]);
 useEffect(()=>{try{localStorage.setItem(storage(tableKey,'pins'),JSON.stringify(pinned));}catch{/* preference storage is optional */}},[tableKey,pinned]);
 const active=visibleConnectionColumns(keys,columns.map(c=>c.key));
 const visible=active.map(k=>columns.find(c=>c.key===k)).filter((c):c is ConnectionColumn=>!!c);
 const sorted=useMemo(()=>[...rows].sort((a,b)=>{
   const diff=compareConnectionSortValues(
     a.sortValues?.[sort.key]??a.values[sort.key],
     b.sortValues?.[sort.key]??b.values[sort.key]);
   const priority=tableKey==='tasks'?
     compareConnectionSortValues(a.sortValues?.priority,b.sortValues?.priority):0;
   return (sort.reverse?-diff:diff)||priority||compareConnectionSortValues(a.name,b.name);
 }),[rows,sort]);
 const pages=Math.max(1,Math.ceil(sorted.length/PAGE_SIZE));
 const currentPage=Math.min(page,pages);
 const display=sorted.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
 const selection=new Set(selected);
 const chosen=rows.filter(x=>selection.has(x.id));
 const allOnPage=display.length>0&&display.every(x=>selection.has(x.id));
 const pins=rows.filter(x=>pinned.includes(x.id));
 const togglePin=(id:string)=>setPinned(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 const move=(key:string,dir:-1|1)=>{
   const next=[...active],index=next.indexOf(key),destination=index+dir;
   if(index<0||destination<0||destination>=next.length)return;
   [next[index],next[destination]]=[next[destination],next[index]];setKeys(next);
 };
 const toggleColumn=(key:string)=>setKeys(old=>{
   const next=old.length?old:columns.map(c=>c.key);
   if(key==='name')return next; // Every row needs a visible way to open the record.
   return next.includes(key)?(next.length>1?next.filter(x=>x!==key):next):[...next,key];
 });
 return <section className="connections-grid-shell" aria-label={tableKey+' table'}>
   <div className="connections-grid-toolbar">
     <span>{rows.length} records · {chosen.length} selected</span>
     {chosen.length>0&&<>
       {onBulkTask&&<button type="button" onClick={()=>onBulkTask(chosen)}>Create task with selected ({chosen.length})</button>}
       {onBulkComplete&&<button type="button" onClick={()=>{
         if(window.confirm('Mark '+chosen.length+' selected tasks complete?')){
           onBulkComplete(chosen);setSelected([]);
         }
       }}>Complete selected ({chosen.length})</button>}
       <button type="button" onClick={()=>setSelected([])}>Clear</button>
     </>}
     <details className="connections-columns-menu" ref={columnsMenuRef}><summary>⚙ Columns</summary>
       <div className="connections-columns-popover"><strong>Columns</strong>
         <small>Choose and reorder. Saved on this device.</small>
         {columns.map(col=><div key={col.key} className="connections-column-choice">
           <label><input type="checkbox" checked={active.includes(col.key)}
             disabled={col.key==='name'||(active.length===1&&active.includes(col.key))}
             onChange={()=>toggleColumn(col.key)}/>{col.label}</label>
           <button type="button" disabled={!active.includes(col.key)||active.indexOf(col.key)===0}
             onClick={()=>move(col.key,-1)} aria-label={'Move '+col.label+' left'}>←</button>
           <button type="button" disabled={!active.includes(col.key)||active.indexOf(col.key)===active.length-1}
             onClick={()=>move(col.key,1)} aria-label={'Move '+col.label+' right'}>→</button>
         </div>)}
         <button type="button" onClick={()=>setKeys(columns.map(c=>c.key))}>Reset columns</button>
       </div>
     </details>
   </div>
   {pins.length>0&&<div className="connections-pin-tray" aria-label="Pinned comparisons">
     <header><strong>📌 Pinned ({pins.length})</strong><button type="button" onClick={()=>setPinned([])}>Clear pins</button></header>
     <div className="connections-pin-items">{pins.map(item=><div key={item.id}>
       <button type="button" onClick={()=>onOpen(item.id)}>
         <strong>{item.name}</strong>
         <small>{visible.slice(1,4).map(c=>item.values[c.key]).filter(Boolean).join(' · ')}</small>
       </button><button type="button" onClick={()=>togglePin(item.id)} aria-label={'Unpin '+item.name}>×</button>
     </div>)}</div>
   </div>}
   <div className="connections-table-scroll" role="region" aria-label="Scrollable connections table" tabIndex={0}>
     <table className="connections-data-table">
       <thead><tr>
         <th className="connections-check-cell"><input type="checkbox" checked={allOnPage}
           aria-label="Select all on page" onChange={event=>{
             const ids=new Set(display.map(row=>row.id));
             setSelected(old=>event.target.checked?[...new Set([...old,...ids])]:old.filter(id=>!ids.has(id)));
           }}/></th>
         <th className="connections-pin-cell">Pin</th>
         {visible.map(col=><th key={col.key}>
           <button type="button" aria-label={'Sort by '+col.label}
             onClick={()=>{setSort(s=>({key:col.key,reverse:s.key===col.key?!s.reverse:false}));setPage(1);}}>
             {col.label}{sort.key===col.key?(sort.reverse?' ↓':' ↑'):' ↕'}
           </button></th>)}
         {hasRowActions&&<th className="connections-row-actions-heading">Quick actions</th>}
       </tr></thead>
       <tbody>{display.map(row=><tr key={row.id} className={selection.has(row.id)?'is-selected':''}>
         <td className="connections-check-cell"><input type="checkbox" checked={selection.has(row.id)}
           aria-label={'Select '+row.name} onChange={event=>setSelected(old=>event.target.checked?
             [...new Set([...old,row.id])]:old.filter(id=>id!==row.id))}/></td>
         <td className="connections-pin-cell"><button type="button" aria-pressed={pinned.includes(row.id)}
           aria-label={(pinned.includes(row.id)?'Unpin ':'Pin ')+row.name}
           onClick={()=>togglePin(row.id)}>{pinned.includes(row.id)?'★':'☆'}</button></td>
         {visible.map(col=><td key={col.key}>
           {col.key==='name'?<button type="button" className="connections-table-open" onClick={()=>onOpen(row.id)}>{row.name}</button>
             :tableKey==='tasks'&&col.key==='priority'?<span className={'tasks-priority is-'+(row.values.priority||'normal')}>
               {row.values.priority||'Normal'}</span>
             :(row.values[col.key]||'—')}
         </td>)}
         {hasRowActions&&<td className="connections-row-actions">
           {hasDocumentActions&&
             (row.archived
               ?onDocumentRestore&&<button type="button" aria-label={'Restore '+row.name}
                  onClick={()=>onDocumentRestore(row.id)}>Restore</button>
               :onDocumentArchive&&<button type="button" aria-label={'Archive '+row.name}
                  onClick={()=>onDocumentArchive(row.id)}>Archive</button>)}
           {onTaskToggleComplete&&<button type="button"
             onClick={()=>onTaskToggleComplete(row.id,row.values.status==='completed'||row.values.status==='canceled')}>
             {row.values.status==='completed'||row.values.status==='canceled'?'Reopen':'Complete'}
           </button>}
           {onTaskDuePreset&&<select defaultValue="" aria-label={'Quick due date for '+row.name}
             disabled={row.values.status==='completed'||row.values.status==='canceled'}
             onChange={event=>{
               const preset=event.currentTarget.value as TaskDuePreset|'';
               if(preset)onTaskDuePreset(row.id,preset);
               event.currentTarget.value='';
             }}>
             <option value="">Due date…</option>
             <option value="today">Today</option><option value="tomorrow">Tomorrow</option>
             <option value="next-week">In 7 days</option><option value="clear">Clear due date</option>
           </select>}
         </td>}
       </tr>)}
       {!display.length&&<tr><td colSpan={visible.length+2+(hasRowActions?1:0)}>No matching records.</td></tr>}
       </tbody>
     </table>
   </div>
   <footer className="connections-grid-pagination">
     <span>{sorted.length?String((currentPage-1)*PAGE_SIZE+1)+'–'+String(Math.min(currentPage*PAGE_SIZE,sorted.length)):'0'} of {sorted.length}</span>
     <button type="button" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>← Previous</button>
     <span>Page {currentPage} of {pages}</span>
     <button type="button" disabled={currentPage>=pages} onClick={()=>setPage(currentPage+1)}>Next →</button>
   </footer>
 </section>;
}
