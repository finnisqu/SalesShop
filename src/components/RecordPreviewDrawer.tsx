import {useEffect,useRef,useState} from 'react';
import {PreviewPanelHeading,PreviewPanelClose,PreviewPanelActions} from './PreviewPanelChrome';
import {createPortal} from 'react-dom';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useNavigationStore} from '../store/navigationStore';
import {quotesForProject,quotesForCompany} from '../services/quoteCrmLinks';
import {displayQuoteNumber,quoteTotal} from '../types/quote';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {useModalScrollLock} from '../lib/useModalScrollLock';
import {MobileSheetHandle} from './MobileSheetHandle';
import {useAuthStore} from '../store/authStore';
import {requestQuoteMetadataPage} from '../services/quoteMetadataNavigation';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import {requestTaskModal} from '../services/taskModalEvents';
import {canEditTeamArea} from '../services/teamDepartments';
import {useDealAssigneeDirectory,dealAssigneeLabel} from '../services/dealAssignees';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {dealPipelineLabel} from '../types/crm';
import {usePersonalTaskStore,taskScope,type TaskAssociation} from '../store/personalTaskStore';
import {localCalendarDay} from '../services/personFollowUpIntelligence';
import {personQuickFollowUp} from '../services/personQuickFollowUp';
import {ExternalQuoteSentForm} from './ExternalQuoteSentForm';
import {companyRelationshipLabel,visibleCompanyAliases} from '../services/companyRelationship';
import {companyRelationshipHistory} from '../services/companyRelationshipHistory';
import {CompanyRelationshipTimeline} from './CompanyRelationshipTimeline';
import {activityRelations} from '../services/activityRelations';
import {CalendarActivityPreview} from './CalendarActivityPreview';
import {crmOwnerLabel} from '../services/crmRecordOwnership';
import {isExternalQuoteActivity} from '../services/salesQuoteRegistry';
import '../record-preview.css';
import '../tasks-workspace.css';

