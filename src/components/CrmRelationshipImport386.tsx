import {useEffect,useMemo,useRef,useState} from 'react';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useCrmStore} from '../store/crmStore';
import {useDealPeopleStore,dealPeopleScope} from '../store/dealPeopleStore';
import {MAX_CRM_IMPORT_BYTES,readCrmImportFile,type CrmImportTable}
 from '../services/crmImport385';
import {RELATIONSHIP_FIELDS,suggestRelationshipMapping,
 previewRelationshipImport,type RelationshipField,type RelationshipMapping}
 from '../services/crmRelationshipImport386';
import {crmImportIdentity} from '../services/crmImportCommit385';
import {canEditTeamArea} from '../services/teamDepartments';
import {relationshipImportCanCommit,commitReviewedRelationshipImport}
 from '../services/crmRelationshipImportCommit386';
import './crm-import-relationships386.css';

export function CrmRelationshipImport386({onBack}:{onBack:()=>void}){
 const [file,setFile]=useState<File|null>(null);
 const [table,setTable]=useState<CrmImportTable|null>(null);
 const [sheet,setSheet]=useState(0);
 const [sheetNames,setSheetNames]=useState<string[]>([]);
 const [mapping,setMapping]=useState<RelationshipMapping>({});
 const [approved,setApproved]=useState<Set<number>>(()=>new Set());
 const [confirmed,setConfirmed]=useState(false);
 const [reading,setReading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const loadSequence=useRef(0),savingLock=useRef(false);
 const mode=useAuthStore(state=>state.mode);
 const orgId=useAuthStore(state=>state.organizationId);
 const userId=useAuthStore(state=>state.user?.id??null);
 const authReady=useAuthStore(state=>state.ready);
 const authRole=useAuthStore(state=>state.teamRole);
 const authDepartment=useAuthStore(state=>state.teamDepartment);
 const perspective=useRolePerspectiveStore(state=>state.activePerspective);
 const companies=useCrmStore(state=>state.companies);
 const people=useCrmStore(state=>state.contacts);
 const deals=useCrmStore(state=>state.projects);
 const crmReady=useCrmStore(state=>state.hydrated);
 const linkScope=dealPeopleScope(mode,orgId);
 const storedScope=useDealPeopleStore(state=>state.scope);
 const linksLoaded=useDealPeopleStore(state=>state.loaded);
 const linksLoading=useDealPeopleStore(state=>state.loading);
 const linksError=useDealPeopleStore(state=>state.error);
 const links=useDealPeopleStore(state=>state.links);
 const loadLinks=useDealPeopleStore(state=>state.load);
 // A new account/workspace gets its own link load. The parent Import page is
 // already keyed by mode/org/user, so pending file bytes cannot cross users.
 useEffect(()=>{
  if(linkScope)void loadLinks(linkScope);
 },[linkScope,loadLinks]);
 const readyLinks=Boolean(linkScope&&storedScope===linkScope&&linksLoaded&&!linksLoading&&!linksError);
 // React selectors must observe role/perspective changes, not only the
 // import form's local state. The commit rechecks authorization as well.
 const canEdit=Boolean(authReady&&crmReady&&readyLinks&&!perspective&&
  (mode==='local'||(userId&&orgId&&
   canEditTeamArea(authRole,authDepartment,'crm'))));
 const preview=useMemo(()=>table&&readyLinks?previewRelationshipImport(
  table,mapping,{companies,people,deals,links}):null,
  [table,mapping,companies,people,deals,links,readyLinks]);
 const selectable=useMemo(()=>new Set(
  (preview?.rows??[]).filter(row=>row.status==='ready').map(row=>row.index)
 ),[preview]);
 const approvedReady=[...approved].filter(index=>selectable.has(index));
 const parse=async(next:File|null,sheetIndex=0)=>{
  const serial=++loadSequence.current;
  setError('');setNotice('');setConfirmed(false);setApproved(new Set());
  setFile(next);setTable(null);setMapping({});
  setSheet(sheetIndex);setSheetNames([]);
  if(!next)return;
  if(next.size>MAX_CRM_IMPORT_BYTES){setError('File exceeds 2 MB.');return;}
  setReading(true);
  try{
   const result=await readCrmImportFile(next,sheetIndex);
   if(serial!==loadSequence.current)return;
   setTable(result.table);setSheetNames(result.sheetNames);
   setMapping(suggestRelationshipMapping(result.table.headers));
  }catch(e){
   if(serial===loadSequence.current)setError(
    e instanceof Error?e.message:'Could not read this spreadsheet.');
  }finally{if(serial===loadSequence.current)setReading(false);}
 };
 const chooseMapping=(field:RelationshipField,next:string)=>{
  setMapping(previous=>{
   const update={...previous};
   if(next==='')delete update[field];else update[field]=Number(next);
   return update;
  });
  setApproved(new Set());setConfirmed(false);setNotice('');setError('');
 };
 const toggle=(index:number,checked:boolean)=>{
  setApproved(previous=>{
   const next=new Set(previous);
   if(checked&&selectable.has(index))next.add(index);else next.delete(index);
   return next;
  });
  setConfirmed(false);setNotice('');
 };
 const run=async()=>{
  if(savingLock.current||!table||!preview||!confirmed||!canEdit||
   !approvedReady.length||preview.errors.length||reading)return;
  const identity=crmImportIdentity();
  if(!relationshipImportCanCommit(identity)){
   setError('The CRM or Deal relationships are still loading.');return;
  }
  savingLock.current=true;setSaving(true);setError('');setNotice('');
  try{
   const result=await commitReviewedRelationshipImport({
    table,mapping,approved:approvedReady,identity,
   });
   setNotice(result.note);setApproved(new Set());
  }catch(e){
   setError(e instanceof Error?e.message:
    'Could not complete relationship import. Review saved links before retrying.');
  }finally{savingLock.current=false;setSaving(false);setConfirmed(false);}
 };
 const sample=()=>{
  const header=['Deal name','Deal Company','Person email','Relationship role'];
  const row=['Example Project','Example Business','person@example.com','Estimator'];
  const content=[header,row].map(values=>values.map(value=>
   '"'+value.replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const blob=new Blob([content],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download='salesshop-deal-person-links-sample.csv';
  document.body.append(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
 };
 return <section className="ss-crm-import ss-crm-relationship-import"
  aria-label="Import Deal–Person relationships">
  <header className="ss-crm-import-heading">
   <div><small>DATA MANAGEMENT · RELATIONSHIPS</small>
    <h2>Link People to Deals</h2>
    <p>Match records you already imported, review each relationship, and create links without changing either record.</p>
   </div>
   <span>CSV · XLSX · XLS</span>
  </header>
  <nav className="ss-crm-import-mode-nav" aria-label="Import type">
   <button type="button" onClick={onBack} disabled={saving}>Import records</button>
   <button type="button" aria-current="page">Link People to Deals</button>
  </nav>
  <div className="ss-crm-import-layout">
   <article className="ss-crm-import-card">
    <div className="ss-crm-import-step-title"><span>1</span><div>
     <strong>Choose relationship file</strong>
     <small>Upload a file with Deal and Person identifiers. No records are created.</small>
    </div></div>
    <div className="ss-crm-import-source">
     <label htmlFor="ss-crm-link-import-file">CSV or Excel file · up to 2 MB / 500 rows</label>
     <input id="ss-crm-link-import-file" type="file"
      accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      disabled={saving} onChange={e=>{void parse(e.target.files?.[0]??null);}}/>
     <button type="button" onClick={sample}>Download sample link CSV</button>
    </div>
    <p className="ss-crm-import-hint">Best identifiers: <strong>SalesShop Deal ID</strong> and
     <strong> SalesShop Person ID</strong>. Alternatively, use an unambiguous Deal name
     (plus Company if needed) and unique Person email. IDs from other software
     are not SalesShop IDs.</p>
    {file&&<div className="ss-crm-import-loaded">
     <strong>{file.name}</strong>
     <small>{reading?'Reading file…':table?table.rows.length+' data rows · '+
      table.headers.length+' columns':'File not loaded'}</small>
    </div>}
    {sheetNames.length>1&&<label className="ss-crm-import-sheet">Worksheet
     <select value={sheet} disabled={reading||saving}
      onChange={e=>{if(file)void parse(file,Number(e.target.value));}}>
      {sheetNames.map((name,index)=><option key={index} value={index}>{name}</option>)}
     </select></label>}
   </article>
   <article className="ss-crm-import-card">
    <div className="ss-crm-import-step-title"><span>2</span><div>
     <strong>Match spreadsheet columns</strong>
     <small>Optional fields can corroborate identity; mismatches stop the link.</small>
    </div></div>
    {!table?<p className="ss-crm-import-empty">Upload a file to map Deal and Person identifiers.</p>:
     <div className="ss-crm-import-mappings">
      {RELATIONSHIP_FIELDS.map(field=><label key={field.id}>
       <span>{field.label}</span>
       <select value={mapping[field.id]===undefined?'':String(mapping[field.id])}
        aria-label={'Column for '+field.label} disabled={saving||reading}
        onChange={e=>chooseMapping(field.id,e.target.value)}>
        <option value="">Not mapped</option>
        {table.headers.map((header,index)=><option key={index} value={index}>
         {header||'Column '+(index+1)}</option>)}
       </select>
      </label>)}
     </div>}
    <p className="ss-crm-import-hint">Required: Deal ID or name, and Person ID or email.
     Names alone do not establish a Person's identity. The optional role is
     applied only to newly created links; existing roles are preserved.</p>
   </article>
  </div>
  <article className="ss-crm-import-card ss-crm-import-review">
   <div className="ss-crm-import-step-title"><span>3</span><div>
    <strong>Approve new relationships</strong>
    <small>Only checked Ready rows will be linked. Uncertain matches are never guessed.</small>
   </div></div>
   {!readyLinks&&<p className="ss-crm-import-permission" role="status">
    {linksError?'Could not load this workspace’s Deal relationships: '+linksError:
     'Loading this workspace’s existing Deal relationships before checking duplicates…'}
   </p>}
   {preview&&preview.errors.length>0&&<p className="ss-crm-import-error" role="alert">
    {preview.errors.join(' ')}</p>}
   {!preview?<p className="ss-crm-import-empty">The relationship preview will appear once the
    spreadsheet, mappings, and existing links are ready.</p>:
    <>
     <div className="ss-crm-import-stats" aria-live="polite">
      <div><strong>{preview.counts.ready}</strong><span>Ready</span></div>
      <div><strong>{preview.counts.existing}</strong><span>Already linked</span></div>
      <div><strong>{preview.counts.review}</strong><span>Needs review</span></div>
     </div>
     <div className="ss-crm-relationship-select-actions">
      <button type="button" disabled={!canEdit||saving||!preview.counts.ready}
       onClick={()=>{
        setApproved(new Set(selectable));setConfirmed(false);
       }}>Select all {selectable.size} Ready</button>
      <button type="button" disabled={saving||!approved.size}
       onClick={()=>{setApproved(new Set());setConfirmed(false);}}>Clear selection</button>
      <small>{approvedReady.length} selected for linking</small>
     </div>
     {preview.rows.length>0&&<div className="ss-crm-import-preview-table" role="region"
      aria-label="Deal–Person relationship preview" tabIndex={0}>
      <table><thead><tr>
       <th scope="col">Approve</th><th scope="col">File row</th><th scope="col">Deal</th>
       <th scope="col">Person</th><th scope="col">Role</th><th scope="col">Status / reason</th>
      </tr></thead><tbody>
       {preview.rows.map(candidate=><tr key={candidate.index}>
        <td><input type="checkbox" aria-label={'Approve row '+(candidate.index+2)}
         checked={approved.has(candidate.index)&&candidate.status==='ready'}
         disabled={!canEdit||saving||candidate.status!=='ready'}
         onChange={e=>toggle(candidate.index,e.target.checked)}/></td>
        <td>{candidate.index+2}</td>
        <td>{candidate.dealName??'Unmatched'}</td>
        <td>{candidate.personName??'Unmatched'}
         {candidate.email&&<small>{candidate.email}</small>}</td>
        <td>{candidate.role??'—'}</td>
        <td><span className={'ss-crm-import-status is-'+candidate.status}>
         {candidate.status==='ready'?'Ready':candidate.status==='existing'?'Already linked':'Needs review'}
        </span><small>{candidate.reason}</small></td>
       </tr>)}
      </tbody></table>
     </div>}
     <div className="ss-crm-import-approval">
      <label><input type="checkbox" checked={confirmed} disabled={!canEdit||saving||
       approvedReady.length===0||preview.errors.length>0}
       onChange={e=>setConfirmed(e.target.checked)}/>
       <span>I reviewed the selected <strong>{approvedReady.length}</strong> links.
        Keep all existing relationship roles and skip unapproved rows.</span>
      </label>
      <button type="button" disabled={!confirmed||!canEdit||saving||
       !approvedReady.length||preview.errors.length>0} onClick={()=>{void run();}}>
       {saving?'Saving links…':'Create '+approvedReady.length+' links'}
      </button>
     </div>
    </>}
   {!canEdit&&<p className="ss-crm-import-permission" role="status">
    Linking requires CRM edit permission, a loaded workspace, and no active role preview.
   </p>}
   {error&&<p className="ss-crm-import-error" role="alert">{error}</p>}
   {notice&&<p className="ss-crm-import-success" role="status">{notice}</p>}
   <footer className="ss-crm-import-footer">This tool never changes People, Deals,
    existing relationship roles, or pipeline stages. A failed multi-row import
    can leave earlier confirmed links saved. Review current links before retrying.
    No automatic emails, external IDs, or background jobs.</footer>
  </article>
 </section>;
}
