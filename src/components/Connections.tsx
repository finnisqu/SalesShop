import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {createPortal} from 'react-dom';
import {WorkspaceLoadingState} from './WorkspaceLoadingState';
import { CompanyRecordPage } from './CompanyRecordPage';
import {QuickActivityLauncher} from './QuickActivityLauncher';
import {CalendarActivityPreview} from './CalendarActivityPreview';
import {OurOrganizationDirectory} from './OurOrganizationDirectory';
import {SuppliersWorkspace} from './SuppliersWorkspace';
import '../suppliers-connections.css';
import {isOurOrgCompany,ourOrgCompanyIds,isOurOrgContact} from '../services/ourOrganizationDirectory';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import {SalesCalendarLauncher} from './SalesCalendarLauncher';
import { PersonRecordPage } from './PersonRecordPage';
import { DealRecordPage } from './DealRecordPage';
import {DealTimelineBetaOverview} from './DealTimelineBeta';
import {useDealTimelineBetaStore} from '../store/dealTimelineBetaStore';
import { Button, SectionTabs, StatusText } from '../design-system/components';
import {WorkspaceHeader,WorkspaceMoreMenu} from './WorkspaceHeader';
import {WorkspaceHelp} from './WorkspaceHelp';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import { useNavigationStore } from '../store/navigationStore';
import {usePersonalTaskStore} from '../store/personalTaskStore';
import {ConnectionsTable,type ConnectionTableRow,type ConnectionColumn} from './ConnectionsTable';
import type {BulkEditChange} from './ConnectionsBulkEditDialog';
import {canEditTeamArea} from '../services/teamDepartments';
import {useRolePerspectiveStore} from '../store/rolePerspectiveStore';
import {RecordPreviewDrawer,type PreviewRecord} from './RecordPreviewDrawer';
import {PreviewPanelClose} from './PreviewPanelChrome';
import {useDismissibleLayer} from '../lib/useDismissibleLayer';
import {useModalScrollLock} from '../lib/useModalScrollLock';
import {QuoteRecordMetadataPage} from './QuoteRecordMetadataPage';
import {useAuthStore} from '../store/authStore';
import {displayQuoteNumber,quoteTotal} from '../types/quote';
import {consumeQuoteMetadataRequest} from '../services/quoteMetadataNavigation';
import {indexConnectionsCounts} from '../services/connectionsCountIndex';
import {DEAL_PIPELINES,PROJECT_STAGES,dealPipelineLabel,type DealPipeline,type ProjectStage} from '../types/crm';
import {companyRelationship,companyRelationshipLabel,companyRelationshipPatch,
 companyMatchesRelationship,visibleCompanyAliases,type CompanyRelationship,
 type EditableCompanyRelationship} from '../services/companyRelationship';
import {ExternalQuoteBackfillDialog} from './ExternalQuoteBackfillDialog';
import {matchesActivityFilters,DEFAULT_ACTIVITY_LOG_FILTERS,
 type ActivityLogFilters} from '../services/activityLogFilters';

type ConnectionsTab = 'companies' | 'people' | 'deals' | 'organization' | 'suppliers' | 'quotes' | 'activity';
type CompanyFilter = CompanyRelationship | 'all';

export const CONNECTIONS_TABS: Array<{ id: ConnectionsTab; label: string; description: string }> = [
  { id: 'companies', label: 'Companies', description: 'Accounts & partners' },
  { id: 'people', label: 'People', description: 'Contacts' },
  { id: 'deals', label: 'Deals', description: 'Opportunities & jobs' },
  { id: 'organization', label: 'Our Organization', description: 'Employees & subcontractors' },
  { id: 'suppliers', label: 'Suppliers', description: 'Vendors, sourcing & imports' },
];
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const TAB_KEY = 'salesshop-connections-tab-v1';
const companyColumns:ConnectionColumn[]=[
 {key:'name',label:'Company name'},{key:'type',label:'Relationship'},
 {key:'people',label:'People'},{key:'deals',label:'Deals'},{key:'quotes',label:'Quotes'},
 {key:'created',label:'Created'},{key:'updated',label:'Updated'}];
const peopleColumns:ConnectionColumn[]=[
 {key:'name',label:'Name'},{key:'company',label:'Company'},{key:'title',label:'Job title'},
 {key:'email',label:'Email'},{key:'phone',label:'Phone'},{key:'updated',label:'Updated'}];
const dealColumns:ConnectionColumn[]=[
 {key:'name',label:'Deal name'},{key:'company',label:'Company'},{key:'pipeline',label:'Pipeline'},{key:'stage',label:'Stage'},
 {key:'due',label:'Due'},{key:'amount',label:'Value'},{key:'next',label:'Next action'},
 {key:'updated',label:'Updated'}];
const quoteColumns:ConnectionColumn[]=[
 {key:'name',label:'Document'},{key:'number',label:'Number'},{key:'type',label:'Type'},
 {key:'company',label:'Company'},{key:'deal',label:'Deal'},{key:'status',label:'Status'},
 {key:'value',label:'Value'},{key:'updated',label:'Updated'}];

/** Historical Overview/Activity selections must not revive hidden dashboard/log tabs. */
export function resolveConnectionsLandingTab(stored: string | null): ConnectionsTab {
  return CONNECTIONS_TABS.find((item) => item.id === stored)?.id ?? 'companies';
}

