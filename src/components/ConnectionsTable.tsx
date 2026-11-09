import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {TaskDuePreset} from '../services/taskSchedule';
import type {TaskAssociation} from '../store/personalTaskStore';
import '../connections-table.css';
import {visibleConnectionColumns,compareConnectionSortValues} from '../services/connectionsTablePreferences';
import {ConnectionsBulkEditDialog,type BulkEditChange} from './ConnectionsBulkEditDialog';
import type {Company} from '../types/crm';
import {TaskBulkEditDialog,type TaskBulkChange} from './TaskBulkEditDialog';
import {useWorkbookTableDensity} from '../services/workbookTableDensity';
import {useDismissibleDetails} from './useDismissibleDetails';
import {WorkspaceChromeIcon} from './WorkspaceChromeIcon';
import {TrashIcon} from './TrashIcon';
export interface ConnectionColumn {key:string;label:string;}
export interface ConnectionTableRow {id:string;name:string;association?:TaskAssociation;values:Record<string,string>;sortValues?:Record<string,string|number>;archived?:boolean;isSelfCompany?:boolean;}
interface Props {tableKey:'companies'|'people'|'deals'|'quotes'|'documents'|'tasks'|'tags'|'suppliers';columns:ConnectionColumn[];rows:ConnectionTableRow[];
 onOpen:(id:string)=>void;onBulkTask?:(records:ConnectionTableRow[])=>void;
 onBulkEdit?:(records:ConnectionTableRow[],change:BulkEditChange)=>Promise<void>;
 bulkEditCompanies?:readonly Company[];
 onBulkTaskProperty?:(records:ConnectionTableRow[],change:TaskBulkChange)=>Promise<void>;
 onBulkComplete?:(records:ConnectionTableRow[])=>void;
 onTaskDelete?:(id:string)=>void;
 onBulkTaskDelete?:(records:ConnectionTableRow[])=>Promise<void>;
 onTaskDuePreset?:(id:string,preset:TaskDuePreset)=>void;
 onTaskToggleComplete?:(id:string,finished:boolean)=>void;
 onDocumentArchive?:(id:string)=>void;onDocumentRestore?:(id:string)=>void;
 /** Optional host for rendering the existing selection/column controls in the page's single toolbar row. */
 toolbarTarget?:HTMLElement|null;
 /** Filters/overview controls slotted before Columns, sharing the same toolbar and selection state. */
 toolbarControls?:ReactNode;}
