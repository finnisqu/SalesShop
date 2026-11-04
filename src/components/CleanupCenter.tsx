import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useAuthStore} from '../store/authStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {canPermanentlyDeleteQuote} from '../services/quoteIntegrity';
import {crmDeletionBlockers} from '../services/crmDeletionBlockers';
import type {Quote} from '../types/quote';
import '../home-cleanup.css';

type CleanupKind='quote'|'person'|'company'|'deal'|'activity';
interface CleanupRow{
 kind:CleanupKind;id:string;name:string;detail:string;
 blockers:string[];action:'delete'|'archive';
}
type Tab=CleanupKind;
export function CleanupCenter(){
 const [open,setOpen]=useState(false),[tab,setTab]=useState<Tab>('quote');
 const [query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const quotes=useQuoteStore(s=>s.quotes),deleteQuote=useQuoteStore(s=>s.deleteQuote);
 const companies=useCrmStore(s=>s.companies),people=useCrmStore(s=>s.contacts);
 const deals=useCrmStore(s=>s.projects),activities=useCrmStore(s=>s.activities);
 const deleteCompany=useCrmStore(s=>s.deleteCompany),deleteContact=useCrmStore(s=>s.deleteContact);
 const deleteDeal=useCrmStore(s=>s.deleteProject);
 const deleteActivity=useCrmStore(s=>s.deleteActivity);
 const tasks=usePersonalTaskStore(s=>s.tasks),taskStorageScope=usePersonalTaskStore(s=>s.scope);
 const mode=useAuthStore(s=>s.mode),org=useAuthStore(s=>s.organizationId),
  userId=useAuthStore(s=>s.user?.id),role=useAuthStore(s=>s.teamRole),
  dept=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const canCrm=!perspective&&(mode==='local'||canEditTeamArea(role,dept,'crm'));
 const canQuotes=!perspective&&(mode==='local'||canEditTeamArea(role,dept,'quotes'));
 const scope=taskScope(mode,org,userId);
 const ownTasks=scope&&scope===taskStorageScope?tasks.filter(task=>!task.deletedAt):[];
 const visibleQuotes=mode==='cloud'?quotes.filter(quote=>quote.ownerUserId===userId):quotes;
 useEffect(()=>{
  const show=()=>{setOpen(true);setQuery('');setSelected([]);setError('');setTab('quote');};
  window.addEventListener('salesshop:open-cleanup-center',show);
  return()=>window.removeEventListener('salesshop:open-cleanup-center',show);
 },[]);
 const rows=useMemo(()=>{
  const refs={companies,contacts:people,projects:deals,activities,quotes, tasks:ownTasks};
  const q=visibleQuotes.filter(quote=>!quote.archivedAt).map((quote:Quote):CleanupRow=>({
   kind:'quote',id:quote.id,name:quote.title||'Untitled Quote',
   detail:quote.quoteNumber+' · '+quote.status,
   blockers:[],action:canPermanentlyDeleteQuote(quote,quotes)?'delete':'archive',
  }));
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
   blockers:['manual-touchpoint','notebook-touchpoint'].includes(activity.type)
    ?[]:['Automatic CRM audit history is protected'],
   action:'delete',
  }));
  return [...q,...p,...c,...d,...a];
 },[visibleQuotes,quotes,people,companies,deals,activities,ownTasks]);
 const filtered=rows.filter(item=>item.kind===tab&&
  (item.name+' '+item.detail).toLowerCase().includes(query.trim().toLowerCase()));
 const eligible=filtered.filter(item=>item.blockers.length===0&&
  (item.kind==='quote'?canQuotes:canCrm));
 const chosen=eligible.filter(item=>selected.includes(item.kind+':'+item.id)&&item.action==='delete');
 const removeRow=async(item:CleanupRow)=>{
  if(item.blockers.length)return;
  if(item.kind==='quote'){deleteQuote(item.id);return;}
  if(item.kind==='person')await deleteContact(item.id);
  if(item.kind==='company')await deleteCompany(item.id);
  if(item.kind==='deal')deleteDeal(item.id);
  if(item.kind==='activity')await deleteActivity(item.id);
 };
 const perform=async(items:CleanupRow[])=>{
  if(!items.length||busy)return;
  const destructive=items.filter(item=>item.action==='delete');
  const archives=items.length-destructive.length;
  const message=destructive.length>1
   ?'Permanently delete '+destructive.length+' unlinked records? This cannot be undone.'
   :destructive.length===1?'Permanently delete '+destructive[0].name+'? This cannot be undone.'
   :'Archive '+items[0].name+'? The original business record will be retained.';
  if(!window.confirm(message))return;
  setBusy(true);setError('');
  try{
   for(const item of items){
    await removeRow(item);
    setSelected(old=>old.filter(key=>key!==item.kind+':'+item.id));
   }
   if(archives)void archives;
  }catch(e){setError(e instanceof Error?e.message:'Delete failed. Nothing else was removed.');}
  finally{setBusy(false);}
 };
 if(!open||perspective)return null;
 return createPortal(<div className="sales-cleanup-backdrop" onPointerDown={e=>{
  if(e.target===e.currentTarget&&!busy)setOpen(false);
 }}>
  <section className="sales-cleanup-dialog is-record-cleanup" role="dialog"
   aria-modal="true" aria-label="Clean up test records">
   <header><div><small>MAINTENANCE · REVIEW BEFORE DELETING</small>
    <h2>Record cleanup</h2>
    <p>Remove unused test records without breaking linked CRM history.</p></div>
    <button type="button" aria-label="Close cleanup" disabled={busy} onClick={()=>setOpen(false)}>×</button>
   </header>
   <div className="sales-record-cleanup-tabs" role="group" aria-label="Record type">
    {(['quote','person','company','deal','activity'] as const).map(kind=><button key={kind} type="button"
     aria-pressed={tab===kind} onClick={()=>{setTab(kind);setSelected([]);setError('');}}>
     {kind==='quote'?'Quotes':kind==='person'?'People':kind==='company'?'Companies':
       kind==='deal'?'Deals':'Activities'}
     <small>{rows.filter(row=>row.kind===kind).length}</small>
    </button>)}
   </div>
   <div className="sales-record-cleanup-toolbar">
    <input type="search" value={query} aria-label="Filter cleanup records"
     onChange={e=>{setQuery(e.target.value);setSelected([]);}}
     placeholder="Find a test record…"/>
    {chosen.length>0&&<button type="button" disabled={busy} onClick={()=>void perform(chosen)}>
      Delete selected ({chosen.length})</button>}
   </div>
   <div className="sales-record-cleanup-list">
    {filtered.map(item=><div className="sales-record-cleanup-row" key={item.kind+item.id}>
     <input type="checkbox" disabled={busy||item.blockers.length>0||item.action!=='delete'||
       (item.kind==='quote'?!canQuotes:!canCrm)}
      aria-label={'Select '+item.name} checked={selected.includes(item.kind+':'+item.id)}
      onChange={e=>setSelected(old=>e.target.checked?
       [...old,item.kind+':'+item.id]:old.filter(key=>key!==item.kind+':'+item.id))}/>
     <div><strong>{item.name}</strong><small>{item.detail}</small>
      {item.blockers.length>0&&<small className="is-blocked">Cannot delete: {item.blockers.join(' · ')}</small>}
     </div>
     <button type="button" disabled={busy||item.blockers.length>0||
      (item.kind==='quote'?!canQuotes:!canCrm)}
      onClick={()=>void perform([item])}>{item.action==='archive'?'Archive':'Delete'}</button>
    </div>)}
    {!filtered.length&&<p className="sales-cleanup-empty">No matching records.</p>}
   </div>
   <footer>
    {error&&<span role="alert" className="sales-cleanup-error">{error}</span>}
    <small>Issued quotes are archived, not permanently erased. Linked records stay protected.</small>
    <button type="button" onClick={()=>setOpen(false)} disabled={busy}>Done</button>
   </footer>
  </section>
 </div>,document.body);
}
