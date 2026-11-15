import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
 OPEN_WORKTABLE_DETAILS_SELECTOR,closeOtherOpenWorktableDetails,
} from '../components/useViewportBoundDetails';

const source=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
type FakeScope={entries:HTMLDetailsElement[];querySelectorAll:(selector:string)=>HTMLDetailsElement[]};
const scope=():FakeScope=>({
 entries:[],
 // Match native Element.querySelectorAll: return only elements that actually
 // satisfy the CSS selector, including its [open] state. Returning all
 // entries accidentally made the mock treat unrelated help accordions as
 // worktable menus, while the browser would never include them.
 querySelectorAll(selector){return this.entries.filter(entry=>entry.open&&entry.matches(selector));},
});
const menu=(kind:string,root:FakeScope):HTMLDetailsElement=>({
 open:true,
 matches:(selector:string)=>selector.split(',').some(part=>part.trim()==='details.'+kind+'[open]'),
 closest:()=>root,
 contains:()=>false,
}) as unknown as HTMLDetailsElement;

describe('Batch 350e — worktable menus do not overlap',()=>{
 it('uses a single explicit shared family for Filters, More and Columns',()=>{
  expect(OPEN_WORKTABLE_DETAILS_SELECTOR.split(',')).toEqual([
   'details.ss-worktable-filter-menu[open]',
   'details.ss-worktable-action-menu[open]',
   'details.connections-columns-menu[open]',
  ]);
 });
 it('opening Columns closes both already-open Filters and More without closing itself',()=>{
  const root=scope();
  const filters=menu('ss-worktable-filter-menu',root);
  const more=menu('ss-worktable-action-menu',root);
  const columns=menu('connections-columns-menu',root);
  root.entries=[filters,more,columns];
  expect(closeOtherOpenWorktableDetails(columns)).toBe(2);
  expect(columns.open).toBe(true);
  expect(filters.open).toBe(false);
  expect(more.open).toBe(false);
  expect(closeOtherOpenWorktableDetails(columns)).toBe(0);
 });
 it('opening Filters closes an already-open Columns menu on the same surface',()=>{
  const root=scope(),filters=menu('ss-worktable-filter-menu',root);
  const columns=menu('connections-columns-menu',root);
  root.entries=[columns,filters];
  expect(closeOtherOpenWorktableDetails(filters)).toBe(1);
  expect(filters.open).toBe(true);
  expect(columns.open).toBe(false);
 });
 it('does not cross independent SalesShop surfaces or affect unrelated details',()=>{
  const first=scope(),second=scope();
  const filters=menu('ss-worktable-filter-menu',first);
  const other=menu('connections-columns-menu',second);
  const untracked=menu('user-guide-accordion',first);
  first.entries=[filters,untracked];second.entries=[other];
  expect(first.querySelectorAll(OPEN_WORKTABLE_DETAILS_SELECTOR)).toEqual([filters]);
  expect(second.querySelectorAll(OPEN_WORKTABLE_DETAILS_SELECTOR)).toEqual([other]);
  expect(closeOtherOpenWorktableDetails(filters)).toBe(0);
  expect(untracked.open).toBe(true);
  expect(other.open).toBe(true);
  expect(closeOtherOpenWorktableDetails(untracked)).toBe(0);
 });
 it('does not modify closed menus or collapse containing/contained nested menus',()=>{
  const root=scope();
  const outer=menu('ss-worktable-filter-menu',root);
  const nested=menu('ss-worktable-action-menu',root);
  const sibling=menu('connections-columns-menu',root);
  outer.contains=(target:Node)=>target===nested;
  root.entries=[outer,nested,sibling];
  expect(closeOtherOpenWorktableDetails(nested)).toBe(1);
  expect(outer.open).toBe(true);
  expect(nested.open).toBe(true);
  expect(sibling.open).toBe(false);
  nested.open=false;
  expect(root.querySelectorAll(OPEN_WORKTABLE_DETAILS_SELECTOR)).not.toContain(nested);
  expect(closeOtherOpenWorktableDetails(nested)).toBe(0);
 });
 it('uses the existing viewport toggle, outside-click and Escape hooks without a new overlay',()=>{
  const bounds=source('src/components/useViewportBoundDetails.ts');
  expect(bounds).toContain('closeOtherOpenWorktableDetails(menu);');
  expect(bounds).toContain("menu.addEventListener('toggle',toggle)");
  expect(bounds).toContain('position();');
  expect(bounds).toContain("const scope=opened.closest('.sales-app')??document;");
  expect(bounds).toContain('menu.contains(opened)||opened.contains(menu)');
  const chrome=source('src/components/WorktableChrome.tsx');
  const records=source('src/components/ConnectionsTable.tsx');
  expect(chrome).toContain('useViewportBoundDetails(ref);');
  expect(chrome).toContain("className=\"ss-worktable-action-menu\"");
  expect(chrome).toContain("className={'ss-worktable-filter-menu '+className}");
  expect(records).toContain('useViewportBoundDetails(columnsMenuRef);');
  expect(records).toContain('className="connections-columns-menu"');
  const dismiss=source('src/components/useDismissibleDetails.ts');
  expect(dismiss).toContain("document.addEventListener('pointerdown',outside,true);");
  expect(dismiss).toContain("document.addEventListener('keydown',escape,true);");
 });
});