function initialTab(): ConnectionsTab {
  if (typeof window === 'undefined') return 'companies';
  try{
   if(window.sessionStorage.getItem('salesshop-connections-open-suppliers-v1')==='1'){
    window.sessionStorage.removeItem('salesshop-connections-open-suppliers-v1');
    return 'suppliers';
   }
   if(window.sessionStorage.getItem('salesshop-open-activity-history-v1')==='1'){
    window.sessionStorage.removeItem('salesshop-open-activity-history-v1');
    return 'activity';
   }
  }catch{/* best effort */}
  try { return resolveConnectionsLandingTab(window.sessionStorage.getItem(TAB_KEY)); }
  catch { return 'companies'; }
}

function timeLabel(value?: string) {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : value;
}

function findText(...items: Array<string | undefined>) {
  return items.filter(Boolean).join(' ').toLowerCase();
}

export function Connections() {
  const [tab, setTab] = useState<ConnectionsTab>(initialTab);
  const [dealsView,setDealsView]=useState<'list'|'timeline'>(()=>{
    try{return window.sessionStorage.getItem('salesshop-connections-deals-timeline-beta-v1')==='timeline'?'timeline':'list';}
    catch{return 'list';}
  });
  const chooseDealsView=(next:'list'|'timeline')=>{
    setDealsView(next);
    try{window.sessionStorage.setItem('salesshop-connections-deals-timeline-beta-v1',next);}
    catch{/* best effort */}
  };
  const timelineBetaEnabled=useDealTimelineBetaStore(state=>state.enabled);
  useEffect(()=>{
   const show=()=>setTab('activity');
   window.addEventListener('salesshop:open-activity-history',show);
   return()=>window.removeEventListener('salesshop:open-activity-history',show);
  },[]);
  useEffect(()=>{
   const show=()=>{
    setTab('suppliers');
    try{window.sessionStorage.setItem(TAB_KEY,'suppliers');}catch{}
   };
   window.addEventListener('salesshop:open-suppliers',show);
   return()=>window.removeEventListener('salesshop:open-suppliers',show);
  },[]);
  const [query, setQuery] = useState('');
  const [activityFilters,setActivityFilters]=useState<ActivityLogFilters>(DEFAULT_ACTIVITY_LOG_FILTERS);
  const [preview,setPreview]=useState<PreviewRecord|null>(null);
  const [activityPreview,setActivityPreview]=useState<string|null>(null);
  const [orgCreateRequest,setOrgCreateRequest]=useState(0);
  const [quoteRecordId,setQuoteRecordId]=useState<string|null>(null);
  useEffect(()=>{
    const id=consumeQuoteMetadataRequest();
    if(id){setQuoteRecordId(id);setTab('quotes');}
  },[]);
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all');
  const [companyCreating, setCompanyCreating] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const [newCompanyRelationship, setNewCompanyRelationship] = useState<EditableCompanyRelationship>('prospect');
  const [externalQuotePickerOpen,setExternalQuotePickerOpen]=useState(false);
  const [personCreating, setPersonCreating] = useState(false);
  const [dealCreating, setDealCreating] = useState(false);
  const [newDeal, setNewDeal] = useState('');
  const [newDealCompanyId, setNewDealCompanyId] = useState('');
  const [newDealPipeline, setNewDealPipeline] = useState<DealPipeline | ''>('');
  const [newPerson, setNewPerson] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonCompany, setNewPersonCompany] = useState('');
  const [notice, setNotice] = useState('');

  const crmHydrate = useCrmStore((state) => state.hydrate);
  const quoteHydrate = useQuoteStore((state) => state.hydrate);
  const crmReady=useCrmStore(state=>state.hydrated);
  const quotesReady=useQuoteStore(state=>state.hydrated);
  const recordsReady=crmReady&&quotesReady;
  const companies = useCrmStore((state) => state.companies);
  const contacts = useCrmStore((state) => state.contacts);
  const projects = useCrmStore((state) => state.projects);
  const activities = useCrmStore((state) => state.activities);
  const quotes = useQuoteStore((state) => state.quotes);
  const authMode=useAuthStore(state=>state.mode);
  const authUser=useAuthStore(state=>state.user?.id);
  const authOrgId=useAuthStore(state=>state.organizationId);
  const authRole=useAuthStore(state=>state.teamRole);
  const authDepartment=useAuthStore(state=>state.teamDepartment);
  const previewPerspective=useRolePerspectiveStore(state=>state.activePerspective);
  const canBulkEdit=!previewPerspective&&(authMode==='local'||
    Boolean(authOrgId&&authUser&&canEditTeamArea(authRole,authDepartment,'crm')));
  const canManageSuppliers=!previewPerspective&&(authMode==='local'||
    Boolean(authOrgId&&authUser&&canEditTeamArea(authRole,authDepartment,'supplier')));
  const resolveCompany = useCrmStore((state) => state.resolveCompany);
  const createContact = useCrmStore((state) => state.createContact);
  const createDeal = useCrmStore((state) => state.createProject);
  const updateCompany = useCrmStore((state) => state.updateCompany);
  const updateContact = useCrmStore((state) => state.updateContact);
  const relinkContactCompany = useCrmStore((state) => state.relinkContactCompany);
  const updateDeal = useCrmStore((state) => state.updateProject);
  const assignDeal = useCrmStore((state) => state.assignProject);
  const relinkDealCompany = useCrmStore((state) => state.relinkProjectCompany);
  const setProjectCompany=useCrmStore(state=>state.setProjectCompany);
  const openCompany = useNavigationStore((state) => state.openCompany);
  const focusedCompanyId = useNavigationStore((state) => state.focusedCompanyId);
  const focusedContactId = useNavigationStore((state) => state.focusedContactId);
  const focusedDealId = useNavigationStore((state) => state.focusedProjectId);
  const openPerson = useNavigationStore((state) => state.openPerson);
  const openProject = useNavigationStore((state) => state.openProject);
  const openQuote = useNavigationStore((state) => state.openQuote);
  const setView = useNavigationStore((state) => state.setView);
  const beginTaskPromotion=usePersonalTaskStore(state=>state.beginPromotion);

  useEffect(() => { crmHydrate(); quoteHydrate(); }, [crmHydrate, quoteHydrate]);
  const chooseTab = (next: ConnectionsTab) => {
    setPreview(null);setActivityPreview(null);setQuoteRecordId(null);
    setTab(next); setQuery(''); setNotice('');
    setCompanyCreating(false); setPersonCreating(false); setDealCreating(false);
    // Activity history is an on-demand utility, never the default landing page.
    if (CONNECTIONS_TABS.some((item) => item.id === next)) {
      try { window.sessionStorage.setItem(TAB_KEY, next); } catch { /* best effort */ }
    }
  };

  const companiesById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const internalCompanyIds=useMemo(()=>ourOrgCompanyIds(companies),[companies]);
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const counts=useMemo(()=>indexConnectionsCounts(contacts,projects,quotes),[contacts,projects,quotes]);
  const needle = query.trim().toLowerCase();
  // The Connections metadata directory mirrors My Documents ownership, not
  // team-wide private quotes or the old global sales dashboard.
  const visibleQuotes=useMemo(()=>authMode==='cloud'
    ?quotes.filter(q=>q.ownerUserId===authUser):quotes,[quotes,authMode,authUser]);
  const companyRows = useMemo(() => companies
    .filter(company=>!isOurOrgCompany(company))
    .filter((company) => companyMatchesRelationship(company,companyFilter))
    .filter((company) => findText(company.name, ...visibleCompanyAliases(company)).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name)), [companies, companyFilter, needle]);
  const peopleRows = useMemo(() => contacts
    .filter(person=>!isOurOrgContact(person,companies))
    .filter((person) => findText(person.name, person.email, person.phone, person.title,
      companiesById.get(person.companyId ?? '')?.name).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name)), [contacts, companiesById, companies, needle]);
  const projectRows = useMemo(() => projects
    .filter((project) => findText(project.name, project.companyName, project.stage, project.nextAction, dealPipelineLabel(project.pipeline)).includes(needle))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [projects, needle]);
  const quoteRows=useMemo(()=>visibleQuotes.filter(q=>
    findText(q.title,q.companyName,q.contactName,displayQuoteNumber(q),q.status,
      projectsById.get(q.projectId??'')?.name).includes(needle))
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),[visibleQuotes,projectsById,needle]);
  const activityRows = useMemo(() => [...activities]
    .filter(a=>!(a.type==='contact-created'&&internalCompanyIds.has(a.companyId??'')))
    .filter(activity=>matchesActivityFilters(activity,activityFilters,companies,contacts,
      projects,visibleQuotes,person=>isOurOrgContact(person,companies)))
    .filter((activity) => findText(activity.summary, activity.type,
      companiesById.get(activity.companyId ?? '')?.name,
      projectsById.get(activity.projectId ?? '')?.name).includes(needle))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 150), [activities, companiesById, projectsById,internalCompanyIds,
      activityFilters,companies,contacts,projects,visibleQuotes,needle]);

  const companyTableRows=useMemo<ConnectionTableRow[]>(()=>tab==='companies'?companyRows.map(c=>({
    id:c.id,name:c.name,association:{type:'company',id:c.id,label:'Company · '+c.name},
    values:{name:c.name,type:companyRelationshipLabel(c),
      people:String(counts.peopleByCompany.get(c.id)??0),
      deals:String(counts.dealsByCompany.get(c.id)??0),
      quotes:String(counts.quotesByCompany.get(c.id)??0),
      created:timeLabel(c.createdAt),updated:timeLabel(c.updatedAt)},
    sortValues:{created:c.createdAt,updated:c.updatedAt}})):[],[tab,companyRows,counts]);
  const peopleTableRows=useMemo<ConnectionTableRow[]>(()=>tab==='people'?peopleRows.map(c=>({
    id:c.id,name:c.name||c.email||'Unnamed person',
    association:{type:'contact',id:c.id,label:'Person · '+(c.name||c.email||'Unnamed')},
    values:{name:c.name||c.email||'Unnamed person',company:companiesById.get(c.companyId??'')?.name??'',
      title:c.title??'',email:c.email??'',phone:c.phone??'',updated:timeLabel(c.updatedAt)},
    sortValues:{updated:c.updatedAt}})):[],[tab,peopleRows,companiesById]);
  const dealTableRows=useMemo<ConnectionTableRow[]>(()=>tab==='deals'?projectRows.map(d=>({
    id:d.id,name:d.name,association:{type:'project',id:d.id,label:'Deal · '+d.name},
    values:{name:d.name,company:d.companyName??companiesById.get(d.companyId??'')?.name??'',
      pipeline:dealPipelineLabel(d.pipeline),stage:d.stage,due:d.dueDate?timeLabel(d.dueDate):'',amount:d.amount===undefined?'':money.format(d.amount),
      next:d.nextAction??'',updated:timeLabel(d.updatedAt)},
    sortValues:{amount:d.amount??0,due:d.dueDate??'9999-12-31',updated:d.updatedAt}})):[],[tab,projectRows,companiesById]);
  const quoteTableRows=useMemo<ConnectionTableRow[]>(()=>tab==='quotes'?quoteRows.map(q=>{
    const total=quoteTotal(q);
    return {
    id:q.id,name:q.title||'Untitled document',
    association:{type:'quote',id:q.id,label:'Quote · '+(q.title||displayQuoteNumber(q))},
    values:{name:q.title||'Untitled document',number:displayQuoteNumber(q),
      type:q.documentType==='pricing-schedule'?'Pricing schedule':q.documentType==='change-order'?'Change order':'Quote',
      company:q.companyName??'',deal:projectsById.get(q.projectId??'')?.name??'',
      status:q.status+(q.archivedAt?' · Archived':''),
      value:money.format(total),updated:timeLabel(q.updatedAt)},
    sortValues:{value:total,updated:q.updatedAt}};
  }):[],[tab,quoteRows,projectsById]);
  const bulkTask=(items:ConnectionTableRow[])=>{
    beginTaskPromotion({target:'task',title:'Follow up: '+items.length+' '+tab,
      sourceLabel:'Connections selection',associations:items.flatMap(x=>x.association?[x.association]:[])});
  };
  const bulkEdit = async(items:ConnectionTableRow[],change:BulkEditChange):Promise<void>=>{
    if(!canBulkEdit)throw new Error('You do not have permission to bulk edit CRM records.');
    if(!items.length)throw new Error('Select records to update.');
    // Validate all selected IDs in the current workspace before changing any.
    const live=useCrmStore.getState();
    const available=new Set((change.scope==='companies'?live.companies:
      change.scope==='people'?live.contacts:live.projects).map(record=>record.id));
    if(items.some(item=>!available.has(item.id)))
      throw new Error('Some selected records are no longer available. Refresh your selection.');
    let updated=0;
    for(const item of items){
      try{
        if(change.scope==='companies'){
          const company=useCrmStore.getState().companies.find(c=>c.id===item.id);
          if(!company||isOurOrgCompany(company))throw new Error('Company is unavailable for reclassification.');
          updateCompany(item.id,companyRelationshipPatch(company,change.value));
        }else if(change.scope==='people'){
          if(change.property==='companyId')
            relinkContactCompany(item.id,change.value||undefined);
          else if(change.property==='title')updateContact(item.id,{title:change.value});
          else updateContact(item.id,{phone:change.value});
        }else if(change.property==='companyId'){
          setProjectCompany(item.id,change.value||undefined);
        }else if(change.property==='assignedUserId'){
          // Owner changes are server-confirmed one at a time. Never imply all
          // succeeded if a membership/permission/conflict check rejects one.
          await assignDeal(item.id,change.value||undefined);
        }else if(change.property==='pipeline'){
          updateDeal(item.id,{pipeline:change.pipeline,stage:change.stage},{source:'manual'});
        }else if(change.property==='stage'){
          updateDeal(item.id,{stage:change.value},{source:'manual'});
        }else if(change.property==='amount'){
          updateDeal(item.id,{amount:change.value===''?undefined:Number(change.value)});
        }else if(change.property==='dueDate'){
          updateDeal(item.id,{dueDate:change.value||undefined});
        }else{
          updateDeal(item.id,{nextAction:change.value||undefined});
        }
        updated++;
      }catch(error){
        const reason=error instanceof Error?error.message:'Unable to update the record.';
        throw new Error('Updated '+updated+' of '+items.length+' records. '+reason);
      }
    }
    setNotice('Updated '+updated+' '+(updated===1?'record':'records')+' · '+(
      change.scope==='deals'?'Deals':change.scope==='people'?'People':'Companies')+'.');
  };

  const addCompany = (event: FormEvent) => {
    event.preventDefault();
    const name = newCompany.trim();
    if (!name) return;
    const knownIds=new Set(useCrmStore.getState().companies.map(c=>c.id));
    const id = resolveCompany(name,newCompanyRelationship==='partner'?'non-customer':'customer');
    if(id&&!knownIds.has(id)){
      updateCompany(id,companyRelationshipPatch({aliases:[]},newCompanyRelationship));
    }
    if (id) {
      setNewCompany('');setNewCompanyRelationship('prospect'); setCompanyCreating(false); setNotice('Company ready in your directory.');
      openCompany(id);
    } else setNotice('Several accounts may match this name. Review existing records before creating another.');
  };
  const addPerson = (event: FormEvent) => {
    event.preventDefault();
    if (!newPerson.trim() && !newPersonEmail.trim()) return;
    const id = createContact({
      name: newPerson.trim(), email: newPersonEmail.trim(), companyId: newPersonCompany || undefined, source: 'manual',
    });
    if (id) {
      setNewPerson(''); setNewPersonEmail(''); setNewPersonCompany('');
      setPersonCreating(false); setNotice('Person added to your directory.');
      openPerson(id);
    } else setNotice('Could not add that person. Check the details and try again.');
  };
  const addDeal = (event: FormEvent) => {
    event.preventDefault();
    if (!newDeal.trim()) return;
    const id = createDeal(newDeal.trim(),'Discovery',{pipeline:newDealPipeline || undefined});
    if (!id) { setNotice('Could not create this deal.'); return; }
    if (newDealCompanyId) relinkDealCompany(id, newDealCompanyId);
    setNewDeal(''); setNewDealCompanyId(''); setNewDealPipeline(''); setDealCreating(false);
    openProject(id);
  };
  const openActivity = (activity: (typeof activities)[number]) => {
    setPreview(null);setActivityPreview(activity.id);
  };

  const closeNewRecord=()=>{
    setCompanyCreating(false);setPersonCreating(false);setDealCreating(false);
  };
  const isCreateOpen=companyCreating||personCreating||dealCreating;
  const newRecordRef=useDismissibleLayer<HTMLElement>(isCreateOpen,closeNewRecord);
  useModalScrollLock(isCreateOpen);
  const backToDeals = () => {
    chooseTab('deals');
    setView('dashboard');
  };
  const backToPeople = () => {
    const person=contacts.find(c=>c.id===focusedContactId);
    chooseTab(person&&isOurOrgContact(person,companies)?'organization':'people');
    setView('dashboard');
  };
  const backToCompanies = () => {
    chooseTab('companies');
    setView('dashboard');
  };
  if (focusedDealId) return <main className="connections-workspace">
    <DealRecordPage dealId={focusedDealId} onBack={backToDeals} />
  </main>;
  if (focusedContactId) return <main className="connections-workspace">
    <PersonRecordPage contactId={focusedContactId} onBack={backToPeople} />
  </main>;
  if (focusedCompanyId) return <main className="connections-workspace">
    <CompanyRecordPage companyId={focusedCompanyId} onBack={backToCompanies} />
  </main>;

  if(quoteRecordId)return <main className="connections-workspace">
    <QuoteRecordMetadataPage quoteId={quoteRecordId} onBack={()=>{
      setQuoteRecordId(null);chooseTab('quotes');
    }} onPreview={()=>{setQuoteRecordId(null);setPreview({kind:'quote',id:quoteRecordId});}}/>
  </main>;
  const previewRecord=(kind:PreviewRecord['kind'],id:string)=>setPreview({kind,id});
  return (
    <main className="connections-workspace connections-directory-layout">
      <WorkspaceHeader title="Connections" help={<WorkspaceHelp page="connections" section={tab}/>} 
        className="connections-heading connections-foundation-heading"
        mobileTabs={[...CONNECTIONS_TABS.map(item=>({value:item.id,label:item.label})),
          {value:'quotes',label:'Quotes'},{value:'activity',label:'Activity history'}]}
        mobileTabValue={tab} onMobileTabChange={value=>chooseTab(value as ConnectionsTab)}
        tabs={<SectionTabs className="connections-tabs" aria-label="Connections sections"
          items={CONNECTIONS_TABS} selected={tab} onSelect={chooseTab}/>}
        more={<WorkspaceMoreMenu label="Connections More" items={[
          {label:'Activity history',active:tab==='activity',onClick:()=>chooseTab('activity')},
          {label:'Suppliers',active:tab==='suppliers',onClick:()=>chooseTab('suppliers')},
          {label:'Record external quote',disabled:!canBulkEdit,onClick:()=>setExternalQuotePickerOpen(true)},
          {label:'Quotes · metadata',active:tab==='quotes',onClick:()=>chooseTab('quotes')},
          ...(tab==='deals'&&timelineBetaEnabled?[
            {label:'Deals · list',active:dealsView==='list',onClick:()=>chooseDealsView('list')},
            {label:'Deals · timeline',active:dealsView==='timeline',onClick:()=>chooseDealsView('timeline')},
          ]:[]),
        ]}/>}
        search={<input id="connections-directory-search" type="search" aria-label={`Search ${tab}`}
          value={query} onChange={event=>setQuery(event.target.value)}
          placeholder={tab==='companies'?'Search companies…':tab==='people'?'Search people…':
            tab==='deals'?'Search deals…':tab==='organization'?'Search internal people…':
            tab==='suppliers'?'Search suppliers and brands…':
            tab==='quotes'?'Search quotes…':'Search activities…'}/>}
        primary={<>
          {tab==='companies'&&<Button variant="primary" className="connections-add"
            onClick={()=>setCompanyCreating(value=>!value)}>+ Company</Button>}
          {tab==='people'&&<Button variant="primary" className="connections-add"
            onClick={()=>setPersonCreating(value=>!value)}>+ Person</Button>}
          {tab==='organization'&&<Button variant="primary" className="connections-add"
            disabled={!canBulkEdit} onClick={()=>setOrgCreateRequest(value=>value+1)}>+ Person</Button>}
          {tab==='suppliers'&&<Button variant="primary" className="connections-add"
            disabled={!canManageSuppliers}
            onClick={()=>window.dispatchEvent(new Event('sales-shop:catalog-create'))}>+ Supplier</Button>}
          {tab==='deals'&&timelineBetaEnabled&&<div className="ss-timeline-beta-actions ss-timeline-beta-view-toggle" role="group" aria-label="Deals display">
            <button type="button" aria-pressed={dealsView==='list'} onClick={()=>chooseDealsView('list')}>List</button>
            <button type="button" aria-pressed={dealsView==='timeline'} onClick={()=>chooseDealsView('timeline')}>Timeline <small>Beta</small></button>
          </div>}
          {tab==='deals'&&<Button variant="primary" className="connections-add"
            onClick={()=>setDealCreating(value=>!value)}>+ Deal</Button>}
          {tab==='activity'&&<Button variant="primary" className="connections-add"
            onClick={()=>openActivityComposer({})}>+ Activity</Button>}
          {tab==='quotes'&&<Button variant="primary" className="connections-add"
            onClick={()=>{
              const launch=document.querySelector<HTMLButtonElement>('.mobile-app-hidden-launchers .quick-create-launcher')
                ??document.querySelector<HTMLButtonElement>('.app-primary-actions .quick-create-launcher');
              launch?.click();
            }}>+ Quote</Button>}
        </>}
      />
      {!recordsReady&&<WorkspaceLoadingState title="Loading Connections"
        detail="Opening accounts, contacts, deals and quote links…" />}
      <div className="connections-directory-content"
        style={!recordsReady?{display:'none'}:undefined}>
      {(tab === 'activity'||tab==='quotes') && <div className="connections-history-heading">
        <div><strong>{tab==='quotes'?'Quotes · metadata':'Activity history'}</strong>
          <p>{tab==='quotes'?'Document records and relationships. Open quote to work on pricing.':'A reference log of existing record events.'}</p></div>
        <div className="connections-activity-tools">
         {tab==='quotes'&&canBulkEdit&&<button type="button" onClick={()=>setExternalQuotePickerOpen(true)}>
           Record external quote</button>}
         {tab==='activity'&&<><SalesCalendarLauncher compact /><QuickActivityLauncher label="Log Activity" compact /></>}
         <button type="button" onClick={() => chooseTab('companies')}>← Back to Companies</button>
        </div>
      </div>}


          {notice && <p className="connections-notice" role="status">{notice}</p>}
          {tab === 'companies' && (
            <section className="connections-directory" aria-label="Company directory">
              
              <p className="connections-count">{companyRows.length} companies · preview or open full details</p>
              <ConnectionsTable key="companies" tableKey="companies" columns={companyColumns}
                rows={companyTableRows} onOpen={id=>previewRecord('company',id)} onBulkTask={bulkTask}
                toolbarControls={<label className="connections-filter connections-inline-type-filter">
                  Type
                  <select aria-label="Filter Companies by type" value={companyFilter}
                    onChange={e=>setCompanyFilter(e.target.value as CompanyFilter)}>
                    <option value="all">All</option>
                    <option value="prospect">Prospects</option>
                    <option value="customer">Customers</option>
                    <option value="unclassified">Not classified</option>
                    <option value="partner">Partners / other</option>
                  </select>
                </label>}
                 onBulkEdit={canBulkEdit?bulkEdit:undefined} bulkEditCompanies={companies}/>
              <div className="connections-card-grid connections-legacy-cards">
                {companyRows.map((company) => {
                  const peopleCount=counts.peopleByCompany.get(company.id)??0;
                  const projectCount=counts.dealsByCompany.get(company.id)??0;
                  const companyQuoteCount=counts.quotesByCompany.get(company.id)??0;
                  return <div key={company.id} className="connections-mobile-record-group">
                    <button type="button" className="connections-record" onClick={() => previewRecord('company',company.id)}>
                    <span className="connections-record-eyebrow">{companyRelationshipLabel(company)}</span>
                    <strong>{company.name}</strong>
                    <small>{peopleCount} people · {projectCount} deals · {companyQuoteCount} linked quotes</small>
                    <span className="connections-record-arrow" aria-hidden="true">↗</span>
                  </button>
                  <div className="connections-mobile-inline">
                      {canBulkEdit&&<label>Relationship
                        <select aria-label={'Relationship for '+company.name} value={companyRelationship(company)}
                          onChange={event=>{const next=event.currentTarget.value as EditableCompanyRelationship;
                            if(next!=='prospect'&&next!=='customer'&&next!=='partner')return;
                            updateCompany(company.id,companyRelationshipPatch(company,next));}}>
                          <option value="unclassified" disabled>Unclassified</option>
                          <option value="prospect">Prospect</option>
                          <option value="customer">Customer</option>
                          <option value="partner">Partner / other</option>
                        </select>
                      </label>}
                      <button type="button" className="connections-mobile-open-full"
                        onClick={()=>openCompany(company.id)}>Full record</button>
                    </div>
                </div>;
                })}
              </div>
              {!companyRows.length && <StatusText state="empty" className="connections-empty">No companies match. Try another search or relationship type.</StatusText>}
            </section>
          )}
          {tab === 'people' && (
            <section className="connections-directory" aria-label="People directory">
              
              <p className="connections-count">{peopleRows.length} people · preview or open full details</p>
              <ConnectionsTable key="people" tableKey="people" columns={peopleColumns}
                rows={peopleTableRows} onOpen={id=>previewRecord('person',id)} onBulkTask={bulkTask}
                 onBulkEdit={canBulkEdit?bulkEdit:undefined} bulkEditCompanies={companies}/>
              <div className="connections-card-grid connections-legacy-cards">
                {peopleRows.map((person) => <div key={person.id} className="connections-mobile-record-group">
                <button type="button" className="connections-record connections-person-record" onClick={() => previewRecord('person',person.id)}>
                  <span className="connections-record-eyebrow">{companiesById.get(person.companyId ?? '')?.name ?? 'Unassigned company'}</span>
                  <strong>{person.name || person.email || 'Unnamed contact'}</strong>
                  <small>{[person.title,person.email,person.phone].filter(Boolean).join(' · ') || 'No contact details'}</small>
                  <span className="connections-record-arrow" aria-hidden="true">↗</span>
                </button>
                <div className="connections-mobile-inline connections-mobile-contact-actions">
                  {person.email&&<a href={'mailto:'+person.email} aria-label={'Email '+(person.name||person.email)}>Email</a>}
                  {person.phone&&<a href={'tel:'+person.phone} aria-label={'Call '+(person.name||person.phone)}>Call</a>}
                  <button type="button" className="connections-mobile-open-full" onClick={()=>openPerson(person.id)}>Full record</button>
                </div>
              </div>)}
              </div>
              {!peopleRows.length && <StatusText state="empty" className="connections-empty">No contacts match. Adjust your search or add a person.</StatusText>}

            </section>
          )}
          {tab==='deals'&&timelineBetaEnabled&&dealsView==='timeline'&&
            <DealTimelineBetaOverview projects={projectRows} onOpen={openProject}/>}
          {tab === 'deals' && (!timelineBetaEnabled||dealsView==='list') && <section className="connections-directory" aria-label="Deals directory">
            
            <div className="connections-deals-capture-bar">
              <span>{projectRows.length} Deals · stages, bid dates and linked quotes</span>
              <button type="button" disabled={!canBulkEdit} onClick={()=>setExternalQuotePickerOpen(true)}>
               <span aria-hidden="true">+</span> Record external quote
              </button>
            </div>
            <ConnectionsTable key="deals" tableKey="deals" columns={dealColumns}
              rows={dealTableRows} onOpen={id=>previewRecord('deal',id)} onBulkTask={bulkTask}
               onBulkEdit={canBulkEdit?bulkEdit:undefined} bulkEditCompanies={companies}/>
            <div className="connections-card-grid connections-legacy-cards">
              {projectRows.map((project) => {
                const linkedQuoteCount=counts.quotesByDeal.get(project.id)??0;
                return <div key={project.id} className="connections-mobile-record-group">
                  <button type="button" className="connections-record" onClick={() => previewRecord('deal',project.id)}>
                  <span className="connections-record-eyebrow">{dealPipelineLabel(project.pipeline)} · {project.stage}</span>
                  <strong>{project.name}</strong>
                  <small>{[project.companyName,project.dueDate ? `Due ${timeLabel(project.dueDate)}` : undefined,`${linkedQuoteCount} linked quotes`].filter(Boolean).join(' · ')}</small>
                  {project.amount !== undefined && <b>{money.format(project.amount)}</b>}
                  <span className="connections-record-arrow" aria-hidden="true">↗</span>
                </button>
                  <div className="connections-mobile-inline">
                    {canBulkEdit&&<label>Stage
                      <select aria-label={'Stage for '+project.name} value={project.stage}
                        onChange={event=>updateDeal(project.id,{stage:event.currentTarget.value as ProjectStage},{source:'manual'})}>
                        {PROJECT_STAGES.map(stage=><option key={stage} value={stage}>{stage}</option>)}
                      </select>
                    </label>}
                    <button type="button" className="connections-mobile-open-full"
                      onClick={()=>openProject(project.id)}>Full record</button>
                  </div>
                </div>;
              })}
            </div>
            {!projectRows.length && <StatusText state="empty" className="connections-empty">No deals match your search.</StatusText>}
          </section>}
          {tab === 'quotes' && <section className="connections-directory" aria-label="Quote metadata directory">
            <p className="connections-count">{quoteRows.length} documents · click a name for its preview</p>
            <ConnectionsTable key="quotes" tableKey="quotes" columns={quoteColumns}
              rows={quoteTableRows} onOpen={id=>previewRecord('quote',id)} onBulkTask={bulkTask}/>
            <div className="connections-mobile-quote-records">
              {quoteRows.map(q=><button type="button" key={q.id} className="connections-record"
                onClick={()=>previewRecord('quote',q.id)}>
                <strong>{q.title||displayQuoteNumber(q)}</strong>
                <small>{displayQuoteNumber(q)} · {q.companyName||'No company'} · {q.status}</small>
                <span className="connections-record-arrow" aria-hidden="true">›</span>
              </button>)}
            </div>
            {!quoteRows.length&&<StatusText state="empty" className="connections-empty">
              No quote metadata matches. Check My Sales Documents or your search.
            </StatusText>}
          </section>}
          {tab==='organization'&&<OurOrganizationDirectory onOpenPerson={openPerson} query={query}
            createRequest={orgCreateRequest} onCreateConsumed={()=>setOrgCreateRequest(0)}/>}
          {tab==='suppliers'&&<div className="connections-suppliers-host">
            <SuppliersWorkspace externalQuery={query} embeddedInConnections/>
          </div>}
          {tab==='activity'&&<section className="connections-activity-filters" aria-label="Filter Activity history">
            <label>Method
              <select value={activityFilters.method} onChange={e=>setActivityFilters(f=>({
                ...f,method:e.target.value as ActivityLogFilters['method']}))}>
               <option value="all">Any method</option>
               <option value="call">Phone calls</option>
               <option value="email">Email</option>
               <option value="text">Text</option>
               <option value="video-call">Video call</option>
               <option value="in-person">In person</option>
              </select>
            </label>
            <label>Relationship
              <select value={activityFilters.audience} onChange={e=>setActivityFilters(f=>({
                ...f,audience:e.target.value as ActivityLogFilters['audience']}))}>
               <option value="all">All relationships</option>
               <option value="prospect">Prospects</option>
               <option value="customer">Customers</option>
               <option value="partner">Partners / other</option>
               <option value="unclassified">Unclassified</option>
               <option value="internal">Our Organization</option>
               <option value="unlinked">No identified company</option>
              </select>
            </label>
            <label>Record type
              <select value={activityFilters.kind} onChange={e=>setActivityFilters(f=>({
                ...f,kind:e.target.value as ActivityLogFilters['kind']}))}>
               <option value="all">All events</option>
               <option value="interactions">Logged interactions</option>
               <option value="system">System history</option>
              </select>
            </label>
            <label>When
              <select value={activityFilters.period} onChange={e=>setActivityFilters(f=>({
                ...f,period:e.target.value as ActivityLogFilters['period']}))}>
               <option value="all">Any date</option>
               <option value="7">Last 7 days</option>
               <option value="30">Last 30 days</option>
               <option value="90">Last 90 days</option>
              </select>
            </label>
            <button type="button" disabled={JSON.stringify(activityFilters)===
              JSON.stringify(DEFAULT_ACTIVITY_LOG_FILTERS)}
              onClick={()=>setActivityFilters(DEFAULT_ACTIVITY_LOG_FILTERS)}>Clear filters</button>
           </section>}
          {tab === 'activity' && <section className="connections-directory" aria-label="Activity history">
            <p className="connections-count">{activityRows.length} recorded events. Logged interactions and automatic CRM history, not a follow-up checklist.</p>
            <div className="connections-activity-list">
              {activityRows.map((activity) => {
                return <button type="button" key={activity.id} onClick={() => openActivity(activity)}>
                  <span><strong>{activity.summary}</strong><small>{[
                   activity.metadata?.interactionMethod?.replaceAll('-',' '),
                   companiesById.get(activity.companyId ?? '')?.name,
                   projectsById.get(activity.projectId ?? '')?.name,
                   activity.metadata?.notes?.slice(0,120)
                  ].filter(Boolean).join(' · ')}</small></span>
                  <time>{timeLabel(activity.occurredAt)}</time>
                </button>;
              })}
              {!activityRows.length && <StatusText state="empty" className="connections-empty">No recorded history is available.</StatusText>}
            </div>
          </section>}
      <footer className="connections-footer">
        <span>People and sales records are managed here. Team accounts, permissions, and invitations belong in Settings.</span>
        <button type="button" onClick={() => setView('settings')}>Open team settings →</button>
      </footer>
      </div>
      {externalQuotePickerOpen&&<ExternalQuoteBackfillDialog
        onClose={()=>setExternalQuotePickerOpen(false)}
        onRecorded={dealName=>{setExternalQuotePickerOpen(false);
          setNotice('External quote recorded for '+dealName+'.');}}/>}
      {activityPreview&&<CalendarActivityPreview activityId={activityPreview}
        onClose={()=>setActivityPreview(null)}
        onSelect={(kind,id)=>{setActivityPreview(null);setPreview({kind,id});}}/>}
      {preview&&<RecordPreviewDrawer record={preview}
        onClose={()=>setPreview(null)} onSelect={setPreview}
        onGoToQuotePage={id=>{setPreview(null);setQuoteRecordId(id);setTab('quotes');}}/>}
      {(companyCreating||personCreating||dealCreating)&&createPortal(
        <div className="connections-create-backdrop" onPointerDown={event=>{
          if(event.target===event.currentTarget)closeNewRecord();
        }}>
          <section ref={newRecordRef} className="connections-create-dialog" role="dialog" aria-modal="true"
            aria-label={companyCreating?'New company':personCreating?'New person':'New deal'}>
            <header className="connections-create-heading">
              <div><small>CONNECTIONS · CREATE</small>
                <h2>{companyCreating?'New company':personCreating?'New person':'New deal'}</h2>
              </div>
              <PreviewPanelClose onClose={closeNewRecord} label="Close new record" initialFocus={false}/>
            </header>
            {companyCreating && <form className="connections-add-form" onSubmit={addCompany}>
                
                <label><span>Company name</span><input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} data-dialog-initial-focus autoFocus required placeholder="Builder or supplier name" /></label>
                <label><span>Relationship</span><select value={newCompanyRelationship}
                  onChange={e=>setNewCompanyRelationship(e.target.value as EditableCompanyRelationship)}>
                  <option value="prospect">Prospect</option>
                  <option value="customer">Customer</option>
                  <option value="partner">Partner / other</option>
                </select></label>
                <div><button type="button" onClick={() => setCompanyCreating(false)}>Cancel</button><button type="submit" className="primary">Save & open</button></div>
              </form>}
            {personCreating && <form className="connections-add-form" onSubmit={addPerson}>
                
                <label><span>Name</span><input data-dialog-initial-focus autoFocus value={newPerson} onChange={(e) => setNewPerson(e.target.value)} placeholder="Contact name" /></label>
                <label><span>Email</span><input type="email" value={newPersonEmail} onChange={(e) => setNewPersonEmail(e.target.value)} placeholder="Email address" /></label>
                <label><span>Company</span><select value={newPersonCompany} onChange={(e) => setNewPersonCompany(e.target.value)}>
                  <option value="">No company yet</option>{companies.slice().sort((a,b) => a.name.localeCompare(b.name)).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select></label>
                <div><button type="button" onClick={() => setPersonCreating(false)}>Cancel</button><button className="primary" type="submit" disabled={!newPerson.trim() && !newPersonEmail.trim()}>Add person</button></div>
              </form>}
            {dealCreating && <form className="connections-add-form" onSubmit={addDeal}>
              
              <label><span>Deal name</span><input data-dialog-initial-focus autoFocus required value={newDeal} onChange={event => setNewDeal(event.target.value)} placeholder="e.g. Parkside Apartments" /></label>
              <label><span>Pipeline</span><select value={newDealPipeline}
                 onChange={event=>setNewDealPipeline(event.target.value as DealPipeline | '')}>
                 <option value="">Unassigned</option>
                 {DEAL_PIPELINES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
               </select></label>
               <label><span>Company</span><select value={newDealCompanyId} onChange={event => setNewDealCompanyId(event.target.value)}>
                <option value="">No company yet</option>
                {companies.slice().sort((a,b) => a.name.localeCompare(b.name)).map(company =>
                  <option key={company.id} value={company.id}>{company.name}</option>)}
              </select></label>
              <div><button type="button" onClick={() => setDealCreating(false)}>Cancel</button>
                <button type="submit" className="primary" disabled={!newDeal.trim()}>Create & open</button></div>
            </form>}
          </section>
        </div>,document.body)}
    </main>
  );
}
