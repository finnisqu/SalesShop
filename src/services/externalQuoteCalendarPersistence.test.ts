import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Activity,Project} from '../types/crm';
import type {Quote} from '../types/quote';
import {personalCalendarSources,recentHomeItems} from './salesCalendar';
import {buildCalendarBadgeIndex,metricCount} from './homeCalendarBadges';
import {homeRecentQuoteEntries} from './homeOverview';
import {DEFAULT_HOME_CALENDAR_SETTINGS} from '../store/homeCalendarSettings';
import {matchesActivityFilters,DEFAULT_ACTIVITY_LOG_FILTERS} from './activityLogFilters';
const file=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

const external:Activity={
 id:'external-a',type:'quote-sent',projectId:'deal-a',summary:'External quote sent · $42,000',
 occurredAt:'2026-10-20T16:00:00.000Z',metadata:{
  externalQuoteSent:true,bidSentDate:'2026-10-20',amount:42000,
  recordedAt:'2026-11-10T18:00:00.000Z',recordedByUserId:'user-a',source:'manual',
 },
};
const deal:Project={id:'deal-a',name:'Example Deal',stage:'Bid Sent',assignedUserId:'user-a',
 createdAt:'2026-10-01T14:00:00.000Z',updatedAt:'2026-11-10T18:00:00.000Z'};

describe('External Quote Sent: calendar + CRM + Recents',()=>{
 it('counts quote sent on the real send date, never the logging date',()=>{
  const personal=personalCalendarSources('cloud','user-a',[],[],[deal],[external]);
  expect(personal.activities.map(a=>a.id)).toEqual(['external-a']);
  const idx=buildCalendarBadgeIndex([],[],personal.activities,[],[],
    DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(idx,'2026-10-20','quotes-sent')).toBe(1);
  expect(metricCount(idx,'2026-11-10','quotes-sent')).toBe(0);
 });
 it('places historical backfill in newly logged Recent Activity, not buried by old date',()=>{
  const other:Activity={...external,id:'other-a',type:'manual-touchpoint',
   occurredAt:'2026-11-01T12:00:00.000Z',metadata:{interactionMethod:'call'}};
  const recent=recentHomeItems([],[other,external],[],null,8);
  expect(recent[0]).toMatchObject({
   recordId:'external-a',timestamp:'2026-11-10T18:00:00.000Z',kind:'activity',
   activityType:'quote-sent',
  });
  expect(recent[0].detail).toContain('Sent 2026-10-20');
 });
 it('keeps historical external backfills visible in Quotes even with newer native drafts',()=>{
  const legacy:Activity={...external,id:'legacy-external',
   metadata:{...external.metadata,recordedAt:undefined,bidSentDate:'2026-09-01'},
   occurredAt:'2026-09-01T12:00:00Z'};
  const many=Array.from({length:8},(_,i)=>({
   id:'native-'+i,title:'Native '+i,quoteNumber:'Q-'+i,
   updatedAt:'2026-11-10T18:00:00.000Z',
  })) as unknown as Quote[];
  const entries=homeRecentQuoteEntries(many,[legacy],5);
  expect(entries).toHaveLength(5);
  expect(entries[0]).toMatchObject({kind:'external',recordId:'legacy-external'});
  expect(entries[0].detail).toContain('2026-09-01');
 });
 it('includes genuine external submissions in the Home Quotes list',()=>{
  const quotes=homeRecentQuoteEntries([], [external]);
  expect(quotes).toHaveLength(1);
  expect(quotes[0]).toMatchObject({
   kind:'external',recordId:'external-a',timestamp:'2026-11-10T18:00:00.000Z',
  });
  expect(quotes[0].detail).toContain('Sent 2026-10-20');
 });
 it('includes an externally logged submission under the Interactions filter',()=>{
  expect(matchesActivityFilters(external,{
   ...DEFAULT_ACTIVITY_LOG_FILTERS,kind:'interactions',
  },[],[],[deal],[],()=>false,new Date('2026-11-11'))).toBe(true);
  const native={...external,id:'native',quoteId:'native-q',metadata:{source:'quote' as const}};
  expect(matchesActivityFilters(native,{
   ...DEFAULT_ACTIVITY_LOG_FILTERS,kind:'interactions',
  },[],[],[deal],[],()=>false,new Date('2026-11-11'))).toBe(false);
 });
 it('gates form success on a Supabase-acknowledged Activity row',()=>{
  const store=file('src/store/crmStore.ts');
  const form=file('src/components/ExternalQuoteSentForm.tsx');
  expect(store).toContain("await supabase.from('activities').insert({");
  expect(store).toContain(".select('id,type,project_id,metadata')");
  expect(store).toContain("if(lookupError||!confirmed)");
  const externalStore=store.slice(store.indexOf('recordExternalQuoteSent:async'));
  expect(externalStore.indexOf(".select('id,type,project_id,metadata')"))
    .toBeLessThan(externalStore.indexOf('persist(get().companies,get().contacts,projects,activities)'));
  expect(form).toContain('const saved=await recordExternalQuoteSent(');
  expect(form).toContain('submissionId.current,recordedAt.current');
  expect(form).toContain('onRecorded?.(bidSentDate)');
  expect(file('src/components/SalesCalendarLauncher.tsx')).toContain(
   "setBadgeFocus({date,metric:'quotes-sent'})");
 });
 it('permits only marked external quote-sent events through org RLS',()=>{
  const migration=file('supabase/migrations/20261110190538_external_quote_activity_visibility_20261110.sql');
  expect(migration).toContain("type='quote-sent' and project_id is not null");
  expect(migration).toContain("metadata->>'externalQuoteSent'='true'");
  expect(migration).toContain('private.can_read_quote(organization_id,quote_id)');
 });
 it('keeps duplicate cache copies from inflating calendar, Quotes and Recents',()=>{
  const duplicates=[external,{...external,metadata:{...external.metadata}}];
  expect(personalCalendarSources('cloud','user-a',[],[],[deal],duplicates).activities)
   .toHaveLength(1);
  expect(personalCalendarSources('local',undefined,[],[],[deal],duplicates).activities)
   .toHaveLength(1);
  const badges=buildCalendarBadgeIndex([],[],duplicates,[],[],
   DEFAULT_HOME_CALENDAR_SETTINGS);
  expect(metricCount(badges,'2026-10-20','quotes-sent')).toBe(1);
  expect(recentHomeItems([],duplicates,[],null).filter(e=>e.recordId==='external-a'))
   .toHaveLength(1);
  expect(homeRecentQuoteEntries([],duplicates).map(e=>e.id)).toEqual(['external:external-a']);
 });
});
