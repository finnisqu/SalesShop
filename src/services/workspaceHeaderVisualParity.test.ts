import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const parity=read('workspace-header-parity.css');
const quotes=read('components/QuotesMobileBeta.tsx');
const catalog=read('components/CatalogWorkspace.tsx');
const board=read('components/Board.tsx');
const accounts=read('components/AccountsBoard.tsx');
const notebook=read('App.tsx');
const tasks=read('components/TasksWorkspace.tsx');
const connections=read('components/Connections.tsx');
describe('Connections-style workspace header visual parity',()=>{
 it('loads targeted layout corrections last without changing the reference Connections header',()=>{
  const main=read('main.tsx');
  expect(main).toContain("import './workspace-header-parity.css'");
  expect(main.indexOf("import './workspace-header-parity.css'"))
   .toBeGreaterThan(main.indexOf("import './workspace-header-standard.css'"));
  expect(connections).toContain('connections-header-navigation');
  expect(connections).toContain('connections-header-tools');
  expect(connections).toContain('connections-header-search');
  expect(connections).toContain('connections-section-more');
  expect(parity).toContain('@media (min-width:761px)');
  expect(parity).toContain('grid-template-columns:minmax(0,1fr) minmax(0,440px) minmax(0,1fr)!important');
 });
 it('contains the catalog tab group within the middle slot instead of over the title',()=>{
  expect(catalog).toContain('<WorkspaceHeader title="Catalog"');
  expect(catalog).toContain('<SectionTabs className="catalog-section-nav');
  expect(parity).toContain('.catalog-workspace>.catalog-header.catalog-foundation-heading.ss-workspace-header');
  expect(parity).toContain('display:grid!important');
  expect(parity).toContain('width:max-content!important');
  expect(parity).toContain('flex:0 0 auto!important');
  expect(parity).toContain('.catalog-section-nav.catalog-foundation-tabs .ss-section-tab');
  expect(parity).toContain('.materials-foundation-search,.sinks-foundation-search,.rates-foundation-search');
  expect(parity).toContain('.is-catalog-embedded>.rates-workspace-header>div:first-child');
 });
 it('shrinks Board toggle to a content-sized pill and keeps both account and deal search',()=>{
  expect(board).toContain('className="board-view-toggle"');
  expect(accounts).toContain('className="board-view-toggle"');
  expect(parity).toContain('.board-view-toggle{');
  expect(parity).toContain('width:max-content!important');
  expect(board).toContain('Search Board deals');
  expect(accounts).toContain('Search Board accounts');
 });
 it('limits Quotes top nav to three items without losing less-common templates',()=>{
  expect(quotes).toContain("id:'all',title:'All'");
  expect(quotes).toContain("id:'quick-quote',title:'Quick Quote'");
  expect(quotes).toContain("id:'builder-rates',title:'Builder Rate Schedule'");
  for(const name of ['Community Plan Pricing','Custom Spreadsheet','Follow-ups']){
   expect(quotes).toContain("label:'"+name+"'");
  }
  expect(quotes).toContain('documentFilter===item.id');
  expect(quotes).not.toContain('qmb-library-heading-actions');
  expect(parity).toContain('flex-wrap:nowrap!important');
  expect(parity).toContain('.qmb-library-filter-row');
 });
 it('gives Tasks and Notebook the same compact tab frame',()=>{
  expect(notebook).toContain('WorkspaceHeader title="Notebook"');
  expect(tasks).toContain('WorkspaceHeader title="Tasks"');
  expect(parity).toContain('ss-workspace-header__tabs>nav');
  expect(parity).toContain('.tasks-workspace>.tasks-header.ss-workspace-header');
  expect(parity).toContain('notebook-page-search .notebook-search-field');
 });
});
