import {useMemo,useState} from 'react';
import {useNotebookStore} from '../store/notebookStore';
import {useNavigationStore} from '../store/navigationStore';
import {notebookPageNavigationLabel} from '../services/notebookPageNavigationLabel';
import './records-pages-directory.css';

/** Notebook pages are editable here without copying or modifying their content. */
export function RecordsPagesDirectory({query=''}:{query?:string}){
 const entries=useNotebookStore(s=>s.entries);
 const folders=useNotebookStore(s=>s.folders);
 const hydrated=useNotebookStore(s=>s.hydrated);
 const move=useNotebookStore(s=>s.moveEntryToFolder);
 const favorite=useNotebookStore(s=>s.toggleFavorite);
 const hide=useNotebookStore(s=>s.toggleHidden);
 const lock=useNotebookStore(s=>s.toggleDeletionLocked);
 const navigate=useNavigationStore(s=>s.openNotebookPage);
 const [selected,setSelected]=useState<string[]>([]);
 const [destination,setDestination]=useState('');
 const rows=useMemo(()=>entries.filter(e=>!e.isPostItInbox)
  .filter(e=>(e.title+' '+(e.dailyDate??'')+' '+(folders.find(f=>f.id===e.folderId)?.name??''))
   .toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()))
  .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[entries,folders,query]);
 const active=new Set(selected.filter(id=>entries.some(e=>e.id===id&&!e.isPostItInbox)));
 const shown=rows.filter(row=>active.has(row.id));
 const selectAll=rows.length>0&&rows.every(row=>active.has(row.id));
 const apply=(field:'favorite'|'hidden'|'deletionLocked',value:boolean)=>{
  for(const page of shown)if(page[field]!==value){
   if(field==='favorite')favorite(page.id);
   if(field==='hidden')hide(page.id);
   if(field==='deletionLocked')lock(page.id);
  }
 };
 return <section className="records-pages-directory" aria-label="Notebook pages directory">
  <header className="records-pages-header">
   <div><strong>Notebook pages</strong><small>{rows.length} matching pages</small></div>
   <span>Find, organize and edit page properties without opening each page.</span>
  </header>
  <div className="records-pages-tools">
   <label><input type="checkbox" checked={selectAll}
    onChange={e=>setSelected(e.target.checked?rows.map(p=>p.id):[])}
    aria-label="Select all visible notebook pages"/> {active.size} selected</label>
   <label>Move to <select value={destination} onChange={e=>setDestination(e.target.value)}
    aria-label="Destination notebook folder">
    <option value="">Unfiled</option>
    {folders.map(folder=><option key={folder.id} value={folder.id}>{folder.name}</option>)}
   </select></label>
   <button type="button" disabled={!shown.length} onClick={()=>{
    shown.forEach(page=>move(page.id,destination||null));setSelected([]);
   }}>Move selected</button>
   <button type="button" disabled={!shown.length} onClick={()=>apply('favorite',true)}>Favorite</button>
   <button type="button" disabled={!shown.length} onClick={()=>apply('favorite',false)}>Unfavorite</button>
   <button type="button" disabled={!shown.length} onClick={()=>apply('hidden',true)}>Hide</button>
   <button type="button" disabled={!shown.length} onClick={()=>apply('hidden',false)}>Show</button>
   <button type="button" disabled={!shown.length} onClick={()=>apply('deletionLocked',true)}>Protect</button>
   <button type="button" disabled={!shown.length} onClick={()=>apply('deletionLocked',false)}>Unprotect</button>
  </div>
  <div className="records-pages-scroll">
   <table><thead><tr><th>Select</th><th>Page</th><th>Folder</th><th>Favorite</th><th>Visible</th><th>Protected</th><th>Updated</th></tr></thead>
    <tbody>{rows.map(page=><tr key={page.id}>
     <td><input type="checkbox" checked={active.has(page.id)} aria-label={'Select '+notebookPageNavigationLabel(page)}
      onChange={e=>setSelected(old=>e.target.checked?[...new Set([...old,page.id])]:old.filter(id=>id!==page.id))}/></td>
     <td><button type="button" className="records-pages-open" onClick={()=>navigate(page.id)}>
      {notebookPageNavigationLabel(page)}</button></td>
     <td>{folders.find(f=>f.id===page.folderId)?.name??'Unfiled'}</td>
     <td>{page.favorite?'Yes':'—'}</td><td>{page.hidden?'Hidden':'Visible'}</td>
     <td>{page.deletionLocked?'Locked':'—'}</td>
     <td>{new Date(page.updatedAt).toLocaleDateString()}</td>
    </tr>)}</tbody>
   </table>
   {!rows.length&&<p className="records-pages-empty">{hydrated?'No notebook pages match your search.':'Loading pages…'}</p>}
  </div>
 </section>;
}
