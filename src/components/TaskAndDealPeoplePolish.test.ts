import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const read=(name:string)=>readFileSync(join(process.cwd(),name),'utf8');

describe('Task agenda and quick-view polish',()=>{
 it('shows compact progress only for Task events in the Agenda',()=>{
  const agenda=read('src/components/SalesCalendarLauncher.tsx');
  expect(agenda).toContain("event.kind==='task'&&event.recordType==='task'");
  expect(agenda).toContain('sales-calendar-subtask-count');
  expect(agenda).toContain('{progress.done}/{progress.total}');
 });
 it('removes redundant Close buttons from both quick views while keeping the X',()=>{
  const global=read('src/components/TaskModalHost.tsx');
  const workspace=read('src/components/TasksWorkspace.tsx');
  expect(global).not.toContain('<button type="button" onClick={close}>Close</button>');
  expect(workspace).not.toContain('<button type="button" onClick={()=>setViewingId(null)}>Close</button>');
  expect(global).toContain('aria-label="Close task preview"');
  expect(workspace).toContain('label="Close task preview"');
  expect(read('src/tasks-workspace.css')).toContain('.tasks-preview-card>footer.ss-mobile-sheet-actions');
 });
 it('allows individual and confirmed bulk deletion with existing task tombstones',()=>{
  const page=read('src/components/TasksWorkspace.tsx');
  const table=read('src/components/ConnectionsTable.tsx');
  const bulk=read('src/components/TaskBulkEditDialog.tsx');
  expect(page).toContain('onTaskDelete={id=>');
  expect(page).toContain('onBulkTaskDelete={async items=>');
  expect(table).toContain('onTaskDelete?:(id:string)=>void');
  expect(table).toContain('onBulkTaskDelete?:(records:ConnectionTableRow[])=>Promise<void>');
  expect(bulk).toContain('Delete selected (');
  expect(read('src/store/personalTaskStore.ts')).toContain('deletedAt:now');
 });
 it('uses a red trash icon at the left of both Task quick views and for bulk deletion',()=>{
  const modal=read('src/components/TaskModalHost.tsx');
  const page=read('src/components/TasksWorkspace.tsx');
  const table=read('src/components/ConnectionsTable.tsx');
  const bulk=read('src/components/TaskBulkEditDialog.tsx');
  const css=read('src/tasks-workspace.css');
  expect(modal).toContain('<TrashIcon/> Delete');
  expect(page).toContain('<TrashIcon/> Delete');
  expect(table).toContain('<TrashIcon/> Delete');
  expect(bulk).toContain('<TrashIcon/> Delete selected');
  expect(css).toContain('order:-1');
  expect(css).toContain('var(--ss-danger');
  expect(read('src/components/TrashIcon.tsx')).toContain('ss-trash-icon');
 });
 it('groups Delete and pencil Edit on left, completion actions on right',()=>{
  const global=read('src/components/TaskModalHost.tsx');
  const workspace=read('src/components/TasksWorkspace.tsx');
  const css=read('src/tasks-workspace.css');
  for(const file of [global,workspace]){
   expect(file).toContain('tasks-preview-actions-left');
   expect(file).toContain('tasks-preview-actions-right');
   expect(file).toContain('<TrashIcon/> Delete');
   expect(file).toContain('<PencilIcon/> Edit');
   expect(file).toContain('Complete + Log Activity');
  }
  expect(css).toContain('tasks-preview-action-groups');
 });
 it('opens preselected external submission for generated bid tasks',()=>{
  const global=read('src/components/TaskModalHost.tsx');
  const workspace=read('src/components/TasksWorkspace.tsx');
  expect(global).toContain('initialDealId={externalDealId}');
  expect(workspace).toContain('initialDealId={externalDealId}');
  expect(global).toContain('Complete · quote required');
  expect(workspace).toContain('Complete · quote required');
  expect(read('src/components/ExternalQuoteBackfillDialog.tsx'))
   .toContain('initialDealId?:string');
 });
 it('keeps internal roster workbook inside standard centered Connections width',()=>{
  const css=read('src/our-organization.css');
  expect(css).toContain('.connections-directory-layout .our-org-directory');
  expect(css).toContain('max-width:var(--ss-workspace-width,1360px)');
  expect(css).toContain('overflow-x:auto');
 });
 it('loads shared direct Deal People on both CRM record pages',()=>{
  expect(read('src/components/DealRecordPage.tsx')).toContain('<DealPeopleRelationships');
  expect(read('src/components/PersonRecordPage.tsx')).toContain('<PersonDealRelationships');
  expect(read('src/store/dealPeopleStore.ts')).toContain("from('deal_people')");
 });
});
