import { useEffect, useMemo, useRef, useState, type FormEvent, type UIEvent } from 'react';
import {createPortal} from 'react-dom';
import {WorkspaceLoadingState} from './WorkspaceLoadingState';
import { CompanyRecordPage } from './CompanyRecordPage';
import {Board} from './Board';
import {scopedStorageKey} from '../lib/developerPlayground';
import './connections-board-toggle.css';
import {CalendarActivityPreview} from './CalendarActivityPreview';
import {OurOrganizationDirectory} from './OurOrganizationDirectory';
import {TasksWorkspace} from './TasksWorkspace';
import {RecordsPagesDirectory} from './RecordsPagesDirectory';
import '../records-workspace-polish.css';
import {SuppliersWorkspace} from './SuppliersWorkspace';
import '../suppliers-connections.css';
import {isOurOrgCompany,ourOrgCompanyIds,isOurOrgContact} from '../services/ourOrganizationDirectory';
import {openActivityComposer} from '../services/taskActivityWorkflow';
import { PersonRecordPage } from './PersonRecordPage';
import { DealRecordPage } from './DealRecordPage';
import {DealTimelineBetaOverview} from './DealTimelineBeta';
import {useDealTimelineBetaStore} from '../store/dealTimelineBetaStore';
import { Button, StatusText } from '../design-system/components';
import {WorkspaceHeader} from './WorkspaceHeader';
import {RecordsSectionNav,RECORDS_MAIN_TABS,RECORDS_SECTIONS,rememberRecordsSection,requestRecordsQuotesLibrary,
 type RecordsSection} from './RecordsSectionNav';
import {WorkspaceHelp} from './WorkspaceHelp';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import { useNavigationStore } from '../store/navigationStore';
import {usePersonalTaskStore,taskScope} from '../store/personalTaskStore';
import {personFollowUpIndex,matchesPersonAttentionFilter,localCalendarDay,
 type PeopleAttentionFilter} from '../services/personFollowUpIntelligence';
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
import {consumeQuoteMetadataRequest} from '../services/quoteMetadataNavigation';
import {indexConnectionsCounts} from '../services/connectionsCountIndex';
import {buildSalesQuoteRegistry,mySalesQuoteRegistry,dedupeExternalQuoteActivities} from '../services/salesQuoteRegistry';
import {DEAL_PIPELINES,dealPipelineLabel,matchesDealPipeline,
 type DealPipeline,type DealPipelineFilter,type ProjectStage} from '../types/crm';
import {companyRelationshipLabel,companyRelationshipPatch,
 companyMatchesRelationship,isOurCompany,visibleCompanyAliases,type CompanyRelationship,
 type EditableCompanyRelationship} from '../services/companyRelationship';
import {ExternalQuoteBackfillDialog} from './ExternalQuoteBackfillDialog';
import {personLastContactIndex} from '../services/personLastContact';
import {matchesActivityFilters,DEFAULT_ACTIVITY_LOG_FILTERS,
 type ActivityLogFilters} from '../services/activityLogFilters';

type ConnectionsTab = 'tasks' | 'companies' | 'people' | 'deals' | 'activity' | 'organization' | 'suppliers' | 'quotes' | 'pages';
type CompanyFilter = CompanyRelationship | 'self' | 'all';
type DirectoryLayout='board'|'table';
type DirectoryLayouts={companies:DirectoryLayout;deals:DirectoryLayout};

export const CONNECTIONS_TABS=RECORDS_MAIN_TABS;
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const TAB_KEY = 'salesshop-connections-tab-v1';
const ACTIVITY_COLUMNS:ConnectionColumn[]=[
 {key:'name',label:'Activity'},{key:'method',label:'Method'},
 {key:'related',label:'Related records'},{key:'notes',label:'Notes'},{key:'type',label:'Record type'},
 {key:'occurred',label:'Date'},
];
const LAYOUT_KEY=scopedStorageKey('salesshop-connections-layout-v1');
const SEARCH_KEY=scopedStorageKey('salesshop-connections-tab-search-v1');
const COMPANY_FILTER_KEY=scopedStorageKey('salesshop-connections-company-filter-v1');
const PIPELINE_FILTER_KEY='salesshop-board-pipeline-v1';
function initialDealPipeline():DealPipelineFilter{
  try{
    const saved=localStorage.getItem(PIPELINE_FILTER_KEY);
    if(saved==='all'||saved==='unassigned'||DEAL_PIPELINES.some(item=>item.id===saved))
      return saved as DealPipelineFilter;
  }catch{/* best effort */}
  return 'all';
}
const SCROLL_KEY=scopedStorageKey('salesshop-connections-scroll-v1');
type DirectoryScroll={main?:number;tableTop?:number;tableLeft?:number;boardLeft?:number};
function initialDirectoryScrolls():Record<string,DirectoryScroll>{
  try{
    const raw=JSON.parse(sessionStorage.getItem(SCROLL_KEY)??'{}') as Record<string,DirectoryScroll>;
    return raw&&typeof raw==='object'?raw:{};
  }catch{return {};}
}
function initialTabSearches():Partial<Record<ConnectionsTab,string>>{
  try{
    const raw=JSON.parse(sessionStorage.getItem(SEARCH_KEY)??'{}') as Record<string,unknown>;
    if(!raw||typeof raw!=='object')return {};
    const saved:Partial<Record<ConnectionsTab,string>>={};
    for(const tab of ['tasks','companies','people','deals','activity','organization','suppliers','quotes','pages'] as ConnectionsTab[]){
      if(typeof raw[tab]==='string')saved[tab]=(raw[tab] as string).slice(0,300);
    }
    return saved;
  }catch{return {};}
}
function initialCompanyFilter():CompanyFilter{
  try{
    const saved=sessionStorage.getItem(COMPANY_FILTER_KEY);
    return ['all','prospect','customer','unclassified','partner','self'].includes(saved??'')
      ?saved as CompanyFilter:'all';
  }catch{return 'all';}
}

