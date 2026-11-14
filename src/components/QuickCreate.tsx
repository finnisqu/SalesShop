import { useRef, useState, type FormEvent } from 'react';
import {useModalScrollLock} from '../lib/useModalScrollLock';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {MobileSheetHandle} from './MobileSheetHandle';
import { createPortal } from 'react-dom';
import { useCrmStore } from '../store/crmStore';
import { useNavigationStore } from '../store/navigationStore';
import { useNotebookStore } from '../store/notebookStore';
import {requestTaskModal} from './TaskModalHost';
import {openGuidedQuoteCreation} from '../services/quoteCreationNavigation';
import {ExternalQuoteBackfillDialog} from './ExternalQuoteBackfillDialog';
import {useAuthStore} from '../store/authStore';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {canEditTeamArea} from '../services/teamDepartments';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import type {TaskAssociation} from '../store/personalTaskStore';
import {useDealPeopleStore,dealPeopleScope} from '../store/dealPeopleStore';
import {setNotebookRelatedRecord} from '../services/notebookProjectContext';

export type RecordCreateContext={kind:'company'|'person'|'deal';id:string;name:string};
type NamedCreateMode = 'project' | 'account' | null;
export function contextTaskAssociation(context:RecordCreateContext):TaskAssociation{
  const type=context.kind==='deal'?'project':context.kind==='person'?'contact':'company';
  return {type,id:context.id,label:(context.kind==='deal'?'Deal':context.kind==='person'?'Person':'Company')+' · '+context.name};
}
type QuickCreateGlyph = 'quote'|'external'|'task'|'activity'|'deal'|'account'|'notebook';
function CreateGlyph({kind}:{kind:QuickCreateGlyph}){
 return <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
  stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
  strokeLinejoin="round" aria-hidden="true">
  {kind==='quote'?<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></>:
   kind==='external'?<><rect x="3" y="7" width="12" height="14" rx="2"/><path d="M7 11h4M7 15h4M15 3h6v6M21 3l-8 8"/></>:
   kind==='task'?<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/></>:
   kind==='activity'?<><path d="M5 3h3l2.1 5.2-2.3 2.1a16 16 0 0 0 6 6l2.1-2.3L21 16v3.1a2 2 0 0 1-2.2 2C10.6 20.4 3.6 13.4 3 5.2A2 2 0 0 1 5 3Z"/></>:
   kind==='deal'?<><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>:
   kind==='account'?<><path d="M4 21V5l8-3 8 3v16M2 21h20M9 21v-5h6v5M8 8h1M15 8h1M8 12h1M15 12h1"/></>:
   <><rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18M12 8h5M12 12h5M12 16h3"/></>}
 </svg>;
}

export function QuickCreate({context,launcherLabel}:{context?:RecordCreateContext;launcherLabel?:string}={}) {
  const [open, setOpen] = useState(false);
  const [namedMode, setNamedMode] = useState<NamedCreateMode>(null);
  const [name, setName] = useState('');
  const [namedCreateError,setNamedCreateError]=useState('');
  const [pendingCreated,setPendingCreated]=useState<{id:string;kind:'project'|'account'}|null>(null);
  const namedCreatePending=useRef(false);
  const [namedCreateSaving,setNamedCreateSaving]=useState(false);
  const [recordExternalOpen,setRecordExternalOpen]=useState(false);
  const authMode=useAuthStore(s=>s.mode);
  const organizationId=useAuthStore(s=>s.organizationId);
  const userId=useAuthStore(s=>s.user?.id);
  const teamRole=useAuthStore(s=>s.teamRole);
  const department=useAuthStore(s=>s.teamDepartment);
  const previewRole=useRolePerspectiveStore(s=>s.activePerspective);
  const canRecordExternal=authMode==='local'||(!previewRole&&
    Boolean(organizationId&&userId&&canEditTeamArea(teamRole,department,'crm')));

  const createProject = useCrmStore((state) => state.createProject);
  const setProjectCompany = useCrmStore((state)=>state.setProjectCompany);
  const updateContact = useCrmStore((state)=>state.updateContact);
  const resolveCompany = useCrmStore((state) => state.resolveCompany);
  const createEntry = useNotebookStore((state) => state.createEntry);
  const openProject = useNavigationStore((state) => state.openProject);
  const openCompany = useNavigationStore((state) => state.openCompany);
  const setView = useNavigationStore((state) => state.setView);

  const close = () => {
    // A Deal and its direct Person link are one user-facing operation.
    // Prevent dismissing this dialog before the async link result is known.
    if(namedCreatePending.current&&!pendingCreated)return;
    setOpen(false);
    setNamedMode(null);
    setName('');
    setNamedCreateError('');
    setPendingCreated(null);
  };
  useModalScrollLock(open);
  const sheetRef=useDismissibleLayer<HTMLElement>(open,close);

  const openDocumentPicker = () => {
    close();
    openGuidedQuoteCreation(context);
  };

  const startExternalQuote = () => {
    if(!canRecordExternal)return;
    close();
    setRecordExternalOpen(true);
  };

  const startTask = () => {
    close();
    requestTaskModal({mode:'create',...(context?{associations:[contextTaskAssociation(context)]}:{})});
  };

  const startActivity = () => {
    close();
    // Reuse the one account-scoped CRM Activity editor mounted by App.
    // Don't navigate away or create a second draft-bearing form.
    openActivityComposer(context?{associations:[contextTaskAssociation(context)]}:{});
  };

  const makeNotebookPage = () => {
    createEntry();
    const pageId=useNotebookStore.getState().activeEntryId;
    if(context&&pageId)setNotebookRelatedRecord(pageId,context);
    close();
    setView('notebook');
  };

  const openPendingCreated=()=>{
    if(!pendingCreated)return;
    const saved=pendingCreated;
    close();
    if(saved.kind==='project')openProject(saved.id);
    else openCompany(saved.id);
  };

  const submitNamedCreate = async (event: FormEvent) => {
    event.preventDefault();
    // Do not create a second record from Enter + click before the dialog closes.
    if(namedCreatePending.current||pendingCreated)return;
    const clean=name.trim();
    if(!clean||!namedMode)return;
    namedCreatePending.current=true;
    setNamedCreateSaving(true);
    setNamedCreateError('');
    let createdId:string|undefined;
    try{
      if(namedMode==='project'){
        // A contextual Deal started from a Person must not appear linked
        // until the shared Deal-Person row is available and acknowledged.
        // Preload the store before creating anything to avoid orphan Deals.
        let personLinkScope:string|null=null;
        if(context?.kind==='person'){
          if(!useCrmStore.getState().contacts.some(item=>item.id===context.id))
            throw new Error('This Person is no longer available. Reopen their record and try again.');
          personLinkScope=dealPeopleScope(authMode,organizationId);
          if(!personLinkScope)throw new Error('The Person link workspace is unavailable.');
          const current=useDealPeopleStore.getState();
          if(current.scope!==personLinkScope||!current.loaded)
            await current.load(personLinkScope);
          const latest=useDealPeopleStore.getState();
          if(latest.scope!==personLinkScope||!latest.loaded)
            throw new Error(latest.error||'Deal contacts are unavailable. Retry after they load.');
        }
        const projectId=createProject(clean);
        if(!projectId)throw new Error('Could not create the Deal. Check its name and try again.');
        createdId=projectId;
        if(context?.kind==='company')setProjectCompany(projectId,context.id);
        if(context?.kind==='person'){
          const person=useCrmStore.getState().contacts.find(item=>item.id===context.id);
          if(person?.companyId)setProjectCompany(projectId,person.companyId);
          const links=useDealPeopleStore.getState();
          if(!personLinkScope||links.scope!==personLinkScope||!links.loaded)
            throw new Error('Deal contacts changed workspace. Open the new Deal and link this Person.');
          await links.add(projectId,context.id);
        }
        if(context?.kind==='deal'){
          const parent=useCrmStore.getState().projects.find(item=>item.id===context.id);
          if(parent?.companyId)setProjectCompany(projectId,parent.companyId);
        }
        namedCreatePending.current=false;
        close();
        openProject(projectId);
        return;
      }
      const companyId=resolveCompany(clean,'customer');
      if(!companyId)throw new Error('Could not create the Account. Check its name and try again.');
      createdId=companyId;
      if(context?.kind==='person')updateContact(context.id,{companyId});
      if(context?.kind==='deal')setProjectCompany(context.id,companyId);
      namedCreatePending.current=false;
      close();
      openCompany(companyId);
    }catch(reason){
      const message=reason instanceof Error?reason.message:'Could not create this record.';
      if(createdId){
        // Creation succeeded even if an association failed. Offer a route to
        // the existing record instead of permitting a duplicate retry.
        setPendingCreated({id:createdId,kind:namedMode});
        setNamedCreateError('Record created, but a related link may be incomplete. Open it to review. '+message);
      }else{
        namedCreatePending.current=false;
        setNamedCreateError(message);
      }
    }finally{setNamedCreateSaving(false);}
  };

  const sheet = open ? createPortal(
    <div className="quick-create-backdrop ss-mobile-sheet-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={sheetRef} className="quick-create-sheet ss-mobile-sheet" role="dialog" aria-modal="true" aria-label="Create in SalesShop">
        <MobileSheetHandle onClose={close} disabled={namedCreateSaving}/>
        <header className="quick-create-header">
          <div><span>Quick create</span><strong>{namedMode ? `New ${namedMode === 'project' ? 'deal' : 'account'}` : 'What are you working on?'}</strong></div>
          <button type="button" onClick={close} disabled={namedCreateSaving} aria-label="Close quick create">×</button>
        </header>

        {namedMode ? (
          <form className="quick-create-name-form ss-mobile-sheet-body" onSubmit={event=>{void submitNamedCreate(event);}}>
            <label>
              <span>{namedMode === 'project' ? 'Deal name' : 'Account / company name'}</span>
              <input autoFocus={typeof window!=='undefined'&&window.matchMedia('(min-width:761px)').matches}
                value={name} disabled={namedCreateSaving||Boolean(pendingCreated)}
                onChange={(event) => {setName(event.target.value);setNamedCreateError('');}}
                placeholder={namedMode === 'project' ? 'e.g. Parkside Apartments' : 'e.g. DeVane Builders'} />
            </label>
            {namedCreateError&&<p className="quick-create-error" role="alert">{namedCreateError}</p>}
            <div>
              <button type="button" className="quick-create-secondary"
                onClick={() => pendingCreated?close():(setNamedMode(null),setName(''),setNamedCreateError(''))}
                disabled={namedCreateSaving}>
                {pendingCreated?'Close':'Back'}
              </button>
              {pendingCreated?
                <button type="button" className="quick-create-primary" onClick={openPendingCreated}>Open created record</button>:
                <button type="submit" className="quick-create-primary" disabled={!name.trim()||namedCreateSaving}>
                 {namedCreateSaving?'Creating…':'Create & open'}</button>}
            </div>
          </form>
        ) : (
          <div className={'quick-create-options ss-mobile-sheet-body'+(canRecordExternal?' has-external-quote':'')}>
            <button type="button" className="quick-create-option quick-create-option-primary" onClick={openDocumentPicker}>
              <span className="quick-create-icon"><CreateGlyph kind="quote"/></span>
              <span><strong>New SalesShop Quote</strong><small>Create a Quick Quote or pricing schedule.</small></span>
              <b>›</b>
            </button>
            {canRecordExternal&&<button type="button" className="quick-create-option quick-create-option-primary" onClick={startExternalQuote}>
              <span className="quick-create-icon"><CreateGlyph kind="external"/></span>
              <span><strong>Record External Quote</strong><small>Log a bid sent through a builder platform or outside SalesShop.</small></span>
              <b>›</b>
            </button>}
            <button type="button" className="quick-create-option compact" onClick={startTask}>
              <span className="quick-create-icon"><CreateGlyph kind="task"/></span>
              <span><strong>New Task</strong><small>Open the task editor immediately.</small></span><b>›</b>
            </button>
            <button type="button" className="quick-create-option compact" onClick={startActivity}>
              <span className="quick-create-icon"><CreateGlyph kind="activity"/></span>
              <span><strong>Log Activity</strong><small>Record a call, email, text, video call, or meeting.</small></span><b>›</b>
            </button>
            <div className="quick-create-divider" />
            <button type="button" className="quick-create-option compact" onClick={() => setNamedMode('project')}><span className="quick-create-icon"><CreateGlyph kind="deal"/></span><span><strong>New Deal</strong><small>Add an opportunity or job.</small></span><b>›</b></button>
            <button type="button" className="quick-create-option compact" onClick={() => setNamedMode('account')}><span className="quick-create-icon"><CreateGlyph kind="account"/></span><span><strong>New Account</strong><small>Add a builder, customer, or prospect.</small></span><b>›</b></button>
            <button type="button" className="quick-create-option compact" onClick={makeNotebookPage}><span className="quick-create-icon"><CreateGlyph kind="notebook"/></span><span><strong>New Notebook Page</strong><small>Capture the thought first.</small></span><b>›</b></button>
          </div>
        )}
      </section>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button type="button" className={context?'connections-record-primary ss-record-new-launcher':'quick-create-launcher'}
        onClick={() => {namedCreatePending.current=false;setNamedCreateError('');setPendingCreated(null);setOpen(true);}} aria-label={context?'New related record':'Quick create'}
        title={context?'Create a record linked to '+context.name:'Quick create'}>
        {launcherLabel??'+'}
      </button>
      {sheet}
      {recordExternalOpen&&<ExternalQuoteBackfillDialog
        initialDealId={context?.kind==='deal'?context.id:undefined}
        onClose={()=>setRecordExternalOpen(false)}
        onRecorded={()=>setRecordExternalOpen(false)}/>} 
    </>
  );
}
