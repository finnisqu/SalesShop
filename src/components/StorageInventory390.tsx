import {useEffect,useMemo,useState} from 'react';
import {useAuthStore} from '../store/authStore';
import {useFileLinkStore} from '../store/fileLinkStore';
import {fileLinksScope,fileTargetKey,type FileTarget} from '../services/fileLinks357a';
import {fileSizeLabel,inventoryFromLinks,providerLabel,sortFileInventory,summarizeFileInventory,
 type FileInventorySort,type FileStorageProvider} from '../services/fileStorageInventory390';
import {FileLinksManager} from './FileLinksManager';
import './storage-inventory390.css';

type Props={targets:readonly FileTarget[];search:string;
 onOpenTarget:(target:FileTarget)=>void};
const SORT_OPTIONS:ReadonlyArray<{id:FileInventorySort;label:string}>=[
 {id:'newest',label:'Recently updated'},{id:'oldest',label:'Oldest updated'},
 {id:'name',label:'Name A–Z'},{id:'provider',label:'Storage provider'},
 {id:'size-desc',label:'Largest first'},{id:'size-asc',label:'Smallest first'},
];
/** An honest cross-provider inventory: saved links never pretend to have byte metadata.
 * A future cloud adapter can supply the same FileInventoryItem contract.
 * Existing links stay on the same device until cloud sharing is configured. */
export function StorageInventory390({targets,search,onOpenTarget}:Props){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id);
 const scope=fileLinksScope(mode,org,user);
 const storedScope=useFileLinkStore(s=>s.scope);
 const records=useFileLinkStore(s=>s.records);
 const hydrate=useFileLinkStore(s=>s.hydrate);
 const [page,setPage]=useState<'library'|'links'>('library');
 const [sort,setSort]=useState<FileInventorySort>('newest');
 const [provider,setProvider]=useState<FileStorageProvider|'all'>('all');
 useEffect(()=>hydrate(scope),[hydrate,scope]);
 const index=useMemo(()=>new Map(targets.map(t=>[fileTargetKey(t),t])),[targets]);
 const rows=useMemo(()=>storedScope===scope&&scope?
  inventoryFromLinks(records).filter(row=>index.has(fileTargetKey({kind:row.targetKind,id:row.targetId}))):[],
  [records,scope,storedScope,index]);
 const usage=useMemo(()=>summarizeFileInventory(rows),[rows]);
 const visible=useMemo(()=>sortFileInventory(rows.filter(row=>
  (provider==='all'||row.provider===provider)&&
  (!search.trim()||[
    row.name,providerLabel(row.provider),row.category,
    index.get(fileTargetKey({kind:row.targetKind,id:row.targetId}))?.title??'',
  ].join(' ').toLowerCase().includes(search.toLowerCase().trim()))),sort),
  [rows,provider,search,index,sort]);
 const sized=usage.knownFiles>0;
 return <div className="ss-storage390" aria-label="Files and storage management">
  <div className="ss-storage390-summary" aria-label="Storage inventory summary">
   <div><small>Indexed items</small><strong>{usage.items}</strong>
    <span>{usage.files} files · {usage.folders} folders</span></div>
   <div><small>Known file size</small><strong>{sized?fileSizeLabel(usage.knownBytes):'—'}</strong>
    <span>{usage.unknownSize} {usage.unknownSize===1?'file has':'files have'} unknown size</span></div>
   <div><small>Storage sources</small><strong>{usage.providerCount}</strong>
    <span>Provider count · link inventory only</span></div>
  </div>
  <p className="ss-storage390-note">
   Current files are saved links, not uploaded objects. Sizes are unknown until we
   connect provider metadata or activate private managed storage. Known size totals
   represent indexed files only—not provider billing, quota, or network usage.
  </p>
  <div className="ss-storage390-switch" role="group" aria-label="Files workspace modes">
   <button type="button" aria-pressed={page==='library'} onClick={()=>setPage('library')}>Library</button>
   <button type="button" aria-pressed={page==='links'} onClick={()=>setPage('links')}>Manage links</button>
  </div>
  {page==='library'?<>
   <div className="ss-storage390-controls">
    <label>Sort by
     <select value={sort} onChange={e=>setSort(e.target.value as FileInventorySort)}>
      {SORT_OPTIONS.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}
     </select>
    </label>
    <label>Provider
     <select value={provider} onChange={e=>setProvider(e.target.value as FileStorageProvider|'all')}>
      <option value="all">All providers</option>
      {usage.byProvider.map(p=><option value={p.provider} key={p.provider}>
       {providerLabel(p.provider)} ({p.items})</option>)}
     </select>
    </label>
    <button type="button" onClick={()=>setPage('links')}>+ Link document</button>
   </div>
   <div className="ss-storage390-table-viewport">
    <table className="ss-storage390-table">
     <thead><tr><th>Name</th><th>Provider</th><th>Linked record</th>
      <th>Size</th><th>Updated</th></tr></thead>
     <tbody>
      {visible.map(row=>{
       const target=index.get(fileTargetKey({kind:row.targetKind,id:row.targetId}));
       return <tr key={row.id}>
        <td><a href={row.openUrl} target="_blank" rel="noopener noreferrer">
         {row.kind==='folder'?'▣ ':'▤ '}{row.name}</a></td>
        <td>{providerLabel(row.provider)}</td>
        <td>{target?<button type="button" onClick={()=>onOpenTarget(target)}>{target.title}</button>:'Unavailable'}</td>
        <td title={row.sizeBytes===null?'Provider size has not been fetched':undefined}>
         {fileSizeLabel(row.sizeBytes)}</td>
        <td>{new Date(row.updatedAt).toLocaleDateString()}</td>
       </tr>;
      })}
      {!visible.length&&<tr><td colSpan={5} className="ss-storage390-empty">
       {rows.length?'No files match these filters.':'No documents linked yet. Use + Link document to start.'}
      </td></tr>}
     </tbody>
    </table>
   </div>
   <details className="ss-storage390-providers">
    <summary>Storage by provider · {usage.providerCount}</summary>
    <div>{usage.byProvider.map(p=><div key={p.provider}>
     <span>{providerLabel(p.provider)}</span>
     <span>{p.items} items</span>
     <span>{p.unknownSize?String(p.unknownSize)+' sizes unknown':fileSizeLabel(p.knownBytes)}</span>
    </div>)}
    {!usage.byProvider.length&&<p>No providers linked.</p>}</div>
   </details>
  </>:<FileLinksManager targets={targets} search={search}
   onOpenTarget={onOpenTarget} directory/>}
  <details className="ss-storage390-coming">
   <summary>Storage connections and BYO storage</summary>
   <p><strong>SalesShop-managed Supabase</strong> — planned default private bucket,
    organization-scoped access, uploads, download and deletion.</p>
   <p><strong>Bring your own Supabase / S3 / Cloudflare R2</strong> — provider
    adapters planned. Credentials will remain server-side and tenant-scoped.</p>
   <p><strong>Google Drive / Dropbox / OneDrive</strong> — link-only today.
    Storage size and operations will need a separately authorized provider connection.</p>
   <p>Uploads, storage quotas, provider credentials and billing controls are not
    activated in this batch. Existing file links remain browser-local.</p>
  </details>
 </div>;
}
