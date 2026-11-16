import {useMemo,useState} from 'react';
import type {Activity,Project,DealPipeline} from '../types/crm';
import {DEAL_PIPELINES} from '../types/crm';
import type {SalesQuoteRecord} from '../services/salesQuoteRegistry';
import type {PersonalTask} from '../store/personalTaskStore';
import {useAuthStore} from '../store/authStore';
import {useNavigationStore} from '../store/navigationStore';
import {useDealAssigneeDirectory} from '../services/dealAssignees';
import {buildSalesAnalytics,type AnalyticsPeriod} from '../services/salesAnalytics354a';
import './sales-analytics.css';

const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
type Props={
 projects:readonly Project[];quoteRecords:readonly SalesQuoteRecord[];
 activities:readonly Activity[];personalTasks:readonly PersonalTask[];
};
/** Analytics v0.1: a real, read-only lens over accessible CRM data.
 * No separate reporting database or external credential is needed. */
export function SalesAnalyticsWorkspace({projects,quoteRecords,activities,personalTasks}:Props){
 const [period,setPeriod]=useState<AnalyticsPeriod>('90d');
 const [owner,setOwner]=useState('all');
 const [pipeline,setPipeline]=useState<'all'|DealPipeline>('all');
 const mode=useAuthStore(s=>s.mode),userId=useAuthStore(s=>s.user?.id);
 const {members}=useDealAssigneeDirectory();
 const openDeal=useNavigationStore(s=>s.openProject);
 const openQuote=useNavigationStore(s=>s.openQuote);
 const ownerOptions=useMemo(()=>{
  if(mode!=='cloud')return [{id:'all',name:'All local records'}];
  const ids=new Set<string>();
  const choices=[{id:'all',name:'All accessible owners'}];
  if(userId){ids.add(userId);choices.push({id:userId,name:'My records'});}
  for(const member of members){
   if(!ids.has(member.userId)){ids.add(member.userId);choices.push({id:member.userId,name:member.name});}
  }
  return choices;
 },[mode,userId,members]);
 const result=useMemo(()=>buildSalesAnalytics(projects,quoteRecords,activities,
  personalTasks,{period,ownerId:owner,pipeline}),[projects,quoteRecords,activities,personalTasks,period,owner,pipeline]);
 const maxStage=Math.max(1,...result.pipelineByStage.map(row=>row.value));
 const maxTrend=Math.max(1,...result.trend.map(row=>row.sent+row.interactions));
 const dateLabel=result.since?result.since+' through '+result.through:'All available dates';
 const kpis=[
  {name:'Open pipeline',value:money.format(result.openValue),hint:result.openDeals+' active Deals in selected creation window'},
  {name:'Deals created',value:result.dealsCreated.toLocaleString(),hint:'Created during the selected period'},
  {name:'Quotes delivered',value:result.sentQuotes.toLocaleString(),hint:result.nativeSent+' SalesShop · '+result.externalSent+' external'},
  {name:'Delivered bid value',value:money.format(result.sentValue),hint:result.missingQuoteValues?result.missingQuoteValues+' delivered record(s) missing a value':'Recorded selling totals'},
  {name:'Won Deals',value:result.wonDeals.toLocaleString(),hint:money.format(result.wonValue)+' current value'},
  {name:'Won / decided',value:result.winRate===null?'—':Math.round(result.winRate*100)+'%',hint:result.wonDeals+' won · '+result.lostDeals+' lost (creation cohort)'},
 ];
 return <section className="ss-sales-analytics" aria-label="Sales analytics overview">
  <div className="ss-analytics-intro">
   <div><small>SALES INTELLIGENCE · PROTOTYPE V0.1</small><h2>Analytics</h2>
    <p>Understand pipeline, bids and activity from the records already in SalesShop.</p></div>
   <span className="ss-analytics-scope">Read-only · {dateLabel}</span>
  </div>
  <div className="ss-analytics-filters" role="group" aria-label="Analytics filters">
   <label>Time period<select aria-label="Analytics time period" value={period}
     onChange={e=>setPeriod(e.target.value as AnalyticsPeriod)}>
    <option value="30d">Last 30 days</option><option value="90d">Last 90 days</option>
    <option value="365d">Last 365 days</option><option value="all">All available</option>
   </select></label>
   <label>Record owner<select aria-label="Analytics owner" value={owner}
     onChange={e=>setOwner(e.target.value)}>
    {ownerOptions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select></label>
   <label>Pipeline<select aria-label="Analytics pipeline" value={pipeline}
     onChange={e=>setPipeline(e.target.value as 'all'|DealPipeline)}>
     <option value="all">All pipelines</option>
     {DEAL_PIPELINES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
   </select></label>
   <button type="button" onClick={()=>{setPeriod('90d');setOwner('all');setPipeline('all');}}>
     Reset filters
   </button>
  </div>
  <div className="ss-analytics-kpis" aria-label="Filtered sales metrics">
   {kpis.map(kpi=><article key={kpi.name} className="ss-analytics-kpi">
    <small>{kpi.name}</small><strong>{kpi.value}</strong><span>{kpi.hint}</span>
   </article>)}
  </div>
  <div className="ss-analytics-panels">
   <article className="ss-analytics-panel">
    <header><h3>Open pipeline by stage</h3><small>Current stage of Deals created in the selected window</small></header>
    <div className="ss-analytics-stages">
     {result.pipelineByStage.map(row=><div className="ss-analytics-stage" key={row.stage}>
      <div><strong>{row.stage}</strong><small>{row.count} Deals · {money.format(row.value)}</small></div>
      <div className="ss-analytics-track" role="img" aria-label={row.stage+': '+money.format(row.value)}>
       <span style={{width:(row.value>0?Math.max(2,100*row.value/maxStage):0)+'%'}}/>
      </div>
     </div>)}
    </div>
   </article>
   <article className="ss-analytics-panel">
    <header><h3>Delivered quotes & interactions</h3><small>{result.trendLabel}</small></header>
    <div className="ss-analytics-legend"><span className="is-quotes">Confirmed quote deliveries</span>
      <span className="is-interactions">Logged interactions</span></div>
    <div className="ss-analytics-trend">
     {result.trend.map(row=><div className="ss-analytics-trend-row" key={row.key}>
      <small>{row.label}</small>
      <div className="ss-analytics-trend-track">
       <span className="is-quotes" style={{width:100*row.sent/maxTrend+'%'}} title={row.sent+' confirmed deliveries'}/>
       <span className="is-interactions" style={{width:100*row.interactions/maxTrend+'%'}} title={row.interactions+' logged interactions'}/>
      </div>
      <b>{row.sent} / {row.interactions}</b>
     </div>)}
    </div>
   </article>
   <article className="ss-analytics-panel">
    <header><h3>Biggest open opportunities</h3><small>Ranked by recorded Deal value</small></header>
    <div className="ss-analytics-records">
     {result.topDeals.map(deal=><button type="button" key={deal.id}
       onClick={()=>openDeal(deal.id)}>
       <span><strong>{deal.name}</strong><small>{deal.stage}</small></span>
       <b>{deal.amount===undefined?'No value':money.format(deal.amount)}</b>
     </button>)}
     {!result.topDeals.length&&<p>No active Deals match these filters.</p>}
    </div>
   </article>
   <article className="ss-analytics-panel">
    <header><h3>Recent confirmed bids</h3><small>SalesShop and external bids together</small></header>
    <div className="ss-analytics-records">
     {result.recentSent.map(record=><div className="ss-analytics-bid-row" key={record.id}>
      <span><strong>{record.name}</strong>
       <small>{record.source==='external'?'External'+(record.platform?' · '+record.platform:''):'SalesShop'}
        {' · '}{record.sentDate}</small></span>
      <b>{record.value===undefined?'Not recorded':money.format(record.value)}</b>
      {record.source==='salesshop'
        ?<button type="button" onClick={()=>openQuote(record.sourceId)}>Open Quote</button>
        :record.projectId?<button type="button" onClick={()=>openDeal(record.projectId!)}>Open Deal</button>:null}
     </div>)}
     {!result.recentSent.length&&<p>No confirmed bid deliveries match these filters.</p>}
    </div>
   </article>
  </div>
  <footer className="ss-analytics-notes">
   <strong>How these figures work</strong>
   <p>Deal outcomes and pipeline stages reflect their current status, filtered by when the Deal was created.
      Delivered quotes require confirmed delivery (or an external bid record), not merely an issued document.
      Missing bid amounts are excluded from dollar totals, not from counts. Owner totals reflect records this
      account can access; private quote documents from other users are not included.</p>
   <p><strong>My overdue Tasks:</strong> {result.privateOverdueTasks}. Tasks are private to the signed-in user and
     do not change when you filter team owners. The chart shows the most recent twelve months in All available mode.</p>
  </footer>
 </section>;
}
