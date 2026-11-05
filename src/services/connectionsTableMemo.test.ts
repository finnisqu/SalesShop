import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../components/ConnectionsTable.tsx',import.meta.url),'utf8');

describe('Shared Connections/Tasks/Quotes table render performance',()=>{
 it('memoizes stable column metadata and retains the name column guard',()=>{
  expect(source).toContain('const active=useMemo(()=>visibleConnectionColumns(keys,columns.map(c=>c.key)),[keys,columns]);');
  expect(source).toContain('const byKey=new Map(columns.map(col=>[col.key,col]))');
  expect(source).toContain("if(key==='name')return next;");
 });
 it('reuses selection sets and chosen row lists across unrelated renders',()=>{
  expect(source).toContain('const selection=useMemo(()=>new Set(selected),[selected]);');
  expect(source).toContain('const chosen=useMemo(()=>rows.filter(row=>selection.has(row.id)),[rows,selection]);');
  expect(source).toContain('const allOnPage=display.length>0&&display.every');
  expect(source).toContain('const someOnPage=display.some');
 });
 it('looks up pinned row identifiers in constant time while preserving row order',()=>{
  expect(source).toContain('const pinnedIds=new Set(pinned)');
  expect(source).toContain('return rows.filter(row=>pinnedIds.has(row.id));');
  expect(source).toContain('const togglePin=(id:string)=>setPinned(');
  expect(source).toContain('const sorted=useMemo(()=>[...rows].sort');
 });
});
