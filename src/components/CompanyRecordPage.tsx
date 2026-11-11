import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RecordPageLayout, RecordCard, RecordProperty } from './RecordPageLayout';
import {QuickCreate} from './QuickCreate';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import {RecordRelationshipPicker} from './RecordRelatedActions';
import {RecordTasksPanel} from './RecordTasksPanel';
import {ourOrgPeople,rosterGroupForContact} from '../services/ourOrganizationDirectory';
import {RecordEditField,RecordFormFeedback,nonnegativeFieldError,RECORD_CHANGE_APPLIED_MESSAGE,type RecordFormNotice} from './RecordFormFeedback';
import { companyRecordView } from '../services/companyRecordView';
import { companyAnnualPotential, companyEstimatedAnnualWork,type CompanyPatch } from '../types/crm';
import {companyRelationship,companyRelationshipLabel,companyRelationshipPatch,
 isOurCompany,ourCompanyPatch,visibleCompanyAliases,type EditableCompanyRelationship}
 from '../services/companyRelationship';
import { displayQuoteNumber, quoteTotal } from '../types/quote';
import { useCrmStore } from '../store/crmStore';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {companyRelationshipHistory} from '../services/companyRelationshipHistory';
import {CrmOwnerControl} from './CrmOwnerControl';
import {CompanyRelationshipTimeline} from './CompanyRelationshipTimeline';
import {CalendarActivityPreview} from './CalendarActivityPreview';
import {externalQuoteActivities} from '../services/salesQuoteRegistry';
import {requestTaskModal} from '../services/taskModalEvents';
import { useQuoteStore } from '../store/quoteStore';
import { useNavigationStore } from '../store/navigationStore';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const optionalNumber = (value: string) => value.trim() === '' ? undefined : Number(value);

