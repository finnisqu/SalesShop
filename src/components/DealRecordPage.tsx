import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RecordPageLayout, RecordCard, RecordProperty } from './RecordPageLayout';
import {QuickCreate} from './QuickCreate';
import {RecordRelationshipPicker} from './RecordRelatedActions';
import {RecordUnlinkAction} from './RecordUnlinkAction';
import {UnifiedRecordPicker} from './UnifiedRecordPicker';
import {RecordTasksPanel} from './RecordTasksPanel';
import {DealPeopleRelationships} from './DealPersonRelationships';
import {useDealPeopleStore,dealPeopleScope} from '../store/dealPeopleStore';
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
import {ExternalQuoteBackfillDialog} from './ExternalQuoteBackfillDialog';
import {useDealTimelineBetaStore} from '../store/dealTimelineBetaStore';
import {DealTimelineBeta} from './DealTimelineBeta';
import {CalendarActivityPreview} from './CalendarActivityPreview';
import {externalQuoteActivities} from '../services/salesQuoteRegistry';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {isOurOrgCompany} from '../services/ourOrganizationDirectory';
import {isOurCompany,companyRelationshipPatch} from '../services/companyRelationship';
import '../deal-people.css';

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
  const mode=useAuthStore(state=>state.mode);
  const teamRole=useAuthStore(state=>state.teamRole);
  const department=useAuthStore(state=>state.teamDepartment);
  const orgId=useAuthStore(state=>state.organizationId);
  const userId=useAuthStore(state=>state.user?.id);
  const previewRole=useRolePerspectiveStore(state=>state.activePerspective);
  const canEditCrm=!previewRole&&(mode==='local'||Boolean(orgId&&userId&&
    canEditTeamArea(teamRole,department,'crm')));
  const directScope=useDealPeopleStore(state=>state.scope);
  const allDirectLinks=useDealPeopleStore(state=>state.links);
  const directIds=new Set(directScope===dealPeopleScope(mode,orgId)
    ?allDirectLinks.filter(link=>link.dealId===dealId).map(link=>link.personId):[]);
  const updateDeal = useCrmStore(state => state.updateProject);
  const assignDeal = useCrmStore(state => state.assignProject);
  const {members:assignees}=useDealAssigneeDirectory();
  const setProjectCompany = useCrmStore(state => state.setProjectCompany);
  const resolveCompany = useCrmStore(state => state.resolveCompany);
  const updateCompany = useCrmStore(state => state.updateCompany);
  const quotes = useQuoteStore(state => state.quotes);
  const hydrateQuotes = useQuoteStore(state => state.hydrate);
  const createQuote = useQuoteStore(state => state.createQuote);
  const openQuote = useNavigationStore(state => state.openQuote);
  const openCompany = useNavigationStore(state => state.openCompany);
  const openPerson = useNavigationStore(state => state.openPerson);
  const [editing, setEditing] = useState(false);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState('');
  const [newCompanyName,setNewCompanyName]=useState('');
  const [notice,setNotice]=useState<RecordFormNotice|null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activityPreviewId,setActivityPreviewId]=useState<string|null>(null);
  const [timelineOpen,setTimelineOpen]=useState(false);
  const timelineBetaEnabled=useDealTimelineBetaStore(state=>state.enabled);
  const [externalQuoteOpen,setExternalQuoteOpen]=useState(false);
  const [externalQuoteDialogOpen,setExternalQuoteDialogOpen]=useState(false);
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
  useEffect(() => { setEditing(false);setTimelineOpen(false);setHistoryOpen(false);setActivityPreviewId(null);
    setExternalQuoteOpen(false);setExternalQuoteDialogOpen(false);setNewCompanyName('');
    setSaveError('');setNotice(null); }, [dealId]);
  useEffect(()=>{if(!timelineBetaEnabled)setTimelineOpen(false);},[timelineBetaEnabled]);
  useEffect(() => {
    if (!editing && deal) {
      setNewCompanyName('');
      setDraft({
      name: deal.name, stage: deal.stage,
      pipeline: (deal.pipeline ?? '') as DealPipeline | '', companyId: deal.companyId ?? '',
      assignedUserId: deal.assignedUserId ?? '',
      amount: deal.amount?.toString() ?? '', dueDate: deal.dueDate ?? '',
      nextAction: deal.nextAction ?? '', lastTouchpoint: deal.lastTouchpoint ?? '',
      });
    }
  }, [deal, editing]);
  const related = useMemo(
    () => deal ? dealRecordView(deal, companies, contacts, quotes, activities) : null,
    [deal, companies, contacts, quotes, activities],
  );

  const outsideQuotes=externalQuoteActivities(activities).filter(activity=>activity.projectId===dealId)
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
    // Validate the selected Company before changing the Deal. A newly typed
    // name is only staged here; Cancel never creates an orphan CRM record.
    let companyId=draft.companyId||undefined;
    if(newCompanyName.trim()){
      const clean=newCompanyName.trim();
      const before=new Set(useCrmStore.getState().companies.map(c=>c.id));
      if(useCrmStore.getState().companies.some(c=>c.name.trim().toLowerCase()===clean.toLowerCase()))
        throw new Error('That Company already exists. Select it from search instead.');
      // First complete any server-confirmed assignment operation. This avoids
      // creating a Company if assignment fails before the Deal can be saved.
      if((deal.assignedUserId??'')!==draft.assignedUserId)
        await assignDeal(deal.id,draft.assignedUserId||undefined);
      const createdId=resolveCompany(clean,'customer');
      if(!createdId||before.has(createdId))
        throw new Error('That Company may already exist. Select it from search instead.');
      const created=useCrmStore.getState().companies.find(c=>c.id===createdId);
      if(created)updateCompany(createdId,companyRelationshipPatch(created,'prospect'));
      companyId=createdId;
    }else{
      if(companyId&&!useCrmStore.getState().companies.some(c=>c.id===companyId))
        throw new Error('Selected Company is no longer available. Choose another Company.');
      if((deal.assignedUserId??'')!==draft.assignedUserId)
        await assignDeal(deal.id,draft.assignedUserId||undefined);
    }
    updateDeal(deal.id, {
      name: draft.name.trim(), stage: draft.stage, pipeline: draft.pipeline || undefined, amount,
      dueDate: draft.dueDate || undefined,
      nextAction: draft.nextAction.trim() || undefined,
      lastTouchpoint: draft.lastTouchpoint || undefined,
    });
    if((deal.companyId??'')!==(companyId??''))
      setProjectCompany(deal.id,companyId);
    setNewCompanyName('');
    setEditing(false);
    setNotice({kind:'applied',message:RECORD_CHANGE_APPLIED_MESSAGE});
    }catch(reason){setSaveError(reason instanceof Error?reason.message:'Unable to save Deal assignment.');}
    finally{setSaving(false);}
  };
  const dealAssociation={type:'project' as const,id:deal.id,label:'Deal · '+deal.name};
  const logDealActivity=(personId?:string)=>{
    const person=personId?useCrmStore.getState().contacts.find(p=>p.id===personId):undefined;
    openActivityComposer({associations:[dealAssociation,
      ...(person?[{type:'contact' as const,id:person.id,label:'Person · '+person.name}]:[])]});
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

  return <><RecordPageLayout entityType="project" recordTypeLabel="Deal" collectionLabel="Deals" title={deal.name} onBack={onBack}
    subtitle={related.company?.name || deal.companyName || 'No associated company'}
    badge={<><span className="connections-record-stage">{deal.stage}</span><span>{dealPipelineLabel(deal.pipeline)}</span><span>{related.linkedQuotes.length+outsideQuotes.length} linked quotes</span></>}
    actions={<>
      {timelineBetaEnabled&&<button type="button" onClick={()=>setTimelineOpen(true)}>Project timeline <small>Beta</small></button>}
      <button type="button" onClick={() => {
        setNotice(null);setSaveError('');
        if(editing)setNewCompanyName('');
        setEditing(value=>!value);
      }}>{editing ? 'Cancel Edit Page' : 'Edit Page'}</button>
      {canEditCrm&&
        <button type="button" onClick={()=>{
           if(window.matchMedia('(max-width:760px)').matches){setExternalQuoteDialogOpen(true);setExternalQuoteOpen(false);}
           else setExternalQuoteOpen(open=>!open);
          }}>
          {externalQuoteOpen?"Cancel external quote":"Record external quote"}
        </button>}
      {canEditCrm&&<button type="button" onClick={()=>logDealActivity()}>Log Activity</button>}
      <QuickCreate context={{kind:'deal',id:deal.id,name:deal.name}} launcherLabel="+ New"/>
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
          <div className="ss-record-association-field" role="group" aria-label="Deal Company">
            <strong className="ss-record-association-label">Company</strong>
            <div className="ss-record-association-current">
              <span>{newCompanyName
                ?'New Company · '+newCompanyName+' (created when Deal is saved)'
                :companies.find(company=>company.id===draft.companyId)?.name||
                  (draft.companyId?'Company unavailable':'No company selected')}</span>
              {(draft.companyId||newCompanyName)&&<button type="button" disabled={saving}
                aria-label="Clear Deal Company" onClick={()=>{
                  setNewCompanyName('');setDraft(previous=>({...previous,companyId:''}));
                }}>Clear</button>}
            </div>
            <UnifiedRecordPicker kind="Company" disabled={saving}
              triggerLabel={draft.companyId||newCompanyName?'Change Company':'Search or add Company'}
              items={companies.filter(company=>
                (!isOurOrgCompany(company)&&!isOurCompany(company))||
                company.id===draft.companyId)
                .slice().sort((a,b)=>a.name.localeCompare(b.name))
                .map(company=>({id:company.id,name:company.name,
                  detail:company.aliases?.join(', ')||undefined}))}
              onLink={id=>{setNewCompanyName('');
                setDraft(previous=>({...previous,companyId:id}));}}
              onCreate={name=>{setNewCompanyName(name.trim());
                setDraft(previous=>({...previous,companyId:''}));}}
              helper="Choose an existing Company or create one on Save changes. Canceling Deal edits creates nothing."/>
          </div>
          <label>Next action<textarea rows={3} value={draft.nextAction} onChange={event => setDraft({...draft,nextAction:event.target.value})} /></label>
          <label>Last touchpoint<input type="date" value={draft.lastTouchpoint} onChange={event => setDraft({...draft,lastTouchpoint:event.target.value})} /></label>
          <RecordFormFeedback notice={saveError&&!['Enter a deal name.'].includes(saveError)&&!saveError.startsWith('Deal amount')
            ?{kind:'error',message:saveError}:saving?{kind:'saving',message:'Applying deal changes…'}:null}/>
          <div className="connections-record-form-actions ss-record-editor-actions">
            <button type="button" onClick={() => {setNewCompanyName('');setEditing(false);}}
              disabled={saving}>Cancel</button>
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
      <RecordCard title="Quotes" extra={<span>{related.linkedQuotes.length+outsideQuotes.length} total</span>}>
        {externalQuoteOpen&&<ExternalQuoteSentForm key={deal.id} deal={deal}
          onCancel={()=>setExternalQuoteOpen(false)}
          onRecorded={()=>{setExternalQuoteOpen(false);setNotice({kind:"applied",message:"External quote saved. It is now linked to this Deal and appears in Quotes."});}}/>}
        <div className="connections-record-entity-list">
          {related.linkedQuotes.map(quote => <div className="ss-record-associated-row" key={quote.id}>
            <button type="button" onClick={() => openQuote(quote.id)}>
              <strong>{quote.title || displayQuoteNumber(quote)}</strong>
              <small>SalesShop · {displayQuoteNumber(quote)} · {quote.status} · {money.format(quoteTotal(quote))}</small>
            </button>
            {editing&&<RecordUnlinkAction source={{kind:'deal',id:deal.id,name:deal.name}}
              target={{kind:'quote',id:quote.id,name:quote.title||displayQuoteNumber(quote)}}/>}
          </div>)}
          {outsideQuotes.map(activity=><button type="button" key={activity.id}
            onClick={()=>setActivityPreviewId(activity.id)}
            aria-label={'Open external quote details '+activity.summary}>
            <strong>External quote · {activity.metadata?.amount===undefined?'Value not recorded':money.format(activity.metadata.amount)}</strong>
            <small>{activity.metadata?.externalQuoteFormat||'Builder platform'} · Sent {displayDate(activity.metadata?.bidSentDate||activity.occurredAt)}</small>
          </button>)}
          {!related.linkedQuotes.length&&!outsideQuotes.length&&
            <p className="connections-record-empty">No quotes linked to this Deal yet. Create one in SalesShop or record an external submission.</p>}
        </div>
        <RecordRelationshipPicker source={{kind:'deal',id:deal.id,name:deal.name}} target="quote"/>
      </RecordCard>
      <RecordCard title="Notebook">
        <ProjectNotebookLinks project={deal} />
      </RecordCard>
      <RecordTasksPanel kind="deal" id={deal.id} name={deal.name} editing={editing}/>
    </>}
    right={<>
      <RecordCard title="Company">
        {related.company ? <div className="connections-record-entity-list">
          <div className="ss-record-associated-row">
            <button type="button" onClick={() => openCompany(related.company!.id)}>
              <strong>{related.company.name}</strong><small>Open company →</small>
            </button>
            {editing&&<RecordUnlinkAction source={{kind:'deal',id:deal.id,name:deal.name}}
              target={{kind:'company',id:related.company.id,name:related.company.name}}/>}
          </div>
        </div> : <p className="connections-record-empty">No associated company. Edit the deal to select one.</p>}
        <RecordRelationshipPicker source={{kind:'deal',id:deal.id,name:deal.name}} target="company"/>
      </RecordCard>
      <RecordCard title="People" extra={<span>{new Set([
        ...related.dealPeople.map(person=>person.id),...directIds]).size} linked</span>}>
        <p className="connections-record-helper">People associated through Quotes and logged Activities appear below. Direct Deal contacts can be assigned independently with an optional role.</p>
        <div className="connections-record-entity-list">
          {related.dealPeople.map(person=><div key={person.id} className="ss-deal-person-entry">
            <button type="button" onClick={()=>openPerson(person.id)}>
              <strong>{person.name||person.email||'Unnamed person'}</strong>
              <small>{person.title||'Linked contact'} · Open person →</small>
            </button>
            {canEditCrm&&<button type="button" onClick={()=>logDealActivity(person.id)}>Log</button>}
          </div>)}
          {!related.dealPeople.length&&<p className="connections-record-empty">No contacts linked through Quotes or Activities. Add a direct Deal Person below.</p>}
        </div>
        <DealPeopleRelationships dealId={deal.id} people={contacts} onOpenPerson={openPerson} editing={editing}/>
        {related.companyPeople.some(person=>!directIds.has(person.id))&&<details className="ss-deal-company-people">
          <summary>Other people at this company ({related.companyPeople.filter(person=>!directIds.has(person.id)).length})</summary>
          <div className="connections-record-entity-list">
            {related.companyPeople.filter(person=>!directIds.has(person.id)).map(person=><div key={person.id} className="ss-deal-person-entry">
              <button type="button" onClick={()=>openPerson(person.id)}>
               <strong>{person.name||person.email||'Unnamed person'}</strong>
               <small>{person.title||'Company contact'}</small>
              </button>
              {canEditCrm&&<button type="button" onClick={()=>logDealActivity(person.id)}>Log</button>}
            </div>)}
          </div>
        </details>}
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
  />
  {externalQuoteDialogOpen&&<ExternalQuoteBackfillDialog initialDealId={deal.id}
   onClose={()=>setExternalQuoteDialogOpen(false)}
   onRecorded={()=>{setExternalQuoteDialogOpen(false);
    setNotice({kind:'applied',message:'External quote recorded as a dated Quote Sent activity.'});}}/>}
  {activityPreviewId&&<CalendarActivityPreview activityId={activityPreviewId}
   onClose={()=>setActivityPreviewId(null)}
   onSelect={(kind,id)=>{
     setActivityPreviewId(null);
     if(kind==='person')openPerson(id);
     else if(kind==='company')openCompany(id);
     else if(kind==='deal')useNavigationStore.getState().openProject(id);
     else if(kind==='quote')openQuote(id);
   }}/>}
  </>;
}
