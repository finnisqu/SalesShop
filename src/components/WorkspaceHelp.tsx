import {useEffect,useRef} from 'react';
import {useDismissibleDetails} from './useDismissibleDetails';
import {HomeCalendarHelpLegend} from './HomeCalendarCustomizer';

export type WorkspaceHelpPage='home'|'quotes'|'tasks'|'board'|'connections'|'notebook'|'catalog'|'settings';
type Tip={label:string;text:string};
type Article={name:string;intro:string;tips:readonly Tip[]};
const pages:Record<WorkspaceHelpPage,Article>={
 home:{name:'Home',intro:'A view of your schedule and an easy place to start work.',tips:[
  {label:'Calendar',text:'Select any calendar date to show its pending tasks. Expand the collapsed On this day categories directly under the agenda to open sent quotes, logged activities, completed tasks, new people, companies, and Notebook entries. Recent work remains independent; badge tapping is optional on mobile.'},
  {label:'Log Activity',text:'Record a call, email, text, video meeting, or visit and link it to a CRM record.'},
  {label:'Create',text:'Use quick-create tools to start a quote, task, or note.'}]},
 quotes:{name:'Quotes',intro:'Find, create, and manage pricing documents.',tips:[
  {label:'New documents',text:'Use + Document to choose a template. Quick Quote combines takeoffs, selections, and pricing.'},
  {label:'Find work',text:'Use the tabs, More menu, and status filters to find drafts, issued documents, or archived work.'},
  {label:'Table tools',text:'Click a name for its record preview. Select rows for group actions; Columns controls fields and row spacing.'}]},
 tasks:{name:'Tasks',intro:'Personal tasks connected to the rest of SalesShop.',tips:[
  {label:'Dates',text:'A due date never hides a task from All open. Start later is for work you do not plan to begin yet.'},
  {label:'Queue & Overview',text:'Filter by workstream, check daily totals, and open Calendar for dated tasks.'},
  {label:'Quick changes',text:'On mobile, tap the title to preview, set priority inline, or tap Due today. Use bulk editing to update several tasks.'}]},
 board:{name:'Board',intro:'Deals and accounts organized into visual columns.',tips:[
  {label:'Preview',text:'Click a card name to see its record without leaving Board.'},
  {label:'Scroll',text:'Shift + mouse wheel moves across the whole Board, even over a column. Ordinary wheel scrolls within columns.'},
  {label:'Reduce clutter',text:'Collapse column headings or use More to show compact cards.'}]},
 connections:{name:'Connections',intro:'Your CRM directory of companies, people, deals, and their relationships.',tips:[
  {label:'Explore related records',text:'Tap a name to preview. Follow related records inside the preview and use Back on mobile to return to the previous one.'},
  {label:'Related records',text:'Link people to companies and deals to quotes so everyone can find the connected work.'},
  {label:'Quick actions',text:'On mobile, change company type or deal stage inline, call or email a contact, or open its full record directly.'}]},
 notebook:{name:'Notebook',intro:'Pages, daily notes, and a linked agenda.',tips:[
  {label:'Daily pages',text:'A daily page is created when you use Notes on Home, not automatically every day.'},
  {label:'Linked agenda',text:'Keep calendar items alongside your notes without disrupting the page layout.'},
  {label:'Split view',text:'Use More to open or swap a second notebook page.'}]},
 catalog:{name:'Catalog',intro:'Materials, sinks, rates, suppliers, and classification tags.',tips:[
  {label:'Browse',text:'Choose a Catalog section to inspect its prices, variants, or references.'},
  {label:'Compare',text:'Pin material variants to reveal the comparison board. It stays hidden with no pins.'},
  {label:'Pricing setup',text:'Rates and builder material levels help maintain standard selling prices.'}]},
 settings:{name:'Settings',intro:'Company identity, account preferences, team access, and appearance.',tips:[
  {label:'Company',text:'Branding and company details affect shared records and customer documents.'},
  {label:'Your preferences',text:'Appearance and account settings personalize your experience.'},
  {label:'Permissions & saving',text:'Available tools depend on your role. Look for save indicators and validation messages.'}]},
};
const contexts:Record<WorkspaceHelpPage,Record<string,Tip>>={
 home:{},
 board:{
  deals:{label:'Deals view',text:'Drag cards between stages. More can filter the pipeline.'},
  accounts:{label:'Accounts view',text:'Columns organize customers by relationship health; click a name to preview its account.'}},
 quotes:{
  all:{label:'All documents',text:'Preview document records or open a document to edit.'},
  'quick-quote':{label:'Quick Quote',text:'Build takeoffs and pricing, review the result, then inspect the customer preview.'},
  'builder-rates':{label:'Builder Rate Schedule',text:'Manage builder pricing programs rather than single-job takeoffs.'},
  'community-pricing':{label:'Community Plan Pricing',text:'This view holds community plan pricing documents.'},
  spreadsheet:{label:'Custom Spreadsheet',text:'This view holds custom spreadsheet pricing documents.'},
  'follow-ups':{label:'Follow-ups',text:'Review outstanding quote follow-ups without changing the underlying estimate.'}},
 tasks:{
  active:{label:'Open',text:'Due dates alone do not remove tasks from the open queue.'},
  today:{label:'Today',text:'Focus on tasks relevant to today.'},
  upcoming:{label:'Upcoming',text:'Review upcoming scheduled tasks.'},
  overdue:{label:'Overdue',text:'Review late tasks that need attention.'},
  scheduled:{label:'Start later',text:'Keep work scheduled for a later start separate from your immediate queue.'},
  completed:{label:'Completed',text:'Review finished tasks without deleting their history.'},
  all:{label:'All history',text:'See tasks across all statuses.'}},
 connections:{
  companies:{label:'Companies',text:'Inspect customer and partner accounts and their related people and deals.'},
  people:{label:'People',text:'Review contacts and the companies they belong to.'},
  deals:{label:'Deals',text:'Link companies, next actions, stages, and quote documents.'},
  activity:{label:'Activity history',text:'Browse recorded interactions and touchpoints.'},
  quotes:{label:'Quote metadata',text:'View document records and CRM links here; edit pricing in Quotes.'}},
 notebook:{
  pages:{label:'Pages',text:'Browse, search, and organize notebook pages.'},
  agenda:{label:'Agenda',text:'Review planned work alongside your notes.'}},
 catalog:{
  materials:{label:'Materials',text:'Expand products to see variants and supplier pricing.'},
  sinks:{label:'Sinks',text:'Browse sink models, variants, customer prices, and costs.'},
  rates:{label:'Rates',text:'Maintain fabrication, installation, and service rates.'},
  suppliers:{label:'Suppliers',text:'Review vendors and their catalog price sources.'},
  tags:{label:'Tags',text:'Use and define tags for materials and slab variants.'},
  other:{label:'Other — planned',text:'Accessories and shop consumables are not yet editable here.'}},
 settings:{
  company:{label:'Company',text:'Company identity and document branding.'},
  account:{label:'Account',text:'Your profile, account, and privacy.'},
  team:{label:'Team',text:'Team membership and permissions, if authorized.'},
  appearance:{label:'Appearance',text:'Themes and display preferences.'},
  beta:{label:'Beta features',text:'Opt into available experimental features.'},
  data:{label:'Data',text:'Data management and maintenance options.'},
  advanced:{label:'Advanced',text:'Additional configuration options.'}},
};
/** Native, keyboard-accessible info button. Outside clicks and Escape close it. */
export function WorkspaceHelp({page,section}:{page:WorkspaceHelpPage;section?:string}){
 const ref=useRef<HTMLDetailsElement>(null);
 useDismissibleDetails(ref);
 useEffect(()=>{if(ref.current)ref.current.open=false;},[page,section]);
 const article=pages[page],current=section?contexts[page][section]:undefined;
 return <details className="ss-workspace-help" ref={ref}>
  <summary aria-label={'Help with '+article.name} title={'About '+article.name}>
   <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9"/><path d="M12 11v6"/>
    <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/>
   </svg>
  </summary>
  <section className="ss-workspace-help__popover" aria-label={article.name+' quick guide'}>
   <div className="ss-workspace-help__heading"><small>QUICK GUIDE</small><strong>Using {article.name}</strong></div>
   <p className="ss-workspace-help__intro">{article.intro}</p>
   {current&&<div className="ss-workspace-help__current"><strong>{current.label}</strong><p>{current.text}</p></div>}
   <ul>{article.tips.map(tip=><li key={tip.label}><strong>{tip.label}</strong><span>{tip.text}</span></li>)}</ul>
   {page==='home'&&<HomeCalendarHelpLegend/>}
   <small className="ss-workspace-help__dismiss">Click outside or press Esc to close.</small>
  </section>
 </details>;
}
