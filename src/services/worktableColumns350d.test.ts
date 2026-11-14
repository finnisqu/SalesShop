import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
 orderedConnectionColumnChoices,visibleConnectionColumns,
} from './connectionsTablePreferences';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const columns=[
 {key:'name',label:'Name'},{key:'industry',label:'Industry'},
 {key:'phone',label:'Phone'},{key:'status',label:'Status'},
];

describe('Batch 350d — actual-order Records column chooser and phone controls',()=>{
 it('lists visible fields in saved table order, then hidden fields in original schema order',()=>{
  const visible=visibleConnectionColumns(['phone','name'],columns.map(c=>c.key));
  const chosen=orderedConnectionColumnChoices(columns,visible);
  expect(chosen.map(c=>c.key)).toEqual(['phone','name','industry','status']);
  expect(chosen.map(c=>c.label)).toEqual(['Phone','Name','Industry','Status']);
  expect(columns.map(c=>c.key)).toEqual(['name','industry','phone','status']);
  expect(visible).toEqual(['phone','name']);
 });
 it('reordering a visible field immediately changes the chooser order',()=>{
  const left=['name','industry','phone'];
  const before=orderedConnectionColumnChoices(columns,left);
  expect(before.map(c=>c.key)).toEqual(['name','industry','phone','status']);
  const moved=['name','phone','industry'];
  expect(orderedConnectionColumnChoices(columns,moved).map(c=>c.key))
   .toEqual(['name','phone','industry','status']);
  expect(left).toEqual(['name','industry','phone']);
 });
 it('does not duplicate stale, unknown or repeated saved keys',()=>{
  expect(orderedConnectionColumnChoices(columns,['removed','phone','phone','name'])
   .map(c=>c.key)).toEqual(['phone','name','industry','status']);
  expect(orderedConnectionColumnChoices(columns,[]).map(c=>c.key))
   .toEqual(['name','industry','phone','status']);
  expect(visibleConnectionColumns(['removed','phone','phone'],columns.map(c=>c.key)))
   .toEqual(['name','phone']);
 });
 it('shows hidden fields after all active ones, so restoring a field updates its location',()=>{
  const before=orderedConnectionColumnChoices(columns,['name','phone'])
   .map(c=>c.key);
  expect(before.slice(2)).toEqual(['industry','status']);
  const after=orderedConnectionColumnChoices(columns,['name','phone','status'])
   .map(c=>c.key);
  expect(after).toEqual(['name','phone','status','industry']);
 });
 it('keeps column menu, movement, device persistence and directory isolation in Records',()=>{
  const table=source('src/components/ConnectionsTable.tsx');
  expect(table).toContain("import {Fragment,useEffect,useMemo,useRef,useState,type ReactNode} from 'react'");
  expect(table).toContain('orderedConnectionColumnChoices(columns,active)');
  expect(table).toContain('{columnChoices.map((col,index)=><Fragment key={col.key}>');
  expect(table).toContain('index===0&&<span className="connections-columns-section-title"');
  expect(table).toContain('index===visible.length&&<span className="connections-columns-section-title"');
  expect(table).toContain('active.indexOf(col.key)===0');
  expect(table).toContain('active.indexOf(col.key)===active.length-1');
  expect(table).toContain('onClick={()=>move(col.key,-1)}');
  expect(table).toContain('onClick={()=>move(col.key,1)}');
  expect(table).toContain("storage(scope,'cols')");
  expect(table).toContain('useWorktableDirectoryState(tableKey,');
  expect(table).toContain("if(key==='name')return next");
  expect(table).toContain('Reset columns</button>');
 });
 it('provides a focus-restoring Done action without affecting saved column state',()=>{
  const table=source('src/components/ConnectionsTable.tsx');
  expect(table).toContain('className="connections-columns-done"');
  expect(table).toContain('if(columnsMenuRef.current)columnsMenuRef.current.open=false');
  expect(table).toContain("columnsMenuRef.current?.querySelector<HTMLElement>('summary')?.focus({preventScroll:true})");
  expect(table).toContain('>Done · View table</button>');
  expect(table).toContain('useDismissibleDetails(columnsMenuRef)');
  expect(table).toContain('useViewportBoundDetails(columnsMenuRef)');
  const css=source('src/connections-table.css');
  expect(css).toContain('.connections-columns-section-title');
  expect(css).toContain('.connections-columns-done{display:none;}');
  expect(css).toContain('min-width:44px;min-height:44px');
  expect(css).toContain('position:sticky;bottom:-12px;z-index:1');
  expect(css).toContain('env(safe-area-inset-bottom)');
  expect(css).toContain('accent-color:var(--ss-theme-accent)');
 });
});
