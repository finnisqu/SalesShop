import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
describe('Task bulk property editing',()=>{
 const dialog=read('components/TaskBulkEditDialog.tsx');
 const table=read('components/ConnectionsTable.tsx');
 const workspace=read('components/TasksWorkspace.tsx');
 const css=read('connections-table.css');
 it('supports single-property changes using existing task store values',()=>{
  for(const key of ['priority','status','type','queue','startDate','dueDate'])
   expect(dialog).toContain("key:'"+key+"'");
  expect(dialog).toContain("role=\"dialog\" aria-modal=\"true\"");
  expect(dialog).toContain('setClear(event.target.checked)');
  expect(dialog).toContain("case 'dueDate'");
  expect(dialog).toContain('dueTime:undefined');
  expect(dialog).toContain('disabled={!valid}');
 });
 it('updates only currently scoped, nondeleted task records',()=>{
  expect(workspace).toContain("onBulkTaskProperty={async(items,change:TaskBulkChange)=>");
  expect(workspace).toContain("if(!scope||current.scope!==scope)");
  expect(workspace).toContain('t.workspaceScope===scope&&!t.deletedAt');
  expect(workspace).toContain("if(items.some(item=>!found.has(item.id)))");
  expect(workspace).toContain('for(const item of items)update(item.id,change)');
  expect(table).toContain("onBulkTaskProperty?:(records:ConnectionTableRow[],change:TaskBulkChange)=>Promise<void>");
  expect(table).toContain("<TaskBulkEditDialog count={chosen.length}");
 });
 it('preserves mobile task list when not in selection mode',()=>{
  expect(table).toContain('setMobileBulkMode');
  expect(table).toContain('setBulkTaskEditing(true)');
  expect(css).toContain('.tasks-workspace:has(.connections-mobile-bulk.is-selecting)');
  expect(css).toContain('.tasks-list{display:none}');
 });
});
