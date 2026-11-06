import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {TaskAssociationsField,type AssociationOption} from './TaskAssociationsField';
import type {TaskAssociation} from '../store/personalTaskStore';
import type {PreviewRecord} from './RecordPreviewDrawer';
import {activityRelations,primaryActivityRelations,activityMethodSummary,
 type ActivityRelation} from '../services/activityRelations';
import {draftStorageKey,readSavedDraft,writeSavedDraft,clearSavedDraft} from '../services/draftRecovery';
import {localDateKey} from '../services/salesCalendar';
import type {ActivityMetadata} from '../types/crm';
import {useModalScrollLock} from '../lib/useModalScrollLock';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {MobileSheetHandle} from './MobileSheetHandle';
import '../record-preview.css';
import '../tasks-workspace.css';

type Method=NonNullable<ActivityMetadata['interactionMethod']>;
const labels:Record<ActivityRelation['type'],string>={
 contact:'Person',company:'Company',project:'Deal',quote:'Quote',
};
const methods:Method[]=['call','email','text','video-call','in-person'];
const methodLabel=(method:Method)=>method.replaceAll('-',' ').replace(/^./,v=>v.toUpperCase());
const localTimestamp=(timestamp:string)=>{
 const date=new Date(timestamp);
 return Number.isFinite(date.getTime())
  ?localDateKey(date)+'T'+[date.getHours(),date.getMinutes()].map(v=>String(v).padStart(2,'0')).join(':')
  :'';
};
interface EditDraft{method:Method;occurred:string;notes:string;links:TaskAssociation[];}

