import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

const file=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch #118 — Records navigation and Home deadline integrity',()=>{
 it('makes Records the only primary nav for Tasks, Activities and CRM records',()=>{
  const app=file('App.tsx');
  const mobile=file('components/MobileAppChrome.tsx');
  const records=file('components/Connections.tsx');
  expect(app).toContain(">Records</button>");
  expect(app).not.toContain(">Connections</button>");
  expect(app).not.toContain(">Tasks</button>");
  expect(app).toContain("['home','dashboard','catalog','notebook']");
  expect(mobile).toContain("{ view: 'dashboard', label: 'Records', short: 'Records' }");
  const nav=file('components/RecordsSectionNav.tsx');
  expect(nav).toContain("id:'tasks',label:'Tasks'");
  expect(nav).toContain("id:'activity',label:'Activity'");
  expect(nav).toContain("id:'quotes',label:'Quotes'");
  expect(records).toContain("label:'Our Organization'");
  expect(records).toContain("label:'Pages · Notebook'");
  expect(records).toContain("title=\"Records\"");
  expect(records).not.toContain("label:'Activity history',active:tab==='activity'");
  expect(records).toContain('connections-pipeline-dropdown');
  expect(records).not.toContain('Pipeline\n    <select');
 });
 it('embeds Open and Completed controls inside Tasks table toolbar',()=>{
  const tasks=file('components/TasksWorkspace.tsx');
  expect(tasks).toContain('toolbarTarget={embedded?undefined:taskToolbarHost}');
  expect(tasks).toContain('toolbarControls={<>' );
  expect(tasks).toContain('tasks-records-tabs');
  expect(tasks).toContain('tasks-records-mobile-tabs');
  expect(tasks).toContain('aria-label="Task status"');
  expect(tasks).toContain('is-records-embedded');
  expect(tasks).toContain('salesshop-records-task-filter-v1');
 });
 it('exposes notebook page bulk edits without deleting or replacing page contents',()=>{
  const pages=file('components/RecordsPagesDirectory.tsx');
  expect(pages).toContain('useNotebookStore');
  for(const action of ['Move selected','Favorite','Unfavorite','Hide','Show','Protect','Unprotect'])
   expect(pages).toContain(action);
  expect(pages).toContain('notebookPageNavigationLabel');
  expect(pages).not.toContain('deleteEntry(');
 });
 it('preserves original due date and responsibility history in cloud and local records',()=>{
  const crm=file('store/crmStore.ts');
  const tasks=file('store/personalTaskStore.ts');
  const cloud=file('services/normalizedCrmSync.ts');
  expect(crm).toContain('const deadlineChanged=');
  expect(crm).toContain('originalDueDate=current.originalDueDate');
  expect(crm).toContain('dueDateHistory=deadlineChanged');
  expect(tasks).toContain('delete patch.originalDueDate;delete patch.dueDateHistory;');
  expect(tasks).toContain('originalDueDate:deal.originalDueDate??deal.dueDate');
  expect(tasks).toContain("delete patch.dueDate;delete patch.dueDateResponsibility");
  expect(cloud).toContain('original_due_date:project.originalDueDate');
  expect(cloud).toContain('due_date_history:project.dueDateHistory');
  expect(file('components/DealRecordPage.tsx')).toContain('Original bid due date');
  expect(file('components/TasksWorkspace.tsx')).toContain('Deadline responsibility');
 });
 it('uses one page scrollbar, equal-height 7-day calendar, and themed Home actions',()=>{
  const css=file('records-workspace-polish.css');
  const home=file('home-workspace.css');
  const week=file('components/home-week-focus.css');
  const layout=file('components/home-layout-custom.css');
  expect(css).toContain('position:sticky;top:0;z-index:3');
  expect(css).toContain('max-height:none!important;height:auto!important');
  expect(week).toContain('height:470px!important;min-height:470px!important;max-height:470px!important');
  expect(layout).toContain('height:470px!important;min-height:470px!important;max-height:470px!important');
  expect(home).toContain('.sales-home-top-actions .sales-log-launcher');
  expect(home).toContain('background:var(--ss-theme-card);border:1px solid var(--ss-theme-border)');
  const recent=file('components/SalesCalendarLauncher.tsx');
  expect(recent).toContain('>Outstanding</button>');
  expect(recent).toContain('homeOutstandingTasks(ownTasks)');
  expect(recent).toContain('outstandingDueLabel(task,today)');
  expect(file('components/HomeWorkspace.tsx')).not.toContain('sales-home-task-focus');
 });
});
