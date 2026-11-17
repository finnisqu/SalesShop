import {useEffect,useRef,useState} from 'react';
import {useAuthStore} from '../store/authStore';
import {useCrmStore} from '../store/crmStore';
import {useQuoteStore} from '../store/quoteStore';
import {useNotebookStore} from '../store/notebookStore';
import {useNavigationStore,type AppView} from '../store/navigationStore';
import {scopedStorageKey} from '../lib/developerPlayground';
import {parseRecentVisits,rememberRecentVisit,recentVisitFromLocation,type RecentVisit} from '../services/recentVisits';
import './recent-visits.css';

const VIEW_TITLES:Record<AppView,string>={
 home:'Home',notebook:'Notebook',board:'Records',quotes:'Quotes',tasks:'Tasks',
 catalog:'Catalog',dashboard:'Records',tools:'Tools',settings:'Settings',
};
const CATALOG_TITLES:Record<string,string>={
 materials:'Materials',sinks:'Sinks',other:'Other',rates:'Rates',
 suppliers:'Suppliers',tags:'Tags',
};
interface Item{visit:RecentVisit;title:string;detail:string;}
function readVisits(key:string):RecentVisit[]{
 try{return parseRecentVisits(window.localStorage.getItem(key));}
 catch{return [];}
}
function writeVisits(key:string,items:RecentVisit[]){
 try{window.localStorage.setItem(key,JSON.stringify(items));}
 catch{/* Recent visits are a convenience, not a required store. */}
}

/** Clicking the SalesShop logo opens a user-scoped, bounded visit list.
 * Entries resolve from current stores; unavailable/private records never render. */
export function RecentVisitsMenu({disabled=false}:{disabled?:boolean}){
 const mode=useAuthStore(s=>s.mode);
 const org=useAuthStore(s=>s.organizationId);
 const user=useAuthStore(s=>s.user?.id);
 const companies=useCrmStore(s=>s.companies);
 const people=useCrmStore(s=>s.contacts);
 const deals=useCrmStore(s=>s.projects);
 const quotes=useQuoteStore(s=>s.quotes);
 const notebook=useNotebookStore(s=>s.entries);
 const [items,setItems]=useState<RecentVisit[]>([]);
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 const key=mode==='cloud'
  ?(user?scopedStorageKey('salesshop-recent-visits-v1')+':'+(org??'personal')+':'+user:null)
  :scopedStorageKey('salesshop-recent-visits-v1')+':local';

 useEffect(()=>{
  setOpen(false);
  if(!key||disabled){setItems([]);return;}
  let history=readVisits(key);
  setItems(history);
  const capture=()=>{
   const nav=useNavigationStore.getState();
   const page=useNotebookStore.getState().activeEntryId;
   const next=recentVisitFromLocation(nav,page);
   const updated=rememberRecentVisit(history,next);
   if(updated===history)return;
   history=updated;setItems(updated);writeVisits(key,updated);
  };
  capture();
  const unsubNav=useNavigationStore.subscribe(capture);
  const unsubNotebook=useNotebookStore.subscribe((next,previous)=>{
   if(next.activeEntryId!==previous.activeEntryId&&useNavigationStore.getState().view==='notebook')
    capture();
  });
  return ()=>{unsubNav();unsubNotebook();};
 },[key,disabled]);

 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{
   if(!root.current?.contains(event.target as Node))setOpen(false);
  };
  const escape=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){setOpen(false);root.current?.querySelector<HTMLButtonElement>('.ss-recent-visits-trigger')?.focus();}
  };
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);

 const visible=items.map((visit):Item|null=>{
  if(visit.kind==='deal'){
   const record=deals.find(item=>item.id===visit.id);
   return record?{visit,title:record.name,detail:'Deal'}:null;
  }
  if(visit.kind==='company'){
   const record=companies.find(item=>item.id===visit.id);
   return record?{visit,title:record.name,detail:'Company'}:null;
  }
  if(visit.kind==='person'){
   const record=people.find(item=>item.id===visit.id);
   return record?{visit,title:record.name||record.email||'Unnamed person',detail:'Person'}:null;
  }
  if(visit.kind==='quote'){
   const quote=quotes.find(item=>item.id===visit.id&&!item.archivedAt);
   return quote?{visit,title:quote.title||'Untitled quote',detail:'Quote'}:null;
  }
  if(visit.kind==='notebook'){
   const page=notebook.find(item=>item.id===visit.id&&!item.hidden);
   return page?{visit,title:page.title||'Untitled page',detail:'Notebook'}:null;
  }
  if(visit.kind==='catalog')
   return {visit,title:CATALOG_TITLES[visit.id]||'Catalog',detail:'Catalog'};
  if(visit.kind==='view')
   return {visit,title:VIEW_TITLES[visit.id],detail:'Workspace'};
  return null;
 }).filter((item):item is Item=>item!==null);

 const openVisit=(visit:RecentVisit)=>{
  setOpen(false);
  const nav=useNavigationStore.getState();
  switch(visit.kind){
   case 'deal':nav.openProject(visit.id);break;
   case 'company':nav.openCompany(visit.id);break;
   case 'person':nav.openPerson(visit.id);break;
   case 'quote':nav.openQuote(visit.id);break;
   case 'notebook':nav.openNotebookPage(visit.id);break;
   case 'catalog':nav.openCatalog(visit.id);break;
   case 'view':nav.setView(visit.id);break;
  }
 };
 return <div className="brand-lockup ss-recent-visits" ref={root}>
  <button type="button" className="ss-recent-visits-trigger" disabled={disabled}
   aria-label="Recently visited pages" aria-haspopup="dialog" aria-expanded={open}
   aria-controls="ss-recent-visits-panel" title="Recently visited"
   onClick={()=>setOpen(value=>!value)}>
   <span className="brand-mark" aria-hidden="true">S</span><strong>SalesShop</strong>
  </button>
  {open&&<div id="ss-recent-visits-panel" className="ss-recent-visits-popover"
    role="dialog" aria-label="Recently visited pages">
   <div className="ss-recent-visits-heading"><strong>Recently visited</strong>
    <button type="button" aria-label="Close recent visits" onClick={()=>setOpen(false)}>×</button>
   </div>
   <div className="ss-recent-visits-list">
    {visible.map(item=><button type="button" key={item.visit.kind+':'+item.visit.id}
      onClick={()=>openVisit(item.visit)}>
      <span className="ss-recent-visits-item-title">{item.title}</span>
      <small>{item.detail}</small>
     </button>)}
    {!visible.length&&<p>No recent pages yet. Open a record to start this list.</p>}
   </div>
  </div>}
 </div>;
}
