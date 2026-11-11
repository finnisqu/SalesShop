import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RecordPageLayout, RecordCard, RecordProperty } from './RecordPageLayout';
import {RecordRelationshipPicker} from './RecordRelatedActions';
import {UnifiedRecordPicker} from './UnifiedRecordPicker';
import {RecordTasksPanel} from './RecordTasksPanel';
import {CalendarActivityPreview} from './CalendarActivityPreview';
import {PersonDealRelationships} from './DealPersonRelationships';
import {RecordEditField,RecordFormFeedback,RECORD_CHANGE_APPLIED_MESSAGE,recordEmailError,type RecordFormNotice} from './RecordFormFeedback';
import { personRecordView } from '../services/personRecordView';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import { useNavigationStore } from '../store/navigationStore';
import {isOurOrgCompany,isOurOrgContact,rosterGroupForContact} from '../services/ourOrganizationDirectory';
import {isOurCompany,companyRelationshipPatch} from '../services/companyRelationship';
import {CrmOwnerControl} from './CrmOwnerControl';

const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

export function PersonRecordPage({ contactId, onBack }: { contactId: string; onBack: () => void }) {
  const hydrated = useCrmStore((state) => state.hydrated);
  const people = useCrmStore((state) => state.contacts);
  const companies = useCrmStore((state) => state.companies);
  const activities = useCrmStore((state) => state.activities);
  const projects = useCrmStore((state) => state.projects);
  const quotes = useQuoteStore((state) => state.quotes);
  const hydrateQuotes = useQuoteStore((state) => state.hydrate);
  const updateContact = useCrmStore((state) => state.updateContact);
  const resolveCompany = useCrmStore((state) => state.resolveCompany);
  const updateCompany = useCrmStore((state) => state.updateCompany);
  const openCompany = useNavigationStore((state) => state.openCompany);
  const openProject = useNavigationStore((state) => state.openProject);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const openPerson=useNavigationStore((state)=>state.openPerson);

  const person = people.find((candidate) => candidate.id === contactId);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activityPreviewId,setActivityPreviewId]=useState<string|null>(null);
  const [editError,setEditError]=useState('');
  const [newCompanyName,setNewCompanyName]=useState('');
  const [notice,setNotice]=useState<RecordFormNotice|null>(null);
  const [draft, setDraft] = useState({
    name: person?.name ?? '', email: person?.email ?? '', phone: person?.phone ?? '',
    title: person?.title ?? '', companyId: person?.companyId ?? '',
  });
  const related = useMemo(
    () => person ? personRecordView(person, companies, activities, projects, quotes) : null,
    [person, companies, activities, projects, quotes],
  );
  useEffect(() => { hydrateQuotes(); }, [hydrateQuotes]);

  useEffect(() => {
    setEditing(false);
    setHistoryOpen(false);setActivityPreviewId(null);
    setNewCompanyName('');
    setEditError('');setNotice(null);
  }, [contactId]);
  useEffect(() => {
    if (!editing && person) {
      setNewCompanyName('');
      setDraft({
        name: person.name, email: person.email ?? '', phone: person.phone ?? '',
        title: person.title ?? '', companyId: person.companyId ?? '',
      });
    }
  }, [person, editing]);

  if (!hydrated) return <section className="connections-record-missing" role="status">Loading person record…</section>;
  if (!person || !related) return <section className="connections-record-missing" role="status">
    <h1>Person not available</h1>
    <p>This record may have been removed or you may not have access to it.</p>
    <button type="button" onClick={onBack}>Back to People</button>
  </section>;

  const save = (event: FormEvent) => {
    event.preventDefault();
    const name=draft.name.trim()||draft.email.trim();
    if(!name){setEditError('Enter a name or email.');return;}
    const emailError=recordEmailError(draft.email);
    if(emailError){setEditError(emailError);return;}
    setEditError('');
    try{
      let companyId=draft.companyId||undefined;
      if(newCompanyName.trim()){
        // New names are staged until Save so Cancel never leaves an orphan Company.
        const clean=newCompanyName.trim();
        const currentCompanies=useCrmStore.getState().companies;
        const knownIds=new Set(currentCompanies.map(item=>item.id));
        if(currentCompanies.some(item=>item.name.trim().toLowerCase()===clean.toLowerCase()))
          throw new Error('That Company already exists. Select it from search instead.');
        const createdId=resolveCompany(clean,'customer');
        if(!createdId||knownIds.has(createdId))
          throw new Error('A matching Company already exists. Choose it from search.');
        const created=useCrmStore.getState().companies.find(item=>item.id===createdId);
        if(created)updateCompany(createdId,companyRelationshipPatch(created,'prospect'));
        companyId=createdId;
      }else if(companyId&&!useCrmStore.getState().companies.some(item=>item.id===companyId)){
        throw new Error('Selected Company is no longer available. Choose another one.');
      }
      updateContact(person.id, {
        name,email:draft.email.trim(),phone:draft.phone.trim(),
        title:draft.title.trim(),companyId,
      });
      setNewCompanyName('');
      setEditing(false);
      setNotice({kind:'applied',message:RECORD_CHANGE_APPLIED_MESSAGE});
    }catch(reason){setEditError(reason instanceof Error?reason.message:'Unable to apply person changes.');}
  };
  const displayName = person.name || person.email || 'Unnamed contact';
  const isInternal=isOurOrgContact(person,companies);
  const ownCompany=companies.find(isOurCompany);
  const associatedOwnCompany=isInternal?ownCompany:undefined;

  return <><RecordPageLayout entityType="person" title={displayName} onBack={onBack}
    subtitle={[person.title, isInternal?(ownCompany?.name??'Our Organization'):related.company?.name].filter(Boolean).join(' · ') || 'Contact'}
    badge={<span>{isInternal?'Internal contact':related.company?'Associated company':'Unassigned'}</span>}
    actions={<button type="button" onClick={() => {
      setNotice(null);setEditError('');
      if(editing)setNewCompanyName('');
      setEditing(value=>!value);
    }}>
      {editing ? 'Cancel editing' : 'Edit person'}
    </button>}
    left={<>
      <RecordCard title="About this person">
        <RecordFormFeedback notice={notice}/>
        {editing ? <form className="connections-record-edit-form" noValidate onChange={()=>setEditError('')} onSubmit={save}>
          <RecordEditField label="Name" error={editError==='Enter a name or email.'?editError:undefined}
            help="A name or email is required for this contact.">
            {control=><input {...control} autoFocus value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/>}
          </RecordEditField>
          <RecordEditField label="Email" error={editError==='Enter a valid email address.'?editError:undefined}>
            {control=><input {...control} type="email" value={draft.email} onChange={event=>setDraft({...draft,email:event.target.value})}/>}
          </RecordEditField>
          <label>Phone<input type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></label>
          <label>Job title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <div className="ss-record-association-field" role="group" aria-label="Person Company">
            <strong className="ss-record-association-label">Company</strong>
            <div className="ss-record-association-current">
              <span>{newCompanyName
                ?'New Company · '+newCompanyName+' (created when Person is saved)'
                :companies.find(item=>item.id===draft.companyId)?.name||
                  (draft.companyId?'Company unavailable':'Unassigned company')}</span>
              {(draft.companyId||newCompanyName)&&<button type="button"
                aria-label="Clear Person Company" onClick={()=>{
                  setNewCompanyName('');setDraft(previous=>({...previous,companyId:''}));
                }}>Clear</button>}
            </div>
            <UnifiedRecordPicker kind="Company"
              triggerLabel={draft.companyId||newCompanyName?'Change Company':'Search or add Company'}
              items={companies.filter(item=>!isOurOrgCompany(item)||item.id===draft.companyId)
                .slice().sort((a,b)=>a.name.localeCompare(b.name))
                .map(item=>({id:item.id,name:item.name,detail:item.aliases?.join(', ')||undefined}))}
              onLink={id=>{setNewCompanyName('');
                setDraft(previous=>({...previous,companyId:id}));}}
              onCreate={name=>{setNewCompanyName(name.trim());
                setDraft(previous=>({...previous,companyId:''}));}}
              helper="Search existing Companies or create one on Save changes. Canceling creates nothing."/>
          </div>
          <RecordFormFeedback notice={editError&&!['Enter a name or email.','Enter a valid email address.'].includes(editError)?{kind:'error',message:editError}:null}/>
          <div className="connections-record-form-actions ss-record-editor-actions">
            <button type="button" onClick={() => {setNewCompanyName('');setEditing(false);}}>Cancel</button>
            <button type="submit" className="connections-record-primary">Save changes</button>
          </div>
        </form> : <div className="connections-record-properties-list">
          <RecordProperty label="Name">{displayName}</RecordProperty>
          <RecordProperty label="Job title">{person.title || 'Not set'}</RecordProperty>
          <RecordProperty label="Email">{person.email || 'Not set'}</RecordProperty>
          <RecordProperty label="Phone">{person.phone || 'Not set'}</RecordProperty>
          <RecordProperty label="Company">{associatedOwnCompany?.name??(isInternal&&rosterGroupForContact(person,companies)==='employees'?
              'Our Organization':related.company?.name||'Not assigned')}</RecordProperty>
          <CrmOwnerControl kind="contact" recordId={person.id} ownerUserId={person.ownerUserId}/>
          <RecordProperty label="Created">{dateLabel(person.createdAt)}</RecordProperty>
          <RecordProperty label="Updated">{dateLabel(person.updatedAt)}</RecordProperty>
        </div>}
      </RecordCard>
    </>}
    center={<>
      <RecordCard title="Company">
        {(related.company||associatedOwnCompany) ? <div className="connections-record-entity-list">
          {associatedOwnCompany&&<button type="button" onClick={()=>openCompany(associatedOwnCompany.id)}>
            <strong>{associatedOwnCompany.name} · SELF</strong>
            <small>Our Organization · View company record →</small>
          </button>}
          {related.company&&!isOurOrgCompany(related.company)&&related.company.id!==associatedOwnCompany?.id&&
           <button type="button" onClick={()=>openCompany(related.company!.id)}>
             <strong>{related.company.name}</strong>
             <small>{isInternal?'Subcontractor firm':'Associated company'} · View company record →</small>
           </button>}
          {isInternal&&!associatedOwnCompany&&<p className="connections-record-helper">
            Listed in Our Organization. Mark your company SELF to connect its record automatically.
          </p>}
        </div> : <p className="connections-record-empty">No company is assigned. Select Edit person to associate one.</p>}
        {!isInternal&&<>
          <RecordRelationshipPicker source={{kind:'person',id:person.id,name:displayName}} target="company"/>
        </>}
        {isInternal&&<p className="connections-record-helper">
          Change an internal Person's Company from Our Organization to preserve their roster membership.</p>}
      </RecordCard>
      <RecordCard title="Deals" extra={<span>{related.linkedDeals.length} via Quotes</span>}>
        <p className="connections-record-helper">These links mean this person was explicitly selected on a quote. They do not imply a wider role on the deal.</p>
        <div className="connections-record-entity-list">
          {related.linkedDeals.map(({ project, quoteCount }) =>
            <button type="button" key={project.id} onClick={() => openProject(project.id)}>
              <strong>{project.name}</strong>
              <small>Quote contact · {quoteCount} {quoteCount === 1 ? 'linked quote' : 'linked quotes'} →</small>
            </button>)}
          {!related.linkedDeals.length && <p className="connections-record-empty">No deals explicitly linked through this person's quotes.</p>}
        </div>
        <PersonDealRelationships personId={person.id} deals={projects} onOpenDeal={openProject}/>
      </RecordCard>
      <RecordCard title="Quotes" extra={<span>{quotes.filter(q=>!q.archivedAt&&q.contactId===person.id).length}</span>}>
       <div className="connections-record-entity-list">
        {quotes.filter(q=>!q.archivedAt&&q.contactId===person.id).map(q=><button
          type="button" key={q.id} onClick={()=>openQuote(q.id)}>
          <strong>{q.title||displayName+' quote'}</strong>
          <small>{q.status} · Open quote →</small>
         </button>)}
        {!quotes.some(q=>!q.archivedAt&&q.contactId===person.id)&&
         <p className="connections-record-empty">No Quotes have this Person as their primary contact.</p>}
       </div>
       <RecordRelationshipPicker source={{kind:'person',id:person.id,name:displayName}} target="quote"/>
      </RecordCard>
    </>}
    right={<>
      <RecordTasksPanel kind="person" id={person.id} name={displayName}/>
      <RecordCard title="Contact details">
        <div className="connections-person-contact-actions">
          {person.email ? <a href={'mailto:' + person.email}>✉ Email</a> : <span>Email not provided</span>}
          {person.phone ? <a href={'tel:' + person.phone}>☎ Call</a> : <span>Phone not provided</span>}
        </div>
        <p className="connections-record-helper">Opening your email or phone app does not automatically log an activity.</p>
      </RecordCard>
      <section className="connections-record-panel connections-record-history">
        <button type="button" className="connections-history-toggle" aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((value) => !value)}>
          <span>Activity history</span><small>{historyOpen ? 'Hide' : 'View'} <span aria-hidden="true">{historyOpen ? '▴' : '▾'}</span></small>
        </button>
        {historyOpen && <div className="connections-record-panel-body">
          <p className="connections-record-helper">Only events explicitly linked to this person appear here.</p>
          <ol className="connections-record-timeline">
            {related.directActivities.map((activity) => <li key={activity.id}>
              <div><button type="button" className="connections-activity-history-open"
                onClick={()=>setActivityPreviewId(activity.id)}
                aria-label={'View Activity details: '+activity.summary}>
                <strong>{activity.summary}</strong>
              </button><time dateTime={activity.occurredAt}>{dateLabel(activity.occurredAt)}</time></div>
              <small>{activity.type.replaceAll('-', ' ')}</small>
              {activity.quoteId && <button type="button" onClick={() => openQuote(activity.quoteId!)}>Open linked quote →</button>}
              {!activity.quoteId && activity.projectId && <button type="button" onClick={() => openProject(activity.projectId!)}>Open linked deal →</button>}
            </li>)}
          </ol>
          {!related.directActivities.length && <p className="connections-record-empty">No directly linked history on this contact.</p>}
        </div>}
      </section>
    </>}
  />
  {activityPreviewId&&<CalendarActivityPreview activityId={activityPreviewId}
    onClose={()=>setActivityPreviewId(null)}
    onSelect={(kind,id)=>{
      setActivityPreviewId(null);
      if(kind==='person')openPerson(id);
      else if(kind==='company')openCompany(id);
      else if(kind==='deal')openProject(id);
      else if(kind==='quote')openQuote(id);
    }}/>}
  </>;
}
