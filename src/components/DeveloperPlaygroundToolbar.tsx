import {useState,type ChangeEvent} from 'react';
import {leavePlaygroundUrl,isDeveloperPlaygroundRoute,resetPlaygroundStorage,
 scopedStorageKey} from '../lib/developerPlayground';
import {readLocalDocument,writeLocalDocument,LOCAL_STORAGE_KEYS} from '../data/cloudAwareStorage';
import {parseDemoRecordsBundle,sampleDemoRecordsJson,DEMO_RECORDS_MAX_BYTES,
 type DemoMaterialized} from '../services/playgroundRecordImport353a';

const DEMO_TASK_KEY='salesshop-personal-tasks-v1:local:user';
type Preview={name:string;dataset:DemoMaterialized;raw:string};

/** Fixed compact escape hatch; mounted only on the disconnected Developer Playground.
 * No tenant Supabase client or cloud record deletion is possible on this route. */
export function DeveloperPlaygroundToolbar() {
 const [expanded,setExpanded]=useState(false);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const reset=()=>{
  if(!isDeveloperPlaygroundRoute())return;
  if(!window.confirm('Reset ALL local Playground changes (including imported records, Tasks, Quotes, Notebook, and catalog preferences) and reload the fictional samples? This does not affect any real company.'))return;
  resetPlaygroundStorage();
  window.location.reload();
 };
 const download=()=>{
  if(!isDeveloperPlaygroundRoute())return;
  const blob=new Blob([sampleDemoRecordsJson()],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='salesshop-demo-records.json';
  document.body.append(a);a.click();a.remove();
  URL.revokeObjectURL(url);
 };
 const fileSelected=async(event:ChangeEvent<HTMLInputElement>)=>{
  setPreview(null);setError('');
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file)return;
  if(file.size>DEMO_RECORDS_MAX_BYTES){
   setError('This file exceeds 250 KB. Split large test datasets into smaller files.');
   return;
  }
  try{
   const raw=await file.text();
   const dataset=parseDemoRecordsBundle(raw);
   setPreview({name:file.name,dataset,raw});
  }catch(err){
   setError(err instanceof Error?err.message:'Cannot read or validate this demo file.');
  }
 };
 const importRecords=()=>{
  if(!isDeveloperPlaygroundRoute()||!preview||busy)return;
  setBusy(true);setError('');
  try{
   // Parse a second time to reject any malformed/changed payload.
   const parsed=parseDemoRecordsBundle(preview.raw);
   const counts=parsed.counts;
   if(!window.confirm('REPLACE the current Playground CRM, Quotes and Tasks with '+
    [counts.companies+' Companies',counts.people+' People',counts.deals+' Deals',
     counts.activities+' Activities',counts.quotes+' Quotes',counts.tasks+' Tasks'].join(', ')+
    '? This is the browser-only Developer Playground. No live account will change.')){
    setBusy(false);return;
   }
   const keys=[
    scopedStorageKey(LOCAL_STORAGE_KEYS.crm),
    scopedStorageKey(LOCAL_STORAGE_KEYS.quotes),
    scopedStorageKey(DEMO_TASK_KEY),
   ];
   const backup=keys.map(key=>localStorage.getItem(key));
   try{
    writeLocalDocument('crm',parsed.crm,false);
    writeLocalDocument('quotes',parsed.quotes,false);
    localStorage.setItem(scopedStorageKey('salesshop-personal-tasks-v1:local:user'),
     JSON.stringify(parsed.tasks));
   }catch(err){
    keys.forEach((key,index)=>{
     if(backup[index]===null)localStorage.removeItem(key);
     else localStorage.setItem(key,backup[index]);
    });
    throw err;
   }
   window.location.reload();
  }catch(err){
   setError(err instanceof Error?err.message:'Unable to load records locally.');
   setBusy(false);
  }
 };
 return <aside className={`developer-playground-toolbar${expanded?' is-expanded':''}`}
  aria-label="Developer sandbox controls">
  <button type="button" className="developer-playground-toggle"
   aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>
   ◇ Playground <span>{expanded?'×':'☰'}</span>
  </button>
  {expanded&&<div className="developer-playground-toolbar-actions">
   <div><strong>Fictional test workspace</strong>
    <small>Browser-only records · No customer cloud connection</small></div>
   <section className="developer-playground-import" aria-label="Import test dataset">
    <strong>Import a test dataset</strong>
    <small>Generate a sample JSON, customize it, and upload it to test realistic records and relationships.</small>
    <button type="button" onClick={download}>Download sample JSON</button>
    <label className="developer-playground-file">
     <span>Select a JSON file to preview</span>
     <input type="file" accept=".json,application/json" onChange={event=>{void fileSelected(event);}}/>
    </label>
    {preview&&<div className="developer-playground-import-preview" role="status">
     <strong>{preview.name}</strong>
     <small>{preview.dataset.counts.companies} Companies · {preview.dataset.counts.people} People
      {' · '}{preview.dataset.counts.deals} Deals · {preview.dataset.counts.activities} Activities
      {' · '}{preview.dataset.counts.quotes} Quotes · {preview.dataset.counts.tasks} Tasks</small>
     <button type="button" disabled={busy} onClick={importRecords}>
      Replace local test records</button>
    </div>}
    {error&&<p role="alert" className="developer-playground-error">{error}</p>}
    <small>Import replaces Playground CRM, Quotes and Tasks only. Use Reset demo below
     to clear every Playground preference and return to the original fictional sample.</small>
   </section>
   <button type="button" onClick={reset}>Reset demo</button>
   <button type="button" onClick={()=>window.location.assign(leavePlaygroundUrl())}>
    ← Platform Studio</button>
  </div>}
 </aside>;
}