export function CalendarActivityPreview({activityId,onClose,onSelect}:{
 activityId:string;onClose:()=>void;onSelect:(kind:PreviewRecord['kind'],id:string)=>void;
}){
 const activity=useCrmStore(s=>s.activities.find(a=>a.id===activityId));
 const saveActivity=useCrmStore(s=>s.updateActivity);
 const people=useCrmStore(s=>s.contacts);
 const companies=useCrmStore(s=>s.companies);
 const deals=useCrmStore(s=>s.projects);
 const quotes=useQuoteStore(s=>s.quotes);
 const mode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id),
  orgId=useAuthStore(s=>s.organizationId),role=useAuthStore(s=>s.teamRole),
  department=useAuthStore(s=>s.teamDepartment);
 const rolePreview=useRolePerspectiveStore(s=>s.activePerspective);
 const allowed=!rolePreview&&(mode==='local'||canEditTeamArea(role,department,'crm'))&&
  (!activity?.metadata?.recordedByUserId||
    activity.metadata.recordedByUserId===userId||role==='owner'||role==='admin');
 const canEdit=allowed&&activity?.type==='manual-touchpoint';
 const scopeKey=draftStorageKey('activity-edit:'+activityId,mode,orgId,userId);
 const [editing,setEditing]=useState(false);
 const [method,setMethod]=useState<Method>('call');
 const [occurred,setOccurred]=useState('');
 const [notes,setNotes]=useState('');
 const [links,setLinks]=useState<TaskAssociation[]>([]);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 useModalScrollLock(Boolean(activity));
 const previewRef=useDismissibleLayer<HTMLElement>(Boolean(activity),()=>{
  if(!saving)onClose();
 });

 const options:AssociationOption[]=useMemo(()=>[
  ...people.map(p=>({key:'contact:'+p.id,label:'Person · '+p.name,
   linked:{type:'contact' as const,id:p.id,label:'Person · '+p.name}})),
  ...companies.map(c=>({key:'company:'+c.id,label:'Company · '+c.name,
   linked:{type:'company' as const,id:c.id,label:'Company · '+c.name}})),
  ...deals.map(d=>({key:'project:'+d.id,label:'Deal · '+d.name,
   linked:{type:'project' as const,id:d.id,label:'Deal · '+d.name}})),
  ...quotes.filter(q=>!q.archivedAt&&(mode!=='cloud'||q.ownerUserId===userId))
   .map(q=>({key:'quote:'+q.id,label:'Quote · '+(q.title||q.quoteNumber),
    linked:{type:'quote' as const,id:q.id,label:'Quote · '+(q.title||q.quoteNumber)}})),
 ],[people,companies,deals,quotes,mode,userId]);
 const optionLabels=useMemo(()=>new Map(options.map(option=>[option.key,option.label])),[options]);
 const relationList=activity?activityRelations(activity).map(link=>({
  ...link,label:optionLabels.get(link.type+':'+link.id)??link.label??labels[link.type],
 })):[];
 const openEditor=()=>{
  if(!activity||!canEdit)return;
  const restored=readSavedDraft<EditDraft>(scopeKey);
  setMethod(restored?.method??activity.metadata?.interactionMethod??'call');
  setOccurred(restored?.occurred??localTimestamp(activity.occurredAt));
  setNotes(restored?.notes??activity.metadata?.notes??'');
  setLinks(restored?.links??relationList);
  setError('');setEditing(true);
 };
 useEffect(()=>{
  if(!editing||!scopeKey)return;
  writeSavedDraft(scopeKey,{method,occurred,notes,links});
 },[editing,scopeKey,method,occurred,notes,links]);
 useEffect(()=>{setEditing(false);setError('');},[activityId,scopeKey]);
 if(!activity)return null;
 const close=()=>{if(!saving)onClose();};
 const discard=()=>{
  clearSavedDraft(scopeKey);setEditing(false);setError('');
 };
 const submit=async(event:FormEvent)=>{
  event.preventDefault();
  if(!activity||!canEdit||saving)return;
  const when=new Date(occurred);
  if(!Number.isFinite(when.getTime())||when.getTime()>Date.now()+60000){
   setError('Choose a valid date and time for a completed interaction.');return;
  }
  const relations:ActivityRelation[]=links.filter(link=>link.type!=='notebook')
   .map(link=>({type:link.type as ActivityRelation['type'],id:link.id,label:link.label}));
  if(!relations.length){setError('Link at least one CRM record.');return;}
  const primary=primaryActivityRelations(relations);
  // Respect the edited associations exactly: removing a Company link must
  // not silently re-add it through an associated Person or Deal.
  setSaving(true);setError('');
  try{
   await saveActivity(activityId,{
    summary:activityMethodSummary(method,relations),
    occurredAt:when.toISOString(),
    ...primary,
    metadata:{...activity.metadata,interactionMethod:method,
     relatedRecords:relations,notes:notes.trim().slice(0,5000)||undefined},
   });
   clearSavedDraft(scopeKey);setEditing(false);
  }catch(e){setError(e instanceof Error?e.message:'Activity save was not confirmed. Try again.');}
  finally{setSaving(false);}
 };
 return createPortal(<div className="tasks-dialog-backdrop activity-quick-backdrop ss-mobile-sheet-backdrop"
  onPointerDown={event=>{if(event.target===event.currentTarget)close();}}>
  <section ref={previewRef}
   className="tasks-preview-card record-preview-panel activity-preview-panel activity-quick-card ss-mobile-sheet"
   role="dialog" aria-modal="true" aria-label={editing?'Edit Activity':'Activity preview'}>
   <MobileSheetHandle onClose={close}/>
   <header className="activity-preview-header">
    <div><span className="board-eyebrow">CRM · COMPLETED INTERACTION</span>
     <h2>{editing?'Edit activity':activity.summary}</h2>
     {editing&&<p>Correct details or add related people without leaving Home.</p>}
    </div>
    <button type="button" aria-label="Close activity preview" className="editor-close"
     disabled={saving} onClick={close}>×</button>
   </header>
   <div className="tasks-preview-body record-preview-body activity-preview-body ss-mobile-sheet-body">
    {editing?<form id="activity-preview-edit" className="activity-preview-edit" onSubmit={submit}>
      <div className="activity-preview-fields">
       <label>Method<select value={method} onChange={e=>setMethod(e.target.value as Method)}>
        {methods.map(m=><option key={m} value={m}>{methodLabel(m)}</option>)}
       </select></label>
       <label>When<input type="datetime-local" value={occurred} required
        max={localTimestamp(new Date().toISOString())}
        onChange={e=>setOccurred(e.target.value)}/></label>
      </div>
      <label>Notes<textarea rows={6} maxLength={5000} value={notes}
       placeholder="Details, questions and next steps…"
       onChange={e=>setNotes(e.target.value)}/></label>
      <TaskAssociationsField options={options} value={links} onChange={setLinks}/>
      <p className="activity-preview-hint">Changes are saved to your CRM activity. Unsubmitted edits remain on this device if you close the panel.</p>
      {error&&<p className="activity-preview-error" role="alert">{error}</p>}
     </form>:<>
      <div className="tasks-preview-meta activity-quick-meta">
       <span>{activity.metadata?.interactionMethod?
        methodLabel(activity.metadata.interactionMethod):'Interaction'}</span>
       <span>Completed</span>
       <span>{new Date(activity.occurredAt).toLocaleString()}</span>
      </div>
      {activity.metadata?.notes?
       <p className="tasks-preview-notes activity-quick-notes">{activity.metadata.notes}</p>:
       <p className="activity-preview-empty">No notes were recorded.</p>}
      {activity.metadata?.editedAt&&
       <p className="activity-quick-edited">Edited {new Date(activity.metadata.editedAt).toLocaleString()}</p>}
      <div className="tasks-preview-related activity-quick-related">
       <strong>Related records</strong>
       {relationList.map(item=><button type="button"
        key={item.type+':'+item.id} onClick={()=>onSelect(
         item.type==='contact'?'person':item.type==='project'?'deal':item.type,item.id)}>
        {labels[item.type]} · {(item.label??item.id).replace(/^(Quote|Deal|Company|Person) · /,'')} ↗
       </button>)}
       {!relationList.length&&<p className="record-preview-empty">No linked CRM record.</p>}
      </div>
     </>}
   </div>
   <footer className="record-preview-actions activity-preview-actions ss-mobile-sheet-actions">
    {editing?<>
      <button type="button" onClick={discard} disabled={saving}>Discard changes</button>
      <button type="button" onClick={()=>setEditing(false)} disabled={saving}>Back to preview</button>
      <button type="submit" form="activity-preview-edit" className="activity-preview-primary"
       disabled={saving}>{saving?'Saving…':'Save changes'}</button>
     </>:<>
      <button type="button" onClick={close}>Close</button>
      {canEdit&&<button type="button" className="activity-preview-primary" onClick={openEditor}>
       Edit activity</button>}
     </>}
   </footer>
  </section>
 </div>,document.body);
}
