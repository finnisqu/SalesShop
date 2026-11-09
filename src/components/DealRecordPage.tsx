import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RecordPageLayout, RecordCard, RecordProperty } from './RecordPageLayout';
import {RecordEditField,RecordFormFeedback,nonnegativeFieldError,RECORD_CHANGE_APPLIED_MESSAGE,type RecordFormNotice} from './RecordFormFeedback';
import { ProjectNotebookLinks } from './ProjectNotebookLinks';
import { dealRecordView } from '../services/dealRecordView';
import { PrivateDealContactRoles } from './PrivateDealContactRoles';
import { DEAL_PIPELINES, PROJECT_STAGES, dealPipelineLabel, type DealPipeline, type ProjectStage } from '../types/crm';
import { quoteTotal, displayQuoteNumber } from '../types/quote';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import { useNavigationStore } from '../store/navigationStore';
import {DealAssigneeSelect,useDealAssigneeDirectory,dealAssigneeLabel} from '../services/dealAssignees';
import {ExternalQuoteSentForm} from './ExternalQuoteSentForm';
import {useDealTimelineBetaStore} from '../store/dealTimelineBetaStore';
import {DealTimelineBeta} from './DealTimelineBeta';
import {CalendarActivityPreview} from './CalendarActivityPreview';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const displayDate = (value?: string) => {
  if (!value) return 'Not set';
  const date = new Date(value.includes('T') ? value : value + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
};

export function DealRecordPage({ dealId, onBack }: { dealId: string; onBack: () => void }) {
  const hydrated = useCrmStore(state => state.hydrated);
  const deals = useCrmStore(state => state.projects);
  const companies = useCrmStore(state => state.companies);
  const contacts = useCrmStore(state => state.contacts);
  const activities = useCrmStore(state => state.activities);
  const createContact=useCrmStore(state=>state.createContact);
  const mode=useAuthStore(state=>state.mode);
  const teamRole=useAuthStore(state=>state.teamRole);
  const department=useAuthStore(state=>state.teamDepartment);
  const previewRole=useRolePerspectiveStore(state=>state.activePerspective);
  const canEditCrm=!previewRole&&(mode==='local'||canEditTeamArea(teamRole,department,'crm'));
  const updateDeal = useCrmStore(state => state.updateProject);
  const assignDeal = useCrmStore(state => state.assignProject);
  const {members:assignees}=useDealAssigneeDirectory();
  const relinkCompany = useCrmStore(state => state.relinkProjectCompany);
  const quotes = useQuoteStore(state => state.quotes);
  const hydrateQuotes = useQuoteStore(state => state.hydrate);
  const createQuote = useQuoteStore(state => state.createQuote);
  const openQuote = useNavigationStore(state => state.openQuote);
  const openCompany = useNavigationStore(state => state.openCompany);
  const openPerson = useNavigationStore(state => state.openPerson);
  const [editing, setEditing] = useState(false);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [notice,setNotice]=useState<RecordFormNotice|null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activityPreviewId,setActivityPreviewId]=useState<string|null>(null);
  const [personCreating,setPersonCreating]=useState(false);
  const [personName,setPersonName]=useState('');
  const [personEmail,setPersonEmail]=useState('');
  const [personTitle,setPersonTitle]=useState('');
  const [personPhone,setPersonPhone]=useState('');
  const [personError,setPersonError]=useState('');
  const [timelineOpen,setTimelineOpen]=useState(false);
  const timelineBetaEnabled=useDealTimelineBetaStore(state=>state.enabled);
  const [externalQuoteOpen,setExternalQuoteOpen]=useState(false);
  const deal = deals.find(item => item.id === dealId);
  const [draft, setDraft] = useState({
    name: deal?.name ?? '', stage: deal?.stage ?? 'Discovery' as ProjectStage,
    pipeline: (deal?.pipeline ?? '') as DealPipeline | '',
    companyId: deal?.companyId ?? '',
    assignedUserId: deal?.assignedUserId ?? '',
    amount: deal?.amount?.toString() ?? '',
    dueDate: deal?.dueDate ?? '',
    nextAction: deal?.nextAction ?? '',
    lastTouchpoint: deal?.lastTouchpoint ?? '',
  });

  useEffect(() => { hydrateQuotes(); }, [hydrateQuotes]);
  useEffect(() => { setEditing(false);setTimelineOpen(false);setHistoryOpen(false);setActivityPreviewId(null);setPersonCreating(false);
    setExternalQuoteOpen(false);setSaveError('');setNotice(null); }, [dealId]);
  useEffect(()=>{if(!timelineBetaEnabled)setTimelineOpen(false);},[timelineBetaEnabled]);
  useEffect(() => {
    if (!editing && deal) setDraft({
      name: deal.name, stage: deal.stage,
      pipeline: (deal.pipeline ?? '') as DealPipeline | '', companyId: deal.companyId ?? '',
      assignedUserId: deal.assignedUserId ?? '',
      amount: deal.amount?.toString() ?? '', dueDate: deal.dueDate ?? '',
      nextAction: deal.nextAction ?? '', lastTouchpoint: deal.lastTouchpoint ?? '',
    });
  }, [deal, editing]);
  const related = useMemo(
    () => deal ? dealRecordView(deal, companies, contacts, quotes, activities) : null,
    [deal, companies, contacts, quotes, activities],
  );

  const outsideQuotes=activities.filter(activity=>activity.projectId===dealId&&activity.metadata?.externalQuoteSent)
    .sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));

  if (!hydrated) return <section className="connections-record-missing" role="status">Loading deal record…</section>;
  if (!deal || !related) return <section className="connections-record-missing" role="status">
    <h1>Deal not available</h1>
    <p>This record may have been removed or you may not have access to it.</p>
    <button type="button" onClick={onBack}>Back to Deals</button>
  </section>;

  const saveDeal = async (event: FormEvent) => {
    event.preventDefault();
    if(saving)return;
    if(!draft.name.trim()){setSaveError('Enter a deal name.');return;}
    const amountError=nonnegativeFieldError(draft.amount,'Deal amount');
    if(amountError){setSaveError(amountError);return;}
    const amount=draft.amount.trim()?Number(draft.amount):undefined;
    setSaving(true);setSaveError('');
    try{
    if((deal.assignedUserId??'')!==draft.assignedUserId)
      await assignDeal(deal.id,draft.assignedUserId||undefined);
    updateDeal(deal.id, {
      name: draft.name.trim(), stage: draft.stage, pipeline: draft.pipeline || undefined, amount,
      dueDate: draft.dueDate || undefined,
      nextAction: draft.nextAction.trim() || undefined,
      lastTouchpoint: draft.lastTouchpoint || undefined,
      ...(!draft.companyId && deal.companyId ? { companyName: '' } : {}),
    });
    if (draft.companyId && draft.companyId !== deal.companyId) relinkCompany(deal.id, draft.companyId);
    setEditing(false);
    setNotice({kind:'applied',message:RECORD_CHANGE_APPLIED_MESSAGE});
    }catch(reason){setSaveError(reason instanceof Error?reason.message:'Unable to save Deal assignment.');}
    finally{setSaving(false);}
  };
  const dealAssociation={type:'project' as const,id:deal.id,label:'Deal · '+deal.name};
  const logDealActivity=(personId?:string)=>{
    const person=personId?contacts.find(p=>p.id===personId):undefined;
    openActivityComposer({associations:[dealAssociation,
      ...(person?[{type:'contact' as const,id:person.id,label:'Person · '+person.name}]:[])]});
  };
  const createDealPerson=(event:FormEvent)=>{
    event.preventDefault();
    if(!canEditCrm)return;
    const name=personName.trim(),email=personEmail.trim();
    if(!name){setPersonError('Enter a name.');return;}
    if(contacts.some(p=>(email&&p.email?.toLowerCase()===email.toLowerCase())||
      (p.name.toLowerCase()===name.toLowerCase()&&(p.companyId??'')===(deal.companyId??'')))){
      setPersonError('That person already exists. Use the company people list or search in the Activity editor.');return;
    }
    const personId=createContact({name,email,phone:personPhone.trim(),
      title:personTitle.trim(),companyId:deal.companyId,source:'manual'});
    if(!personId){setPersonError('Could not create that person.');return;}
    setPersonName('');setPersonEmail('');setPersonTitle('');setPersonPhone('');
    setPersonCreating(false);setPersonError('');
    // Creating a Person does not imply that every Company person belongs to the Deal.
    // Open a prelinked interaction so the user's explicit association is recorded.
    logDealActivity(personId);
  };
  const newQuote = () => {
    const id = createQuote({ title: deal.name, projectId: deal.id, companyId: deal.companyId, companyName: deal.companyName });
    openQuote(id);
  };

  if(timelineBetaEnabled&&timelineOpen)return <section className="connections-record-page ss-timeline-beta-page">
    <nav className="ss-timeline-beta-breadcrumb" aria-label="Deal navigation">
      <button type="button" onClick={()=>setTimelineOpen(false)}>← Deal details</button>
      <span aria-hidden="true">/</span><strong>{deal.name}</strong>
    </nav>
    <DealTimelineBeta deal={deal}/>
  </section>;

  return <RecordPageLayout entityType="project" recordTypeLabel="Deal" collectionLabel="Deals" title={deal.name} onBack={onBack}
    subtitle={related.company?.name || deal.companyName || 'No associated company'}
    badge={<><span className="connections-record-stage">{deal.stage}</span><span>{dealPipelineLabel(deal.pipeline)}</span><span>{related.linkedQuotes.length} linked quotes</span></>}
    actions={<>
      {timelineBetaEnabled&&<button type="button" onClick={()=>setTimelineOpen(true)}>Project timeline <small>Beta</small></button>}
      <button type="button" onClick={() => {setNotice(null);setSaveError('');setEditing(value=>!value);}}>{editing ? 'Cancel editing' : 'Edit deal'}</button>
      {!["Closed Won","Completed","Closed Lost","Discarded"].includes(deal.stage)&&
        <button type="button" onClick={()=>setExternalQuoteOpen(open=>!open)}>
          {externalQuoteOpen?"Cancel external quote":"Record external quote sent"}
        </button>}
      {canEditCrm&&<button type="button" onClick={()=>logDealActivity()}>Log Activity</button>}
      <button type="button" className="connections-record-primary" onClick={newQuote}>+ New quote</button>
    </>}
    left={<>
      <RecordCard title="About this deal">
        <RecordFormFeedback notice={notice}/>
        {editing ? <form className="connections-record-edit-form" noValidate
          aria-busy={saving} onChange={()=>setSaveError('')} onSubmit={saveDeal}>
          <RecordEditField label="Deal name" required error={saveError==='Enter a deal name.'?saveError:undefined}>
            {control=><input {...control} autoFocus value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/>}
          </RecordEditField>
          <label>Stage<select value={draft.stage} onChange={event => setDraft({...draft,stage:event.target.value as ProjectStage})}>
            {PROJECT_STAGES.map(stage => <option key={stage} value={stage}>{stage}</option>)}
          </select></label>
          <label>Pipeline<select value={draft.pipeline} onChange={event=>setDraft({...draft,pipeline:event.target.value as DealPipeline | ''})}>
            <option value="">Unassigned</option>
            {DEAL_PIPELINES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          <RecordEditField label="Amount" error={saveError.startsWith('Deal amount')?saveError:undefined}>
            {control=><input {...control} type="number" min="0" step="0.01" value={draft.amount}
              onChange={event=>setDraft({...draft,amount:event.target.value})}/>}
          </RecordEditField>
          <label>Bid due date<input type="date" value={draft.dueDate} onChange={event => setDraft({...draft,dueDate:event.target.value})} /></label>
          <label>Assigned salesperson<DealAssigneeSelect value={draft.assignedUserId}
            onChange={value=>setDraft({...draft,assignedUserId:value})} disabled={saving}/></label>
          <label>Company<select value={draft.companyId} onChange={event => setDraft({...draft,companyId:event.target.value})}>
            <option value="">No company selected</option>
            {companies.slice().sort((a,b) => a.name.localeCompare(b.name)).map(company =>
              <option key={company.id} value={company.id}>{company.name}</option>)}
          </select></label>
          <label>Next action<textarea rows={3} value={draft.nextAction} onChange={event => setDraft({...draft,nextAction:event.target.value})} /></label>
          <label>Last touchpoint<input type="date" value={draft.lastTouchpoint} onChange={event => setDraft({...draft,lastTouchpoint:event.target.value})} /></label>
          <RecordFormFeedback notice={saveError&&!['Enter a deal name.'].includes(saveError)&&!saveError.startsWith('Deal amount')
            ?{kind:'error',message:saveError}:saving?{kind:'saving',message:'Applying deal changes…'}:null}/>
          <div className="connections-record-form-actions ss-record-editor-actions">
            <button type="button" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
            <button className="connections-record-primary" type="submit" disabled={saving}>{saving?'Saving…':'Save changes'}</button>
          </div>
        </form> : <div className="connections-record-properties-list">
          <RecordProperty label="Stage">{deal.stage}</RecordProperty>
          <RecordProperty label="Pipeline">{dealPipelineLabel(deal.pipeline)}</RecordProperty>
          <RecordProperty label="Amount">{deal.amount === undefined ? 'Not set' : money.format(deal.amount)}</RecordProperty>
          <RecordProperty label="Bid due date">{displayDate(deal.dueDate)}</RecordProperty>
          {outsideQuotes.length>0&&<RecordProperty label="External bid sent">{displayDate(outsideQuotes[0].metadata?.bidSentDate||outsideQuotes[0].occurredAt)}</RecordProperty>}
          <RecordProperty label="Assigned salesperson">{dealAssigneeLabel(deal.assignedUserId,assignees)}</RecordProperty>
          <RecordProperty label="Next action">{deal.nextAction || 'Not set'}</RecordProperty>
          <RecordProperty label="Last touchpoint">{displayDate(deal.lastTouchpoint)}</RecordProperty>
          <RecordProperty label="Created">{displayDate(deal.createdAt)}</RecordProperty>
        </div>}
      </RecordCard>
    </>}
    center={<>
      {timelineBetaEnabled&&<RecordCard title="Project timeline · Beta">
        <p className="connections-record-helper">Track deposit, shop drawings, import batches, installations by building, invoices and retainage.</p>
        <button type="button" onClick={()=>setTimelineOpen(true)}>Open milestone timeline</button>
      </RecordCard>}
      <RecordCard title="Quotes" extra={<span>{related.linkedQuotes.length} SalesShop</span>}>
        {externalQuoteOpen&&<ExternalQuoteSentForm key={deal.id} deal={deal}
          onCancel={()=>setExternalQuoteOpen(false)}
          onRecorded={()=>{setExternalQuoteOpen(false);setNotice({kind:"applied",message:"External quote recorded. Bid due date cleared and submission tasks completed."});}}/>}
        <div className="connections-record-entity-list">
          {related.linkedQuotes.map(quote => <button type="button" key={quote.id} onClick={() => openQuote(quote.id)}>
            <strong>{quote.title || displayQuoteNumber(quote)}</strong>
            <small>{displayQuoteNumber(quote)} · {quote.status} · {money.format(quoteTotal(quote))}</small>
          </button>)}
          {!related.linkedQuotes.length && <p className="connections-record-empty">No SalesShop quotes linked to this deal.</p>}
        </div>
        {outsideQuotes.length>0&&<div className="external-quote-history">
          <strong>Submitted with another tool or format</strong>
          {outsideQuotes.slice(0,5).map(activity=><div className="external-quote-history-entry" key={activity.id}>
            <span><b>{activity.metadata?.amount===undefined?"External bid":money.format(activity.metadata.amount)}</b>
              <small>{activity.metadata?.externalQuoteFormat||"External quote"} · Sent {displayDate(activity.metadata?.bidSentDate||activity.occurredAt)}</small></span>
            <small>{activity.metadata?.bidDueDate?`Original due ${displayDate(activity.metadata.bidDueDate)}`:"Bid sent"}</small>
          </div>)}
        </div>}
      </RecordCard>
      <RecordCard title="Notebook">
        <ProjectNotebookLinks project={deal} />
      </RecordCard>
    </>}
    right={<>
      <RecordCard title="Company">
        {related.company ? <div className="connections-record-entity-list">
          <button type="button" onClick={() => openCompany(related.company!.id)}>
            <strong>{related.company.name}</strong><small>Open company →</small>
          </button>
        </div> : <p className="connections-record-empty">No associated company. Edit the deal to select one.</p>}
      </RecordCard>
      <RecordCard title="People" extra={<span>{related.dealPeople.length} linked</span>}>
        <p className="connections-record-helper">People explicitly linked by a quote or recorded interaction. Other contacts at this company are suggestions, not automatically assigned to the Deal.</p>
        <div className="connections-record-entity-list">
          {related.dealPeople.map(person=><div key={person.id} className="ss-deal-person-entry">
            <button type="button" onClick={()=>openPerson(person.id)}>
              <strong>{person.name||person.email||'Unnamed person'}</strong>
              <small>{person.title||'Linked contact'} · Open person →</small>
            </button>
            {canEditCrm&&<button type="button" onClick={()=>logDealActivity(person.id)}>Log</button>}
          </div>)}
          {!related.dealPeople.length&&<p className="connections-record-empty">No people linked yet. Log an interaction with a person or add a contact to a quote.</p>}
        </div>
        {related.companyPeople.length>0&&<details className="ss-deal-company-people">
          <summary>Other people at this company ({related.companyPeople.length})</summary>
          <div className="connections-record-entity-list">
            {related.companyPeople.map(person=><div key={person.id} className="ss-deal-person-entry">
              <button type="button" onClick={()=>openPerson(person.id)}>
               <strong>{person.name||person.email||'Unnamed person'}</strong>
               <small>{person.title||'Company contact'}</small>
              </button>
              {canEditCrm&&<button type="button" onClick={()=>logDealActivity(person.id)}>Log</button>}
            </div>)}
          </div>
        </details>}
        {canEditCrm&&<>
          <button type="button" onClick={()=>{setPersonCreating(v=>!v);setPersonError('');}}>
            {personCreating?'Cancel new person':'+ New person'}
          </button>
          {personCreating&&<form className="ss-deal-person-form" onSubmit={createDealPerson}>
            <label>Name<input required autoFocus value={personName} onChange={e=>setPersonName(e.target.value)}/></label>
            <label>Title / role<input value={personTitle} onChange={e=>setPersonTitle(e.target.value)}/></label>
            <label>Email<input type="email" value={personEmail} onChange={e=>setPersonEmail(e.target.value)}/></label>
            <label>Phone<input type="tel" value={personPhone} onChange={e=>setPersonPhone(e.target.value)}/></label>
            <p className="connections-record-helper">Creates a Person and starts an Activity with this Deal preselected. Save the Activity to record their Deal link.</p>
            {personError&&<p role="alert" className="connections-record-error">{personError}</p>}
            <button type="submit" className="connections-record-primary">Create & log activity</button>
          </form>}
        </>}
      </RecordCard>
      <PrivateDealContactRoles dealId={deal.id} contacts={contacts} quotes={related.linkedQuotes} />
      <section className="connections-record-panel connections-record-history">
        <button type="button" className="connections-history-toggle" aria-expanded={historyOpen}
          onClick={() => setHistoryOpen(value => !value)}>
          <span>Activity history</span><small>{historyOpen ? 'Hide' : 'View'} <span aria-hidden="true">{historyOpen ? '▴' : '▾'}</span></small>
        </button>
        {historyOpen && <div className="connections-record-panel-body">
          <p className="connections-record-helper">Only events explicitly linked to this deal or its quotes.</p>
          <ol className="connections-record-timeline">
            {related.directHistory.map(activity => <li key={activity.id}>
              <div><button type="button" onClick={()=>setActivityPreviewId(activity.id)}><strong>{activity.summary}</strong></button>
                <time dateTime={activity.occurredAt}>{displayDate(activity.occurredAt)}</time></div>
              <small>{activity.type.replaceAll('-', ' ')}</small>
              {activity.quoteId && related.linkedQuotes.some(quote => quote.id === activity.quoteId) &&
                <button type="button" onClick={() => openQuote(activity.quoteId!)}>Open linked quote →</button>}
            </li>)}
          </ol>
          {!related.directHistory.length && <p className="connections-record-empty">No directly linked history available.</p>}
        </div>}
      </section>
    </>}
  />;
}
