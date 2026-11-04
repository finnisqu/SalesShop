import {useCrmStore} from '../store/crmStore';
import {createPortal} from 'react-dom';
import type {PreviewRecord} from './RecordPreviewDrawer';
import '../record-preview.css';
export function CalendarActivityPreview({activityId,onClose,onSelect}:{
 activityId:string;onClose:()=>void;onSelect:(kind:PreviewRecord['kind'],id:string)=>void;
}){
 const activity=useCrmStore(s=>s.activities.find(a=>a.id===activityId));
 const people=useCrmStore(s=>s.contacts);
 const companies=useCrmStore(s=>s.companies);
 const deals=useCrmStore(s=>s.projects);
 if(!activity)return null;
 const related:{kind:PreviewRecord['kind'];id:string;title:string}[]=[];
 if(activity.contactId)related.push({kind:'person',id:activity.contactId,
  title:people.find(p=>p.id===activity.contactId)?.name||'Person'});
 if(activity.companyId)related.push({kind:'company',id:activity.companyId,
  title:companies.find(c=>c.id===activity.companyId)?.name||'Company'});
 if(activity.projectId)related.push({kind:'deal',id:activity.projectId,
  title:deals.find(d=>d.id===activity.projectId)?.name||'Deal'});
 if(activity.quoteId)related.push({kind:'quote',id:activity.quoteId,title:'Linked quote'});
 return createPortal(<div className="project-editor-backdrop record-preview-backdrop"
  onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <aside className="project-editor record-preview-panel" role="dialog" aria-modal="true"
   aria-label="Activity preview">
   <header><div><span className="board-eyebrow">CRM · Completed interaction</span>
    <h2>{activity.summary}</h2></div>
    <button type="button" aria-label="Close activity preview" className="editor-close"
     onClick={onClose}>×</button></header>
   <div className="record-preview-body">
    <section><h3>Activity details</h3><dl>
     <dt>When</dt><dd>{new Date(activity.occurredAt).toLocaleString()}</dd>
     <dt>Method</dt><dd>{activity.metadata?.interactionMethod?.replaceAll('-',' ')||'Interaction'}</dd>
    </dl>{activity.metadata?.notes&&<p>{activity.metadata.notes}</p>}</section>
    <section><h3>Related records</h3>
     {related.map(item=><button type="button" className="record-preview-related"
      key={item.kind+item.id} onClick={()=>onSelect(item.kind,item.id)}>
      <span><strong>{item.title}</strong><small>{item.kind}</small></span>
      <span aria-hidden="true">›</span></button>)}
     {!related.length&&<p className="record-preview-empty">No linked CRM record.</p>}
    </section>
   </div>
   <footer className="record-preview-actions"><button type="button" onClick={onClose}>Close</button></footer>
  </aside>
 </div>,document.body);
}