export function CompanyRecordPage({ companyId, onBack }: { companyId: string; onBack: () => void }) {
  const companies = useCrmStore((state) => state.companies);
  const crmHydrated = useCrmStore((state) => state.hydrated);
  const contacts = useCrmStore((state) => state.contacts);
  const projects = useCrmStore((state) => state.projects);
  const activities = useCrmStore((state) => state.activities);
  const updateCompany = useCrmStore((state) => state.updateCompany);
  const quotes = useQuoteStore((state) => state.quotes);
  const hydrateQuotes = useQuoteStore((state) => state.hydrate);
  const createQuote = useQuoteStore((state) => state.createQuote);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const openProject = useNavigationStore((state) => state.openProject);
  const openPerson = useNavigationStore((state) => state.openPerson);
  const openCompany = useNavigationStore((state) => state.openCompany);
  const [activityPreviewId,setActivityPreviewId]=useState<string|null>(null);
  const [editing, setEditing] = useState(false);
  const [newAlias, setNewAlias] = useState('');
  const [editError,setEditError]=useState('');
  const [notice,setNotice]=useState<RecordFormNotice|null>(null);
  const company = companies.find((candidate) => candidate.id === companyId);
  const [draft, setDraft] = useState({
    name: company?.name ?? '', relationship: company?companyRelationship(company):'unclassified' as const,
    isSelf:company?isOurCompany(company):false,
    annualUnits: company?.annualUnits?.toString() ?? '',
    averageUnitValue: company?.averageUnitValue?.toString() ?? '',
    expectedSharePct: company?.expectedSharePct?.toString() ?? '',
  });

  useEffect(() => { hydrateQuotes(); }, [hydrateQuotes]);
  useEffect(() => {
    setEditing(false);
    setActivityPreviewId(null);
    setNewAlias('');
    setEditError('');setNotice(null);
  }, [companyId]);
  useEffect(() => {
    if (!editing && company) setDraft({
      name: company.name, relationship: companyRelationship(company),isSelf:isOurCompany(company),
      annualUnits: company.annualUnits?.toString() ?? '',
      averageUnitValue: company.averageUnitValue?.toString() ?? '',
      expectedSharePct: company.expectedSharePct?.toString() ?? '',
    });
  }, [company, editing]);

  const related = useMemo(
    () => company ? companyRecordView(company, contacts, projects, activities, quotes) : null,
    [company, contacts, projects, activities, quotes],
  );
  const privateTasks=usePersonalTaskStore(state=>state.tasks);
  const storedTaskScope=usePersonalTaskStore(state=>state.scope);
  const authMode=useAuthStore(state=>state.mode);
  const userId=useAuthStore(state=>state.user?.id);
  const organizationId=useAuthStore(state=>state.organizationId);
  const perspective=useRolePerspectiveStore(state=>state.activePerspective);
  const personalScope=taskScope(authMode,organizationId,userId);
  const timelineQuotes=useMemo(()=>authMode==='cloud'
    ?quotes.filter(q=>q.ownerUserId===userId):quotes,[authMode,quotes,userId]);
  const timeline=useMemo(()=>company?companyRelationshipHistory({
    company,contacts,projects,activities,quotes:timelineQuotes,
    tasks:personalScope&&storedTaskScope===personalScope&&!perspective?privateTasks:[],
    personalTaskScope:personalScope&&storedTaskScope===personalScope&&!perspective
      ?personalScope:null,
  }):[],[company,contacts,projects,activities,timelineQuotes,privateTasks,
      personalScope,storedTaskScope,perspective]);
  const companyDealIds=new Set(projects.filter(p=>p.companyId===companyId).map(p=>p.id));
  const externalQuotes=externalQuoteActivities(activities).filter(a=>
    (a.companyId===companyId||!!a.projectId&&companyDealIds.has(a.projectId)))
    .sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt));
  // Our Organization is a roster, not a second copy of World Stone contacts.
  // Include its members on the SELF company record without replacing anyone's
  // real Company (especially subcontractors' own firms).
  const listedPeople=useMemo(()=>{
    if(!related)return[];
    if(!company||!isOurCompany(company))return related.relatedContacts;
    const members=ourOrgPeople(contacts,companies);
    const seen=new Set(related.relatedContacts.map(person=>person.id));
    return [...related.relatedContacts,...members.filter(person=>!seen.has(person.id))];
  },[related,company,companies,contacts]);
  if (!crmHydrated) return <section className="connections-record-missing" role="status">Loading company record…</section>;
  if (!company || !related) return <section className="connections-record-missing" role="status">
    <h1>Company not available</h1>
    <p>This record may have been removed or you may not have access to it.</p>
    <button type="button" onClick={onBack}>Back to Companies</button>
  </section>;

  const saveCompany = (event: FormEvent) => {
    event.preventDefault();
    const message=!draft.name.trim()?'Enter a company name.':
      nonnegativeFieldError(draft.annualUnits,'Annual units')||
      (draft.annualUnits.trim()&&!Number.isInteger(Number(draft.annualUnits))?'Annual units must be a whole number.':'')||
      nonnegativeFieldError(draft.averageUnitValue,'Average revenue / unit')||
      nonnegativeFieldError(draft.expectedSharePct,'Expected share',100);
    if(message){setEditError(message);return;}
    setEditError('');
    try{
      // "Our Company" is a designation on this same CRM record, never a new
      // customer/prospect or a separate duplicate internal company.
      const relationshipPatch:CompanyPatch=draft.isSelf
        ?companyRelationshipPatch(company,'partner')
        :draft.relationship==='unclassified'?{}
          :companyRelationshipPatch(company,draft.relationship as EditableCompanyRelationship);
      updateCompany(company.id, {
        name: draft.name.trim(),
        ...relationshipPatch,
        ...ourCompanyPatch({aliases:relationshipPatch.aliases??company.aliases},draft.isSelf),
        ...(draft.isSelf?{kind:'non-customer' as const}:{}),
        annualUnits: optionalNumber(draft.annualUnits),
        averageUnitValue: optionalNumber(draft.averageUnitValue),
        expectedSharePct: optionalNumber(draft.expectedSharePct),
      });
      setEditing(false);
      setNotice({kind:'applied',message:RECORD_CHANGE_APPLIED_MESSAGE});
    }catch(reason){setEditError(reason instanceof Error?reason.message:'Unable to apply company changes.');}
  };
  const newQuote = () => {
    const quoteId = createQuote({ title: 'Quote · ' + company.name, companyId: company.id, companyName: company.name });
    openQuote(quoteId);
  };
  const addAlias = (event: FormEvent) => {
    event.preventDefault();
    const alias = newAlias.trim();
    if (!alias || company.aliases?.some((existing) => existing.toLowerCase() === alias.toLowerCase())) return;
    updateCompany(company.id, { aliases: [...(company.aliases ?? []), alias] });
    setNewAlias('');
  };

  return <><RecordPageLayout entityType="company" title={company.name} onBack={onBack}
    subtitle={companyRelationshipLabel(company)}
    badge={<><span className={'connections-record-stage'+(isOurCompany(company)?' is-self-company':'')}>
      {isOurCompany(company)?'SELF · Our Company':companyRelationshipLabel(company)}
      </span><span>{related.relatedProjects.length} deals</span>
      <span>{related.relatedQuotes.length+externalQuotes.length} linked quotes</span></>}
    actions={<>
      <button type="button" onClick={() => {setNotice(null);setEditError('');setEditing(current=>!current);}}>
        {editing?'Cancel Edit Page':'Edit Page'}</button>
      <button type="button" onClick={()=>openActivityComposer({associations:[{
        type:'company',id:company.id,label:'Company · '+company.name,
      }]})}>Log Activity</button>
      <QuickCreate context={{kind:'company',id:company.id,name:company.name}} launcherLabel="+ New"/>
    </>}
    left={<>
      <RecordCard title="About this company">
        <RecordFormFeedback notice={notice}/>
        {editing ? <form className="connections-record-edit-form" noValidate onChange={()=>setEditError('')} onSubmit={saveCompany}>
          <RecordEditField label="Company name" required error={editError==='Enter a company name.'?editError:undefined}>
            {control=><input {...control} autoFocus value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/>}
          </RecordEditField>
          <details className="connections-company-advanced-identity">
            <summary>Company identity <span>{draft.isSelf?'· SELF':''}</span></summary>
            <label className="connections-company-self-compact">
              <input type="checkbox" checked={draft.isSelf}
                onChange={event=>setDraft({...draft,isSelf:event.target.checked})}/>
              This is our company
            </label>
          </details>
          {!draft.isSelf&&<label>Relationship<select value={draft.relationship}
            onChange={event=>setDraft({...draft,relationship:event.target.value as EditableCompanyRelationship})}>
            <option value="unclassified" disabled>Not classified</option>
            <option value="prospect">Prospect</option>
            <option value="customer">Customer</option>
            <option value="partner">Partner / other</option>
          </select></label>}
          <label>Annual units<input type="number" min="0" step="1" value={draft.annualUnits} onChange={(event) => setDraft({ ...draft, annualUnits: event.target.value })} /></label>
          <label>Average revenue / unit<input type="number" min="0" step="0.01" value={draft.averageUnitValue} onChange={(event) => setDraft({ ...draft, averageUnitValue: event.target.value })} /></label>
          <label>Expected share (%)<input type="number" min="0" max="100" step="0.1" value={draft.expectedSharePct} onChange={(event) => setDraft({ ...draft, expectedSharePct: event.target.value })} /></label>
          <RecordFormFeedback notice={editError&&editError!=='Enter a company name.'?{kind:'error',message:editError}:null}/>
          <div className="connections-record-form-actions ss-record-editor-actions">
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className="connections-record-primary">Save changes</button>
          </div>
        </form> : <div className="connections-record-properties-list">
          <RecordProperty label="Relationship">{companyRelationshipLabel(company)}</RecordProperty>
          <CrmOwnerControl kind="company" recordId={company.id} ownerUserId={company.ownerUserId} showChange={false}/>
          {isOurCompany(company)&&<span className="connections-company-self-inline">SELF · Linked to Our Organization</span>}
          <RecordProperty label="Created">{dateLabel(company.createdAt)}</RecordProperty>
          <RecordProperty label="Last updated">{dateLabel(company.updatedAt)}</RecordProperty>
        </div>}
        {editing&&<CrmOwnerControl kind="company" recordId={company.id} ownerUserId={company.ownerUserId}/>}
      </RecordCard>
      {company.kind === 'customer' && <RecordCard title="Account forecast">
        <div className="connections-record-properties-list">
          <RecordProperty label="Annual units">{company.annualUnits ?? 'Not set'}</RecordProperty>
          <RecordProperty label="Revenue / unit">{company.averageUnitValue === undefined ? 'Not set' : money.format(company.averageUnitValue)}</RecordProperty>
          <RecordProperty label="Expected share">{company.expectedSharePct === undefined ? 'Not set' : company.expectedSharePct + '%'}</RecordProperty>
          <RecordProperty label="Annual potential">{companyAnnualPotential(company) === undefined ? 'Not set' : money.format(companyAnnualPotential(company)!)}</RecordProperty>
          <RecordProperty label="Expected annual work">{companyEstimatedAnnualWork(company) === undefined ? 'Not set' : money.format(companyEstimatedAnnualWork(company)!)}</RecordProperty>
        </div>
      </RecordCard>}
      <RecordCard title="Known aliases">
        <div className="connections-record-aliases">
          {visibleCompanyAliases(company).map((alias) => <span key={alias}>{alias}
            <button type="button" aria-label={'Remove alias ' + alias} onClick={() => updateCompany(company.id, { aliases: (company.aliases ?? []).filter((item) => item !== alias) })}>×</button>
          </span>)}
          {!visibleCompanyAliases(company).length && <p className="connections-record-helper">No alternate names saved.</p>}
        </div>
        <form className="connections-record-alias-form" onSubmit={addAlias}>
          <input value={newAlias} onChange={(event) => setNewAlias(event.target.value)} aria-label="New company alias" placeholder="Add an alternate name" />
          <button type="submit" disabled={!newAlias.trim()}>Add</button>
        </form>
      </RecordCard>
    </>}
    center={<>
      <RecordCard title="Deals" extra={<span>{related.relatedProjects.length}</span>}>
        <div className="connections-record-entity-list">
          {related.relatedProjects.map((project) => <button type="button" key={project.id} onClick={() => openProject(project.id)}>
            <strong>{project.name}</strong><small>{project.stage}{project.dueDate ? ' · Due ' + dateLabel(project.dueDate) : ''}</small>
          </button>)}
          {!related.relatedProjects.length && <p className="connections-record-empty">No deals linked yet.</p>}
        </div>
        <RecordRelationshipPicker source={{kind:'company',id:company.id,name:company.name}} target="deal"/>
      </RecordCard>
      <RecordCard title="Quotes" extra={<span>{related.relatedQuotes.length+externalQuotes.length}</span>}>
        <div className="connections-record-entity-list">
          {related.relatedQuotes.map((quote) => <button type="button" key={quote.id} onClick={() => openQuote(quote.id)}>
            <strong>{quote.title || displayQuoteNumber(quote)}</strong>
            <small>SalesShop · {displayQuoteNumber(quote)} · {quote.status} · {money.format(quoteTotal(quote))}</small>
          </button>)}
          {externalQuotes.map(activity=><button type="button" key={activity.id}
            onClick={()=>setActivityPreviewId(activity.id)}
            aria-label={'View external quote details '+activity.summary}>
            <strong>External quote · {activity.metadata?.amount===undefined?'Value not recorded':money.format(activity.metadata.amount)}</strong>
            <small>{activity.metadata?.externalQuoteFormat||'Builder platform'} · Sent {activity.metadata?.bidSentDate||activity.occurredAt.slice(0,10)}</small>
          </button>)}
          {!related.relatedQuotes.length&&!externalQuotes.length&&
            <p className="connections-record-empty">No quotes linked yet. Create a SalesShop quote or record an external bid through a Deal.</p>}
        </div>
        <RecordRelationshipPicker source={{kind:'company',id:company.id,name:company.name}} target="quote"/>
      </RecordCard>

    </>}
    right={<>
      <RecordCard title={isOurCompany(company)?'People · Our Organization':'People'} extra={<span>{listedPeople.length}</span>}>
        <div className="connections-record-entity-list">
          {listedPeople.map((person) => <article key={person.id}>
            <button type="button" className="connections-person-entity-open" onClick={() => openPerson(person.id)}>
              <strong>{person.name || person.email || 'Unnamed contact'}</strong>
              <small>{isOurCompany(company)&&rosterGroupForContact(person,companies)?
                rosterGroupForContact(person,companies)==='employees'?'Employee · ':'Subcontractor · ':''}
                Open person →</small>
            </button>
            {person.title && <small>{person.title}</small>}
            {person.email && <a href={'mailto:' + person.email}>{person.email}</a>}
            {person.phone && <a href={'tel:' + person.phone}>{person.phone}</a>}
          </article>)}
          {!listedPeople.length && <p className="connections-record-empty">No people linked yet.</p>}
        </div>
        <RecordRelationshipPicker source={{kind:'company',id:company.id,name:company.name}} target="person"/>
      </RecordCard>
      <RecordTasksPanel kind="company" id={company.id} name={company.name}/>

      <RecordCard title="Relationship history" extra={<span>{timeline.length} events</span>}>
        <CompanyRelationshipTimeline items={timeline} onOpenTarget={target=>{
          if(target.kind==='activity'){setActivityPreviewId(target.id);return;}
          if(target.kind==='person')openPerson(target.id);
          if(target.kind==='deal')openProject(target.id);
          if(target.kind==='quote')openQuote(target.id);
          if(target.kind==='task')requestTaskModal({mode:'preview',id:target.id});
        }}/>
      </RecordCard>
    </>}
  />
  {activityPreviewId&&<CalendarActivityPreview activityId={activityPreviewId}
    onClose={()=>setActivityPreviewId(null)}
    onSelect={(kind,id)=>{
      setActivityPreviewId(null);
      if(kind==='person')openPerson(id);
      else if(kind==='deal')openProject(id);
      else if(kind==='quote')openQuote(id);
      else if(kind==='company')openCompany(id);
    }}/>}
  </>;
}
