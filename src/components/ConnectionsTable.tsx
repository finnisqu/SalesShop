import {useEffect,useMemo,useState} from 'react';
import type {TaskAssociation} from '../store/personalTaskStore';
import '../connections-table.css';
export interface ConnectionColumn {key:string;label:string;}
export interface ConnectionTableRow {id:string;name:string;association:TaskAssociation;values:Record<string,string>;}
interface Props {tableKey:'companies'|'people'|'deals';columns:ConnectionColumn[];rows:ConnectionTableRow[];
 onOpen:(id:string)=>void;onBulkTask:(records:ConnectionTableRow[])=>void;}
const PAGE_SIZE=25;
const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
const storage=(tab:string,suffix:string)=>'salesshop-connections-grid-v1:'+tab+':'+suffix;
function read(key:string):string[]{
 try{const data=JSON.parse(localStorage.getItem(key)??'[]') as unknown;
 return Array.isArray(data)?data.filter((x):x is string=>typeof x==='string'):[];}
 catch{return[];}
}
export function ConnectionsTable({tableKey,columns,rows,onOpen,onBulkTask}:Props){
 const [keys,setKeys]=useState<string[]>(()=>read(storage(tableKey,'cols')));
 const [pinned,setPinned]=useState<string[]>(()=>read(storage(tableKey,'pins')));
 const [selected,setSelected]=useState<string[]>([]);
 const [sort,setSort]=useState({key:'name',reverse:false});
 const [page,setPage]=useState(1);
 useEffect(()=>{localStorage.setItem(storage(tableKey,'cols'),JSON.stringify(keys));},[tableKey,keys]);
 useEffect(()=>{localStorage.setItem(storage(tableKey,'pins'),JSON.stringify(pinned));},[tableKey,pinned]);
 const valid=new Set(columns.map(c=>c.key));
 const active=(keys.length?keys:columns.map(c=>c.key)).filter(k=>valid.has(k));
 const visible=active.map(k=>columns.find(c=>c.key===k)).filter((c):c is ConnectionColumn=>!!c);
 const sorted=useMemo(()=>[...rows].sort((a,b)=>{
   const diff=collator.compare(a.values[sort.key]??'',b.values[sort.key]??'');
   return (sort.reverse?-diff:diff)||collator.compare(a.name,b.name);
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
   return next.includes(key)?(next.length>1?next.filter(x=>x!==key):next):[...next,key];
 });
 return <section className="connections-grid-shell" aria-label={tableKey+' table'}>
   <div className="connections-grid-toolbar">
     <span>{rows.length} records · {chosen.length} selected</span>
     {chosen.length>0&&<>
       <button type="button" onClick={()=>onBulkTask(chosen)}>Create task with selected ({chosen.length})</button>
       <button type="button" onClick={()=>setSelected([])}>Clear</button>
     </>}
     <details className="connections-columns-menu"><summary>⚙ Columns</summary>
       <div className="connections-columns-popover"><strong>Columns</strong>
         <small>Choose and reorder. Saved on this device.</small>
         {columns.map(col=><div key={col.key} className="connections-column-choice">
           <label><input type="checkbox" checked={active.includes(col.key)}
             disabled={active.length===1&&active.includes(col.key)}
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
             :(row.values[col.key]||'—')}
         </td>)}
       </tr>)}
       {!display.length&&<tr><td colSpan={visible.length+2}>No matching records.</td></tr>}
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
