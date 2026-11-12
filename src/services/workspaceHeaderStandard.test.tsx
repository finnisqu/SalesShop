import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WorkspaceHeader,WorkspaceMoreMenu} from '../components/WorkspaceHeader';
const src=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=src('workspace-header-standard.css');
describe('Six-workspace standardized header',()=>{
 it('reserves title, true-center tabs, More, Search, fixed-width create',()=>{
  const html=renderToStaticMarkup(<WorkspaceHeader title="Tasks"
    tabs={<nav><button type="button">Open</button></nav>}
    more={<WorkspaceMoreMenu items={[{label:'All history',onClick:()=>{}}]}/>}
    search={<input type="search" aria-label="Search tasks"/>}
    primary={<button type="button">+ Task</button>}/>);
  for(const part of ['ss-workspace-header__intro','ss-workspace-header__tabs',
   'ss-workspace-header__more','ss-workspace-header__search','ss-workspace-header__primary',
   'ss-workspace-more'])expect(html).toContain(part);
  expect(html).toContain('All history');
  expect(html).toContain('Search tasks');
  expect(css).toContain('--ss-workspace-header-height:82px');
  expect(css).toContain('--ss-header-more-width:86px');
  expect(css).toContain('--ss-header-search-width:184px');
  expect(css).toContain('--ss-header-create-width:126px');
  expect(css).toContain('grid-template-columns:minmax(0,1fr) minmax(0,440px) minmax(0,1fr)');
  expect(css).toContain('@media(min-width:761px) and (max-width:1399px)');
  expect(css).toContain('grid-template-rows:50px 46px');
 });
 it('applies the same chrome to six pages without replacing record editors',()=>{
  const pages=[
   ['components/Board.tsx','ss-workspace-header'],
   ['components/AccountsBoard.tsx','ss-workspace-header'],
   ['components/Connections.tsx','ss-workspace-header'],
   ['components/QuotesMobileBeta.tsx','WorkspaceHeader title="Records"'],
   ['components/TasksWorkspace.tsx','WorkspaceHeader title="Tasks"'],
   ['components/CatalogWorkspace.tsx','WorkspaceHeader title="Catalog"'],
   ['App.tsx','WorkspaceHeader title="Notebook"'],
  ];
  pages.forEach(([file,pattern])=>expect(src(file)).toContain(pattern));
  expect(css).toContain('.notebook-workspace:has(>.ss-workspace-header)');
  expect(src('components/QuotesMobileBeta.tsx')).toContain('QuoteMatrixBuilder');
  expect(src('components/CatalogWorkspace.tsx')).toContain('<MaterialsWorkspace embedded externalQuery={catalogSearch}');
 });
 it('keeps search and add actions connected to real workspace controls',()=>{
  const board=src('components/Board.tsx');
  const accounts=src('components/AccountsBoard.tsx');
  const catalog=src('components/CatalogWorkspace.tsx');
  const tasks=src('components/TasksWorkspace.tsx');
  expect(board).toContain('boardSearch.trim().toLowerCase()');
  expect(accounts).toContain('searchQuery.trim().toLowerCase()');
  expect(catalog).toContain("window.dispatchEvent(new Event('sales-shop:catalog-create'))");
  expect(catalog).toContain("disabled={!canAdd}");
  expect(catalog).toContain('<CatalogSinksWorktable externalQuery={catalogSearch}');
  expect(catalog).toContain('<CatalogOtherWorktable externalQuery={catalogSearch}');
  expect(tasks).toContain('onChange={event=>setSearch(event.target.value)}');
  for(const file of ['MaterialsWorkspace','SinksWorkspace','RatesWorkspace','SuppliersWorkspace','CatalogTagsWorkspace']){
   expect(src('components/'+file+'.tsx')).toContain("sales-shop:catalog-create");
   expect(src('components/'+file+'.tsx')).toContain('externalQuery');
  }
 });
});
