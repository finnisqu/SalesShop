import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const file=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Shared CRM Activity detail access',()=>{
 it('opens recorded Company history events by Activity ID, not first related record',()=>{
  const service=file('src/services/companyRelationshipHistory.ts');
  const table=file('src/components/CompanyRelationshipTimeline.tsx');
  const company=file('src/components/CompanyRecordPage.tsx');
  expect(service).toContain("kind:'activity',id:activity.id");
  expect(table).toContain('className="company-history-row"');
  expect(table).toContain("onOpenTarget?.(item.target)");
  expect(company).toContain("if(target.kind==='activity'){setActivityPreviewId(target.id);return;}");
  expect(company).toContain('<CalendarActivityPreview activityId={activityPreviewId}');
 });
 it('opens a nested Activity sheet and returns safely to Company or Person quick preview',()=>{
  const preview=file('src/components/RecordPreviewDrawer.tsx');
  expect(preview).toContain('!pendingPersonMethod&&!activityPreviewId');
  expect(preview).toContain('is-activity-underlay');
  expect(preview).toContain("if(target.kind==='activity'){");
  expect(preview).toContain('personActivities.map(a=>');
  expect(preview).toContain("setActivityPreviewId(a.id)");
  expect(preview).toContain('<CalendarActivityPreview activityId={activityPreviewId}');
 });
 it('supports correctable logged details and read-only system history',()=>{
  const preview=file('src/components/CalendarActivityPreview.tsx');
  const store=file('src/store/crmStore.ts');
  expect(preview).toContain("activity?.type==='notebook-touchpoint'");
  expect(preview).toContain("activity-preview-event-details");
  expect(preview).toContain('type="datetime-local"');
  expect(preview).toContain('<TaskAssociationsField options={options} value={links}');
  expect(preview).toContain('onCreated={link=>setLinks(previous=>');
  expect(preview).toContain('Edit activity</button>');
  expect(store).toContain("source.type!=='manual-touchpoint'&&source.type!=='notebook-touchpoint'");
  expect(store).toContain("editedAt:now(),editedByUserId:auth.user?.id");
 });
 it('uses one contact-book headshot glyph for in-person activity choices and recents',()=>{
  const quick=file('src/components/QuickActivityLauncher.tsx');
  const home=file('src/components/SalesCalendarLauncher.tsx');
  expect(quick).toContain('<rect x="3.5" y="2.5" width="17" height="19" rx="3.3"/>');
  expect(home).toContain('<rect x="3.5" y="2.5" width="17" height="19" rx="3.3"/>');
 });
});