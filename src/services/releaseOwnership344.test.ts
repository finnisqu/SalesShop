import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Activity,Project} from '../types/crm';
import type {Quote} from '../types/quote';
import type {PersonalTask} from '../store/personalTaskStore';
import {buildSalesCalendarEvents,personalCalendarSources,personalCalendarTasks,
 recentHomeItems} from './salesCalendar';
import {visibleSubmissionDeals} from './dealSubmissionAudience';

const date='2026-11-12T15:00:00.000Z';
const deal=(assignedUserId?:string):Project=>({
 id:'deal-a',name:'Builder deadline',stage:'Bid Development',
 dueDate:'2026-11-20',createdAt:date,updatedAt:date,
 ...(assignedUserId?{assignedUserId}:{}),
});
const quote:Quote={id:'quote-former',projectId:'deal-a',ownerUserId:'former',
 status:'Sent',title:'Earlier native proposal',revision:0,
 createdAt:date,updatedAt:date,lines:[],sections:[],history:[],
} as Quote;
const nativeDelivery:Activity={
 id:'native-delivered',type:'quote-sent',projectId:'deal-a',quoteId:'quote-former',
 summary:'Delivered earlier proposal',occurredAt:date,
 metadata:{source:'manual',deliveryConfirmed:true,revision:0},
};
const external:Activity={
 id:'external-former',type:'quote-sent',projectId:'deal-a',
 summary:'Earlier builder portal submission',occurredAt:date,
 metadata:{source:'manual',externalQuoteSent:true,recordedByUserId:'former',
  bidSentDate:'2026-11-12',amount:80000},
};
const teammateActivity:Activity={
 id:'teammate-followup',type:'manual-touchpoint',projectId:'deal-a',
 summary:'New assignee follow-up',occurredAt:date,
 metadata:{source:'manual',recordedByUserId:'current',interactionMethod:'call'},
};
const task=(status:'open'|'completed'='open'):PersonalTask=>({
 id:'task_deal_submit_deal-a',sourceObjectId:'deal-submit:deal-a',
 workspaceScope:'org:shop:user:former',title:'Submit quote · Builder deadline',
 status,completedAt:status==='completed'?date:undefined,
 dueDate:'2026-11-20',createdAt:date,updatedAt:date,
 linked:{type:'project',id:'deal-a'},
 associations:[{type:'project',id:'deal-a'}],
});

describe('Batch 344 release gate: reassigned Deal Home ownership and history',()=>{
 it('keeps the current assignee responsible even when a former rep owns the quote and Task',()=>{
  const project=deal('current');
  const previous=personalCalendarSources('cloud','former',[quote],[task()],[project],
   [nativeDelivery,external,teammateActivity]);
  expect(previous.deals).toEqual([]);
  expect(previous.activities.map(a=>a.id).sort()).toEqual([
   'external-former','native-delivered',
  ]);
  const filtered=personalCalendarTasks('cloud','former',[task()],[project]);
  expect(filtered).toEqual([]);
  expect(buildSalesCalendarEvents(filtered,previous.deals,previous.activities,[quote])
   .filter(e=>e.kind==='bid')).toEqual([]);
  const owner=personalCalendarSources('cloud','current',[],[],[project],
   [nativeDelivery,external,teammateActivity]);
  expect(owner.deals.map(d=>d.id)).toEqual(['deal-a']);
  expect(owner.activities.map(a=>a.id).sort()).toEqual([
   'external-former','teammate-followup',
  ]);
  expect(buildSalesCalendarEvents([],owner.deals,owner.activities,[])
   .some(e=>e.kind==='bid'&&e.recordId==='deal-a')).toBe(true);
 });
 it('keeps completed task history and user-authored follow-ups after reassignment',()=>{
  const project=deal('current');
  const authored:PersonalTask={...task(),id:'personal-note',
   title:'Follow up with original contact',sourceObjectId:undefined};
  const own=personalCalendarTasks('cloud','former',
   [task('completed'),authored],[project]);
  expect(own.map(t=>t.id)).toEqual(['task_deal_submit_deal-a','personal-note']);
  const recent=recentHomeItems(own,[],[],null);
  expect(recent.some(item=>item.recordId==='task_deal_submit_deal-a'&&
   item.kind==='completed-task')).toBe(true);
 });
 it('does not hide a former rep historical external quote or native delivery',()=>{
  const project=deal('current');
  const own=personalCalendarSources('cloud','former',[quote],[task()],[project],
   [nativeDelivery,external,teammateActivity]);
  expect(own.activities.find(a=>a.id==='external-former')).toBeDefined();
  expect(own.activities.find(a=>a.id==='native-delivered')).toBeDefined();
  expect(own.activities.find(a=>a.id==='teammate-followup')).toBeUndefined();
 });
 it('retains local-mode Tasks and unassigned Deals for their real contributor',()=>{
  const unassigned=deal();
  expect(personalCalendarTasks('local',undefined,[task()],[deal('current')]))
   .toHaveLength(1);
  const cloud=personalCalendarSources('cloud','former',[quote],[task()],[unassigned],
   [external]);
  expect(cloud.deals.map(d=>d.id)).toEqual(['deal-a']);
  expect(personalCalendarTasks('cloud','former',[task()],[unassigned]))
   .toHaveLength(1);
  expect(visibleSubmissionDeals('cloud','member','former',[unassigned],
   [external],[quote],[])).toEqual([unassigned]);
 });
 it('matches the central Home launcher and the exact assignment precedence contract',()=>{
  const launch=readFileSync(new URL('../components/SalesCalendarLauncher.tsx',import.meta.url),'utf8');
  const calendar=readFileSync(new URL('./salesCalendar.ts',import.meta.url),'utf8');
  expect(launch).toContain('personalCalendarTasks(mode,userId,tasks,deals)');
  expect(calendar).toContain("const personalDeals=deals.filter(deal=>deal.assignedUserId");
  expect(calendar).toContain("?deal.assignedUserId===userId:relatedDealIds.has(deal.id)");
  expect(calendar).toContain("!!(activity.projectId&&personalDealIds.has(activity.projectId))");
  expect(calendar).toContain("task.status==='completed'||task.status==='canceled'||Boolean(task.completedAt)");
 });
});
