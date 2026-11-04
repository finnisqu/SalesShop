import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const table=read('src/components/ConnectionsTable.tsx');
const screen=read('src/components/Connections.tsx');
const dialog=read('src/components/ConnectionsBulkEditDialog.tsx');
const css=read('src/connections-bulk-edit.css');
const tableCss=read('src/connections-table.css');

describe('Connections bulk record editing',()=>{
 it('exposes the action only for editable CRM table records with selection',()=>{
  expect(table).toContain('onBulkEdit?:(records:ConnectionTableRow[],change:BulkEditChange)=>Promise<void>');
  expect(table).toContain("chosen=rows.filter(x=>selection.has(x.id))");
  expect(table).toContain("onBulkEdit&&['companies','people','deals'].includes(tableKey)");
  expect(table).toContain('onBulkEdit(chosen,change)');
  expect(table).toContain('setSelected([])');
  expect(screen).toContain("onBulkEdit={canBulkEdit?bulkEdit:undefined}");
  expect(screen).toContain("canEditTeamArea(authRole,authDepartment,'crm')");
  expect(screen).toContain('!previewPerspective');
  expect(screen).not.toContain('rows={quoteTableRows} onOpen={id=>previewRecord(\'quote\',id)} onBulkTask={bulkTask} onBulkEdit=');
 });
 it('uses the same property options as individual CRM record editors',()=>{
  for(const property of [
   "key:'pipeline'","key:'stage'","key:'dueDate'","key:'assignedUserId'",
   "key:'amount'","key:'nextAction'","key:'kind'","key:'companyId'","key:'title'","key:'phone'"
  ])expect(dialog).toContain(property);
  expect(dialog).toContain('DEAL_PIPELINES.map(');
  expect(dialog).toContain('PROJECT_STAGES.map(');
  expect(dialog).toContain('Moving deals to a pipeline also sets their stage');
  expect(dialog).toContain('useDealAssigneeDirectory()');
  expect(dialog).toContain('role="dialog" aria-modal="true"');
  expect(dialog).toContain('createPortal(');
  expect(dialog).toContain('disabled={!canSubmit}');
  expect(dialog).toContain('if(!canSubmit)return');
  expect(dialog).toContain('Clear this property on selected records');
 });
 it('preserves stage history and server confirmation for owner changes',()=>{
  expect(screen).toContain("updateDeal(item.id,{pipeline:change.pipeline,stage:change.stage},{source:'manual'})");
  expect(screen).toContain("updateDeal(item.id,{stage:change.value},{source:'manual'})");
  expect(screen).toContain("await assignDeal(item.id,change.value||undefined)");
  expect(screen).toContain('Updated \'+updated+\' of \'+items.length+\' records.');
  expect(screen).toContain('Some selected records are no longer available.');
  expect(dialog).toContain('setError(reason instanceof Error?reason.message:');
  expect(css).toContain('@media(max-width:700px)');
 });
 it('keeps phone cards until mobile selection is opened and selection spans pages',()=>{
  expect(table).toContain('connections-mobile-bulk');
  expect(table).toContain('setMobileBulkMode');
  expect(table).toContain('setSelected(old=>[...new Set([...old,...ids])])');
  expect(tableCss).toContain('.connections-mobile-bulk.is-selecting');
  expect(tableCss).toContain('.connections-card-grid.connections-legacy-cards{display:none}');
 });
});
