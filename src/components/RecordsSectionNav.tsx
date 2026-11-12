import {SectionTabs} from '../design-system/components';
import {WorkspaceMoreMenu,type WorkspaceMoreItem} from './WorkspaceHeader';
import './records-section-nav.css';

/** The five everyday Records destinations share one navigation contract.
 * Extra directories stay in the More menu, not the primary app navigation. */
export const RECORDS_MAIN_TABS=[
 {id:'companies',label:'Companies',description:'Companies & partners'},
 {id:'people',label:'People',description:'Contacts'},
 {id:'deals',label:'Deals',description:'Opportunities & jobs'},
 {id:'quotes',label:'Quotes',description:'Quotes and commercial documents'},
 {id:'tasks',label:'Tasks',description:'Work and deadlines'},
] as const;
export type RecordsMainTab=typeof RECORDS_MAIN_TABS[number]['id'];
export const RECORDS_MORE_TABS=[
 {id:'suppliers',label:'Suppliers',description:'Vendors and sourcing'},
 {id:'pages',label:'Pages',description:'Notebook page directory'},
 {id:'activity',label:'Activity',description:'Recorded events and interactions'},
 {id:'organization',label:'Our Organization',description:'Internal team directory'},
] as const;
export type RecordsMoreTab=typeof RECORDS_MORE_TABS[number]['id'];
export type RecordsSection=RecordsMainTab|RecordsMoreTab;
export const RECORDS_SECTIONS=[...RECORDS_MAIN_TABS,...RECORDS_MORE_TABS];

export const RECORDS_TAB_KEY='salesshop-connections-tab-v1';
export const RECORDS_QUOTES_LIBRARY_KEY='salesshop-records-quotes-library-v1';
export function requestRecordsQuotesLibrary(){
 try{sessionStorage.setItem(RECORDS_QUOTES_LIBRARY_KEY,'1');}
 catch{/* optional browser storage */}
}
export function rememberRecordsSection(next:RecordsSection){
 // The Quotes library owns its own route; don't reopen the legacy quote
 // metadata table when someone returns to the Records dashboard.
 if(next==='quotes')return;
 try{sessionStorage.setItem(RECORDS_TAB_KEY,next);}catch{/* session storage optional */}
}

export function RecordsSectionNav({selected,onSelect,extraMore=[]}:{
 selected:RecordsSection;
 onSelect:(next:RecordsSection)=>void;
 extraMore?:readonly WorkspaceMoreItem[];
}){
 const additional:WorkspaceMoreItem[]=[
  ...RECORDS_MORE_TABS.map(item=>({
   section:'More records',label:item.label,active:selected===item.id,
   onClick:()=>onSelect(item.id),
  })),
  ...extraMore,
 ];
 return <div className="records-section-nav" role="group" aria-label="Records sections">
  <SectionTabs className="connections-tabs records-section-nav-tabs"
   aria-label="Records sections" items={RECORDS_MAIN_TABS}
   selected={selected} onSelect={onSelect}/>
  <div className={"records-section-more"+(RECORDS_MORE_TABS.some(item=>item.id===selected)?" is-active":"")}>
   <WorkspaceMoreMenu label="Records sections" items={additional}/>
  </div>
 </div>;
}
