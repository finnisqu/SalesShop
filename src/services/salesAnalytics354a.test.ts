import {describe,it,expect} from 'vitest';
import type {Project,Activity} from '../types/crm';
import type {SalesQuoteRecord} from './salesQuoteRegistry';
import type {PersonalTask} from '../store/personalTaskStore';
import {buildSalesAnalytics,analyticsWindowStart} from './salesAnalytics354a';
import {readFileSync} from 'node:fs';
const now=new Date('2026-11-16T12:00:00Z');
const deal=(id:string,extra:Partial<Project>={}):Project=>({
 id,name:id,createdAt:'2026-11-01T12:00:00Z',updatedAt:'2026-11-10T12:00:00Z',
 stage:'Discovery',pipeline:'commercial',amount:1000,assignedUserId:'rep-a',...extra,
});
const row=(id:string,extra:Partial<SalesQuoteRecord>={}):SalesQuoteRecord=>({
 id,source:'salesshop',sourceId:id,name:id,number:id,
 documentType:'Quote',status:'Sent',sentDate:'2026-11-10',
 value:1200,updatedAt:'2026-11-11T12:00:00Z',projectId:'a',
 ownerUserId:'rep-a',...extra,
});
const interaction=(id:string,extra:Partial<Activity>={}):Activity=>({
 id,type:'manual-touchpoint',summary:'Contacted customer',
 occurredAt:'2026-11-10T12:00:00Z',projectId:'a',
 metadata:{interactionMethod:'call',recordedByUserId:'rep-a'},...extra,
});
const run=(projects:Project[],quotes:SalesQuoteRecord[],activities:Activity[]=[],filter:{
 period:'30d'|'90d'|'365d'|'all';ownerId:string;pipeline:'all'|'commercial'|'residential'|'multifamily'
}={period:'90d',ownerId:'all',pipeline:'all'},tasks:PersonalTask[]=[])=>
 buildSalesAnalytics(projects,quotes,activities,tasks,filter,now);
describe('Analytics 354a — real records and filter semantics',()=>{
 it('keeps native and external delivery evidence equally important without double counting a cached activity',()=>{
  const result=run([deal('a')],[row('native'),row('external',{source:'external',sourceId:'external',
   ownerUserId:'rep-a',value:75000}),row('external',{source:'external',sourceId:'external',value:75000})]);
  expect(result.sentQuotes).toBe(2);expect(result.nativeSent).toBe(1);
  expect(result.externalSent).toBe(1);expect(result.sentValue).toBe(76200);
  expect(result.recentSent).toHaveLength(2);
 });
 it('uses actual delivered date, never a mere issued native document',()=>{
  const result=run([deal('a')],[row('notDelivered',{sentDate:undefined}),row('delivered',{sentDate:'2026-11-16'}),
    row('historical',{sentDate:'2026-07-01'}),row('unknown',{value:undefined})]);
  expect(result.sentQuotes).toBe(2);
  expect(result.sentValue).toBe(1200);
  expect(result.missingQuoteValues).toBe(1);
 });
 it('includes October deliveries in a 90-day view, but excludes them from a 30-day view',()=>{
  const recent=row('recent',{sentDate:'2026-11-16'});
  const october=row('october',{sentDate:'2026-10-01'});
  const source=[recent,october];
  expect(run([deal('a')],source).sentQuotes).toBe(2);
  expect(run([deal('a')],source,[],{period:'30d',ownerId:'all',pipeline:'all'}).sentQuotes).toBe(1);
 });
 it('filters Deal cohort by creation date, owner and pipeline and reports outcomes explicitly',()=>{
  const old=deal('old',{createdAt:'2026-01-01T12:00:00Z',amount:99999});
  const won=deal('won',{stage:'Closed Won',amount:3200});
  const lost=deal('lost',{stage:'Closed Lost',amount:200});
  const other=deal('other',{pipeline:'residential',assignedUserId:'rep-b'});
  const result=run([deal('a'),old,won,lost,other],[],[],{period:'90d',ownerId:'rep-a',pipeline:'commercial'});
  expect(result.dealsCreated).toBe(3);expect(result.openDeals).toBe(1);
  expect(result.openValue).toBe(1000);expect(result.wonDeals).toBe(1);
  expect(result.winRate).toBe(.5);
 });
 it('does not attribute unattributed/team events to a selected rep',()=>{
  const activities=[interaction('own'),interaction('other',{metadata:{interactionMethod:'call',recordedByUserId:'rep-b'}}),
   interaction('unknown',{metadata:{interactionMethod:'email'}}),interaction('system',{type:'project-created',metadata:undefined})];
  expect(run([deal('a')],[],activities,{period:'90d',ownerId:'rep-a',pipeline:'all'}).interactions).toBe(1);
  expect(run([deal('a')],[],activities).interactions).toBe(3);
 });
 it('uses personal overdue Tasks separately from the owner filter',()=>{
  const tasks=[{id:'private',title:'Follow up',status:'open',dueDate:'2026-11-12'},
   {id:'done',title:'Done',status:'completed',dueDate:'2026-11-09'}] as PersonalTask[];
  const result=run([deal('a')],[],[],{period:'30d',ownerId:'rep-b',pipeline:'all'},tasks);
  expect(result.privateOverdueTasks).toBe(1);expect(result.dealsCreated).toBe(0);
 });
 it('has inclusive calendar-day boundaries and nonempty chart buckets',()=>{
  expect(analyticsWindowStart('30d',now)).toBe('2026-10-18');
  expect(analyticsWindowStart('all',now)).toBeNull();
  // Nov 16 is Monday; 90 days back begins Wed Aug 19, so 14 week buckets.
  expect(run([],[],[]).trend).toHaveLength(14);
  expect(run([],[],[],{period:'30d',ownerId:'all',pipeline:'all'}).trend).toHaveLength(6);
  expect(run([],[],[],{period:'all',ownerId:'all',pipeline:'all'}).trend).toHaveLength(12);
 });
 it('exposes Analytics under Tools while keeping Records focused on CRM',()=>{
  const nav=readFileSync(new URL('../components/RecordsSectionNav.tsx',import.meta.url),'utf8');
  const tools=readFileSync(new URL('../components/ToolsWorkspace.tsx',import.meta.url),'utf8');
  expect(nav).not.toContain("id:'analytics',label:'Analytics'");
  expect(tools).toContain("id:'analytics',label:'Analytics'");
  expect(tools).toContain("section==='analytics'&&<SalesAnalyticsWorkspace");
  const ui=readFileSync(new URL('../components/SalesAnalyticsWorkspace.tsx',import.meta.url),'utf8');
  for(const label of ['Analytics time period','Analytics owner','Analytics pipeline','Open pipeline by stage',
   'Confirmed quote deliveries','Recent confirmed bids'])expect(ui).toContain(label);
 });
});
