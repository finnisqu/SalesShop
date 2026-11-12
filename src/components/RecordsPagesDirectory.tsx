import {useEffect,useMemo,useState} from 'react';
import {useNotebookStore} from '../store/notebookStore';
import {useNavigationStore} from '../store/navigationStore';
import {notebookPageNavigationLabel} from '../services/notebookPageNavigationLabel';
import {ConnectionsTable,type ConnectionColumn,type ConnectionTableRow} from './ConnectionsTable';
import './records-pages-directory.css';

const PAGE_COLUMNS:ConnectionColumn[]=[
 {key:'name',label:'Page'},{key:'folder',label:'Folder'},
 {key:'favorite',label:'Favorite'},{key:'visibility',label:'Visible'},
 {key:'protected',label:'Protected'},{key:'updated',label:'Updated'},
];

/** Notebook pages now share the Records worktable, pagination, pins and bulk toolbar. */
export function RecordsPagesDirectory({query=''}:{query?:string}){
 const entries=useNotebookStore(s=>s.entries);
 const folders=useNotebookStore(s=>s.folders);
 const hydrated=useNotebookStore(s=>s.hydrated);
 const hydrate=useNotebookStore(s=>s.hydrate);
 useEffect(()=>hydrate(),[hydrate]);
 const move=useNotebookStore(s=>s.moveEntryToFolder);
 const favorite=useNotebookStore(s=>s.toggleFavorite);
 const hide=useNotebookStore(s=>s.toggleHidden);
 const lock=useNotebookStore(s=>s.toggleDeletionLocked);
 const navigate=useNavigationStore(s=>s.openNotebookPage);
 const [destination,setDestination]=useState('');
 const pages=useMemo(()=>entries.filter(e=>!e.isPostItInbox&&!e.isCalendarInbox)
  .filter(e=>(e.title+' '+(e.dailyDate??'')+' '+(folders.find(f=>f.id===e.folderId)?.name??''))
   .toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()))
  .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[entries,folders,query]);
 const rows=useMemo<ConnectionTableRow[]>(()=>pages.map(page=>{
  const label=notebookPageNavigationLabel(page);
  return {id:page.id,name:label,values:{
   name:label,folder:folders.find(f=>f.id===page.folderId)?.name??'Unfiled',
   favorite:page.favorite?'Yes':'—',visibility:page.hidden?'Hidden':'Visible',
   protected:page.deletionLocked?'Locked':'—',
   updated:new Date(page.updatedAt).toLocaleDateString(),
  },sortValues:{updated:page.updatedAt}};
 }),[pages,folders]);
 const apply=(items:ConnectionTableRow[],field:'favorite'|'hidden'|'deletionLocked',value:boolean)=>{
  for(const row of items){
   const page=entries.find(e=>e.id===row.id);
   if(!page||page[field]===value)continue;
   if(field==='favorite')favorite(page.id);
   if(field==='hidden')hide(page.id);
   if(field==='deletionLocked')lock(page.id);
  }
 };
 return <section className="records-pages-directory" aria-label="Notebook pages directory">
  <ConnectionsTable tableKey="pages" columns={PAGE_COLUMNS} rows={rows}
   onOpen={navigate}
   toolbarControls={<label className="records-pages-destination">Move to
    <select value={destination} aria-label="Destination notebook folder"
     onChange={event=>setDestination(event.target.value)}>
     <option value="">Unfiled</option>
     {folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}
    </select>
   </label>}
   bulkActions={(items,clear)=><div className="records-pages-bulk-actions">
    <button type="button" onClick={()=>{items.forEach(row=>move(row.id,destination||null));clear();}}>Move selected</button>
    <button type="button" onClick={()=>apply(items,'favorite',true)}>Favorite</button>
    <button type="button" onClick={()=>apply(items,'favorite',false)}>Unfavorite</button>
    <button type="button" onClick={()=>apply(items,'hidden',true)}>Hide</button>
    <button type="button" onClick={()=>apply(items,'hidden',false)}>Show</button>
    <button type="button" onClick={()=>apply(items,'deletionLocked',true)}>Protect</button>
    <button type="button" onClick={()=>apply(items,'deletionLocked',false)}>Unprotect</button>
   </div>}/>
  {!hydrated&&<p className="records-pages-empty">Loading pages…</p>}
 </section>;
}
