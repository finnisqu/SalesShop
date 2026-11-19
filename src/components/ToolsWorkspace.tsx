import {useEffect,useMemo,useState} from 'react';
import {SectionTabs} from '../design-system/components';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useAuthStore} from '../store/authStore';
import {taskScope,usePersonalTaskStore} from '../store/personalTaskStore';
import {buildSalesQuoteRegistry,mySalesQuoteRegistry} from '../services/salesQuoteRegistry';
import {scopedStorageKey} from '../lib/developerPlayground';
import {RECORDS_TAB_KEY} from './RecordsSectionNav';
import {WorkspaceHeader} from './WorkspaceHeader';
import {WorkspaceHelp} from './WorkspaceHelp';
import {WorkspaceLoadingState} from './WorkspaceLoadingState';
import {SalesAnalyticsWorkspace} from './SalesAnalyticsWorkspace';
import {FilesWorkspace} from './FilesWorkspace';
import {AutomationsWorkspace} from './AutomationsWorkspace';
import {EmailWorkspace} from './EmailWorkspace';
import {CrmImportWorkspace385} from './CrmImportWorkspace385';
import {CrmSuggestionsWorkspace387} from './CrmSuggestionsWorkspace387';
import './tools-workspace.css';

export const TOOLS_SECTIONS=[
 {id:'analytics',label:'Analytics',description:'Pipeline and activity insights'},
 {id:'files',label:'Files & Docs',description:'Storage inventory and linked documents'},
 {id:'automations',label:'Automations',description:'Rule-based private Tasks'},
 {id:'email',label:'Email',description:'Connected Gmail conversations'},
 {id:'import',label:'Import',description:'Review CSV and Excel CRM records'},
 {id:'suggestions',label:'Suggestions',description:'Review proposed CRM records, links, and Tasks'},
] as const;
export type ToolsSection=typeof TOOLS_SECTIONS[number]['id'];
export const TOOLS_TAB_KEY=scopedStorageKey('salesshop-tools-section-v1');

/** Preserve the last tool from Records > More for existing sessions. */
export function resolveToolsLanding(saved:string|null,legacy:string|null):ToolsSection{
 for(const candidate of [saved,legacy]){
  if(TOOLS_SECTIONS.some(item=>item.id===candidate))return candidate as ToolsSection;
 }
 return 'analytics';
}
function initialSection():ToolsSection{
 try{return resolveToolsLanding(
  sessionStorage.getItem(TOOLS_TAB_KEY),
  sessionStorage.getItem(RECORDS_TAB_KEY),
 );}catch{return 'analytics';}
}
/** One owning Tools page: the existing prototypes retain their data/permissions. */
export function ToolsWorkspace(){
 const [section,setSection]=useState<ToolsSection>(initialSection);
 const [query,setQuery]=useState('');
 const hydrateCrm=useCrmStore(s=>s.hydrate);
 const hydrateQuotes=useQuoteStore(s=>s.hydrate);
 const crmReady=useCrmStore(s=>s.hydrated);
 const quotesReady=useQuoteStore(s=>s.hydrated);
 const companies=useCrmStore(s=>s.companies);
 const contacts=useCrmStore(s=>s.contacts);
 const deals=useCrmStore(s=>s.projects);
 const activities=useCrmStore(s=>s.activities);
 const quotes=useQuoteStore(s=>s.quotes);
 const mode=useAuthStore(s=>s.mode);
 const organizationId=useAuthStore(s=>s.organizationId);
 const userId=useAuthStore(s=>s.user?.id);
 const taskStorageScope=usePersonalTaskStore(s=>s.scope);
 const tasks=usePersonalTaskStore(s=>s.tasks);
 const expectedScope=taskScope(mode,organizationId,userId);
 useEffect(()=>{void hydrateCrm();void hydrateQuotes();},[hydrateCrm,hydrateQuotes]);
 const quoteRecords=useMemo(()=>
  mySalesQuoteRegistry(buildSalesQuoteRegistry(quotes,activities,deals),mode,userId,deals),
  [quotes,activities,deals,mode,userId]);
 const select=(next:ToolsSection)=>{
  setSection(next);setQuery('');
  try{sessionStorage.setItem(TOOLS_TAB_KEY,next);}catch{/* optional */}
 };
 return <main className="ss-tools-workspace" aria-label="SalesShop Tools">
  <WorkspaceHeader title="Tools" help={<WorkspaceHelp page="tools" section={section}/>}
   tabs={<div className="ss-tools-tab-pill ss-header-tab-pill">
    <SectionTabs className="ss-tools-section-tabs" aria-label="Tools sections"
     items={TOOLS_SECTIONS} selected={section} onSelect={select}/>
   </div>}
   mobileTabs={TOOLS_SECTIONS.map(item=>({value:item.id,label:item.label}))}
   mobileTabValue={section} onMobileTabChange={value=>select(value as ToolsSection)}
   search={section==='files'?<input type="search" aria-label="Search files and documents"
    placeholder="Search files and folders…" value={query}
    onChange={event=>setQuery(event.target.value)}/>:undefined}
  />
  {!crmReady||!quotesReady?
   <WorkspaceLoadingState title="Opening Tools" detail="Loading accessible CRM and Quote records…"/>:
   <div className="ss-tools-content">
    {section==='analytics'&&<SalesAnalyticsWorkspace projects={deals}
     quoteRecords={quoteRecords} activities={activities}
     personalTasks={expectedScope&&taskStorageScope===expectedScope?tasks:[]}/>}
    {section==='files'&&<FilesWorkspace companies={companies} deals={deals}
     quotes={quoteRecords} query={query}/>}
    {section==='automations'&&<AutomationsWorkspace/>}
    {section==='email'&&<EmailWorkspace contacts={contacts} deals={deals} companies={companies}/>}
    {section==='import'&&<CrmImportWorkspace385 key={[mode,organizationId,userId].join(':')}/>}
    {section==='suggestions'&&<CrmSuggestionsWorkspace387 key={[mode,organizationId,userId].join(':')}/>}
   </div>}
 </main>;
}