const PAGE_SIZE=25;
const storage=(tab:string,suffix:string)=>'salesshop-connections-grid-v1:'+tab+':'+suffix;
function read(key:string):string[]{
 try{const data=JSON.parse(localStorage.getItem(key)??'[]') as unknown;
 return Array.isArray(data)?data.filter((x):x is string=>typeof x==='string'):[];}
 catch{return[];}
}
export function ConnectionsTable({tableKey,columns,rows,onOpen,onBulkTask,onBulkEdit,onBulkTaskProperty,bulkEditCompanies=[],onBulkComplete,onTaskDelete,onBulkTaskDelete,
 onTaskDuePreset,onTaskToggleComplete,onDocumentArchive,onDocumentRestore,toolbarTarget,toolbarControls}:Props){
 const [keys,setKeys]=useState<string[]>(()=>read(storage(tableKey,'cols')));
 const [pinned,setPinned]=useState<string[]>(()=>read(storage(tableKey,'pins')));
 const [selected,setSelected]=useState<string[]>([]);
 const [density,setDensity]=useWorkbookTableDensity();
 const selectPageRef=useRef<HTMLInputElement>(null);
 const [bulkEditing,setBulkEditing]=useState(false);
 const [bulkTaskEditing,setBulkTaskEditing]=useState(false);
 const [mobileBulkMode,setMobileBulkMode]=useState(false);
 const [sort,setSort]=useState({
   key:tableKey==='documents'?'updated':tableKey==='tasks'?'due':'name',
   reverse:tableKey==='documents',
 });
 const [page,setPage]=useState(1);
 const columnsMenuRef=useRef<HTMLDetailsElement>(null);
 useDismissibleDetails(columnsMenuRef);
 // Preserve selections across pages, but never act on records removed by a new filter.
 useEffect(()=>{
   const ids=new Set(rows.map(row=>row.id));
   setSelected(old=>old.every(id=>ids.has(id))?old:old.filter(id=>ids.has(id)));
 },[rows]);
 const hasTaskActions=tableKey==='tasks'&&Boolean(onTaskDuePreset||onTaskToggleComplete||onTaskDelete);
 const hasDocumentActions=tableKey==='documents'&&Boolean(onDocumentArchive||onDocumentRestore);
 const hasRowActions=hasTaskActions||hasDocumentActions;
 useEffect(()=>{try{localStorage.setItem(storage(tableKey,'cols'),JSON.stringify(keys));}catch{/* preference storage is optional */}},[tableKey,keys]);
 useEffect(()=>{try{localStorage.setItem(storage(tableKey,'pins'),JSON.stringify(pinned));}catch{/* preference storage is optional */}},[tableKey,pinned]);
 const active=useMemo(()=>visibleConnectionColumns(keys,columns.map(c=>c.key)),[keys,columns]);
 const visible=useMemo(()=>{
   const byKey=new Map(columns.map(col=>[col.key,col]));
   return active.map(key=>byKey.get(key))
     .filter((col):col is ConnectionColumn=>Boolean(col));
 },[active,columns]);
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
 const selection=useMemo(()=>new Set(selected),[selected]);
 const chosen=useMemo(()=>rows.filter(row=>selection.has(row.id)),[rows,selection]);
 const allOnPage=display.length>0&&display.every(x=>selection.has(x.id));
 const someOnPage=display.some(x=>selection.has(x.id));
 useEffect(()=>{
  if(selectPageRef.current)selectPageRef.current.indeterminate=someOnPage&&!allOnPage;
 },[someOnPage,allOnPage]);
 const pins=useMemo(()=>{
   const pinnedIds=new Set(pinned);
   return rows.filter(row=>pinnedIds.has(row.id));
 },[rows,pinned]);
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
 const toolbar=(
   <div className="connections-grid-toolbar">
     <span>{rows.length} records · {chosen.length} selected</span>
     {chosen.length>0&&<>
       {onBulkEdit&&['companies','people','deals'].includes(tableKey)&&<button type="button"
         className="connections-bulk-edit-action" onClick={()=>setBulkEditing(true)}>Bulk edit ({chosen.length})</button>}
       {onBulkTaskProperty&&tableKey==='tasks'&&<button type="button" className="connections-bulk-edit-action"
         onClick={()=>setBulkTaskEditing(true)}>Bulk edit ({chosen.length})</button>}
       {onBulkTask&&<button type="button" onClick={()=>onBulkTask(chosen)}>Create task with selected ({chosen.length})</button>}
       {onBulkComplete&&<button type="button" onClick={()=>{
         if(window.confirm('Mark '+chosen.length+' selected tasks complete?')){
           onBulkComplete(chosen);setSelected([]);
         }
       }}>Complete selected ({chosen.length})</button>}
       <button type="button" onClick={()=>setSelected([])}>Clear</button>
     </>}
     {toolbarControls&&<div className="connections-toolbar-controls">{toolbarControls}</div>}
     <details className="connections-columns-menu" ref={columnsMenuRef}><summary><WorkspaceChromeIcon name="columns"/> Columns</summary>
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
         <fieldset className="connections-density-setting">
           <legend>Row spacing · all workbooks</legend>
           <div role="group" aria-label="Workbook table row density">
             <button type="button" aria-pressed={density==='compact'} onClick={()=>setDensity('compact')}>Compact</button>
             <button type="button" aria-pressed={density==='comfortable'} onClick={()=>setDensity('comfortable')}>Comfortable</button>
           </div>
         </fieldset>
       </div>
     </details>
   </div>
 );
 return <section className="connections-grid-shell" aria-label={tableKey+' table'}>
   {(onBulkEdit&&['companies','people','deals'].includes(tableKey)||onBulkTaskProperty&&tableKey==='tasks')&&
    <div className={'connections-mobile-bulk'+(mobileBulkMode?' is-selecting':'')}>
     <div className="connections-mobile-bulk-toolbar">
      <span>{mobileBulkMode?selected.length+' selected':'Select multiple '+tableKey}</span>
      <button type="button" onClick={()=>{
        setMobileBulkMode(open=>!open);setSelected([]);
      }}>{mobileBulkMode?'Done selecting':'Select records'}</button>
     </div>
     {mobileBulkMode&&<div className="connections-mobile-bulk-list">
       <div className="connections-mobile-bulk-actions">
        <button type="button" onClick={()=>{
          const ids=new Set(display.map(item=>item.id));
          setSelected(old=>[...new Set([...old,...ids])]);
        }}>Select page</button>
        <button type="button" onClick={()=>setSelected([])} disabled={!selected.length}>Clear</button>
        <button type="button" className="connections-mobile-bulk-apply" disabled={!chosen.length}
         onClick={()=>onBulkTaskProperty?setBulkTaskEditing(true):setBulkEditing(true)}>Bulk edit ({chosen.length})</button>
       </div>
       {display.map(row=><label key={row.id}>
        <input type="checkbox" checked={selection.has(row.id)}
          onChange={event=>setSelected(old=>event.target.checked?
           [...new Set([...old,row.id])]:old.filter(id=>id!==row.id))}/>
        <span>{row.name}</span>
       </label>)}
       <div className="connections-mobile-bulk-pages">
        <button type="button" disabled={currentPage<=1} onClick={()=>setPage(page=>page-1)}>Previous</button>
        <span>Page {currentPage} of {pages}</span>
        <button type="button" disabled={currentPage>=pages} onClick={()=>setPage(page=>page+1)}>Next</button>
       </div>
     </div>}
    </div>}
   {toolbarTarget===undefined?toolbar:toolbarTarget?createPortal(toolbar,toolbarTarget):null}
   {pins.length>0&&<div className="connections-pin-tray" aria-label="Pinned comparisons">
     <header><strong><WorkspaceChromeIcon name="pin"/> Pinned ({pins.length})</strong><button type="button" onClick={()=>setPinned([])}>Clear pins</button></header>
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
         <th className="connections-check-cell"><input ref={selectPageRef} type="checkbox" checked={allOnPage}
           aria-label="Select all on page" onChange={event=>{
             const ids=new Set(display.map(row=>row.id));
             setSelected(old=>event.target.checked?[...new Set([...old,...ids])]:old.filter(id=>!ids.has(id)));
           }}/></th>
         <th className="connections-pin-cell">Pin</th>
         {visible.map(col=><th key={col.key} aria-sort={sort.key===col.key?(sort.reverse?'descending':'ascending'):'none'}>
           <button type="button" aria-label={'Sort by '+col.label}
             onClick={()=>{setSort(s=>({key:col.key,reverse:s.key===col.key?!s.reverse:false}));setPage(1);}}>
             {col.label}<WorkspaceChromeIcon name={sort.key===col.key?(sort.reverse?'sort-desc':'sort-asc'):'sort'}/>
           </button></th>)}
         {hasRowActions&&<th className="connections-row-actions-heading">Quick actions</th>}
       </tr></thead>
       <tbody>{display.map(row=><tr key={row.id} className={selection.has(row.id)?'is-selected':''}>
         <td className="connections-check-cell"><input type="checkbox" checked={selection.has(row.id)}
           aria-label={'Select '+row.name} onChange={event=>setSelected(old=>event.target.checked?
             [...new Set([...old,row.id])]:old.filter(id=>id!==row.id))}/></td>
         <td className="connections-pin-cell"><button type="button" aria-pressed={pinned.includes(row.id)}
           aria-label={(pinned.includes(row.id)?'Unpin ':'Pin ')+row.name}
           onClick={()=>togglePin(row.id)} title={(pinned.includes(row.id)?'Unpin ':'Pin ')+row.name}><WorkspaceChromeIcon name="pin"/></button></td>
         {visible.map(col=><td key={col.key}>
           {col.key==='name'?<button type="button" className="connections-table-open" onClick={()=>onOpen(row.id)}>
            {row.name}{tableKey==='companies'&&row.isSelfCompany&&<span className="connections-table-self-badge">SELF</span>}
           </button>
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
             disabled={row.values.status!=='completed'&&Number(row.values.subtaskRemaining||0)>0}
             title={row.values.status!=='completed'&&Number(row.values.subtaskRemaining||0)>0
               ?'Finish all subtasks first':undefined}
             onClick={()=>onTaskToggleComplete(row.id,row.values.status==='completed'||row.values.status==='canceled')}>
             {row.values.status==='completed'||row.values.status==='canceled'?'Reopen':'Complete'}
           </button>}
           {onTaskDelete&&<button type="button" className="connections-task-delete"
             aria-label={'Delete '+row.name} onClick={()=>onTaskDelete(row.id)}><TrashIcon/> Delete</button>}
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
   {bulkEditing&&onBulkEdit&&['companies','people','deals'].includes(tableKey)&&<ConnectionsBulkEditDialog
     scope={tableKey as 'companies'|'people'|'deals'} count={chosen.length}
     companies={bulkEditCompanies} onClose={()=>setBulkEditing(false)}
     onApply={async change=>{
       await onBulkEdit(chosen,change);
       setBulkEditing(false);
       setMobileBulkMode(false);
       setSelected([]);
     }}/>} 
   {bulkTaskEditing&&onBulkTaskProperty&&tableKey==='tasks'&&<TaskBulkEditDialog count={chosen.length}
     onClose={()=>setBulkTaskEditing(false)}
     onDelete={onBulkTaskDelete?async()=>{
       await onBulkTaskDelete(chosen);
       setBulkTaskEditing(false);setMobileBulkMode(false);setSelected([]);
     }:undefined}
     onApply={async change=>{
       await onBulkTaskProperty(chosen,change);
       setBulkTaskEditing(false);setMobileBulkMode(false);setSelected([]);
     }}/>} 
   <footer className="connections-grid-pagination">
     <span>{sorted.length?String((currentPage-1)*PAGE_SIZE+1)+'–'+String(Math.min(currentPage*PAGE_SIZE,sorted.length)):'0'} of {sorted.length}</span>
     <button type="button" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>← Previous</button>
     <span>Page {currentPage} of {pages}</span>
     <button type="button" disabled={currentPage>=pages} onClick={()=>setPage(currentPage+1)}>Next →</button>
   </footer>
 </section>;
}
