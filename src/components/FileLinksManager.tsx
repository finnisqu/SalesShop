import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {useAuthStore} from '../store/authStore';
import {useFileLinkStore} from '../store/fileLinkStore';
import {fileLinkProvider,fileLinksScope,fileTargetKey,
 type FileLinkDraft,type FileLinkKind,type FileLinkRecord,type FileTarget} from '../services/fileLinks357a';
import './file-links.css';

type Props={
 target?:FileTarget;targets?:readonly FileTarget[];
 search?:string;onOpenTarget?:(target:FileTarget)=>void;
};
/** Stores and opens real provider URLs; it does not upload their contents or
 * imply Dropbox/Drive authorization. Safe, explicit local-only first slice. */
export function FileLinksManager({target,targets=[],search='',onOpenTarget}:Props){
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  user=useAuthStore(s=>s.user?.id);
 const expectedScope=fileLinksScope(mode,org,user);
 const storedScope=useFileLinkStore(s=>s.scope);
 const records=useFileLinkStore(s=>s.records);
 const hydrate=useFileLinkStore(s=>s.hydrate);
 const add=useFileLinkStore(s=>s.add),edit=useFileLinkStore(s=>s.edit),
  remove=useFileLinkStore(s=>s.remove);
 useEffect(()=>hydrate(expectedScope),[hydrate,expectedScope]);
 const allTargets=useMemo(()=>target?[target]:[...targets],[target,targets]);
 const [targetKey,setTargetKey]=useState('');
 const [showForm,setShowForm]=useState(false);
 const [editingId,setEditingId]=useState<string|null>(null);
 const [title,setTitle]=useState(''),[url,setUrl]=useState(''),
  [kind,setKind]=useState<FileLinkKind>('file'),[error,setError]=useState('');
 const chosen=target??allTargets.find(item=>fileTargetKey(item)===targetKey);
 const targetsByKey=useMemo(()=>new Map(allTargets.map(row=>[fileTargetKey(row),row])),[allTargets]);
 const scoped=storedScope===expectedScope&&!!expectedScope?records:[];
 const visible=scoped.filter(row=>{
  if(target)return row.targetKind===target.kind&&row.targetId===target.id;
  return targetsByKey.has(fileTargetKey({kind:row.targetKind,id:row.targetId}));
 }).filter(row=>{
  if(!search.trim())return true;
  const label=targetsByKey.get(fileTargetKey({kind:row.targetKind,id:row.targetId}))?.title??'';
  return [row.title,row.url,label,fileLinkProvider(row.url)].join(' ').toLowerCase()
   .includes(search.trim().toLowerCase());
 }).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 const startNew=()=>{setEditingId(null);setTitle('');setUrl('');setKind('file');
  setError('');setShowForm(true);};
 const startEdit=(row:FileLinkRecord)=>{setEditingId(row.id);setTitle(row.title);
  setUrl(row.url);setKind(row.kind);setError('');setShowForm(true);};
 const submit=(event:FormEvent)=>{
  event.preventDefault();
  if(!chosen&&!editingId){setError('Choose a Company, Deal or Quote first.');return;}
  try{
   if(editingId)edit(editingId,{title,url,kind});
   else if(chosen){
    const draft:FileLinkDraft={title,url,kind,targetKind:chosen.kind,targetId:chosen.id};
    add(draft);
   }
   setError('');setShowForm(false);setEditingId(null);setTitle('');setUrl('');
  }catch(e){setError(e instanceof Error?e.message:'Could not save link.');}
 };
 if(!expectedScope)return <p className="ss-files-notice">A signed-in workspace is required for your private file links.</p>;
 return <div className="ss-file-links-manager">
  {!showForm&&<div className="ss-file-links-actions">
   <span>{visible.length} {visible.length===1?'link':'links'}{target?' for this record':''}</span>
   <button type="button" onClick={startNew}>+ Link file or folder</button>
  </div>}
  {showForm&&<form className="ss-file-links-form" onSubmit={submit}>
   <div className="ss-file-links-form-head">
    <strong>{editingId?'Edit link':'Link a document or folder'}</strong>
    <button type="button" onClick={()=>{setShowForm(false);setError('');}}>Cancel</button>
   </div>
   {!target&&!editingId&&<label>Related record
    <select value={chosen?fileTargetKey(chosen):''} required
     aria-label="File linked CRM record" onChange={e=>setTargetKey(e.target.value)}>
     <option value="">Choose a Company, Deal or Quote</option>
     <optgroup label="Companies">
      {allTargets.filter(row=>row.kind==='company').map(row=>
       <option key={fileTargetKey(row)} value={fileTargetKey(row)}>{row.title}</option>)}
     </optgroup>
     <optgroup label="Deals">
      {allTargets.filter(row=>row.kind==='deal').map(row=>
       <option key={fileTargetKey(row)} value={fileTargetKey(row)}>{row.title}</option>)}
     </optgroup>
     <optgroup label="Quotes">
      {allTargets.filter(row=>row.kind==='quote'||row.kind==='externalQuote').map(row=>
       <option key={fileTargetKey(row)} value={fileTargetKey(row)}>{row.title}</option>)}
     </optgroup>
    </select>
   </label>}
   <div className="ss-file-links-fields">
    <label>Label<input type="text" required maxLength={180} value={title}
     autoFocus placeholder="e.g. Contract drawings" onChange={e=>setTitle(e.target.value)}/></label>
    <label>Link type<select value={kind} onChange={e=>setKind(e.target.value as FileLinkKind)}>
     <option value="file">Document / file</option><option value="folder">Folder</option>
    </select></label>
   </div>
   <label>File or folder URL<input type="url" required maxLength={2048}
    value={url} placeholder="https://drive.google.com/…"
    onChange={e=>setUrl(e.target.value)}/></label>
   {error&&<p className="ss-files-error" role="alert">{error}</p>}
   <button type="submit" className="ss-files-save" disabled={!title.trim()||!url.trim()||(!chosen&&!editingId)}>
    {editingId?'Save changes':'Save link'}</button>
  </form>}
  <div className="ss-file-links-list" aria-label="Saved file links">
   {visible.map(row=>{
    const linked=targetsByKey.get(fileTargetKey({kind:row.targetKind,id:row.targetId}));
    return <article className="ss-file-links-row" key={row.id}>
     <span className="ss-file-links-kind" aria-hidden="true">{row.kind==='folder'?'▣':'▤'}</span>
     <div className="ss-file-links-details">
      <a href={row.url} target="_blank" rel="noopener noreferrer" title={'Open '+row.title}>
       {row.title} <span aria-hidden="true">↗</span></a>
      <small>{fileLinkProvider(row.url)}{!target&&linked?' · '+linked.title:''}
       {' · '}{row.kind==='folder'?'Folder':'File'}</small>
     </div>
     <div className="ss-file-links-row-actions">
      {!target&&linked&&onOpenTarget&&
       <button type="button" onClick={()=>onOpenTarget(linked)}>Record</button>}
      <button type="button" onClick={()=>startEdit(row)}>Edit</button>
      <button type="button" className="is-remove" onClick={()=>{
       if(!window.confirm('Remove this link from SalesShop? The original file will not be deleted.'))return;
       try{remove(row.id);setError('');}catch(e){
        setError(e instanceof Error?e.message:'Could not remove link.');setShowForm(true);
       }
      }}>Remove</button>
     </div>
    </article>;
   })}
   {!visible.length&&!showForm&&<p className="ss-files-empty">
     {target?'No files or folders linked to this record.':'No saved links match these records and filters.'}
   </p>}
  </div>
  <p className="ss-files-notice">Links only · Files remain in their original service. Saved privately in this browser for this workspace user; not yet shared or synced across devices.</p>
 </div>;
}
