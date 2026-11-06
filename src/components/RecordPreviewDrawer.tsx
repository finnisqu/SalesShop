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
import type {TaskAssociation} from '../store/personalTaskStore';
import {ExternalQuoteSentForm} from './ExternalQuoteSentForm';
import '../record-preview.css';
import '../tasks-workspace.css';

export type PreviewRecord = {kind:'company'|'person'|'deal'|'quote';id:string};
type Props={record:PreviewRecord;onClose:()=>void;onSelect?:(record:PreviewRecord)=>void;
  onGoToQuotePage?:(id:string)=>void;onEditBoard?:(record:PreviewRecord)=>void};
const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const shortDate=(date?:string)=>date?new Date(date.includes('T')?date:date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';

/** A consistent, nondestructive focus preview across Board and Connections.
 * Full record pages and document editors stay separate from preview clicks. */
export function RecordPreviewDrawer({record,onClose,onSelect,onGoToQuotePage,onEditBoard}:Props){
 const ref=useDismissibleLayer<HTMLElement>(true,onClose);
 useModalScrollLock(true);
 // Follow related records in the same preview; the phone Back control
 // returns through the prior previews without resetting the directory.
 const [previewTrail,setPreviewTrail]=useState<PreviewRecord[]>([]);
 const [externalQuoteOpen,setExternalQuoteOpen]=useState(false);
 const [captureViewport,setCaptureViewport]=useState<{height:number;top:number}|null>(null);
 useEffect(()=>{setExternalQuoteOpen(false);},[record.kind,record.id]);
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
 const deals=useCrmStore(s=>s.projects),activities=useCrmStore(s=>s.activities),allQuotes=useQuoteStore(s=>s.quotes);
 const {members:assignees}=useDealAssigneeDirectory();
 const authMode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id),
  teamRole=useAuthStore(s=>s.teamRole),department=useAuthStore(s=>s.teamDepartment);
 const perspective=useRolePerspectiveStore(s=>s.activePerspective);
 const canLog=!perspective&&(authMode==='local'||canEditTeamArea(teamRole,department,'crm'));
 const quotes=authMode==='cloud'?allQuotes.filter(q=>q.ownerUserId===userId):allQuotes;
 const navigate=useNavigationStore();
 const company=record.kind==='company'?companies.find(x=>x.id===record.id):undefined;
 const person=record.kind==='person'?people.find(x=>x.id===record.id):undefined;
 const deal=record.kind==='deal'?deals.find(x=>x.id===record.id):undefined;
 const quote=record.kind==='quote'?quotes.find(x=>x.id===record.id):undefined;
 const externalQuotes=deal?activities.filter(a=>a.projectId===deal.id&&a.metadata?.externalQuoteSent)
   .sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)):[];
 const linkedCompany=person?companies.find(x=>x.id===person.companyId)
    :deal?companies.find(x=>x.id===deal.companyId):quote?companies.find(x=>x.id===quote.companyId):undefined;
 const relatedPeople=company?people.filter(p=>p.companyId===company.id):[];
 const relatedDeals=company?deals.filter(d=>d.companyId===company.id):[];
 const relatedQuotes=deal?quotesForProject(deal,quotes)
   :company?quotesForCompany(company,deals,quotes)
   :quote?.projectId?quotes.filter(q=>q.projectId===quote.projectId&&q.id!==quote.id):[];
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
     (capture?' record-preview-capture-backdrop':'')+' ss-mobile-sheet-backdrop'}
   style={capture&&captureViewport
     ?{top:captureViewport.top,height:captureViewport.height,bottom:'auto'}:undefined}
   onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
   <aside ref={ref} role="dialog" aria-modal="true"
     aria-label={capture?'Record external quote for '+heading:label+' preview'}
     className={(center?'tasks-preview-card record-preview-center-card':'project-editor record-preview-panel')+
       (capture?' record-preview-capture-panel':'')+' ss-mobile-sheet'}>
     <MobileSheetHandle onClose={onClose}/>
     <header>
       {Boolean(onSelect&&previewTrail.length)&&<button type="button" className="record-preview-back"
         onClick={backToRelated} aria-label="Back to previous related record">← Back</button>}
       <PreviewPanelHeading eyebrow={capture?'Deal · Record external quote':center?'QUOTE · QUICK VIEW':label+' · Quick preview'} title={heading}/>
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
           <dl><dt>Relationship</dt><dd>{company.kind==='customer'?'Customer / prospect':'Partner / supplier'}</dd>
             <dt>Aliases</dt><dd>{company.aliases?.join(', ')||'—'}</dd>
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
       </>}
       {person&&<>
         <section><h3>About this person</h3><dl>
           <dt>Job title</dt><dd>{person.title||'—'}</dd>
           <dt>Email</dt><dd>{person.email||'—'}</dd>
           <dt>Phone</dt><dd>{person.phone||'—'}</dd></dl></section>
         <section><h3>Company</h3>
           {linkedCompany?related('company',linkedCompany.id,linkedCompany.name):<p className="record-preview-empty">No company linked.</p>}
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
         <section><h3>Quotes <span>{relatedQuotes.length} SalesShop</span></h3>
           {relatedQuotes.slice(0,12).map(q=>related('quote',q.id,q.title||displayQuoteNumber(q),q.status))}
           {!relatedQuotes.length&&<p className="record-preview-empty">No SalesShop quotes linked.</p>}
           {externalQuotes.length>0&&<div className="external-quote-history">
             <strong>Outside SalesShop</strong>
             {externalQuotes.slice(0,3).map(a=><div className="external-quote-history-entry" key={a.id}>
               <span><b>{a.metadata?.amount===undefined?'External bid':money.format(a.metadata.amount)}</b>
                 <small>{a.metadata?.externalQuoteFormat||'External quote'} · Sent {shortDate(a.metadata?.bidSentDate||a.occurredAt)}</small></span>
             </div>)}
           </div>}
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
           {!linkedCompany&&!quote.companyName&&
            !(quote.projectId&&deals.some(x=>x.id===quote.projectId))&&
            <p className="record-preview-empty">No linked company or deal.</p>}
         </div>
       </>}
       </>}
     </div>
     {!capture&&<PreviewPanelActions className="record-preview-actions ss-mobile-sheet-actions">
       {center&&<button type="button" onClick={onClose}>Close</button>}
       {!perspective&&<button type="button" data-mobile-label="+ Task" onClick={()=>{
        onClose();requestTaskModal({mode:'create',associations:contextualLinks});
       }}>New task</button>}
       {deal&&canLog&&!['Closed Won','Completed','Closed Lost','Discarded'].includes(deal.stage)&&
         <button type="button" data-mobile-label="Bid sent" onClick={()=>setExternalQuoteOpen(value=>!value)}>
           {externalQuoteOpen?'Cancel external quote':'Record external quote sent'}
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
   </aside>
 </div>;
 // Portal every preview: a fixed iPhone sheet should never inherit Board's
 // horizontal scroll container or any transformed ancestor.
 return createPortal(preview,document.body);
}
