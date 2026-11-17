import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
describe('Build #373 — viewport Email and Records UI',()=>{
 it('creates Gmail People in place and opens Person records only on explicit navigation',()=>{
  const email=source('components/EmailWorkspace.tsx');
  expect(email).toContain('onCreated={id=>{setNotice(');
  expect(email).toContain('setEmailAction(null);}} onOpen={openPerson}');
  expect(email).not.toContain('onCreated={openPerson}');
  expect(source('components/EmailPersonCreate362.tsx')).toContain('onCreated(personId)');
 });
 it('has a row inbox, distinct scrollports and accessible toolbar popovers',()=>{
  const email=source('components/EmailWorkspace.tsx');
  const css=source('components/email-workspace.css');
  expect(email).toContain('ss-email-thread-list');
  expect(email).toContain('ss-email-list-columns');
  expect(email).toContain('ss-email-action-toolbar');
  expect(email).toContain('ss-email-action-popover');
  expect(email).toContain("['task','New task']");
  expect(email).toContain("['log','Log Activity']");
  expect(email).toContain("['person','Create Person']");
  expect(email).toContain("['link','Link record']");
  const reader=email.indexOf('ss-email-detail-heading');
  expect(email.indexOf('ss-email-action-toolbar',reader)).toBeLessThan(email.indexOf('ss-email-messages',reader));
  expect(css).toContain('ss-email-thread-list{display:block;flex:1 1 auto;min-height:0');
  expect(css).toContain('.ss-email-messages');
  expect(css).toContain('overflow-y:auto');
  expect(source('components/EmailActivityLogger363.tsx')).toContain('defaultLogOpen?:boolean');
 });
 it('makes Person About, Email and Notebook tabs under a persistent name',()=>{
  const person=source('components/PersonRecordPage.tsx');
  const layout=source('components/RecordPageLayout.tsx');
  expect(person).toContain('title={displayName} initialTab="about"');
  expect(person).toContain("label:'About'");
  expect(person).toContain("label:'Email'");
  expect(person).toContain("label:'Notebook'");
  expect(person).not.toContain("label:'Contact'");
  expect(person).toContain('headerShortcuts={<>');
  expect(layout).toContain('headerShortcuts && <div className="ss-record-header-shortcuts">');
  expect(person).not.toContain('These links mean this person');
  expect(person).not.toContain("No deals explicitly linked through this person's quotes");
 });
 it('consolidates Activities into a noncollapsible, scrollable History',()=>{
  const recent=source('components/RecordRecentsPanel.tsx');
  expect(recent).toContain("useState<'quotes'|'history'>('quotes')");
  expect(recent).toContain('History <span>{historyCount??activityCount}</span>');
  for(const file of ['PersonRecordPage','DealRecordPage']){
   const page=source('components/'+file+'.tsx');
   expect(page).toContain('className="ss-record-history-timeline"');
   expect(page).not.toContain('historyOpen');
  }
  expect(source('record-page-refinement.css')).toContain('max-height:calc(100dvh - 265px)');
 });
 it('places record More before Edit, with uniform tab capsules and full-width scrollbar',()=>{
  for(const file of ['PersonRecordPage','DealRecordPage','CompanyRecordPage']){
   const page=source('components/'+file+'.tsx');
   const a=page.indexOf('actions={<>'),b=page.indexOf('</>}',a);
   const actions=page.slice(a,b);
   expect(actions.indexOf('<RecordActionsMenu')).toBeGreaterThan(-1);
   expect(actions.indexOf('<RecordActionsMenu')).toBeLessThan(actions.indexOf('Edit Page'));
  }
  const css=source('connections-record-pages.css');
  expect(css).toContain('main.connections-workspace:has(>.connections-record-page)');
  expect(css).toContain('min-height:max(480px,calc(100dvh - 220px))');
  const refine=source('record-page-refinement.css');
  expect(refine).toContain('.ss-record-panel-tabs button[aria-selected="true"]');
  expect(refine).toContain('>.ss-unified-record-picker>.ss-unified-picker-trigger');
 });
 it('keeps preview X separate from contact buttons',()=>{
  const preview=source('components/RecordPreviewDrawer.tsx');
  expect(preview).toContain('record-preview-person-controls');
  expect(preview).toContain('{!person&&<PreviewPanelClose');
  expect(source('record-preview.css')).toContain('position:static!important');
 });
});
