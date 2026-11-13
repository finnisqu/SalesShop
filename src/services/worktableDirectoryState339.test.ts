import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {worktableDirectoryUpdate,worktableDirectoryValue} from '../components/useWorktableDirectoryState';

const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Batch 339 — directory-scoped Records state and persistence',()=>{
 it('never displays another Records directory\'s saved column layout',()=>{
  const settings=new Map([['companies',['name','industry']],
   ['people',['name','email']],['tasks',['name','due']]]);
  const read=(directory:string)=>settings.get(directory)??[];
  const companies={directory:'companies',value:['name','industry']};
  expect(worktableDirectoryValue(companies,'companies',read)).toEqual(['name','industry']);
  expect(worktableDirectoryValue(companies,'people',read)).toEqual(['name','email']);
  expect(worktableDirectoryValue(companies,'tasks',read)).toEqual(['name','due']);
 });
 it('updates the active directory rather than borrowing prior directory state',()=>{
  const read=(directory:string)=>directory==='companies'?['name','industry']:['name','email'];
  const prior={directory:'companies',value:['name','industry']};
  const people=worktableDirectoryUpdate(prior,'people',old=>[...old,'company'],read);
  expect(people).toEqual({directory:'people',value:['name','email','company']});
  expect(prior).toEqual({directory:'companies',value:['name','industry']});
  const reset=worktableDirectoryUpdate(people,'companies',['name'],read);
  expect(reset).toEqual({directory:'companies',value:['name']});
 });
 it('keeps selection empty after switching directories, even for reused row IDs',()=>{
  const selected={directory:'companies',value:['record-42']};
  expect(worktableDirectoryValue(selected,'tasks',()=>[] as string[])).toEqual([]);
  const newSelection=worktableDirectoryUpdate(selected,'tasks',
   old=>[...old,'task-1'],()=>[] as string[]);
  expect(newSelection.value).toEqual(['task-1']);
  expect(newSelection.directory).toBe('tasks');
  expect(worktableDirectoryValue(newSelection,'companies',()=>[] as string[])).toEqual([]);
 });
 it('stores columns, pins and page size against the snapshot\'s own directory',()=>{
  const table=src('components/ConnectionsTable.tsx');
  const hook=src('components/useWorktableDirectoryState.ts');
  expect(table).toContain('useWorktableDirectoryState(tableKey,');
  expect(table).toContain('useWorktableDirectoryState<string[]>(tableKey,()=>[])');
  expect(table).toContain('useWorktableDirectoryState<number>(pageSizeScope,');
  expect(table).toContain("const pageSizeScope=tableKey+'|'+(catalogPagination?'catalog':'records')");
  expect(table).toContain("storage(scope,'cols')");
  expect(table).toContain("storage(scope,'pins')");
  expect(table).toContain("storage(directory,'pageSize')");
  expect(table).toContain("if(mode==='catalog')return");
  expect(table).not.toContain("storage(tableKey,'cols'),JSON.stringify(keys)");
  expect(table).not.toContain("storage(tableKey,'pins'),JSON.stringify(pinned)");
  expect(hook).toContain('persist?.(snapshot.directory,snapshot.value)');
  expect(hook).toContain('previous.directory===directory?previous');
  expect(hook).toContain('worktableDirectoryValue(snapshot,directory,load)');
 });
 it('isolates page, bulk dialogs and mobile multi-select mode alongside selection',()=>{
  const table=src('components/ConnectionsTable.tsx');
  for(const item of ['page','bulkEditing','bulkTaskEditing','mobileBulkMode']){
   expect(table).toContain('['+item+',set'+item[0].toUpperCase()+item.slice(1)+
    ']=useWorktableDirectoryState(tableKey,()=>');
  }
  expect(table).toContain("const [sortState,setSort]=useState(()=>({tableKey,...readSort()}))");
  expect(table).toContain("storage(sortState.tableKey,'sort')");
  expect(table).toContain('const chosen=useMemo(()=>rows.filter(row=>selection.has(row.id))');
 });
});