function initialLayouts():DirectoryLayouts{
  try{
    const raw=JSON.parse(localStorage.getItem(LAYOUT_KEY)??'{}') as Partial<DirectoryLayouts>;
    return {companies:raw.companies==='board'?'board':'table',
      deals:raw.deals==='table'?'table':'board'};
  }catch{return {companies:'table',deals:'board'};}
}
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
 {key:'name',label:'Quote / document'},{key:'number',label:'Number'},{key:'type',label:'Source / type'},
 {key:'company',label:'Company'},{key:'deal',label:'Deal'},{key:'status',label:'Status'},
 {key:'value',label:'Value'},{key:'updated',label:'Updated'}];

/** Historical Overview/Activity selections must not revive hidden dashboard/log tabs. */
export function resolveConnectionsLandingTab(stored: string | null): ConnectionsTab {
  return (RECORDS_SECTIONS.some(item=>item.id===stored)&&stored!=='quotes')
    ?stored as ConnectionsTab:'companies';
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

function followUpDateLabel(day:string){
 const date=new Date(day+'T12:00:00');
 return Number.isFinite(date.getTime())
  ?date.toLocaleDateString(undefined,{month:'short',day:'numeric'}):day;
}
function findText(...items: Array<string | undefined>) {
  return items.filter(Boolean).join(' ').toLowerCase();
}

function ContactOnFileIcon({kind}:{kind:'phone'|'email'}){
 return <span className="connections-person-card-method" role="img"
  aria-label={kind==='phone'?'Phone number on file':'Email address on file'}
  title={kind==='phone'?'Phone number on file':'Email address on file'}>
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
   strokeLinejoin="round" aria-hidden="true">
   {kind==='phone'
    ?<path d="M5 3h3l2 5-2 2a16 16 0 0 0 6 6l2-2 5 2v3a2 2 0 0 1-2 2C11 20 4 13 3 5a2 2 0 0 1 2-2Z"/>
    :<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></>}
  </svg>
 </span>;
}
export function Connections() {
  const [tab, setTab] = useState<ConnectionsTab>(initialTab);
  const [layouts,setLayouts]=useState<DirectoryLayouts>(initialLayouts);
  const activeLayoutKind:'companies'|'deals'=tab==='companies'?'companies':'deals';
  const chooseLayout=(kind:'companies'|'deals',value:DirectoryLayout)=>{
    setLayouts(previous=>{
      const next={...previous,[kind]:value};
      try{localStorage.setItem(LAYOUT_KEY,JSON.stringify(next));}catch{}
      return next;
    });
  };
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
  // Keep each directory's search while switching tabs, views and record pages.
  // Session scope avoids carrying private CRM search terms into another session.
  const [tabSearches,setTabSearches]=useState<Partial<Record<ConnectionsTab,string>>>(initialTabSearches);
  const query=tabSearches[tab]??'';
  const setQuery=(value:string)=>{
    setTabSearches(previous=>{
      const next={...previous,[tab]:value};
      try{sessionStorage.setItem(SEARCH_KEY,JSON.stringify(next));}catch{/* best effort */}
      return next;
    });
  };
  const [peopleAttention,setPeopleAttention]=useState<PeopleAttentionFilter>('all');
  const [activityFilters,setActivityFilters]=useState<ActivityLogFilters>(DEFAULT_ACTIVITY_LOG_FILTERS);
  const [preview,setPreview]=useState<PreviewRecord|null>(null);
  const [activityPreview,setActivityPreview]=useState<string|null>(null);
  const [orgCreateRequest,setOrgCreateRequest]=useState(0);
  const [quoteRecordId,setQuoteRecordId]=useState<string|null>(null);
  useEffect(()=>{
    const id=consumeQuoteMetadataRequest();
    if(id){setQuoteRecordId(id);setTab('quotes');}
  },[]);
  // Remember both the outer directory and nested table/board position while
  // visiting related records or other SalesShop tabs.
  const directoryRef=useRef<HTMLElement|null>(null);
  const scrollPositions=useRef<Record<string,DirectoryScroll>>(initialDirectoryScrolls());
  const scrollKey=tab+':'+(tab==='companies'?layouts.companies:tab==='deals'?layouts.deals:'table');
  const rememberScroll=(event:UIEvent<HTMLElement>)=>{
    const node=event.target as HTMLElement;
    if(!node||!directoryRef.current)return;
    const current=scrollPositions.current[scrollKey]??{};
    if(node===directoryRef.current)current.main=node.scrollTop;
    else if(node.classList.contains('connections-table-scroll')){
      current.tableTop=node.scrollTop;current.tableLeft=node.scrollLeft;
    }else if(node.classList.contains('project-board'))current.boardLeft=node.scrollLeft;
    else return;
    scrollPositions.current[scrollKey]=current;
  };
  useEffect(()=>()=>{
    try{sessionStorage.setItem(SCROLL_KEY,JSON.stringify(scrollPositions.current));}
    catch{/* best effort */}
  },[]);
  const [pipelineFilter,setPipelineFilter]=useState<DealPipelineFilter>(initialDealPipeline);
  const choosePipelineFilter=(filter:DealPipelineFilter)=>{
    setPipelineFilter(filter);
    try{localStorage.setItem(PIPELINE_FILTER_KEY,filter);}catch{/* best effort */}
  };
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>(initialCompanyFilter);
  const chooseCompanyFilter=(filter:CompanyFilter)=>{
    setCompanyFilter(filter);
    try{sessionStorage.setItem(COMPANY_FILTER_KEY,filter);}catch{/* best effort */}
  };
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
  const lastContactByPerson=useMemo(()=>personLastContactIndex(activities),[activities]);
  const quotes = useQuoteStore((state) => state.quotes);
  const authMode=useAuthStore(state=>state.mode);
  const authUser=useAuthStore(state=>state.user?.id);
  const authOrgId=useAuthStore(state=>state.organizationId);
  const authRole=useAuthStore(state=>state.teamRole);
  const authDepartment=useAuthStore(state=>state.teamDepartment);
  const personalTaskScope=usePersonalTaskStore(state=>state.scope);
  const personalTasks=usePersonalTaskStore(state=>state.tasks);
  const todayKey=localCalendarDay(new Date());
  const expectedTaskScope=taskScope(authMode,authOrgId,authUser);
  const followUpByPerson=useMemo(()=>personFollowUpIndex(
    expectedTaskScope&&personalTaskScope===expectedTaskScope?personalTasks:[],todayKey),
    [expectedTaskScope,personalTaskScope,personalTasks,todayKey]);
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
  const navigationHistory=useNavigationStore(state=>state.history);
  const goBack=useNavigationStore(state=>state.goBack);
  const beginTaskPromotion=usePersonalTaskStore(state=>state.beginPromotion);
  useEffect(()=>{
    if(focusedCompanyId||focusedContactId||focusedDealId||quoteRecordId||!recordsReady)return;
    const frame=requestAnimationFrame(()=>{
      const root=directoryRef.current;
      if(!root)return;
      const saved=scrollPositions.current[scrollKey];
      if(!saved)return;
      root.scrollTop=saved.main??0;
      const table=root.querySelector<HTMLElement>('.connections-table-scroll');
      if(table){table.scrollTop=saved.tableTop??0;table.scrollLeft=saved.tableLeft??0;}
      const board=root.querySelector<HTMLElement>('.project-board');
      if(board)board.scrollLeft=saved.boardLeft??0;
    });
    return()=>cancelAnimationFrame(frame);
  },[scrollKey,recordsReady,focusedCompanyId,focusedContactId,focusedDealId,quoteRecordId]);

  useEffect(() => { crmHydrate(); quoteHydrate(); }, [crmHydrate, quoteHydrate]);
  const chooseTab = (next: ConnectionsTab) => {
    // Quotes owns a full document library and builder. Records navigation
    // opens that existing route instead of the older metadata-only directory.
    if(next==='quotes'){requestRecordsQuotesLibrary();setView('quotes');return;}
    setPreview(null);setActivityPreview(null);setQuoteRecordId(null);
    setTab(next);setNotice('');setPeopleAttention('all');
    setCompanyCreating(false); setPersonCreating(false); setDealCreating(false);
    rememberRecordsSection(next as RecordsSection);
  };

  const companiesById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const internalCompanyIds=useMemo(()=>ourOrgCompanyIds(companies),[companies]);
  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const counts=useMemo(()=>indexConnectionsCounts(contacts,projects,quotes,activities),[contacts,projects,quotes,activities]);
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
    .filter(person=>matchesPersonAttentionFilter(person.id,peopleAttention,
      lastContactByPerson,followUpByPerson,todayKey))
    .sort((a, b) => a.name.localeCompare(b.name)), [contacts, companiesById,
      companies,needle,peopleAttention,lastContactByPerson,followUpByPerson,todayKey]);
  const projectRows = useMemo(() => projects
    .filter(project=>matchesDealPipeline(project,pipelineFilter))
    .filter((project) => findText(project.name, project.companyName, project.stage, project.nextAction, dealPipelineLabel(project.pipeline)).includes(needle))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [projects, needle,pipelineFilter]);
  const quoteRegistry=useMemo(()=>buildSalesQuoteRegistry(quotes,activities,projects),
    [quotes,activities,projects]);
  const personalQuoteRecords=useMemo(()=>mySalesQuoteRegistry(
    quoteRegistry,authMode,authUser,projects),[quoteRegistry,authMode,authUser,projects]);
  const quoteRows=useMemo(()=>personalQuoteRecords.filter(q=>
    findText(q.name,q.companyName,q.number,q.documentType,q.source,q.platform,
      q.status,q.dealName,companiesById.get(q.companyId??'')?.name).includes(needle)),
    [personalQuoteRecords,companiesById,needle]);
  const activityRows = useMemo(() => dedupeExternalQuoteActivities(activities)
    .filter(a=>!(a.type==='contact-created'&&internalCompanyIds.has(a.companyId??'')))
    .filter(activity=>matchesActivityFilters(activity,activityFilters,companies,contacts,
      projects,visibleQuotes,person=>isOurOrgContact(person,companies)))
    .filter((activity) => findText(activity.summary, activity.type,
      companiesById.get(activity.companyId ?? '')?.name,
      projectsById.get(activity.projectId ?? '')?.name).includes(needle))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)), [activities, companiesById, projectsById,internalCompanyIds,
      activityFilters,companies,contacts,projects,visibleQuotes,needle]);

  const activityTableRows=useMemo<ConnectionTableRow[]>(()=>activityRows.map(activity=>({
    id:activity.id,name:activity.summary,values:{
      name:activity.summary,
      method:activity.metadata?.interactionMethod?.replaceAll('-',' ')??'—',
      related:[companiesById.get(activity.companyId??'')?.name,
        projectsById.get(activity.projectId??'')?.name].filter(Boolean).join(' · ')||'—',
      notes:activity.metadata?.notes?.slice(0,120)??'—',
      type:activity.type.replaceAll('-',' '),
      occurred:timeLabel(activity.occurredAt),
    },sortValues:{occurred:activity.occurredAt},
  })),[activityRows,companiesById,projectsById]);
  const companyTableRows=useMemo<ConnectionTableRow[]>(()=>tab==='companies'?companyRows.map(c=>({
    id:c.id,name:c.name,isSelfCompany:isOurCompany(c),
    association:{type:'company',id:c.id,label:'Company · '+c.name},
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
  const allowedCompanyIds=useMemo(()=>new Set(companyRows.map(company=>company.id)),[companyRows]);
  const allowedDealIds=useMemo(()=>new Set(projectRows.map(deal=>deal.id)),[projectRows]);
  const quoteTableRows=useMemo<ConnectionTableRow[]>(()=>tab==='quotes'?quoteRows.map(q=>({
    id:q.id,name:q.name,
    association:q.source==='external'&&q.projectId
      ?{type:'project' as const,id:q.projectId,label:'External quote · '+q.name}
      :{type:'quote' as const,id:q.sourceId,label:'Quote · '+q.name},
    values:{name:q.name,number:q.number||'—',
      type:q.source==='external'?'External'+(q.platform?' · '+q.platform:''):
        'SalesShop · '+q.documentType,
      company:q.companyName??companiesById.get(q.companyId??'')?.name??'',
      deal:q.dealName??'',status:q.status,
      value:q.value===undefined?'':money.format(q.value),
      updated:timeLabel(q.sentDate??q.updatedAt)},
    sortValues:{value:q.value??0,updated:q.sentDate??q.updatedAt},
  })):[],[tab,quoteRows,companiesById]);
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
          if(!company||isOurOrgCompany(company)||isOurCompany(company))
            throw new Error('Our Company records must be reclassified from their Company page.');
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
  // A Company → Deal → Person journey should return to its immediate related
  // record. Direct navigation and records opened from a directory still use
  // the ordinary Connections breadcrumb instead.
  const previousLocation=navigationHistory[navigationHistory.length-1];
  const previousRelated=previousLocation?.view==='dashboard'?
    previousLocation.focusedCompanyId?{id:previousLocation.focusedCompanyId,label:'Company'}:
    previousLocation.focusedProjectId?{id:previousLocation.focusedProjectId,label:'Deal'}:
    previousLocation.focusedContactId?{id:previousLocation.focusedContactId,label:'Person'}:null:null;
  const relatedBack=(currentId:string)=>{
    if(!previousRelated||previousRelated.id===currentId)return false;
    goBack();
    return true;
  };
  const recordBackLabel=(currentId:string)=>previousRelated&&previousRelated.id!==currentId
    ?'Back to '+previousRelated.label:'Records';
  const backToDeals = () => {
    if(focusedDealId&&relatedBack(focusedDealId))return;
    chooseTab('deals');
    setView('dashboard');
  };
  const backToPeople = () => {
    if(focusedContactId&&relatedBack(focusedContactId))return;
    const person=contacts.find(c=>c.id===focusedContactId);
    chooseTab(person&&isOurOrgContact(person,companies)?'organization':'people');
    setView('dashboard');
  };
  const backToCompanies = () => {
    if(focusedCompanyId&&relatedBack(focusedCompanyId))return;
    chooseTab('companies');
    setView('dashboard');
  };
  if (focusedDealId) return <main className="connections-workspace">
    <DealRecordPage dealId={focusedDealId} onBack={backToDeals}
      backLabel={recordBackLabel(focusedDealId)}/>
  </main>;
  if (focusedContactId) return <main className="connections-workspace">
    <PersonRecordPage contactId={focusedContactId} onBack={backToPeople}
      backLabel={recordBackLabel(focusedContactId)}/>
  </main>;
  if (focusedCompanyId) return <main className="connections-workspace">
    <CompanyRecordPage companyId={focusedCompanyId} onBack={backToCompanies}
      backLabel={recordBackLabel(focusedCompanyId)}/>
  </main>;

  if(quoteRecordId)return <main className="connections-workspace">
    <QuoteRecordMetadataPage quoteId={quoteRecordId} onBack={()=>{
      setQuoteRecordId(null);chooseTab('quotes');
    }} onPreview={()=>{setQuoteRecordId(null);setPreview({kind:'quote',id:quoteRecordId});}}/>
  </main>;
  const previewRecord=(kind:PreviewRecord['kind'],id:string)=>setPreview({kind,id});
  const openQuoteMetadata=(id:string)=>{
    setPreview(null);setQuoteRecordId(id);setTab('quotes');
  };
  const dealPipelineControl=<label className="connections-filter connections-inline-type-filter connections-pipeline-dropdown">
    <select aria-label="Filter Deals by pipeline" value={pipelineFilter}
      onChange={event=>choosePipelineFilter(event.target.value as DealPipelineFilter)}>
      <option value="all">All pipelines</option>
      {DEAL_PIPELINES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
      <option value="unassigned">Unassigned</option>
    </select>
  </label>;
  const companyFilterControl=<label className="connections-filter connections-inline-type-filter">
    Type
    <select aria-label="Filter Companies by type" value={companyFilter}
      onChange={event=>chooseCompanyFilter(event.target.value as CompanyFilter)}>
      <option value="all">All</option>
      <option value="prospect">Prospects</option>
      <option value="customer">Customers</option>
      <option value="unclassified">Not classified</option>
      <option value="partner">Partners / other</option>
      <option value="self">Our Company (SELF)</option>
    </select>
  </label>;
  const openRegistryQuote=(id:string)=>{
    if(id.startsWith('external:')){setActivityPreview(id.slice('external:'.length));return;}
    const nativeId=id.startsWith('native:')?id.slice('native:'.length):id;
    setPreview({kind:'quote',id:nativeId});
  };
  return (
    <main ref={directoryRef} onScrollCapture={rememberScroll}
      className="connections-workspace connections-directory-layout">
      <WorkspaceHeader title="Records" help={<WorkspaceHelp page="connections" section={tab}/>} 
        className="connections-heading connections-foundation-heading"
        afterTitle={(tab==='companies'||tab==='deals')&&
          <div className="connections-layout-toggle" role="group"
           aria-label={(tab==='deals'?'Deals':'Companies')+' layout'}>
            <button type="button" aria-label="Table layout"
              aria-pressed={layouts[activeLayoutKind]==='table'}
              onClick={()=>chooseLayout(activeLayoutKind,'table')}>Table</button>
            <button type="button" aria-label="Board layout"
              aria-pressed={layouts[activeLayoutKind]==='board'}
              onClick={()=>chooseLayout(activeLayoutKind,'board')}>Board</button>
          </div>}
        mobileBeforeTabs={(tab==='companies'||tab==='deals')&&
          <button type="button" className="connections-mobile-layout-action"
            aria-label={'Switch '+(tab==='deals'?'Deals':'Companies')+' to '+
              (layouts[activeLayoutKind]==='board'?'Table':'Board')+' view'}
            title={'Switch to '+(layouts[activeLayoutKind]==='board'?'Table':'Board')+' view'}
            onClick={()=>chooseLayout(activeLayoutKind,layouts[activeLayoutKind]==='board'?'table':'board')}>
            {layouts[activeLayoutKind]==='board'
              ?<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                 <rect x="3" y="4" width="18" height="16" rx="2"/>
                 <path d="M3 9.5h18M3 14.5h18M9 4v16"/>
               </svg>
              :<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                 <rect x="3" y="4" width="18" height="16" rx="2"/>
                 <path d="M9 4v16M15 4v16"/>
               </svg>}
          </button>}
        mobileTabs={RECORDS_SECTIONS.map(item=>({value:item.id,label:item.label}))}
        mobileTabValue={tab} onMobileTabChange={value=>chooseTab(value as ConnectionsTab)}
        tabs={<RecordsSectionNav selected={tab as RecordsSection} onSelect={chooseTab}
          extraMore={tab==='deals'&&layouts.deals==='table'&&timelineBetaEnabled?[
            {section:'View',label:'Deals · list',active:dealsView==='list',onClick:()=>chooseDealsView('list')},
            {label:'Deals · timeline',active:dealsView==='timeline',onClick:()=>chooseDealsView('timeline')},
          ]:[]}/>}
        search={<input id="connections-directory-search" type="search" aria-label={`Search ${tab}`}
          value={query} onChange={event=>setQuery(event.target.value)}
          placeholder={tab==='companies'?'Search companies…':tab==='people'?'Search people…':
            tab==='deals'?'Search deals…':tab==='organization'?'Search internal people…':
            tab==='suppliers'?'Search suppliers and brands…':
            tab==='quotes'?'Search quotes…':tab==='tasks'?'Search tasks…':tab==='pages'?'Search pages…':'Search activities…'}/>}
        primary={<>
          {tab==='companies'&&layouts.companies==='table'&&<Button variant="primary" className="connections-add"
            onClick={()=>setCompanyCreating(value=>!value)}>+ Company</Button>}
          {(tab==='deals'||tab==='companies')&&layouts[activeLayoutKind]==='board'&&
           <button type="button" className="connections-board-header-create" disabled={!recordsReady}
            onClick={()=>document.querySelector<HTMLButtonElement>('.connections-board-host .board-add-button')?.click()}>
            {tab==='deals'?'+ Deal':'+ Company'}
           </button>}
          {tab==='people'&&<Button variant="primary" className="connections-add"
            onClick={()=>setPersonCreating(value=>!value)}>+ Person</Button>}
          {tab==='organization'&&<Button variant="primary" className="connections-add"
            disabled={!canBulkEdit} onClick={()=>setOrgCreateRequest(value=>value+1)}>+ Person</Button>}
          {tab==='suppliers'&&<Button variant="primary" className="connections-add"
            disabled={!canManageSuppliers}
            onClick={()=>window.dispatchEvent(new Event('sales-shop:catalog-create'))}>+ Supplier</Button>}
          {tab==='deals'&&layouts.deals==='table'&&timelineBetaEnabled&&<div className="ss-timeline-beta-actions ss-timeline-beta-view-toggle" role="group" aria-label="Deals display">
            <button type="button" aria-pressed={dealsView==='list'} onClick={()=>chooseDealsView('list')}>List</button>
            <button type="button" aria-pressed={dealsView==='timeline'} onClick={()=>chooseDealsView('timeline')}>Timeline <small>Beta</small></button>
          </div>}
          {tab==='deals'&&layouts.deals==='table'&&<Button variant="primary" className="connections-add"
            onClick={()=>setDealCreating(value=>!value)}>+ Deal</Button>}
          {tab==='activity'&&<Button variant="primary" className="connections-add"
            onClick={()=>openActivityComposer({})}>+ Activity</Button>}
          {tab==='tasks'&&<Button variant="primary" className="connections-add"
            onClick={()=>{
              try{sessionStorage.setItem('salesshop-create-task-v1','1');}catch{}
              window.dispatchEvent(new Event('salesshop:create-task'));
            }}>+ Task</Button>}
          {tab==='quotes'&&<Button variant="primary" className="connections-add"
            onClick={()=>{
              const launch=document.querySelector<HTMLButtonElement>('.mobile-app-hidden-launchers .quick-create-launcher')
                ??document.querySelector<HTMLButtonElement>('.app-primary-actions .quick-create-launcher');
              launch?.click();
            }}>+ Quote</Button>}
        </>}
      />
      {!recordsReady&&<WorkspaceLoadingState title="Loading Records"
        detail="Opening companies, people, deals and quote links…" />}
      <div className="connections-directory-content"
        style={!recordsReady?{display:'none'}:undefined}>
      {tab==='quotes' && <div className="connections-history-heading">
        <div><strong>{tab==='quotes'?'Quotes · metadata':'Activity history'}</strong>
          <p>{tab==='quotes'?'Document records and relationships. Open quote to work on pricing.':'A reference log of existing record events.'}</p></div>
        <div className="connections-activity-tools">
         {tab==='quotes'&&canBulkEdit&&<button type="button" onClick={()=>setExternalQuotePickerOpen(true)}>
           Record external quote</button>}
         
         <button type="button" onClick={() => chooseTab('companies')}>← Back to Companies</button>
        </div>
      </div>}


          {notice && <p className="connections-notice" role="status">{notice}</p>}
          {tab==='tasks'&&<TasksWorkspace embedded externalQuery={query}/>}
          {tab==='pages'&&<RecordsPagesDirectory query={query}/>}
          {tab==='companies'&&layouts.companies==='board'&&
            <div className="connections-board-host" aria-label="Company board layout">
              <Board embeddedMode="accounts" searchQuery={query}
                allowedCompanyIds={allowedCompanyIds} companyToolbarControl={companyFilterControl}
                onOpenQuoteMetadata={openQuoteMetadata}/>
            </div>}
          {tab === 'companies' && layouts.companies==='table' && (
            <section className="connections-directory" aria-label="Company directory">
              
              
              <ConnectionsTable key="companies" tableKey="companies" columns={companyColumns}
                rows={companyTableRows} onOpen={id=>previewRecord('company',id)} onBulkTask={bulkTask}
                toolbarControls={companyFilterControl}
                 onBulkEdit={canBulkEdit?bulkEdit:undefined} bulkEditCompanies={companies}/>
              <div className="connections-card-grid connections-legacy-cards">
                {companyRows.map((company) => {
                  const peopleCount=counts.peopleByCompany.get(company.id)??0;
                  const projectCount=counts.dealsByCompany.get(company.id)??0;
                  const companyQuoteCount=counts.quotesByCompany.get(company.id)??0;
                  return <div key={company.id} className="connections-mobile-record-group">
                    <button type="button" className="connections-record" onClick={() => previewRecord('company',company.id)}>
                    <span className="connections-record-eyebrow">{companyRelationshipLabel(company)}</span>
                    <strong>{company.name}{isOurCompany(company)&&
                      <span className="connections-table-self-badge">SELF</span>}</strong>
                    <small>{peopleCount} people · {projectCount} deals · {companyQuoteCount} linked quotes</small>
                  </button>
                    <button type="button" className="connections-mobile-top-action"
                      onClick={()=>openCompany(company.id)} aria-label={'Open full page for '+company.name}>Full page</button>
                </div>;
                })}
              </div>
              {!companyRows.length && <StatusText state="empty" className="connections-empty">No companies match. Try another search or relationship type.</StatusText>}
            </section>
          )}
          {tab === 'people' && (
            <section className="connections-directory" aria-label="People directory">
              
              
              <div className="connections-people-attention-filters is-mobile" role="group" aria-label="People follow-up filters">
               {([
                 ['all','All'],['never','Never contacted'],
                 ['stale','Inactive 30+ days'],['overdue','Follow-up overdue'],
                ] as const).map(([value,label])=><button type="button" key={value}
                aria-pressed={peopleAttention===value} onClick={()=>setPeopleAttention(value)}>
                {label}</button>)}
              </div>
              <ConnectionsTable key="people" tableKey="people" columns={peopleColumns}
                rows={peopleTableRows} onOpen={id=>previewRecord('person',id)} onBulkTask={bulkTask}
                toolbarControls={<>
              <div className="connections-people-attention-filters" role="group" aria-label="People follow-up filters">
               {([
                 ['all','All'],['never','Never contacted'],
                 ['stale','Inactive 30+ days'],['overdue','Follow-up overdue'],
                ] as const).map(([value,label])=><button type="button" key={value}
                aria-pressed={peopleAttention===value} onClick={()=>setPeopleAttention(value)}>
                {label}</button>)}
              </div>
                </>}
                 onBulkEdit={canBulkEdit?bulkEdit:undefined} bulkEditCompanies={companies}/>
              <div className="connections-card-grid connections-legacy-cards">
                {peopleRows.map((person) => <div key={person.id} className="connections-mobile-record-group">
                <button type="button" className="connections-record connections-person-record" onClick={() => previewRecord('person',person.id)}>
                  <span className="connections-record-eyebrow">{companiesById.get(person.companyId ?? '')?.name ?? 'Unassigned company'}</span>
                  <strong>{person.name&&person.name.trim().toLowerCase()!==person.email?.trim().toLowerCase()
                    ?person.name:'Unnamed contact'}</strong>
                  <span className="connections-person-card-meta">
                    <span className="connections-person-card-relationship">
                     <small>{lastContactByPerson.has(person.id)
                       ?'Last contacted · '+timeLabel(lastContactByPerson.get(person.id)?.occurredAt)
                       :'Never contacted'}</small>
                     {followUpByPerson.get(person.id)&&<small
                       className={'connections-person-follow-up'+
                         (followUpByPerson.get(person.id)?.overdue?' is-overdue':'')}>
                       {followUpByPerson.get(person.id)?.overdue?'Overdue follow-up':'Follow-up'}
                       {' · '}{followUpByPerson.get(person.id)?.dueDate
                         ?followUpDateLabel(followUpByPerson.get(person.id)!.dueDate!)
                         :'No due date'}
                     </small>}
                    </span>
                    <span className="connections-person-card-methods" aria-label="Contact information available">
                      {Boolean(person.phone?.trim())&&<ContactOnFileIcon kind="phone"/>}
                      {Boolean(person.email?.trim())&&<ContactOnFileIcon kind="email"/>}
                      {!person.phone?.trim()&&!person.email?.trim()&&
                        <span className="connections-person-card-no-info">No phone or email</span>}
                    </span>
                  </span>
                </button>
                <button type="button" className="connections-mobile-top-action"
                  onClick={()=>openPerson(person.id)} aria-label={'Open full page for '+(person.name||person.email||'person')}>Full page</button>
              </div>)}
              </div>
              {!peopleRows.length && <StatusText state="empty" className="connections-empty">
                No people match the search and follow-up filters.
                {peopleAttention!=='all'&&<button type="button" onClick={()=>setPeopleAttention('all')}>
                  Clear follow-up filter</button>}
               </StatusText>}

            </section>
          )}
          {tab==='deals'&&layouts.deals==='board'&&
            <div className="connections-board-host" aria-label="Deal board layout">
              <Board embeddedMode="projects" searchQuery={query}
                allowedDealIds={allowedDealIds} pipelineFilter={pipelineFilter}
                onPipelineFilterChange={choosePipelineFilter}
                onOpenQuoteMetadata={openQuoteMetadata}/>
            </div>}
          {tab==='deals'&&layouts.deals==='table'&&timelineBetaEnabled&&dealsView==='timeline'&&
            <DealTimelineBetaOverview projects={projectRows} onOpen={openProject}/>}
          {tab === 'deals' && layouts.deals==='table' && (!timelineBetaEnabled||dealsView==='list') && <section className="connections-directory" aria-label="Deals directory">
            
            <div className="connections-deals-capture-bar is-mobile">
              <span className="connections-deals-capture-title">Deals</span>
              <button type="button" disabled={!canBulkEdit} onClick={()=>setExternalQuotePickerOpen(true)}>
               <span aria-hidden="true">+</span> Record external quote
              </button>
            </div>
            <ConnectionsTable key="deals" tableKey="deals" columns={dealColumns}
              rows={dealTableRows} onOpen={id=>previewRecord('deal',id)} onBulkTask={bulkTask}
              toolbarControls={<>{dealPipelineControl}
               <button type="button" disabled={!canBulkEdit}
                onClick={()=>setExternalQuotePickerOpen(true)}>+ Record external quote</button>
              </>}
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
                </button>
                  <button type="button" className="connections-mobile-top-action"
                    onClick={()=>openProject(project.id)} aria-label={'Open full page for '+project.name}>Full page</button>
                </div>;
              })}
            </div>
            {!projectRows.length && <StatusText state="empty" className="connections-empty">No deals match your search.</StatusText>}
          </section>}
          {tab === 'quotes' && <section className="connections-directory" aria-label="Quote metadata directory">
            
            <ConnectionsTable key="quotes" tableKey="quotes" columns={quoteColumns}
              rows={quoteTableRows} onOpen={openRegistryQuote} onBulkTask={bulkTask}/>
            <div className="connections-mobile-quote-records">
              {quoteRows.map(q=><div key={q.id} className="connections-mobile-record-group">
                <button type="button" className="connections-record" onClick={()=>openRegistryQuote(q.id)}>
                  <strong>{q.name}</strong>
                  <small>{q.source==='external'?'External'+(q.platform?' · '+q.platform:''):
                    'SalesShop · '+q.number} · {q.companyName??companiesById.get(q.companyId??'')?.name??'No company'} · {q.status}</small>
                  <small>{q.value===undefined?'Value not recorded':money.format(q.value)}
                    {q.sentDate?' · Sent '+timeLabel(q.sentDate):''}</small>
                </button>
                <button type="button" className="connections-mobile-top-action"
                  onClick={()=>q.source==='external'?setActivityPreview(q.sourceId):
                    (setQuoteRecordId(q.sourceId),setTab('quotes'))}
                  aria-label={(q.source==='external'?'View external quote details ':'Open full quote record ')+q.name}>
                  {q.source==='external'?'Details':'Full page'}</button>
              </div>)}
            </div>
            {!quoteRows.length&&<StatusText state="empty" className="connections-empty">
              No quote records match. Search SalesShop and external quotes or record an external bid.
            </StatusText>}
          </section>}
          {tab==='organization'&&<OurOrganizationDirectory onOpenPerson={openPerson} query={query}
            createRequest={orgCreateRequest} onCreateConsumed={()=>setOrgCreateRequest(0)}/>}
          {tab==='suppliers'&&<div className="connections-suppliers-host">
            <SuppliersWorkspace externalQuery={query} embeddedInConnections/>
          </div>}
          {tab==='activity'&&<section className="connections-directory records-activity-directory" aria-label="Activity history">
            <ConnectionsTable tableKey="activity" columns={ACTIVITY_COLUMNS} rows={activityTableRows}
              onOpen={id=>{const activity=activityRows.find(a=>a.id===id);if(activity)openActivity(activity);}}
              toolbarControls={<div className="connections-activity-filters" aria-label="Filter Activity history">
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
              </div>}/>
          </section>}
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
        onGoToQuotePage={openQuoteMetadata}/>}
      {(companyCreating||personCreating||dealCreating)&&createPortal(
        <div className="connections-create-backdrop" onPointerDown={event=>{
          if(event.target===event.currentTarget)closeNewRecord();
        }}>
          <section ref={newRecordRef} className="connections-create-dialog" role="dialog" aria-modal="true"
            aria-label={companyCreating?'New company':personCreating?'New person':'New deal'}>
            <header className="connections-create-heading">
              <div><small>RECORDS · CREATE</small>
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
