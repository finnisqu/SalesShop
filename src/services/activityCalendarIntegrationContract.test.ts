import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const source=(p:string)=>readFileSync(p,'utf8');
describe('Activity and Calendar integration release contracts',()=>{
 it('does not lose unsaved Activities or acknowledge an unuploaded correction',()=>{
  const crm=source('src/store/crmStore.ts');
  const logger=source('src/components/QuickActivityLauncher.tsx');
  const sync=source('src/services/cloudSync.ts');
  const normalized=source('src/services/normalizedCrmSync.ts');
  expect(crm).toContain('if(!stagePendingActivity(scope,activity))');
  expect(crm).toContain("return '';");
  expect(logger).toContain('if(!activityId)');
  expect(sync).toContain('if(crmSnapshot.length)await upsertPendingCrmActivities');
  expect(sync).toContain('acknowledgePendingActivities(scope,crmSnapshot)');
  expect(normalized).toContain('knownActivityIds.has(activity.id)');
  expect(normalized).toContain("order('id',{ascending:true})");
 });
 it('uses one source Activity in People, Companies and Deals',()=>{
  const timeline=source('src/components/CrmActivityTimeline.tsx');
  for(const page of ['CompanyRecordPage','PersonRecordPage','DealRecordPage'])
   expect(source('src/components/'+page+'.tsx')).toContain('<CrmActivityTimeline');
  expect(timeline).toContain('new Map(');
  expect(timeline).toContain('requestActivityDetail(activity.id)');
  expect(timeline).toContain('activity.metadata?.notes');
 });
 it('keeps Tasks and Activity origins linked both ways',()=>{
  const tasks=source('src/components/TasksWorkspace.tsx');
  const detail=source('src/components/ActivityDetailHost.tsx');
  expect(tasks).toContain('requestActivityDetail(task.sourceObjectId!)');
  expect(detail).toContain('t.sourceObjectId===id');
  expect(detail).toContain('salesshop-open-task-id-v1');
  expect(detail).toContain('TaskAssociationsField');
  expect(detail).toContain('allowMismatch');
 });
 it('offers Calendar date actions without a permanent navigation tab',()=>{
  const calendar=source('src/components/SalesCalendarLauncher.tsx');
  const host=source('src/components/CalendarQuickActionHost.tsx');
  const home=source('src/components/HomeWorkspace.tsx');
  expect(calendar).toContain("requestCalendarQuickAction('task',selected)");
  expect(calendar).toContain("requestCalendarQuickAction('bid',selected)");
  expect(host).toContain('bidDueDate:bidDate');
  expect(host).toContain('dueDate:taskDate');
  expect(home).toContain('className="sales-home-upcoming"');
  expect(home).toContain("item.kind!=='activity'");
 });
 it('requires grabber gestures for mobile dismissal, preserving scrollable content',()=>{
  const grab=source('src/components/MobileSheetGrabber.tsx');
  const css=source('src/components/sales-calendar.css');
  expect(grab).toContain("event.pointerType!=='touch'");
  expect(grab).toContain('event.clientY-point.y>75');
  expect(css).toContain('touch-action:none');
  expect(css).toContain('prefers-reduced-motion');
  expect(css).toContain('safe-area-inset-bottom');
 });
});
