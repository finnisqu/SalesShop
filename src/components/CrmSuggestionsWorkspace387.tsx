import {useMemo,useRef,useState} from 'react';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {useCrmStore} from '../store/crmStore';
import {taskScope,usePersonalTaskStore} from '../store/personalTaskStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {proposeCrmSuggestions,type CrmSuggestion,type CrmSuggestionKind}
 from '../services/crmSuggestions387';
import {acceptCrmSuggestion,currentSuggestionIdentity,dismissSuggestion,
 readSuggestionDismissals,suggestionCanEdit,suggestionTaskReady,
 type SuggestionEdit} from '../services/crmSuggestionActions387';
import './crm-suggestions387.css';

const types:{id:'all'|CrmSuggestionKind;label:string}[]=[
 {id:'all',label:'All'},
 {id:'person-create',label:'New People'},
 {id:'person-link',label:'Record links'},
 {id:'follow-up',label:'Follow-ups'},
];
const titleFor=(kind:CrmSuggestionKind)=>
 kind==='person-create'?'New Person':kind==='person-link'?'Existing Person link':'Follow-up Task';

export function CrmSuggestionsWorkspace387(){
 const mode=useAuthStore(s=>s.mode);
 const organizationId=useAuthStore(s=>s.organizationId);
 const userId=useAuthStore(s=>s.user?.id??null);
 const role=useAuthStore(s=>s.teamRole);
 const department=useAuthStore(s=>s.teamDepartment);
 const readyAuth=useAuthStore(s=>s.ready);
 const previewRole=useRolePerspectiveStore(s=>s.activePerspective);
 const hydrated=useCrmStore(s=>s.hydrated);
 const activities=useCrmStore(s=>s.activities);
 const contacts=useCrmStore(s=>s.contacts);
 const companies=useCrmStore(s=>s.companies);
 const deals=useCrmStore(s=>s.projects);
 const tasks=usePersonalTaskStore(s=>s.tasks);
 const storedTaskScope=usePersonalTaskStore(s=>s.scope);
 const taskSync=usePersonalTaskStore(s=>s.syncStatus);
 const identity={mode,organizationId,userId};
 const expectedTaskScope=taskScope(mode,organizationId,userId??undefined);
 const taskReady=Boolean(expectedTaskScope&&expectedTaskScope===storedTaskScope&&
  (mode==='local'||taskSync==='saved'));
 const canEdit=Boolean(readyAuth&&hydrated&&!previewRole&&
  (mode==='local'||(organizationId&&userId&&canEditTeamArea(role,department,'crm'))));
 const [dismissed,setDismissed]=useState<string[]>(
  ()=>readSuggestionDismissals(currentSuggestionIdentity()));
 const [filter,setFilter]=useState<'all'|CrmSuggestionKind>('all');
 const [expanded,setExpanded]=useState<string|null>(null);
 const [editing,setEditing]=useState<string|null>(null);
 const [drafts,setDrafts]=useState<Record<string,SuggestionEdit>>({});
 const [busy,setBusy]=useState<string|null>(null);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const locked=useRef(false);
 const suggestions=useMemo(()=>hydrated?proposeCrmSuggestions({
  activities,contacts,companies,deals,tasks:taskReady?tasks:[],
  mode,userId:userId??undefined,now:new Date(),
 }).filter(item=>taskReady||item.kind!=='follow-up'):[],
 [hydrated,taskReady,activities,contacts,companies,deals,tasks,mode,userId]);
 const available=suggestions.filter(s=>!dismissed.includes(s.id));
 const shown=available.filter(s=>filter==='all'||filter===s.kind);
 const count=(kind:CrmSuggestionKind)=>available.filter(s=>s.kind===kind).length;
 const onEdit=(id:string,change:SuggestionEdit)=>{
  setDrafts(old=>({...old,[id]:{...old[id],...change}}));
 };
 const acknowledge=(id:string)=>{
  setDismissed(dismissSuggestion(identity,id));
 };
 const accept=async(item:CrmSuggestion)=>{
  if(locked.current||!canEdit||(item.kind==='follow-up'&&!taskReady))return;
  locked.current=true;setBusy(item.id);setNotice('');setError('');
  try{
   if(!suggestionCanEdit(identity))throw new Error('CRM permissions changed.');
   if(item.kind==='follow-up'&&!suggestionTaskReady(identity))
    throw new Error('Private Task sync has not finished.');
   const result=await acceptCrmSuggestion(identity,item,drafts[item.id]??{});
   acknowledge(item.id);setNotice(result.message);setEditing(null);setExpanded(null);
  }catch(e){
   setError(e instanceof Error?e.message:'Could not accept this suggestion.');
  }finally{locked.current=false;setBusy(null);}
 };
 const dismiss=(item:CrmSuggestion)=>{
  if(locked.current)return;
  try{acknowledge(item.id);setNotice('Suggestion dismissed on this browser.');setError('');}
  catch(e){setError(e instanceof Error?e.message:'Could not dismiss suggestion.');}
 };
 const evidence=(item:CrmSuggestion)=>item.kind==='person-create'
  ?'Explicit name and email found in an Activity'
  :item.kind==='person-link'?'Unique email matches an existing Person'
  :'Explicit YYYY-MM-DD follow-up date found in an Activity';
 return <section className="ss-crm-suggestions" aria-label="CRM Suggestions inbox">
  <header className="ss-crm-suggestions-head">
   <div><small>CRM ASSISTANT · REVIEW-FIRST</small>
    <h2>Suggestions</h2>
    <p>Keep records and follow-ups organized using evidence from activities you logged.
     Suggestions never write to your CRM until you accept them.</p>
   </div>
   <span className="ss-crm-suggestions-count">{available.length} to review</span>
  </header>
  <div className="ss-crm-suggestions-guidance">
   <strong>What is included?</strong> Recent manual Activities and Notebook-logged touchpoints,
   using explicit email/name or follow-up dates. Full Notebook pages and Gmail
   aren't scanned. Nothing is sent to customers, and ambiguous matches are not proposed.
  </div>
  <div className="ss-crm-suggestions-tabs" role="group" aria-label="Filter CRM suggestions">
   {types.map(item=><button type="button" key={item.id}
    aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>
    {item.label} <small>{item.id==='all'?available.length:count(item.id)}</small>
   </button>)}
  </div>
  {!canEdit&&<p className="ss-crm-suggestions-info" role="status">
   CRM editing is unavailable until your workspace loads or your role allows changes.
   You can review suggestions without creating records.
  </p>}
  {canEdit&&!taskReady&&<p className="ss-crm-suggestions-info" role="status">
   Private Tasks are still syncing. Task suggestions will appear when they are ready;
   Person and Activity suggestions can still be reviewed.
  </p>}
  {shown.length===0&&<div className="ss-crm-suggestions-empty">
   <strong>{available.length?'No suggestions in this category.':'All caught up.'}</strong>
   <p>{available.length?'Try All to see other review items.':
    'When your manually logged Activities include a clear Person email or dated follow-up, '+
    'SalesShop can suggest a record or Task here.'}</p>
  </div>}
  <div className="ss-crm-suggestions-list">
   {shown.map(item=>{
    const isOpen=expanded===item.id;
    const isEditing=editing===item.id;
    const draft=drafts[item.id]??{};
    const disabled=Boolean(busy)||!canEdit||
     (item.kind==='follow-up'&&!taskReady);
    return <article className="ss-crm-suggestion" key={item.id}>
     <div className="ss-crm-suggestion-main">
      <div className="ss-crm-suggestion-heading">
       <small>{titleFor(item.kind)}</small>
       <strong>{item.title}</strong>
       <span>{item.reason}</span>
      </div>
      <div className="ss-crm-suggestion-actions">
       <button type="button" aria-expanded={isOpen} onClick={()=>{
        setExpanded(current=>current===item.id?null:item.id);setError('');
       }}>{isOpen?'Hide details':'Review'}</button>
       {item.kind!=='person-link'&&<button type="button"
        aria-expanded={isEditing}
        onClick={()=>{
         setEditing(current=>current===item.id?null:item.id);
         setExpanded(item.id);
        }}>{isEditing?'Close edit':'Edit'}</button>}
       <button type="button" className="is-secondary" disabled={Boolean(busy)}
        onClick={()=>dismiss(item)}>Dismiss</button>
       <button type="button" className="is-primary" disabled={disabled}
        onClick={()=>{void accept(item);}}>
        {busy===item.id?'Saving…':'Accept'}
       </button>
      </div>
     </div>
     {isOpen&&<div className="ss-crm-suggestion-details">
      <div><small>Evidence</small><p>{evidence(item)}</p></div>
      <div><small>Source Activity · {new Date(item.activityAt).toLocaleDateString()}</small>
       <p>{item.sourceSummary}</p></div>
      {item.email&&<div><small>Person email</small><p>{item.email}</p></div>}
      {item.dueDate&&<div><small>Proposed Task due</small><p>{item.dueDate}</p></div>}
      {isEditing&&<div className="ss-crm-suggestion-editor">
       {item.kind==='person-create'&&<>
        <label>Person name<input type="text" maxLength={160}
         disabled={disabled} value={draft.name??item.proposedName??''}
         onChange={e=>onEdit(item.id,{name:e.target.value})}/></label>
        <label>Email<input type="email" maxLength={180}
         disabled={disabled} value={draft.email??item.email??''}
         onChange={e=>onEdit(item.id,{email:e.target.value})}/></label>
       </>}
       {item.kind==='follow-up'&&<>
        <label>Task title<input type="text" maxLength={180}
         disabled={disabled} value={draft.taskTitle??item.taskTitle??''}
         onChange={e=>onEdit(item.id,{taskTitle:e.target.value})}/></label>
        <label>Due date<input type="date" disabled={disabled}
         value={draft.dueDate??item.dueDate??''}
         onChange={e=>onEdit(item.id,{dueDate:e.target.value})}/></label>
       </>}
      </div>}
      <small className="ss-crm-suggestion-caution">
       Accept creates only the described Person, Activity association, or private Task.
       Dismiss only hides this proposal in your browser; source records remain unchanged.
      </small>
     </div>}
    </article>;
   })}
  </div>
  {error&&<p className="ss-crm-suggestions-error" role="alert">{error}</p>}
  {notice&&<p className="ss-crm-suggestions-info" role="status">{notice}</p>}
  <footer className="ss-crm-suggestions-footer">
   Suggestions are private to this browser and scoped to the current account/workspace.
   Accepted CRM edits use existing permissions and cloud confirmation. Private Tasks
   sync through your existing Task storage. This is a deterministic assistant,
   not unattended AI or a background monitor.
  </footer>
 </section>;
}
