import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useAuthStore} from '../store/authStore';
import {recordManagementDependencies,type ManagedKind} from '../services/recordManagementDependencies';
import {canEditTeamArea} from '../services/teamDepartments';
import {canPermanentlyDeleteQuote} from '../services/quoteIntegrity';
import {planPracticeQuotePurge,purgeArchivedPracticeQuote} from '../services/practiceQuotePurge';
import {crmDeletionBlockers} from '../services/crmDeletionBlockers';
import type {Quote} from '../types/quote';
import '../home-cleanup.css';

type CleanupKind=ManagedKind;
interface CleanupRow{
 kind:CleanupKind;id:string;name:string;detail:string;
 blockers:string[];action:'delete'|'archive'|'purge';
 quoteNumber?:string;activityCount?:number;
}
type Tab=Exclude<CleanupKind,'task'>;
type FocusRef={kind:CleanupKind;id:string};
type OpenDetail={kind?:CleanupKind;testMode?:boolean};
export function CleanupCenter(){
 const [open,setOpen]=useState(false),[tab,setTab]=useState<Tab>('quote');
 const [query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [pending,setPending]=useState<CleanupRow[]|null>(null);
 const [confirmation,setConfirmation]=useState('');
 const [practiceAcknowledged,setPracticeAcknowledged]=useState(false);
 const [testMode,setTestMode]=useState(false);
 const [focusTrail,setFocusTrail]=useState<FocusRef[]>([]);
 const quotes=useQuoteStore(s=>s.quotes),archiveQuote=useQuoteStore(s=>s.archiveQuote),
  deleteQuoteFromManagement=useQuoteStore(s=>s.deleteQuoteFromManagement);
 const companies=useCrmStore(s=>s.companies),people=useCrmStore(s=>s.contacts);
 const deals=useCrmStore(s=>s.projects),activities=useCrmStore(s=>s.activities);
 const deleteCompany=useCrmStore(s=>s.deleteCompany),deleteContact=useCrmStore(s=>s.deleteContact);
 const deleteDeal=useCrmStore(s=>s.deleteCleanProject);
 const deleteActivity=useCrmStore(s=>s.deleteActivity);
 const tasks=usePersonalTaskStore(s=>s.tasks),taskStorageScope=usePersonalTaskStore(s=>s.scope);
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  dept=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const canManage=!perspective&&(mode==='local'||role==='owner'||role==='admin');
 const canCrm=canManage&&(mode==='local'||canEditTeamArea(role,dept,'crm'));
 const canQuotes=canManage&&(mode==='local'||canEditTeamArea(role,dept,'quotes'));
 const scope=taskScope(mode,org,userId);
 const ownTasks=scope&&scope===taskStorageScope?tasks.filter(task=>!task.deletedAt):[];
 // Legacy unassigned quotes are recoverable by Owners/Admins, while quotes
 // assigned to another salesperson are never offered in this maintenance list.
 const visibleQuotes=mode==='cloud'?quotes.filter(quote=>
  quote.ownerUserId===userId||
  (!quote.ownerUserId&&(role==='owner'||role==='admin'))):quotes;
 useEffect(()=>{
  const show=(event:Event)=>{
   const detail=(event as CustomEvent<OpenDetail>).detail;
   setOpen(true);setQuery('');setSelected([]);setError('');setPending(null);
   setConfirmation('');setPracticeAcknowledged(false);setFocusTrail([]);
   setTestMode(Boolean(detail?.testMode));setTab(detail?.kind&&detail.kind!=='task'?detail.kind:'quote');
  };
  window.addEventListener('salesshop:open-cleanup-center',show);
  return()=>window.removeEventListener('salesshop:open-cleanup-center',show);
 },[]);
 const rows=useMemo(()=>{
  const refs={companies,contacts:people,projects:deals,activities,quotes, tasks:ownTasks};
  const q=visibleQuotes.map((quote:Quote):CleanupRow=>{
   const plan=quote.archivedAt?
    planPracticeQuotePurge(quote,quotes,activities,ownTasks):null;
   return {kind:'quote',id:quote.id,name:quote.title||'Untitled Quote',
    quoteNumber:quote.quoteNumber,activityCount:plan?.activityIds.length,
    detail:quote.quoteNumber+' · '+quote.status+(quote.archivedAt?' · Archived':''),
    blockers:plan?.blockers??[],
    action:quote.archivedAt?'purge':
     canPermanentlyDeleteQuote(quote,quotes)?'delete':'archive',
   };
  });
  const p=people.map((person):CleanupRow=>({
   kind:'person',id:person.id,name:person.name||person.email||'Unnamed person',
   detail:companies.find(c=>c.id===person.companyId)?.name||'No company',
   blockers:crmDeletionBlockers('person',person.id,refs),action:'delete',
  }));
  const c=companies.map((company):CleanupRow=>({
   kind:'company',id:company.id,name:company.name,detail:company.kind,
   blockers:crmDeletionBlockers('company',company.id,refs),action:'delete',
  }));
  const d=deals.map((deal):CleanupRow=>({
   kind:'deal',id:deal.id,name:deal.name,detail:deal.stage,
   blockers:crmDeletionBlockers('deal',deal.id,refs),action:'delete',
  }));
  const a=activities.map((activity):CleanupRow=>({
   kind:'activity',id:activity.id,name:activity.summary,
   detail:new Date(activity.occurredAt).toLocaleDateString()+' · '+activity.type,
   blockers:!['manual-touchpoint','notebook-touchpoint'].includes(activity.type)&&
    !(['quote-created','quote-linked'].includes(activity.type)&&
      !!activity.quoteId&&!quotes.some(quote=>quote.id===activity.quoteId))
    ?['Automatic CRM audit history is protected']
    :ownTasks.some(task=>task.sourceObjectId==='activity-followup:'+activity.id)
     ?['A follow-up task still references this activity']:[],
   action:'delete',
  }));
  return [...q,...p,...c,...d,...a];
 },[visibleQuotes,quotes,people,companies,deals,activities,ownTasks]);
 const findRow=(kind:CleanupKind,id:string):CleanupRow|undefined=>{
  if(kind==='task'){
   const task=ownTasks.find(item=>item.id===id);
   return task?{kind:'task',id:task.id,name:task.title,
    detail:task.dueDate?'Due '+task.dueDate:'Personal task',blockers:[],action:'delete'}:undefined;
  }
  const row=rows.find(item=>item.kind===kind&&item.id===id);
  if(row)return row;
  // Archived quotes still block deletion of linked CRM records. Do not
  // present another salesperson's quote as a deletable document.
  if(kind==='quote'){
   const quote=quotes.find(item=>item.id===id);
   if(!quote)return undefined;
   const restricted=mode==='cloud'&&quote.ownerUserId!==userId&&
    !(quote.ownerUserId==null&&(role==='owner'||role==='admin'));
   return {kind:'quote',id,name:restricted?'Quote owned by another user':quote.title||'Untitled Quote',
    detail:restricted?'Not manageable from your account':'Archived document',
    blockers:[restricted?'Another owner must manage this quote':'Archived documents retain CRM history'],
    action:'archive'};
  }
  return undefined;
 };
 const focused=focusTrail[focusTrail.length-1];
 const focusRow=focused?findRow(focused.kind,focused.id):undefined;
 const related=focused?recordManagementDependencies(focused.kind,focused.id,{
  companies,contacts:people,projects:deals,activities,quotes,tasks:ownTasks,
 }).map(reference=>({...reference,row:findRow(reference.kind,reference.id)})):[];
 const filtered=rows.filter(item=>item.kind===tab&&
  (item.name+' '+item.detail).toLowerCase().includes(query.trim().toLowerCase()));
 const eligible=filtered.filter(item=>item.blockers.length===0&&
  (item.kind==='quote'?canQuotes:canCrm));
 const chosen=eligible.filter(item=>selected.includes(item.kind+':'+item.id)&&item.action==='delete');
 const removeRow=async(item:CleanupRow)=>{
  if(item.blockers.length)return;
  if(item.kind==='task'){
   usePersonalTaskStore.getState().remove(item.id);return;
  }
  if(item.kind==='quote'){
   if(item.action==='purge')await purgeArchivedPracticeQuote(item.id);
   else if(item.action==='archive')archiveQuote(item.id);
   else await deleteQuoteFromManagement(item.id);
   return;
  }
  if(item.kind==='person')await deleteContact(item.id);
  if(item.kind==='company')await deleteCompany(item.id);
  if(item.kind==='deal')await deleteDeal(item.id);
  if(item.kind==='activity'){
    const event=activities.find(activity=>activity.id===item.id);
    const orphaned=!!event&&!!event.quoteId&&
      ['quote-created','quote-linked'].includes(event.type)&&
      !quotes.some(quote=>quote.id===event.quoteId);
    await deleteActivity(item.id,orphaned);
  }
 };
 const perform=(items:CleanupRow[])=>{
  if(!items.length||busy||!canManage||items.some(item=>item.blockers.length>0))return;
  if(items.some(item=>item.action==='purge')&&items.length!==1)return;
  setPending(items);setConfirmation('');setPracticeAcknowledged(false);setError('');
 };
 // Drill into dependencies without changing the active tab, search, or parent.
 const openRecord=(item:CleanupRow)=>{
  if(busy)return;
  setPending(null);setError('');
  setFocusTrail(current=>{
   const existing=current.findIndex(ref=>ref.kind===item.kind&&ref.id===item.id);
   return existing>=0?current.slice(0,existing+1):
    [...current,{kind:item.kind,id:item.id}];
  });
 };
 const backToParent=()=>{setPending(null);setError('');
  setFocusTrail(current=>current.slice(0,-1));
 };
 const confirmPending=async()=>{
  if(!pending?.length||busy||!canManage)return;
  const phrase=pending.some(item=>item.action==='purge')
   ?'PURGE '+pending[0].quoteNumber:
    pending.some(item=>item.action==='delete')?'DELETE':'ARCHIVE';
  if(confirmation.trim()!==phrase)return;
  if(pending.some(item=>item.action==='purge')&&!practiceAcknowledged)return;
  setBusy(true);setError('');
  try{
   const auth=useAuthStore.getState();
   if(useRolePerspectiveStore.getState().activePerspective||
     (auth.mode!=='local'&&auth.teamRole!=='owner'&&auth.teamRole!=='admin'))
     throw new Error('Record management requires an Owner or Admin account.');
   for(const item of pending){
    const crm=useCrmStore.getState(),allQuotes=useQuoteStore.getState().quotes;
    const saved=usePersonalTaskStore.getState();
    const currentScope=taskScope(auth.mode,auth.organizationId,auth.user?.id);
    const own=currentScope===saved.scope?saved.tasks.filter(task=>!task.deletedAt):[];
    const refs={companies:crm.companies,contacts:crm.contacts,projects:crm.projects,
     activities:crm.activities,quotes:allQuotes,tasks:own};
    if(item.kind==='task'){
     const itemTask=own.find(task=>task.id===item.id);
     if(!itemTask)throw new Error('This personal Task is no longer available in your workspace.');
    }else if(item.kind==='quote'){
     const current=allQuotes.find(quote=>quote.id===item.id);
     if(!current||(auth.mode==='cloud'&&current.ownerUserId!==auth.user?.id&&
       !(current.ownerUserId==null&&
        (auth.teamRole==='owner'||auth.teamRole==='admin'))))
       throw new Error('This quote is unavailable or not manageable by your account.');
     if(item.action==='purge'){
       const plan=planPracticeQuotePurge(current,allQuotes,crm.activities,own);
       if(plan.blockers.length)throw new Error(plan.blockers.join('; '));
       if(!current.archivedAt||current.quoteNumber!==item.quoteNumber)
        throw new Error('This archived quote changed. Review it again before purging.');
     }else if(current.archivedAt||
       (canPermanentlyDeleteQuote(current,allQuotes)?'delete':'archive')!==item.action)
       throw new Error('This quote changed. Review it again before removing it.');
    }else if(item.kind==='person'||item.kind==='company'||item.kind==='deal'){
     const collection=item.kind==='person'?crm.contacts:item.kind==='company'?crm.companies:crm.projects;
     if(!collection.some(record=>record.id===item.id)||
       crmDeletionBlockers(item.kind,item.id,refs).length)
       throw new Error(item.name+' now has linked records. Unlink them before deleting.');
    }else{
     const activity=crm.activities.find(activity=>activity.id===item.id);
     if(!activity)throw new Error('This Activity is no longer available.');
     if(own.some(task=>task.sourceObjectId==='activity-followup:'+activity.id))
      throw new Error('A follow-up Task now depends on this Activity. Unlink it before deleting.');
     const orphaned=!!activity.quoteId&&
      ['quote-created','quote-linked'].includes(activity.type)&&
      !allQuotes.some(quote=>quote.id===activity.quoteId);
     if(!['manual-touchpoint','notebook-touchpoint'].includes(activity.type)&&!orphaned)
      throw new Error('Automatic CRM audit history cannot be deleted.');
    }
    await removeRow(item);
    setSelected(old=>old.filter(key=>key!==item.kind+':'+item.id));
    setFocusTrail(current=>{
     const last=current[current.length-1];
     return last?.kind===item.kind&&last.id===item.id?current.slice(0,-1):current;
    });
   }
   setPending(null);setConfirmation('');
  }catch(e){
   setPending(null);setConfirmation('');
   setError(e instanceof Error?e.message:'Removal stopped. Earlier records may already have been removed.');
  }finally{setBusy(false);}
 };
 if(!open||!canManage)return null;
 const isPurging=Boolean(pending?.some(item=>item.action==='purge'));
 const isDeleting=Boolean(pending?.some(item=>item.action==='delete'));
 const confirmWord=isPurging?'PURGE '+pending?.[0]?.quoteNumber:
  isDeleting?'DELETE':'ARCHIVE';
 return createPortal(<div className="sales-cleanup-backdrop" onPointerDown={e=>{
  if(e.target===e.currentTarget&&!busy){setOpen(false);setPending(null);}
 }}>
  <section className="sales-cleanup-dialog is-record-cleanup" role="dialog"
   aria-modal="true" aria-label={testMode?'Clean up test records':'Manage and delete records'}
   onKeyDown={e=>{if(e.key==='Escape'&&!busy){
    e.stopPropagation();if(pending)setPending(null);
    else if(focusTrail.length)backToParent();else setOpen(false);
   }}}>
   <header><div><small>SETTINGS · DATA MANAGEMENT</small>
    <h2>{testMode?'Clean up test records':'Record management'}</h2>
    <p>{testMode
     ?'Review sample records manually. Nothing is selected or deleted automatically.'
     :'Delete drafts, archive issued quotes, or explicitly purge archived practice quotes.'}</p></div>
    <button type="button" aria-label="Close record management" disabled={busy}
     onClick={()=>{setOpen(false);setPending(null);}}>×</button>
   </header>
   <div className="sales-record-cleanup-tabs" role="group" aria-label="Record type">
    {(['quote','person','company','deal','activity'] as const).map(kind=><button key={kind} type="button"
     disabled={busy||!!pending} aria-pressed={tab===kind}
     onClick={()=>{setTab(kind);setSelected([]);setError('');setFocusTrail([]);}}>
     {kind==='quote'?'Quotes':kind==='person'?'People':kind==='company'?'Companies':
       kind==='deal'?'Deals':'Activities'}
     <small>{rows.filter(row=>row.kind===kind).length}</small>
    </button>)}
   </div>
   {focusTrail.length>0&&<nav className="sales-record-dependency-trail"
      aria-label="Record management trail">
     <button type="button" disabled={busy||!!pending} onClick={()=>{setFocusTrail([]);setError('');}}>
       {tab==='person'?'People':tab==='company'?'Companies':tab==='deal'?'Deals':
        tab==='quote'?'Quotes':'Activities'}
     </button>
     {focusTrail.map((ref,index)=><span key={ref.kind+':'+ref.id}>
       <span aria-hidden="true">›</span>
       <button type="button" aria-current={index===focusTrail.length-1?'page':undefined}
        disabled={busy||!!pending} onClick={()=>setFocusTrail(current=>current.slice(0,index+1))}>
         {findRow(ref.kind,ref.id)?.name||'Removed record'}
       </button>
     </span>)}
   </nav>}
   {!focusTrail.length&&<div className="sales-record-cleanup-toolbar">
    <input type="search" value={query} aria-label="Filter records" disabled={busy||!!pending}
     onChange={e=>{setQuery(e.target.value);setSelected([]);}}
     placeholder="Find a record…"/>
    {chosen.length>0&&!pending&&<button type="button" disabled={busy} onClick={()=>perform(chosen)}>
      Delete selected ({chosen.length})</button>}
   </div>}
   {pending ? <div className="sales-record-confirmation" role="group" aria-label="Confirm record removal">
     <strong>{pending.length===1?pending[0].name:pending.length+' selected records'}</strong>
     <p>{isPurging
       ?'This permanently removes the archived document, its revisions, customer share links and '+
        (pending?.[0]?.activityCount??0)+' quote-specific CRM events. Previously sent links will stop working. '+
        'Associated People, Companies, Deals and unrelated Activities are not deleted.'
       :isDeleting
       ?'Permanent deletion cannot be undone. Linked CRM history and tasks are protected.'
       :'Archiving retains customer documents and their history for later restoration.'}</p>
     {isPurging&&<label className="sales-practice-purge-ack">
      <input type="checkbox" checked={practiceAcknowledged} disabled={busy}
       onChange={e=>setPracticeAcknowledged(e.target.checked)}/>
      <span>I confirm this was a practice/test quote, not an actual customer agreement,
       and understand permanent deletion cannot be undone.</span>
     </label>}
     <label>Type {confirmWord} to confirm
       <input autoFocus value={confirmation} aria-label="Type confirmation word"
        disabled={busy} onChange={e=>setConfirmation(e.target.value)}/>
     </label>
     <div className="sales-record-confirmation-actions">
       <button type="button" disabled={busy} onClick={()=>{setPending(null);setConfirmation('');}}>Cancel</button>
       <button type="button" className="is-danger" disabled={busy||
         confirmation.trim()!==confirmWord||(isPurging&&!practiceAcknowledged)}
         onClick={()=>void confirmPending()}>
         {busy?'Working…':isPurging?'Purge practice quote':
          isDeleting?'Permanently delete':'Archive'} ({pending.length})
       </button>
     </div>
   </div> : focused ? <section className="sales-record-dependency-panel"
      aria-label="Manage linked records">
     <div className="sales-record-dependency-heading">
      <button type="button" onClick={backToParent} disabled={busy}>← Back</button>
      <div><small>RECORD & DEPENDENCIES</small>
       <h3>{focusRow?.name||'Record no longer available'}</h3>
       {focusRow&&<p>{focusRow.detail}</p>}
      </div>
     </div>
     {focusRow?.blockers.length ? <p className="sales-record-dependency-warning">
       Cannot delete yet: {focusRow.blockers.join(' · ')}.
       Review linked records below. Deleting a linked record never deletes its parent automatically.
     </p>:focusRow&&<p className="sales-record-dependency-ready">
       No blocking relationships. This record is eligible for {focusRow.action==='archive'?'archiving':'deletion'}.
     </p>}
     {focusRow&&<div className="sales-record-dependency-main-actions">
       <button type="button" disabled={busy||focusRow.blockers.length>0||
        (focusRow.kind==='quote'?!canQuotes:!canCrm)}
        onClick={()=>perform([focusRow])}>
         {focusRow.action==='purge'?'Purge this archived practice quote':
          focusRow.action==='archive'?'Archive this quote':'Delete this '+(
          focusRow.kind==='person'?'person':focusRow.kind==='company'?'company':
          focusRow.kind==='deal'?'deal':focusRow.kind==='activity'?'activity':
          focusRow.kind==='task'?'task':'quote')}
       </button>
     </div>}
     <h4>Linked records ({related.length})</h4>
     {related.length ? <div className="sales-record-dependency-list">
      {related.map(({kind,id,reason,row})=><div className="sales-record-dependency-row"
         key={kind+':'+id}>
       <div><strong>{row?.name||'Unavailable record'}</strong>
        <small>{kind==='person'?'Person':kind==='company'?'Company':
          kind==='deal'?'Deal':kind==='quote'?'Quote':
          kind==='activity'?'Activity':'Task'} · {reason}</small>
        {row?.blockers.length ? <small className="is-blocked">
          {row.blockers.join(' · ')}
        </small>:row?.action==='archive'&&<small>
          Archiving preserves linked history and will not unblock this record.
        </small>}
       </div>
       {row&&<div className="sales-record-dependency-actions">
        <button type="button" aria-label={'Inspect '+row.name} disabled={busy}
         onClick={()=>openRecord(row)}>Inspect</button>
        <button type="button" aria-label={(row.action==='purge'?'Purge ':
          row.action==='archive'?'Archive ':'Delete ')+row.name}
         disabled={busy||row.blockers.length>0||
          (row.kind==='quote'?!canQuotes:!canCrm)}
         onClick={()=>perform([row])}>
          {row.action==='purge'?'Purge':row.action==='archive'?'Archive':'Delete'}
        </button>
       </div>}
      </div>)}
     </div>:<p className="sales-cleanup-empty">
      No linked records requiring deletion were found in the records accessible to you.
     </p>}
     <small className="sales-record-dependency-note">
      All deletions require typed confirmation. Unsigned archived practice quotes can
      be purged separately; signed agreements and unrelated history remain protected.
      After a child is deleted, this list updates while your parent stays open.
     </small>
   </section> : <div className="sales-record-cleanup-list">
    {filtered.map(item=><div className="sales-record-cleanup-row" key={item.kind+item.id}>
     <input type="checkbox" disabled={busy||item.blockers.length>0||item.action!=='delete'||
       (item.kind==='quote'?!canQuotes:!canCrm)}
      aria-label={'Select '+item.name} checked={selected.includes(item.kind+':'+item.id)}
      onChange={e=>setSelected(old=>e.target.checked?
       [...old,item.kind+':'+item.id]:old.filter(key=>key!==item.kind+':'+item.id))}/>
     <div><strong>{item.name}</strong><small>{item.detail}</small>
      {item.blockers.length>0&&<small className="is-blocked">
       Cannot delete yet: {item.blockers.join(' · ')}. Unlink dependent records first.
      </small>}
     </div>
     {(item.blockers.length>0||item.kind==='quote')&&
      <button type="button" className="sales-record-open"
       aria-label={'Review links for '+item.name} disabled={busy}
       onClick={()=>openRecord(item)}>Review links</button>}
     <button type="button" disabled={busy||item.blockers.length>0||
      (item.kind==='quote'?!canQuotes:!canCrm)}
      onClick={()=>perform([item])}>{item.action==='purge'?'Purge':
       item.action==='archive'?'Archive':'Delete'}</button>
    </div>)}
    {!filtered.length&&<p className="sales-cleanup-empty">No matching records.</p>}
   </div>}
   <footer>
    {error&&<span role="alert" className="sales-cleanup-error">{error}</span>}
    <small>Issued quotes are normally archived. An unsigned archived practice quote
     can be purged only with extra confirmation. Linked customer records stay separate.</small>
    <button type="button" onClick={()=>{setOpen(false);setPending(null);}} disabled={busy}>Done</button>
   </footer>
  </section>
 </div>,document.body);
}
