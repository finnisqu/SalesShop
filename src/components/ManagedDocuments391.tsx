import {useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {useManagedFileStore391} from '../store/managedFileStore391';
import {MANAGED_ACCEPT_391,MANAGED_MAX_BYTES_391,
 type ManagedRow391} from '../services/managedDocuments391';
import {fileSizeLabel} from '../services/fileStorageInventory390';
import {FILE_LINK_CATEGORIES,fileTargetKey,type FileTarget,
 type FileLinkCategory} from '../services/fileLinks357a';
import './managed-documents391.css';

export function useManagedStorageBinding391(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id);
 const bind=useManagedFileStore391(s=>s.bind);
 useEffect(()=>bind(),[mode,org,user,bind]);
}
export function useManagedDocumentPermission391(){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  dept=useAuthStore(s=>s.teamDepartment);
 const preview=useRolePerspectiveStore(s=>s.activePerspective);
 return !preview&&mode==='cloud'&&!!org&&!!user&&canEditTeamArea(role,dept,'crm');
}
export function ManagedStorageNotice391(){
 const readiness=useManagedFileStore391(s=>s.readiness);
 const error=useManagedFileStore391(s=>s.error);
 const notice=useManagedFileStore391(s=>s.notice);
 const refresh=useManagedFileStore391(s=>s.refresh);
 const clear=useManagedFileStore391(s=>s.clearNotice);
 if(readiness==='ready'&&!error&&!notice)return null;
 return <div className="ss-managed391-status" role="status">
  {readiness==='idle'&&<span>Sign in to a cloud workspace for managed document uploads.</span>}
  {readiness==='loading'&&<span>Checking private document storage…</span>}
  {readiness==='unconfigured'&&<span>Managed uploads are staged but not activated.
    Private Storage and its security policies need to pass rollout checks before use.</span>}
  {readiness==='error'&&<span>Could not check document storage.</span>}
  {error&&<strong>{error}</strong>}
  {notice&&<span>{notice}</span>}
  {readiness!=='loading'&&readiness!=='idle'&&
   <button type="button" onClick={()=>{clear();void refresh();}}>Refresh storage</button>}
 </div>;
}
export function ManagedUploadPanel391({targets,compact=false}:{
 targets:readonly FileTarget[];compact?:boolean;
}){
 const editable=useManagedDocumentPermission391();
 const status=useManagedFileStore391(s=>s.readiness);
 const busy=useManagedFileStore391(s=>s.busy);
 const upload=useManagedFileStore391(s=>s.upload);
 const [targetKey,setTargetKey]=useState('');
 const [category,setCategory]=useState<FileLinkCategory>('other');
 const [folder,setFolder]=useState('');
 const [error,setError]=useState('');
 const input=useRef<HTMLInputElement>(null);
 const allowed=useMemo(()=>targets.filter(t=>t.kind==='company'||t.kind==='deal'),[targets]);
 const chosen=allowed.length===1?allowed[0]:allowed.find(t=>fileTargetKey(t)===targetKey);
 const submit=async(e:FormEvent)=>{
  e.preventDefault();setError('');
  const file=input.current?.files?.item(0);
  if(!file||!chosen){setError('Choose a document and its Company or Deal.');return;}
  try{
   await upload(chosen,file,category,folder);
   if(input.current)input.current.value='';
   setFolder('');
  }catch(caught){setError(caught instanceof Error?caught.message:'Upload failed.');}
 };
 if(!editable||status!=='ready'||!allowed.length)return null;
 return <details className="ss-managed391-upload" open={!compact||undefined}>
  <summary>Upload a document</summary>
  <form onSubmit={event=>{void submit(event);}}>
   {allowed.length>1&&<label>Attach to
    <select value={chosen?fileTargetKey(chosen):''} required
     onChange={e=>setTargetKey(e.target.value)}>
     <option value="">Choose Company or Deal</option>
     {allowed.map(t=><option key={fileTargetKey(t)} value={fileTargetKey(t)}>
      {t.kind==='company'?'Company':'Deal'} · {t.title}</option>)}
    </select>
   </label>}
   <label>File
    <input ref={input} type="file" required accept={MANAGED_ACCEPT_391}/>
   </label>
   <label>Category
    <select value={category} onChange={e=>setCategory(e.target.value as FileLinkCategory)}>
     {FILE_LINK_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
    </select>
   </label>
   <label>Folder (optional)
    <input type="text" maxLength={160} placeholder="e.g. Bid package / Plans"
     value={folder} onChange={e=>setFolder(e.target.value)}/>
   </label>
   <button type="submit" disabled={busy||!chosen}>
    {busy?'Uploading…':'Upload to private storage'}</button>
   {error&&<p className="ss-managed391-error" role="alert">{error}</p>}
   <small>Max {fileSizeLabel(MANAGED_MAX_BYTES_391)} · Private files ·
    Verified server-side before listing · No automatic sharing with customers</small>
  </form>
 </details>;
}
function ask(message:string){return window.confirm(message);}
export function ManagedDocumentActions391({row}:{row:ManagedRow391}){
 const editable=useManagedDocumentPermission391();
 const busy=useManagedFileStore391(s=>s.busy);
 const downloading=useManagedFileStore391(s=>s.download);
 const trash=useManagedFileStore391(s=>s.trash);
 const restore=useManagedFileStore391(s=>s.restore);
 const purge=useManagedFileStore391(s=>s.purge);
 const complete=useManagedFileStore391(s=>s.complete);
 const [localError,setLocalError]=useState('');
 const act=async(action:()=>Promise<void>)=>{
  setLocalError('');
  try{await action();}catch(e){setLocalError(e instanceof Error?e.message:'File action failed.');}
 };
 return <span className="ss-managed391-actions">
  {row.status==='ready'&&<button type="button" disabled={busy}
   onClick={()=>{void act(()=>downloading(row));}}>Download</button>}
  {row.status==='ready'&&editable&&<button type="button" disabled={busy}
   onClick={()=>{if(ask('Move '+row.title+' to trash? It will disappear from the active library.'))
    void act(()=>trash(row));}}>Trash</button>}
  {row.status==='trashed'&&editable&&<button type="button" disabled={busy}
   onClick={()=>{void act(()=>restore(row));}}>Restore</button>}
  {row.status==='pending'&&editable&&<button type="button" disabled={busy}
   onClick={()=>{void act(()=>complete(row.id));}}>Complete upload</button>}
  {row.status!=='ready'&&editable&&<button type="button" disabled={busy}
   onClick={()=>{if(ask('Permanently delete '+row.title+'? This cannot be undone.'))
    void act(()=>purge(row));}}>Delete</button>}
  {localError&&<small role="alert">{localError}</small>}
 </span>;
}
export function RecordManagedDocuments391({target}:{target:FileTarget}){
 useManagedStorageBinding391();
 const rows=useManagedFileStore391(s=>s.rows).filter(row=>
  row.target_kind===target.kind&&row.target_id===target.id);
 const status=useManagedFileStore391(s=>s.readiness);
 const canEdit=useManagedDocumentPermission391();
 const visible=rows.filter(row=>row.status!=='trashed');
 return <section className="ss-managed391-record" aria-label="Stored documents">
  <div className="ss-managed391-record-head">
   <strong>Private storage</strong>
   <small>{status==='ready'?visible.length+' documents':'Checking availability'}</small>
  </div>
  <ManagedStorageNotice391/>
  {status==='ready'&&<ManagedUploadPanel391 targets={[target]} compact/>}
  {status==='ready'&&<div className="ss-managed391-record-list">
   {visible.map(row=><div key={row.id}>
    <span><strong>{row.title}</strong><small>
     {row.status==='ready'?fileSizeLabel(row.size_bytes):'Upload pending'}
     {' · '}{row.category}{row.folder_path?' · '+row.folder_path:''}
    </small></span><ManagedDocumentActions391 row={row}/>
   </div>)}
   {!visible.length&&<p>No stored documents attached to this record yet.</p>}
  </div>}
  {canEdit&&status==='ready'&&rows.some(row=>row.status==='trashed')&&
   <details className="ss-managed391-trash"><summary>Trash · {rows.filter(r=>r.status==='trashed').length}</summary>
    {rows.filter(r=>r.status==='trashed').map(row=><div key={row.id}>
     {row.title} <ManagedDocumentActions391 row={row}/>
    </div>)}
   </details>}
 </section>;
}
