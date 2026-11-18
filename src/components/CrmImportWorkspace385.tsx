import {useMemo,useRef,useState} from 'react';
import {useAuthStore} from '../store/authStore';
import {useCrmStore} from '../store/crmStore';
import {CRM_IMPORT_FIELDS,MAX_CRM_IMPORT_BYTES,detectCrmImportMapping,
 previewCrmImport,readCrmImportFile,type CrmImportKind,type CrmImportTable,
 type CrmImportMapping,type CrmImportField} from '../services/crmImport385';
import {commitReviewedCrmImport,crmImportCanCreate,crmImportIdentity}
 from '../services/crmImportCommit385';
import './crm-import-workspace385.css';
import {CrmRelationshipImport386} from './CrmRelationshipImport386';

const TARGETS=[
 {id:'company',label:'Companies',hint:'Import Companies before People or Deals that reference them.'},
 {id:'person',label:'People',hint:'Link People to an existing Company by its exact name or alias.'},
 {id:'deal',label:'Deals',hint:'Link Deals to existing Companies and map live SalesShop stages.'},
] as const;

export function CrmImportWorkspace385(){
 const [importMode,setImportMode]=useState<'records'|'links'>('records');
 const [kind,setKind]=useState<CrmImportKind>('company');
 const [file,setFile]=useState<File|null>(null);
 const [table,setTable]=useState<CrmImportTable|null>(null);
 const [sheetNames,setSheetNames]=useState<string[]>([]);
 const [sheet,setSheet]=useState(0);
 const [mapping,setMapping]=useState<CrmImportMapping>({});
 const [accepted,setAccepted]=useState(false);
 const [busy,setBusy]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const loadingSerial=useRef(0),importLocked=useRef(false);
 const companies=useCrmStore(s=>s.companies);
 const contacts=useCrmStore(s=>s.contacts);
 const deals=useCrmStore(s=>s.projects);
 const loaded=useCrmStore(s=>s.hydrated);
 const authReady=useAuthStore(s=>s.ready);
 const canImport=authReady&&loaded&&crmImportCanCreate();
 const preview=useMemo(()=>table?previewCrmImport(kind,table,mapping,{
  companies,people:contacts,deals,
 }):null,[kind,table,mapping,companies,contacts,deals]);
 const load=async(nextFile:File|null,nextSheet=0)=>{
  const sequence=++loadingSerial.current;
  setError('');setNotice('');setAccepted(false);
  setTable(null);setMapping({});setFile(nextFile);setSheet(nextSheet);
  setSheetNames([]);
  if(!nextFile)return;
  if(nextFile.size>MAX_CRM_IMPORT_BYTES){
   setError('File exceeds 2 MB. Split the spreadsheet into smaller imports.');return;
  }
  setBusy(true);
  try{
   const parsed=await readCrmImportFile(nextFile,nextSheet);
   if(sequence!==loadingSerial.current)return;
   setTable(parsed.table);setSheetNames(parsed.sheetNames);
   setMapping(detectCrmImportMapping(kind,parsed.table.headers));
  }catch(caught){
   if(sequence!==loadingSerial.current)return;
   setError(caught instanceof Error?caught.message:'Could not read the selected file.');
  }finally{if(sequence===loadingSerial.current)setBusy(false);}
 };
 const changeKind=(next:CrmImportKind)=>{
  if(importLocked.current)return;
  setKind(next);setAccepted(false);setNotice('');setError('');
  if(table)setMapping(detectCrmImportMapping(next,table.headers));
 };
 const changeMapping=(field:CrmImportField,value:string)=>{
  setMapping(current=>{
   const next={...current};
   if(value==='')delete next[field];else next[field]=Number(value);
   return next;
  });
  setAccepted(false);setNotice('');
 };
 const run=async()=>{
  if(importLocked.current||!file||!table||!preview||!canImport||
   !accepted||busy||preview.errors.length||preview.counts.ready===0)return;
  importLocked.current=true;setSaving(true);setError('');setNotice('');
  try{
   const result=await commitReviewedCrmImport({
    kind,table,mapping,identity:crmImportIdentity(),
   });
   if(result.cloudConfirmed)setNotice(result.note+
    (result.skipped?' '+result.skipped+' other row(s) were not imported.':''));
   else setError(result.note);
  }catch(caught){
   setError(caught instanceof Error?caught.message:'Import stopped. Check existing records before retrying.');
  }finally{setSaving(false);setAccepted(false);importLocked.current=false;}
 };
 const downloadSample=()=>{
  const fields=CRM_IMPORT_FIELDS[kind].map(field=>field.label);
  const samples:Record<CrmImportKind,string[]>={
   company:['Example Business','Customer'],
   person:['Sample Person','person@example.com','555-010-1234','Estimator','Example Business'],
   deal:['Sample Project','Example Business','Discovery','Commercial','12000','2026-12-15','Follow up'],
  };
  const csv=[fields,samples[kind]].map(row=>row.map(cell=>
   '"'+cell.replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download='salesshop-'+kind+'-import-sample.csv';
  document.body.append(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
 };
 if(importMode==='links')return <CrmRelationshipImport386
  onBack={()=>setImportMode('records')}/>;
 return <section className="ss-crm-import" aria-label="CRM data import">
  <header className="ss-crm-import-heading">
   <div><small>DATA MANAGEMENT · REVIEW-FIRST</small><h2>Import CRM records</h2>
    <p>Bring existing spreadsheets into SalesShop without overwriting your current records.</p>
   </div>
   <span>CSV · XLSX · XLS</span>
  </header>
  <nav className="ss-crm-import-mode-nav" aria-label="Import type">
   <button type="button" aria-current="page">Import records</button>
   <button type="button" disabled={saving} onClick={()=>setImportMode('links')}>
    Link People to Deals
   </button>
  </nav>
  <div className="ss-crm-import-layout">
   <article className="ss-crm-import-card">
    <div className="ss-crm-import-step-title"><span>1</span><div><strong>Choose records</strong>
     <small>Import one record type at a time so relationships can be reviewed.</small></div></div>
    <div className="ss-crm-import-targets" role="group" aria-label="Record type to import">
     {TARGETS.map(target=><button type="button" key={target.id}
      aria-pressed={kind===target.id} disabled={saving}
      onClick={()=>changeKind(target.id)}>{target.label}</button>)}
    </div>
    <p className="ss-crm-import-hint">{TARGETS.find(target=>target.id===kind)?.hint}</p>
    <div className="ss-crm-import-source">
     <label htmlFor="ss-crm-import-file">Choose a CSV or Excel spreadsheet (maximum 2 MB)</label>
     <input id="ss-crm-import-file" type="file"
      accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      disabled={saving} onChange={event=>{void load(event.target.files?.[0]??null);}}/>
     <button type="button" onClick={downloadSample}>Download sample CSV</button>
    </div>
    {file&&<div className="ss-crm-import-loaded">
     <strong>{file.name}</strong><small>{busy?'Reading file…':
      table?table.rows.length+' row(s) · '+table.headers.length+' columns':'File not loaded'}</small>
    </div>}
    {sheetNames.length>1&&<label className="ss-crm-import-sheet">Worksheet
     <select disabled={saving||busy} value={sheet}
      onChange={e=>{if(file)void load(file,Number(e.target.value));}}>
      {sheetNames.map((name,index)=><option value={index} key={index}>{name}</option>)}
     </select>
    </label>}
   </article>
   <article className="ss-crm-import-card">
    <div className="ss-crm-import-step-title"><span>2</span><div><strong>Map columns</strong>
     <small>Suggested mappings are editable. Unmapped optional fields stay empty.</small></div></div>
    {!table?<p className="ss-crm-import-empty">Upload a spreadsheet to see suggested fields.</p>:
     <div className="ss-crm-import-mappings">
      {CRM_IMPORT_FIELDS[kind].map(field=><label key={field.id}>
       <span>{field.label}{field.required?' *':''}</span>
       <select aria-label={'Column for '+field.label} disabled={saving}
        value={mapping[field.id]===undefined?'':String(mapping[field.id])}
        onChange={e=>changeMapping(field.id,e.target.value)}>
        <option value="">Do not import</option>
        {table.headers.map((header,index)=><option key={index} value={index}>
         {header||'Column '+(index+1)}</option>)}
       </select>
      </label>)}
     </div>}
    <p className="ss-crm-import-hint">Original spreadsheet values are reviewed in your browser.
     Only approved core fields are imported. Custom fields are not published.</p>
   </article>
  </div>
  <article className="ss-crm-import-card ss-crm-import-review">
   <div className="ss-crm-import-step-title"><span>3</span><div><strong>Review matches</strong>
    <small>Ready rows can be created; existing and uncertain records are always skipped.</small></div></div>
   {preview&&preview.errors.length>0&&<div className="ss-crm-import-error" role="alert">
    {preview.errors.join(' ')}</div>}
   {!preview?<p className="ss-crm-import-empty">Your import preview will appear here after mapping.</p>:
    <><div className="ss-crm-import-stats" aria-live="polite">
      <div><strong>{preview.counts.ready}</strong><span>Ready to create</span></div>
      <div><strong>{preview.counts.existing}</strong><span>Already exists</span></div>
      <div><strong>{preview.counts.review}</strong><span>Needs review</span></div>
     </div>
     {preview.candidates.length>0&&<div className="ss-crm-import-preview-table" role="region"
       aria-label="Import row preview" tabIndex={0}>
      <table><thead><tr><th scope="col">File row</th><th scope="col">Record</th>
       <th scope="col">Status</th><th scope="col">Reason</th></tr></thead>
       <tbody>{preview.candidates.slice(0,60).map(candidate=><tr key={candidate.index}>
        <td>{candidate.index+2}</td>
        <td>{candidate.values.name||'Untitled'}{candidate.values.companyName?
         <small>Company: {candidate.values.companyName}</small>:null}</td>
        <td><span className={'ss-crm-import-status is-'+candidate.status}>
         {candidate.status==='ready'?'Ready':candidate.status==='existing'?'Already exists':'Needs review'}
        </span></td>
        <td>{candidate.reason}</td>
       </tr>)}</tbody>
      </table>
     </div>}
     {preview.candidates.length>60&&<small className="ss-crm-import-preview-limited">
      Showing the first 60 of {preview.candidates.length} rows. All rows are validated.</small>}
     <div className="ss-crm-import-approval">
      <label><input type="checkbox" checked={accepted}
       disabled={!canImport||saving||busy||preview.counts.ready===0||preview.errors.length>0}
       onChange={event=>setAccepted(event.target.checked)}/>
       <span>I reviewed the results. Create only <strong>{preview.counts.ready}</strong> Ready
        records; skip existing and uncertain rows without modifying them.</span>
      </label>
      <button type="button" onClick={()=>{void run();}}
       disabled={!accepted||!canImport||saving||busy||preview.counts.ready===0||
        preview.errors.length>0}>
       {saving?'Importing…':'Create '+preview.counts.ready+' records'}
      </button>
     </div>
    </>}
   {!canImport&&<p className="ss-crm-import-permission" role="status">
    Importing requires a loaded CRM, edit permission, and no active role preview.
    You can still inspect file mappings and validation results.
   </p>}
   {error&&<p className="ss-crm-import-error" role="alert">{error}</p>}
   {notice&&<p className="ss-crm-import-success" role="status">{notice}</p>}
   <footer className="ss-crm-import-footer">
    No overwrites, deletions, guessed Company links, automatic email, or background jobs.
    Start by importing Companies, then import People and Deals using their exact Company names.
    Cloud imports use existing CRM permissions and wait for cloud confirmation;
    failures may leave locally saved rows pending sync. You can reload the workspace and
    re-review rather than repeating an unverified import.
   </footer>
  </article>
 </section>;
}
