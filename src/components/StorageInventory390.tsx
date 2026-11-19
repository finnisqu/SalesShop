import {useEffect,useMemo,useState} from 'react';
import {useAuthStore} from '../store/authStore';
import {useFileLinkStore} from '../store/fileLinkStore';
import {fileLinksScope,fileTargetKey,type FileTarget} from '../services/fileLinks357a';
import {fileSizeLabel,inventoryFromLinks,providerLabel,sortFileInventory,summarizeFileInventory,
 type FileInventorySort,type FileStorageProvider} from '../services/fileStorageInventory390';
import {managedToInventory391,MANAGED_MAX_BYTES_391,
 MANAGED_ORG_ALLOWANCE_391} from '../services/managedDocuments391';
import {useManagedFileStore391} from '../store/managedFileStore391';
import {ManagedUploadPanel391,ManagedDocumentActions391,ManagedStorageNotice391,
 useManagedStorageBinding391,useManagedDocumentPermission391} from './ManagedDocuments391';
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
 useManagedStorageBinding391();
 const managedRows=useManagedFileStore391(s=>s.rows);
 const managedStatus=useManagedFileStore391(s=>s.readiness);
 const mayEdit=useManagedDocumentPermission391();
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id);
 const scope=fileLinksScope(mode,org,user);
 const storedScope=useFileLinkStore(s=>s.scope);
 const records=useFileLinkStore(s=>s.records);
 const hydrate=useFileLinkStore(s=>s.hydrate);
 const [page,setPage]=useState<'library'|'links'>('library');
 const [sort,setSort]=useState<FileInventorySort>('newest');
 const [provider,setProvider]=useState<FileStorageProvider|'all'>('all');
 const [folder,setFolder]=useState('all');
 useEffect(()=>hydrate(scope),[hydrate,scope]);
 const index=useMemo(()=>new Map(targets.map(t=>[fileTargetKey(t),t])),[targets]);
 const rows=useMemo(()=>{
  const linked=storedScope===scope&&scope?
   inventoryFromLinks(records).filter(row=>index.has(fileTargetKey({kind:row.targetKind,id:row.targetId}))):[];
  const stored=managedStatus==='ready'?managedRows.filter(row=>
   row.status==='ready'&&index.has(fileTargetKey({kind:row.target_kind,id:row.target_id})))
   .map(managedToInventory391):[];
  return [...stored,...linked];
 },[records,scope,storedScope,index,managedRows,managedStatus]);
 const usage=useMemo(()=>summarizeFileInventory(rows),[rows]);
 const folders=useMemo(()=>[...new Set(rows.map(r=>r.folderPath).filter((v):v is string=>!!v))].sort(),[rows]);
 const visible=useMemo(()=>sortFileInventory(rows.filter(row=>
  (provider==='all'||row.provider===provider)&&
  (folder==='all'||(folder==='root'?!row.folderPath:row.folderPath===folder))&&
  (!search.trim()||[
    row.name,row.folderPath??'',providerLabel(row.provider),row.category,
    index.get(fileTargetKey({kind:row.targetKind,id:row.targetId}))?.title??'',
  ].join(' ').toLowerCase().includes(search.toLowerCase().trim()))),sort),
  [rows,provider,folder,search,index,sort]);
 const sized=usage.knownFiles>0;
 const pending=managedRows.filter(r=>r.status==='pending');
 const trashed=managedRows.filter(r=>r.status==='trashed');
 const reservedBytes=managedRows.reduce((total,row)=>total+
  (row.status==='pending'?MANAGED_MAX_BYTES_391:row.size_bytes??0),0);
 const allowanceRemaining=Math.max(0,MANAGED_ORG_ALLOWANCE_391-reservedBytes);
 return <div className="ss-storage390" aria-label="Files and storage management">
  <div className="ss-storage390-summary" aria-label="Storage inventory summary">
   <div><small>Indexed items</small><strong>{usage.items}</strong>
    <span>{usage.files} files · {usage.folders} folders</span></div>
   <div><small>Known file size</small><strong>{sized?fileSizeLabel(usage.knownBytes):'—'}</strong>
    <span>{usage.unknownSize} {usage.unknownSize===1?'file has':'files have'} unknown size</span></div>
   <div><small>Storage sources</small><strong>{usage.providerCount}</strong>
    <span>Providers represented in this library</span></div>
   <div><small>Managed storage allowance</small>
    <strong>{managedStatus==='ready'?fileSizeLabel(reservedBytes):'Not active'}</strong>
    <span>{managedStatus==='ready'?
     fileSizeLabel(allowanceRemaining)+' remaining of '+fileSizeLabel(MANAGED_ORG_ALLOWANCE_391):
     'Private Storage activation required'}</span></div>
  </div>
  <p className="ss-storage390-note">
   Indexed bytes reflect only verified stored documents. External links do not
   expose file sizes without provider authorization. This is not billing, quota,
   storage overhead, or network usage.
  </p>
  <ManagedStorageNotice391/>
  <div className="ss-storage390-switch" role="group" aria-label="Files workspace modes">
   <button type="button" aria-pressed={page==='library'} onClick={()=>setPage('library')}>Library</button>
   <button type="button" aria-pressed={page==='links'} onClick={()=>setPage('links')}>Manage links</button>
  </div>
  {page==='library'?<>
   {mayEdit&&managedStatus==='ready'&&
    <ManagedUploadPanel391 targets={targets} compact/>}
   <div className="ss-storage390-controls">
    <label>Sort by
     <select value={sort} onChange={e=>setSort(e.target.value as FileInventorySort)}>
      {SORT_OPTIONS.map(option=><option key={option.id} value={option.id}
       disabled={option.id.startsWith('size-')&&!sized}>
       {option.label}{option.id.startsWith('size-')&&!sized?' · sizes unavailable':''}</option>)}
     </select>
    </label>
    <label>Provider
     <select value={provider} onChange={e=>setProvider(e.target.value as FileStorageProvider|'all')}>
      <option value="all">All providers</option>
      {usage.byProvider.map(p=><option value={p.provider} key={p.provider}>
       {providerLabel(p.provider)} ({p.items})</option>)}
     </select>
    </label>
    <label>Folder
     <select value={folder} onChange={e=>setFolder(e.target.value)}>
      <option value="all">All folders</option>
      <option value="root">Unfiled</option>
      {folders.map(path=><option key={path} value={path}>{path}</option>)}
     </select>
    </label>
    <button type="button" onClick={()=>setPage('links')}>+ Link document</button>
   </div>
   <div className="ss-storage390-table-viewport">
    <table className="ss-storage390-table">
     <thead><tr><th>Name</th><th>Provider</th><th>Linked record</th>
      <th>Size</th><th>Updated</th><th>Actions</th></tr></thead>
     <tbody>
      {visible.map(row=>{
       const target=index.get(fileTargetKey({kind:row.targetKind,id:row.targetId}));
       const stored=row.source==='managed'?
        managedRows.find(m=>'managed:'+m.id===row.id):undefined;
       return <tr key={row.id}>
        <td>{stored?<span className="ss-managed391-name"><strong>▤ {row.name}</strong>
          {row.folderPath&&<small>{row.folderPath}</small>}</span>:
         <a href={row.openUrl} target="_blank" rel="noopener noreferrer">
          {row.kind==='folder'?'▣ ':'▤ '}{row.name}</a>}</td>
        <td>{providerLabel(row.provider)}</td>
        <td>{target?<button type="button" onClick={()=>onOpenTarget(target)}>{target.title}</button>:'Unavailable'}</td>
        <td title={row.sizeBytes===null?'Provider size has not been fetched':undefined}>
         {fileSizeLabel(row.sizeBytes)}</td>
        <td>{new Date(row.updatedAt).toLocaleDateString()}</td>
        <td>{stored?<ManagedDocumentActions391 row={stored}/>:<button type="button"
         onClick={()=>setPage('links')}>Manage link</button>}</td>
       </tr>;
      })}
      {!visible.length&&<tr><td colSpan={6} className="ss-storage390-empty">
       {rows.length?'No files match these filters.':'No documents linked yet. Use + Link document to start.'}
      </td></tr>}
     </tbody>
    </table>
   </div>
   {managedStatus==='ready'&&mayEdit&&pending.length>0&&
    <details className="ss-managed391-trash"><summary>Pending uploads · {pending.length}</summary>
     {pending.map(row=><div key={row.id}>{row.title}
      <ManagedDocumentActions391 row={row}/></div>)}
    </details>}
   {managedStatus==='ready'&&mayEdit&&trashed.length>0&&
    <details className="ss-managed391-trash"><summary>Trash · {trashed.length}</summary>
     {trashed.map(row=><div key={row.id}>{row.title}
      <ManagedDocumentActions391 row={row}/></div>)}
    </details>}
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
   <p><strong>SalesShop-managed Supabase</strong> — private Company and Deal uploads
    are available after the security migration is approved and deployed.</p>
   <p><strong>Bring your own Supabase / S3 / Cloudflare R2</strong> — provider
    adapters planned. Credentials will remain server-side and tenant-scoped.</p>
   <p><strong>Google Drive / Dropbox / OneDrive</strong> — link-only today.
    Storage size and operations will need a separately authorized provider connection.</p>
   <p>Customer-owned storage adapters, provider credentials, billing controls,
    and Quote-level attachments remain separate future releases.
    Existing external file links remain browser-local.</p>
  </details>
 </div>;
}