export type PreviewRecord = {kind:'company'|'person'|'deal'|'quote';id:string};
type Props={record:PreviewRecord;onClose:()=>void;onSelect?:(record:PreviewRecord)=>void;
  onGoToQuotePage?:(id:string)=>void;onEditBoard?:(record:PreviewRecord)=>void};
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const shortDate=(date?:string)=>date?new Date(date.includes('T')?date:date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
type PersonQuickMethod='call'|'text'|'email';
function PersonQuickMethodIcon({method}:{method:PersonQuickMethod}){
 return <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
   aria-hidden="true">
   {method==='call'
    ?<path d="M5 3h3l2 5-2 2a16 16 0 0 0 6 6l2-2 5 2v3a2 2 0 0 1-2 2C11 20 4 13 3 5a2 2 0 0 1 2-2Z"/>
    :method==='text'
    ?<path d="M21 11a8 8 0 0 1-8 8H5l2-4a8 8 0 1 1 14-4Z"/>
    :<><rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="m3 7 9 7 9-7"/></>}
  </svg>;
}
const personContactLabel=(method:PersonQuickMethod)=>method==='call'?'Phone call':
 method==='text'?'Text message':'Email';
const nextContactDay=()=>{
 const day=new Date();day.setDate(day.getDate()+1);return localCalendarDay(day);
};

/** A consistent, nondestructive focus preview across Board and Connections.
 * Full record pages and document editors stay separate from preview clicks. */
export function RecordPreviewDrawer({record,onClose,onSelect,onGoToQuotePage,onEditBoard}:Props){
 const [pendingPersonMethod,setPendingPersonMethod]=useState<PersonQuickMethod|null>(null);
 const [activityPreviewId,setActivityPreviewId]=useState<string|null>(null);
 const ref=useDismissibleLayer<HTMLElement>(!pendingPersonMethod&&!activityPreviewId,onClose);
 const confirmRef=useDismissibleLayer<HTMLDivElement>(Boolean(pendingPersonMethod),
  ()=>setPendingPersonMethod(null));
 useModalScrollLock(true);
 // Follow related records in the same preview; the phone Back control
 // returns through the prior previews without resetting the directory.
 const [previewTrail,setPreviewTrail]=useState<PreviewRecord[]>([]);
 const [externalQuoteOpen,setExternalQuoteOpen]=useState(false);
 const [personActionNotice,setPersonActionNotice]=useState('');
 const [personActionError,setPersonActionError]=useState('');
 const [quickFollowUpEnabled,setQuickFollowUpEnabled]=useState(false);
 const [quickFollowUpDate,setQuickFollowUpDate]=useState(nextContactDay);
 const pendingLoggedActivityRef=useRef<string|null>(null);
 const [captureViewport,setCaptureViewport]=useState<{height:number;top:number}|null>(null);
 useEffect(()=>{
  setExternalQuoteOpen(false);setPendingPersonMethod(null);
  setActivityPreviewId(null);
  setPersonActionNotice('');setPersonActionError('');
  setQuickFollowUpEnabled(false);setQuickFollowUpDate(nextContactDay());
  pendingLoggedActivityRef.current=null;
 },[record.kind,record.id]);
 // iOS Safari's visual viewport contracts when the keyboard opens, but CSS
 // 100dvh can remain anchored to the taller layout viewport.
 useEffect(()=>{
   if(!externalQuoteOpen){setCaptureViewport(null);return;}
   const visual=window.visualViewport;
   const measure=()=>{
     if(window.innerWidth>700){setCaptureViewport(null);return;}
     const next={height:Math.round(visual?.height??window.innerHeight),
       top:Math.round(visual?.offsetTop??0)};
     setCaptureViewport(previous=>previous?.height===next.height&&previous.top===next.top
       ?previous:next);
   };
   measure();
   visual?.addEventListener('resize',measure);
   visual?.addEventListener('scroll',measure);
   window.addEventListener('resize',measure);
   return()=>{
     visual?.removeEventListener('resize',measure);
     visual?.removeEventListener('scroll',measure);
     window.removeEventListener('resize',measure);
   };
 },[externalQuoteOpen]);
 const previousRecordRef=useRef(record);
 const returningRef=useRef(false);
 useEffect(()=>{
  const previous=previousRecordRef.current;
  if(previous.kind===record.kind&&previous.id===record.id)return;
  previousRecordRef.current=record;
  if(returningRef.current){returningRef.current=false;return;}
  if(onSelect)setPreviewTrail(trail=>[...trail.slice(-11),previous]);
 },[record.kind,record.id,onSelect]);
 const backToRelated=()=>{
  const previous=previewTrail[previewTrail.length-1];
  if(!previous||!onSelect)return;
  returningRef.current=true;
  setPreviewTrail(trail=>trail.slice(0,-1));
  onSelect(previous);
 };
 const companies=useCrmStore(s=>s.companies),people=useCrmStore(s=>s.contacts);
 const logPersonActivity=useCrmStore(s=>s.recordActivity);
 const createPersonFollowUpTask=usePersonalTaskStore(s=>s.createTask);
 const currentPersonalTaskScope=usePersonalTaskStore(s=>s.scope);
 const privateTasks=usePersonalTaskStore(s=>s.tasks);
 const deals=useCrmStore(s=>s.projects),activities=useCrmStore(s=>s.activities),allQuotes=useQuoteStore(s=>s.quotes);
 const {members:assignees}=useDealAssigneeDirectory();
 const authMode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id),
  organizationId=useAuthStore(s=>s.organizationId),
  teamRole=useAuthStore(s=>s.teamRole),department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const canLog=!perspective&&(authMode==='local'||canEditTeamArea(teamRole,department,'crm'));
 const quotes=authMode==='cloud'?allQuotes.filter(q=>q.ownerUserId===userId):allQuotes;
 const navigate=useNavigationStore();
 const company=record.kind==='company'?companies.find(x=>x.id===record.id):undefined;
 const person=record.kind==='person'?people.find(x=>x.id===record.id):undefined;
 const deal=record.kind==='deal'?deals.find(x=>x.id===record.id):undefined;
 const quote=record.kind==='quote'?quotes.find(x=>x.id===record.id):undefined;
 const linkedQuotePerson=quote?.contactId?people.find(p=>p.id===quote.contactId):undefined;
 const quoteActivities=quote?activities.filter(a=>a.quoteId===quote.id)
   .slice().sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,8):[];
 const externalQuotes=deal?activities.filter(a=>a.projectId===deal.id&&isExternalQuoteActivity(a))
   .sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)):[];
 const personActivities=person?activities.filter(a=>a.contactId===person.id||
   activityRelations(a).some(link=>link.type==='contact'&&link.id===person.id))
   .slice().sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,5):[];
 const linkedCompany=person?companies.find(x=>x.id===person.companyId)
    :deal?companies.find(x=>x.id===deal.companyId):quote?companies.find(x=>x.id===quote.companyId):undefined;
 const relatedPeople=company?people.filter(p=>p.companyId===company.id):[];
 const relatedDeals=company?deals.filter(d=>d.companyId===company.id):[];
 const relatedQuotes=deal?quotesForProject(deal,quotes)
   :company?quotesForCompany(company,deals,quotes)
   :quote?.projectId?quotes.filter(q=>q.projectId===quote.projectId&&q.id!==quote.id):[];
 const personalScope=taskScope(authMode,organizationId,userId);
 const companyHistory=company?companyRelationshipHistory({
  company,contacts:people,projects:deals,activities,quotes,
  tasks:!perspective&&personalScope&&currentPersonalTaskScope===personalScope
   ?privateTasks:[],
  personalTaskScope:!perspective&&personalScope&&currentPersonalTaskScope===personalScope
   ?personalScope:null,
 }):[];
 const heading=company?.name||person?.name||deal?.name||quote?.title||'Record unavailable';
 const label=record.kind==='person'?'Person':record.kind==='deal'?'Deal':
   record.kind==='quote'?'Quote metadata':'Company';
 const contextualLinks:TaskAssociation[]=[
  ...(person?[{type:'contact' as const,id:person.id,label:'Person · '+person.name}]:[]),
  ...(deal?[{type:'project' as const,id:deal.id,label:'Deal · '+deal.name}]:[]),
  ...(quote?[{type:'quote' as const,id:quote.id,label:'Quote · '+(quote.title||displayQuoteNumber(quote))}]:[]),
  ...(quote?.projectId&&deals.some(d=>d.id===quote.projectId)
   ?[{type:'project' as const,id:quote.projectId!,
      label:'Deal · '+(deals.find(d=>d.id===quote?.projectId)?.name??'Linked deal')}]:[]),
  ...(company||linkedCompany
   ?[{type:'company' as const,id:(company??linkedCompany)!.id,
      label:'Company · '+(company??linkedCompany)!.name}]:[]),
 ];
 const open=(kind:PreviewRecord['kind'],id:string)=>{
   if(onSelect)onSelect({kind,id});
   else {
     onClose();
     if(kind==='company')navigate.openCompany(id);
     if(kind==='person')navigate.openPerson(id);
     if(kind==='deal')navigate.openProject(id);
     if(kind==='quote')navigate.openQuote(id);
   }
 };
 const goToPage=()=>{
   onClose();
   if(record.kind==='company')navigate.openCompany(record.id);
   if(record.kind==='person')navigate.openPerson(record.id);
   if(record.kind==='deal')navigate.openProject(record.id);
   if(record.kind==='quote'){
     if(onGoToQuotePage)onGoToQuotePage(record.id);
     else requestQuoteMetadataPage(record.id,()=>navigate.setView('dashboard'));
   }
 };
 const beginPersonContact=(method:PersonQuickMethod)=>{
  if(!canLog)return;
  pendingLoggedActivityRef.current=null;
  setPendingPersonMethod(method);setPersonActionError('');
  setQuickFollowUpEnabled(false);setQuickFollowUpDate(nextContactDay());
 };
 const logConfirmedPersonInteraction=()=>{
  if(!person||!pendingPersonMethod||!canLog)return;
  const method=pendingPersonMethod;
  const links=contextualLinks.filter(link=>link.type==='contact'||link.type==='company');
  const localScope=taskScope(authMode,organizationId,userId);
  if(quickFollowUpEnabled){
   if(!localScope||currentPersonalTaskScope!==localScope){
    setPersonActionError('Your personal Tasks have not loaded in this account. Reopen this preview and try again.');
    return;
   }
   if(!/^\d{4}-\d{2}-\d{2}$/.test(quickFollowUpDate)||
      quickFollowUpDate<localCalendarDay(new Date())){
    setPersonActionError('Choose today or a future follow-up date.');
    return;
   }
  }
  try{
   const loggedId=pendingLoggedActivityRef.current??logPersonActivity({
    type:'manual-touchpoint',
    summary:personContactLabel(method)+' with '+(person.name||person.email||person.phone||'contact'),
    contactId:person.id,companyId:person.companyId,
    occurredAt:new Date().toISOString(),
    metadata:{source:'manual',interactionMethod:method,
     relatedRecords:links.map(link=>({
      type:link.type as 'contact'|'company',id:link.id,label:link.label,
     }))},
   });
   // A failed follow-up retry must never create a duplicate CRM Activity.
   pendingLoggedActivityRef.current=loggedId;
   if(quickFollowUpEnabled){
    const followUp=personQuickFollowUp({
     activityId:loggedId,personName:person.name||'contact',method,
     dueDate:quickFollowUpDate,associations:links,
    });
    const exists=usePersonalTaskStore.getState().tasks.some(task=>
     !task.deletedAt&&task.sourceObjectId===followUp.changes.sourceObjectId);
    if(!exists&&!createPersonFollowUpTask(followUp.title,followUp.changes)){
     throw new Error('Activity was logged, but the follow-up could not be saved. Retry to create the task.');
    }
   }
   setPersonActionNotice(personContactLabel(method)+
    (quickFollowUpEnabled?' recorded. Follow-up due '+new Date(quickFollowUpDate+'T12:00:00')
     .toLocaleDateString(undefined,{month:'short',day:'numeric'})+'.':' recorded in Activity.'));
   pendingLoggedActivityRef.current=null;
   setQuickFollowUpEnabled(false);
   setPendingPersonMethod(null);setPersonActionError('');
  }catch(reason){
   setPersonActionError(reason instanceof Error?reason.message:'Could not record this Activity.');
  }
 };
 const related=(kind:PreviewRecord['kind'],id:string,title:string,description?:string)=>
   <button type="button" className="record-preview-related" key={kind+id}
     onClick={()=>open(kind,id)}><span><strong>{title}</strong>{description&&<small>{description}</small>}</span><span aria-hidden="true">›</span></button>;
 useEffect(()=>{if(!company&&!person&&!deal&&!quote)onClose();},[company,person,deal,quote,onClose]);
 if(!company&&!person&&!deal&&!quote)return null;
 const center=record.kind==='quote';
 const capture=Boolean(deal&&externalQuoteOpen);
 const preview=<div className={(center
     ?'tasks-dialog-backdrop record-preview-center-backdrop'
     :'project-editor-backdrop record-preview-backdrop')+
     (capture?' record-preview-capture-backdrop':'')+
     (activityPreviewId?' is-activity-underlay':'')+' ss-mobile-sheet-backdrop'}
   aria-hidden={activityPreviewId?true:undefined}
   style={capture&&captureViewport
     ?{top:captureViewport.top,height:captureViewport.height,bottom:'auto'}:undefined}
   onPointerDown={event=>{if(!activityPreviewId&&event.target===event.currentTarget)onClose();}}>
   <aside ref={ref} role="dialog" aria-modal="true"
     aria-label={capture?'Record external quote for '+heading:label+' preview'}
     className={(center?'tasks-preview-card record-preview-center-card':'project-editor record-preview-panel')+
       (capture?' record-preview-capture-panel':'')+' ss-mobile-sheet'}>
     <MobileSheetHandle onClose={onClose} disabled={capture}/>
     <header className={person?'record-preview-person-header':undefined}>
       {Boolean(onSelect&&previewTrail.length)&&<button type="button" className="record-preview-back"
         onClick={backToRelated} aria-label="Back to previous related record">← Back</button>}
       <PreviewPanelHeading eyebrow={capture?'Deal · Record external quote':center?'QUOTE · QUICK VIEW':label+' · Quick preview'} title={heading}/>
       {person&&<div className="record-preview-person-quick-actions" aria-label="Contact this person">
        {person.phone&&(['call','text'] as const).map(method=><a key={method}
          href={(method==='call'?'tel:':'sms:')+person.phone!.replace(/[^0-9+*#]/g,'')}
          title={method==='call'?'Call '+person.name:'Text '+person.name}
          aria-label={method==='call'?'Call '+person.name:'Text '+person.name}
          onClick={()=>beginPersonContact(method)}>
          <PersonQuickMethodIcon method={method}/>
        </a>)}
        {person.email&&<a href={'mailto:'+encodeURIComponent(person.email.trim())}
          title={'Email '+person.name} aria-label={'Email '+person.name}
          onClick={()=>beginPersonContact('email')}>
          <PersonQuickMethodIcon method="email"/>
        </a>}
       </div>}
       <PreviewPanelClose onClose={onClose} label="Close preview" className="editor-close"/>
     </header>
     <div className={(center?'tasks-preview-body record-preview-body':'record-preview-body')+
       (capture?' record-preview-capture-body':'')+' ss-mobile-sheet-body'}>
       {capture&&deal
         ?<ExternalQuoteSentForm key={deal.id} deal={deal}
            onCancel={()=>setExternalQuoteOpen(false)}
            onRecorded={()=>setExternalQuoteOpen(false)}/>
         :<>
       {company&&<>
         <section><h3>About this company</h3>
           <dl><dt>Relationship</dt><dd>{companyRelationshipLabel(company)}</dd>
             <dt>Assigned to</dt><dd>{crmOwnerLabel(company.ownerUserId,userId,authMode)}</dd>
             <dt>Aliases</dt><dd>{visibleCompanyAliases(company).join(', ')||'—'}</dd>
             <dt>Last updated</dt><dd>{shortDate(company.updatedAt)}</dd></dl>
         </section>
         <section><h3>People <span>{relatedPeople.length}</span></h3>
           {relatedPeople.slice(0,12).map(p=>related('person',p.id,p.name,p.title||p.email))}
           {!relatedPeople.length&&<p className="record-preview-empty">No people linked.</p>}
         </section>
         <section><h3>Deals <span>{relatedDeals.length}</span></h3>
           {relatedDeals.slice(0,12).map(d=>related('deal',d.id,d.name,d.stage))}
           {!relatedDeals.length&&<p className="record-preview-empty">No deals linked.</p>}
         </section>
         <section><h3>Recent relationship history <span>{companyHistory.length}</span></h3>
           <CompanyRelationshipTimeline items={companyHistory} compact
             onOpenTarget={target=>{
               if(target.kind==='task'){
                 onClose();requestTaskModal({mode:'preview',id:target.id});return;
               }
               if(target.kind==='activity'){
                 setActivityPreviewId(target.id);return;
               }
               open(target.kind,target.id);
             }}/>
         </section>
       </>}
       {person&&<>
         {personActionNotice&&<p className="record-preview-contact-notice" role="status">{personActionNotice}</p>}
         <section><h3>About this person</h3><dl>
           <dt>Assigned to</dt><dd>{crmOwnerLabel(person.ownerUserId,userId,authMode)}</dd>
           <dt>Job title</dt><dd>{person.title||'—'}</dd>
           <dt>Email</dt><dd>{person.email||'—'}</dd>
           <dt>Phone</dt><dd>{person.phone||'—'}</dd></dl></section>
         <section><h3>Company</h3>
           {linkedCompany?related('company',linkedCompany.id,linkedCompany.name):<p className="record-preview-empty">No company linked.</p>}
         </section>
         <section><h3>Recent activities <span>{personActivities.length}</span></h3>
           {personActivities.map(a=><button type="button" key={a.id}
             className="record-preview-related"
             onClick={()=>setActivityPreviewId(a.id)}
             aria-label={'View Activity details: '+a.summary}>
             <span><strong>{a.summary}</strong>
              <small>{new Date(a.occurredAt).toLocaleString()}</small></span>
             <span aria-hidden="true">›</span>
           </button>)}
           {!personActivities.length&&<p className="record-preview-empty">No logged activities for this person.</p>}
         </section>
       </>}
       {deal&&<>
         <section><h3>Company</h3>
           {linkedCompany?related('company',linkedCompany.id,linkedCompany.name):
             <p className="record-preview-empty">{deal.companyName||'No company linked.'}</p>}
         </section>
         <section><h3>About this deal</h3><dl>
           <dt>Pipeline</dt><dd>{dealPipelineLabel(deal.pipeline)}</dd>
            <dt>Stage</dt><dd>{deal.stage}</dd><dt>Value</dt><dd>{deal.amount===undefined?'—':money.format(deal.amount)}</dd>
           <dt>Assigned salesperson</dt><dd>{dealAssigneeLabel(deal.assignedUserId,assignees)}</dd>
           <dt>Due date</dt><dd>{shortDate(deal.dueDate)}</dd><dt>Next action</dt><dd>{deal.nextAction||'—'}</dd></dl></section>
         <section><h3>Quotes <span>{relatedQuotes.length+externalQuotes.length} total</span></h3>
           {relatedQuotes.slice(0,12).map(q=>related('quote',q.id,q.title||displayQuoteNumber(q),
             'SalesShop · '+q.status))}
           {externalQuotes.slice(0,12).map(a=><button type="button" key={a.id}
             className="record-preview-related" onClick={()=>setActivityPreviewId(a.id)}
             aria-label={'View external quote details '+a.summary}>
             <span><strong>External quote · {a.metadata?.amount===undefined?'Value not recorded':money.format(a.metadata.amount)}</strong>
               <small>{a.metadata?.externalQuoteFormat||'Builder platform'} · Sent {shortDate(a.metadata?.bidSentDate||a.occurredAt)}</small>
             </span><span aria-hidden="true">›</span>
           </button>)}
           {!relatedQuotes.length&&!externalQuotes.length&&
             <p className="record-preview-empty">No linked quotes yet.</p>}
         </section>
       </>}
       {quote&&<>
         <div className="tasks-preview-meta record-preview-quote-meta">
           <span>{quote.status}</span>
           <span>{quote.documentType==='pricing-schedule'?'Pricing schedule':
             quote.documentType==='change-order'?'Change order':'Quote'}</span>
           <span>Revision {quote.revision}</span>
           {quote.archivedAt&&<span>Archived</span>}
         </div>
         <dl className="record-preview-quote-facts">
           <div><dt>Number</dt><dd>{displayQuoteNumber(quote)}</dd></div>
           <div><dt>Value</dt><dd>{money.format(quoteTotal(quote))}</dd></div>
           <div><dt>Updated</dt><dd>{shortDate(quote.updatedAt)}</dd></div>
           {quote.sentAt&&<div><dt>Sent</dt><dd>{shortDate(quote.sentAt)}</dd></div>}
         </dl>
         <div className="tasks-preview-related record-preview-quote-links">
           <strong>Related records</strong>
           {linkedCompany?<button type="button" onClick={()=>open('company',linkedCompany.id)}>
             Company · {linkedCompany.name} ↗</button>
            :quote.companyName&&<span className="record-preview-quote-unlinked">Company · {quote.companyName}</span>}
           {quote.projectId&&deals.find(x=>x.id===quote.projectId)&&
             <button type="button" onClick={()=>open('deal',quote.projectId!)}>
               Deal · {deals.find(x=>x.id===quote.projectId)!.name} ↗
             </button>}
           {linkedQuotePerson?<button type="button" onClick={()=>open('person',linkedQuotePerson.id)}>
             Person · {linkedQuotePerson.name} ↗</button>
             :quote.contactName&&<span className="record-preview-quote-unlinked">
               Person · {quote.contactName}</span>}
           {!linkedCompany&&!quote.companyName&&!linkedQuotePerson&&!quote.contactName&&
            !(quote.projectId&&deals.some(x=>x.id===quote.projectId))&&
            <p className="record-preview-empty">No linked company, deal or person.</p>}
         </div>
         {quoteActivities.length>0&&<section className="record-preview-quote-history">
           <h3>Quote activity <span>{quoteActivities.length}</span></h3>
           {quoteActivities.map(activity=><button type="button" className="record-preview-related"
             key={activity.id} onClick={()=>setActivityPreviewId(activity.id)}>
             <strong>{activity.summary}</strong>
             <small>{shortDate(activity.occurredAt)}</small>
           </button>)}
         </section>
       </>}
       </>}
     </div>
     {!capture&&<PreviewPanelActions className="record-preview-actions ss-mobile-sheet-actions">
       {center&&<button type="button" onClick={onClose}>Close</button>}
       {!perspective&&<button type="button" data-mobile-label="+ Task" onClick={()=>{
        onClose();requestTaskModal({mode:'create',associations:contextualLinks});
       }}>New task</button>}
       {deal&&canLog&&
         <button type="button" data-mobile-label="Bid sent" onClick={()=>setExternalQuoteOpen(value=>!value)}>
           {externalQuoteOpen?'Cancel external quote':'Record external quote'}
         </button>}
       {canLog&&<button type="button" data-mobile-label="Activity" onClick={()=>{
        onClose();openActivityComposer({associations:contextualLinks});
       }}>Log activity</button>}
       {onEditBoard&&((record.kind==='deal')||(record.kind==='company'))&&
         <button type="button" data-mobile-label="Edit" onClick={()=>{onClose();onEditBoard(record);}}>Edit</button>}
       <button type="button" className="record-preview-full" data-mobile-label="Full page" onClick={goToPage}>Go to page</button>
       {quote&&<button type="button" className={center?'tasks-primary record-preview-open-quote':'record-preview-open-quote'}
         disabled={Boolean(quote.archivedAt)} title={quote.archivedAt?'Restore this document before opening it':undefined}
         onClick={()=>{onClose();navigate.openQuote(quote.id);}}>Open quote</button>}
     </PreviewPanelActions>}
     {person&&pendingPersonMethod&&canLog&&<div className="record-preview-contact-confirm-cover">
      <div ref={confirmRef} className="record-preview-contact-confirm" role="alertdialog" aria-modal="true"
        aria-labelledby="record-preview-contact-confirm-title"
        aria-describedby="record-preview-contact-confirm-detail"
        onKeyDown={event=>{if(event.key==='Escape'){
         event.preventDefault();event.stopPropagation();setPendingPersonMethod(null);
        }}}>
       <h3 id="record-preview-contact-confirm-title">Log {personContactLabel(pendingPersonMethod)}?</h3>
       <p id="record-preview-contact-confirm-detail">Did you {pendingPersonMethod==='call'
        ?'complete the call':pendingPersonMethod==='text'?'send the text':'send the email'} to {person.name}?
        Only a confirmed interaction will be saved as an Activity.</p>
       <label className="record-preview-contact-follow-up">
        <input type="checkbox" checked={quickFollowUpEnabled} onChange={event=>{
         setQuickFollowUpEnabled(event.currentTarget.checked);setPersonActionError('');
        }}/>
        <span>Create follow-up task</span>
       </label>
       {quickFollowUpEnabled&&<label className="record-preview-contact-due-date">
        Follow up on
        <input type="date" min={localCalendarDay(new Date())}
         value={quickFollowUpDate} onChange={event=>{
          setQuickFollowUpDate(event.currentTarget.value);setPersonActionError('');
         }}/>
       </label>}
       {personActionError&&<p role="alert" className="record-preview-contact-error">{personActionError}</p>}
       <div className="record-preview-contact-confirm-actions">
        <button type="button" onClick={()=>{
         setPendingPersonMethod(null);setPersonActionError('');
        }}>{pendingLoggedActivityRef.current?'Close':'No'}</button>
        <button type="button" className="is-primary" onClick={logConfirmedPersonInteraction}
         data-dialog-initial-focus>{quickFollowUpEnabled?'Yes, log + follow up':'Yes, log it'}</button>
       </div>
      </div>
     </div>}
   </aside>
 </div>;
 // Portal every preview: a fixed iPhone sheet should never inherit Board's
 // horizontal scroll container or any transformed ancestor.
 return <>
  {createPortal(preview,document.body)}
  {activityPreviewId&&<CalendarActivityPreview activityId={activityPreviewId}
   onClose={()=>setActivityPreviewId(null)}
   onSelect={(kind,id)=>{
    setActivityPreviewId(null);
    open(kind,id);
   }}/>}
 </>;
}
