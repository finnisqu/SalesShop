import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RecordPageLayout, RecordCard, RecordProperty } from './RecordPageLayout';
import {RecordInlineProperty} from './RecordInlineProperty';
import {RecordActionsMenu} from './RecordActionsMenu';
import {RecordRecentsPanel} from './RecordRecentsPanel';
import {RecordTabbedGroup372} from './RecordTabbedGroup372';
import {RecordContactIcon374} from './RecordContactIcon374';
import {RecordNotebookPanel374} from './RecordNotebookPanel374';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {QuickCreate} from './QuickCreate';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import {RecordRelationshipPicker} from './RecordRelatedActions';
import {RecordUnlinkAction} from './RecordUnlinkAction';
import {UnifiedRecordPicker} from './UnifiedRecordPicker';
import {RecordTasksPanel} from './RecordTasksPanel';
import {RecordEmailThreadsPanel} from './RecordEmailThreadsPanel';
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

export function PersonRecordPage({ contactId, onBack, backLabel }: { contactId: string; onBack: () => void; backLabel?: string }) {
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
  const openNotebookPage=useNavigationStore(state=>state.openNotebookPage);
  const openPerson=useNavigationStore((state)=>state.openPerson);

  const mode=useAuthStore(state=>state.mode),org=useAuthStore(state=>state.organizationId),
    userId=useAuthStore(state=>state.user?.id),role=useAuthStore(state=>state.teamRole),
    department=useAuthStore(state=>state.teamDepartment);
  const perspective=useRolePerspectiveStore(state=>state.activePerspective);
  const canEditRecord=!perspective&&(mode==='local'||Boolean(org&&userId&&
    canEditTeamArea(role,department,'crm')));
  const person = people.find((candidate) => candidate.id === contactId);
  const [editing, setEditing] = useState(false);
  const [unlinking,setUnlinking]=useState(false);
  const [unlinkingQuotes,setUnlinkingQuotes]=useState(false);
  const [activityPreviewId,setActivityPreviewId]=useState<string|null>(null);
  const [editError,setEditError]=useState('');
  const [newCompanyName,setNewCompanyName]=useState('');
  const [notice,setNotice]=useState<RecordFormNotice|null>(null);
  useEffect(()=>{if(!canEditRecord){setEditing(false);setUnlinking(false);setUnlinkingQuotes(false);}},[canEditRecord]);
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
    setEditing(false);setUnlinking(false);setUnlinkingQuotes(false);
    setActivityPreviewId(null);
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
    if(!canEditRecord){setEditError('You no longer have permission to edit this Person.');return;}
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

  return <><RecordPageLayout entityType="person" recordKey={person.id} title={displayName} onBack={onBack} backLabel={backLabel}
    subtitle={[person.title, isInternal?(ownCompany?.name??'Our Organization'):related.company?.name].filter(Boolean).join(' · ') || 'Contact'}
    badge={isInternal?<span>Internal contact</span>:null}
     headerShortcuts={<>
       {person.email&&<a href={'mailto:'+person.email.trim()} aria-label={'Email '+displayName} title="Email Person"><RecordContactIcon374 kind="email"/></a>}
       {person.phone&&<a href={'tel:'+person.phone.replace(/[^0-9+*#]/g,'')} aria-label={'Call '+displayName} title="Call Person"><RecordContactIcon374 kind="call"/></a>}
       {person.phone&&<a href={'sms:'+person.phone.replace(/[^0-9+*#]/g,'')} aria-label={'Text '+displayName} title="Text Person"><RecordContactIcon374 kind="text"/></a>}
       {canEditRecord&&<button type="button" title="Log Activity with this Person"
         aria-label={'Log Activity with '+displayName}
         onClick={()=>openActivityComposer({associations:[{
          type:'contact',id:person.id,label:'Person · '+displayName,
         }]})}><RecordContactIcon374 kind="activity"/></button>}
     </>}
    actions={<>
      {canEditRecord&&!isOurOrgContact(person,companies)&&<RecordActionsMenu
    onDelete={async()=>{await useCrmStore.getState().deleteContact(person.id);onBack();}}/>}
    <QuickCreate context={{kind:'person',id:person.id,name:displayName}} launcherLabel="+ New"/>
    </>}
    left={<>
 <RecordTabbedGroup372 title={displayName} initialTab="about" items={[
 {id:'about',label:'About',tools:canEditRecord?<button type="button" onClick={()=>{setNotice(null);setEditError('');
    if(editing)setNewCompanyName('');setEditing(v=>!v);
   }}>{editing?'Cancel editing':'Edit details'}</button>:undefined,
  content:<>
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
          <RecordInlineProperty label="Name" value={person.name}
            display={displayName} disabled={!canEditRecord}
            validate={value=>!value.trim()&&!person.email?'Enter a name or email.':undefined}
            onSave={value=>updateContact(person.id,{name:value.trim()})}/>
          <RecordInlineProperty label="Job title" value={person.title??''}
            disabled={!canEditRecord}
            onSave={value=>updateContact(person.id,{title:value.trim()||undefined})}/>
          <RecordInlineProperty label="Email" type="email" value={person.email??''}
            disabled={!canEditRecord}
             validate={value=>recordEmailError(value)||
               (!value.trim()&&!person.name.trim()?'Enter a name or email.':undefined)}
            onSave={value=>updateContact(person.id,{email:value.trim()||undefined})}/>
          <RecordInlineProperty label="Phone" value={person.phone??''}
            disabled={!canEditRecord}
            onSave={value=>updateContact(person.id,{phone:value.trim()||undefined})}/>
          <RecordProperty label="Company">{associatedOwnCompany?.name??(isInternal&&rosterGroupForContact(person,companies)==='employees'?
              'Our Organization':related.company?.name||'Not assigned')}</RecordProperty>
          <CrmOwnerControl kind="contact" recordId={person.id} ownerUserId={person.ownerUserId}/>
          <RecordProperty label="Created">{dateLabel(person.createdAt)}</RecordProperty>
          <RecordProperty label="Updated">{dateLabel(person.updatedAt)}</RecordProperty>
        </div>}
      </RecordCard>
 </>},
 
 {id:'email',label:'Email',content:<>
<RecordEmailThreadsPanel kind="person" id={person.id} email={person.email}/>
 </>},
 {id:'notebook',label:'Notebook',content:<>
<RecordNotebookPanel374 kind="person" id={person.id} title={displayName} onOpenPage={openNotebookPage}/>
 </>},

 ]}/>
 </>}
 center={<>
      <RecordTabbedGroup372 title="Connections" items={[
 {id:'deals',label:'Deals',count:related.linkedDeals.length,tools:canEditRecord?<button type="button" onClick={()=>setUnlinking(v=>!v)}>{unlinking?'Done managing links':'Manage links'}</button>:undefined,
  content:<>
<RecordCard title="Deals" extra={<span>{related.linkedDeals.length} via Quotes</span>}>
        {related.linkedDeals.length>0&&<div className="connections-record-entity-list">
          {related.linkedDeals.map(({ project, quoteCount }) =>
            <button type="button" key={project.id} onClick={() => openProject(project.id)}>
              <strong>{project.name}</strong>
              <small>Quote contact · {quoteCount} {quoteCount === 1 ? 'linked quote' : 'linked quotes'} →</small>
            </button>)}
          </div>}
        <PersonDealRelationships personId={person.id} deals={projects} onOpenDeal={openProject} editing={unlinking}/>
      </RecordCard>
 </>},
 {id:'tasks',label:'Tasks',tools:canEditRecord?<button type="button" onClick={()=>setUnlinking(v=>!v)}>{unlinking?'Done managing links':'Manage links'}</button>:undefined,
  content:<>
<RecordTasksPanel kind="person" id={person.id} name={displayName} editing={editing||unlinking}/>
 </>},
 {id:'company',label:'Company',tools:canEditRecord?<button type="button" onClick={()=>setUnlinking(v=>!v)}>{unlinking?'Done managing links':'Manage links'}</button>:undefined,
  content:<>
<RecordCard title="Company">
        {(related.company||associatedOwnCompany) ? <div className="connections-record-entity-list">
          {associatedOwnCompany&&<button type="button" onClick={()=>openCompany(associatedOwnCompany.id)}>
            <strong>{associatedOwnCompany.name} · SELF</strong>
            <small>Our Organization · View company record →</small>
          </button>}
          {related.company&&!isOurOrgCompany(related.company)&&related.company.id!==associatedOwnCompany?.id&&
           <div className="ss-record-associated-row">
             <button type="button" onClick={()=>openCompany(related.company!.id)}>
               <strong>{related.company.name}</strong>
               <small>{isInternal?'Subcontractor firm':'Associated company'} · View company record →</small>
             </button>
             {unlinking&&!isInternal&&<RecordUnlinkAction source={{kind:'person',id:person.id,name:displayName}}
               target={{kind:'company',id:related.company.id,name:related.company.name}}/>}
           </div>}
          {isInternal&&!associatedOwnCompany&&<p className="connections-record-helper">
            Listed in Our Organization. Mark your company SELF to connect its record automatically.
          </p>}
        </div> : <p className="connections-record-empty">No company assigned yet.</p>}
        {!isInternal&&<>
          <RecordRelationshipPicker source={{kind:'person',id:person.id,name:displayName}} target="company"/>
        </>}
        {isInternal&&<p className="connections-record-helper">
          Change an internal Person's Company from Our Organization to preserve their roster membership.</p>}
      </RecordCard>
 </>},
 ]}/>
    </>}
    right={<>
<RecordRecentsPanel
        quoteCount={quotes.filter(q=>!q.archivedAt&&q.contactId===person.id).length}
        activityCount={related.directActivities.length} quotes={<>
       {canEditRecord&&quotes.some(q=>!q.archivedAt&&q.contactId===person.id)&&
        <div className="ss-record-local-actions">
         <button type="button" onClick={()=>setUnlinkingQuotes(v=>!v)}>
          {unlinkingQuotes?'Done managing Quote links':'Manage Quote links'}</button>
        </div>}
        <div className="connections-record-entity-list">
        {quotes.filter(q=>!q.archivedAt&&q.contactId===person.id).map(q=><div
          className="ss-record-associated-row" key={q.id}>
          <button type="button" onClick={()=>openQuote(q.id)}>
            <strong>{q.title||displayName+' quote'}</strong>
            <small>{q.status} · Open quote →</small>
          </button>
          {unlinkingQuotes&&<RecordUnlinkAction source={{kind:'person',id:person.id,name:displayName}}
            target={{kind:'quote',id:q.id,name:q.title||displayName+' quote'}}/>}
         </div>)}
        {!quotes.some(q=>!q.archivedAt&&q.contactId===person.id)&&
         <p className="connections-record-empty">No Quotes have this Person as their primary contact.</p>}
       </div>
       <RecordRelationshipPicker source={{kind:'person',id:person.id,name:displayName}} target="quote"/>
      </>} activities={<div className="ss-record-recent-activity-list">
        {related.directActivities.slice(0,12).map(activity=>
          <button type="button" key={activity.id} onClick={()=>setActivityPreviewId(activity.id)}>
            <strong>{activity.summary}</strong><small>{dateLabel(activity.occurredAt)}</small>
          </button>)}
        {!related.directActivities.length&&<p className="connections-record-empty">No Activities recorded yet.</p>}
      </div>} history={<>
<div className="ss-record-history-timeline" aria-label="Person activity and relationship history">
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
 {!related.directActivities.length&&<p className="connections-record-empty">No linked history yet.</p>}
 </div>
 </>} historyCount={related.directActivities.length}/>
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
