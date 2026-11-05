import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WorkspaceMoreMenu} from '../components/WorkspaceHeader';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

describe('Shared desktop action menu and dialog foundation',()=>{
 it('keeps keyboard-accessible More actions with disabled and active states',()=>{
  const html=renderToStaticMarkup(<WorkspaceMoreMenu items={[
   {label:'Compact cards',active:true,onClick:()=>{}},
   {label:'Coming soon',disabled:true,onClick:()=>{}},
  ]}/>);
  expect(html).toContain('ss-workspace-more');
  expect(html).toContain('aria-label="More menu"');
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('disabled=""');
  expect(html).toContain('Compact cards');
 });
 it('uses one outside-click and Escape/focus-return rule for native menus',()=>{
  const hook=read('components/useDismissibleDetails.ts');
  expect(hook).toContain("document.addEventListener('pointerdown',outside,true)");
  expect(hook).toContain("document.addEventListener('keydown',escape,true)");
  expect(hook).toContain("menu.querySelector<HTMLElement>('summary')?.focus()");
  expect(hook).toContain("if(menu?.open&&!menu.contains(event.target as Node))menu.open=false");
  expect(hook).toContain('useDismissiblePopover(');
  for(const file of ['components/WorkspaceHeader.tsx','components/ConnectionsTable.tsx',
   'components/SalesDocumentActionsMenu.tsx','components/StationeryInsertMenu.tsx']){
   expect(read(file)).toContain('useDismissibleDetails(');
  }
 });
 it('matches controlled Board and Connections menus without changing their workflow',()=>{
  const board=read('components/Board.tsx');
  const connections=read('components/Connections.tsx');
  expect(board).toContain("useDismissiblePopover(pipelineMenuRef,pipelineMenuOpen");
  expect(connections).toContain('useDismissiblePopover(moreRef,moreOpen');
  expect(board).toContain('setPipelineView(');
  expect(connections).toContain('chooseTab(');
  expect(board).toContain('board-pipeline-more-trigger');
  expect(connections).toContain('connections-more-menu');
 });
 it('shares the existing modal focus trap between CRM and Task bulk editors',()=>{
  const hook=read('lib/useDismissibleLayer.ts');
  const crm=read('components/ConnectionsBulkEditDialog.tsx');
  const task=read('components/TaskBulkEditDialog.tsx');
  expect(hook).toContain('returnFocusRef');
  expect(hook).toContain("querySelector<HTMLElement>('[data-dialog-initial-focus]')");
  expect(hook).toContain("if (event.key === 'Escape')");
  expect(hook).toContain("if (event.key !== 'Tab') return");
  for(const dialog of [crm,task]){
   expect(dialog).toContain('useDismissibleLayer<HTMLElement>(true,()=>{if(!saving)onClose();})');
   expect(dialog).toContain('data-dialog-initial-focus');
   expect(dialog).toContain('ref={dialogRef}');
   expect(dialog).toContain('role="dialog" aria-modal="true"');
   expect(dialog).toContain('createPortal(');
  }
 });
 it('normalizes desktop menu geometry but does not touch mobile layouts',()=>{
  const css=read('shared-desktop-interactions.css');
  expect(css).toContain('@media(min-width:821px)');
  expect(css).not.toContain('@media(max-width:');
  for(const selector of ['.ss-workspace-more__menu','.board-pipeline-menu',
   '.connections-more-menu','.connections-columns-popover',
   '.sales-document-rail-menu','.insert-menu-panel','.connections-bulk-dialog']){
   expect(css).toContain(selector);
  }
  const main=read('main.tsx');
  expect(main.indexOf("import './shared-desktop-interactions.css'"))
   .toBeGreaterThan(main.indexOf("import './workbook-table-foundation.css'"));
 });
});
