import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const file=(p:string)=>readFileSync(join(process.cwd(),p),'utf8');

describe('Desktop workspace visual parity v2',()=>{
 const app=file('src/App.tsx');
 const css=file('src/design-system/workspace-visual-system-v2.css');
 const main=file('src/main.tsx');
 const catalog=file('src/components/CatalogWorkspace.tsx');
 const suppliers=file('src/components/SuppliersWorkspace.tsx');
 it('groups the four desktop global actions while preserving independent launchers',()=>{
  expect(app).toContain('className="app-primary-actions"');
  for(const component of ['<SalesCalendarLauncher compact />','<GlobalSearch />','<QuickCreate />','<GlobalPostItLauncher />'])
   expect(app).toContain(component);
  expect(css).toContain('@media (min-width:1550px)');
  expect(css).toContain('left:50%');
  expect(css).toContain('@media (min-width:761px) and (max-width:1549px)');
 });
 it('shares a desktop content width and compact Catalog tab row',()=>{
  expect(css).toContain('--ss-workspace-width:1360px');
  expect(css).toContain('.sales-app.view-dashboard .connections-workspace');
  expect(css).toContain('.sales-app.view-catalog .catalog-section-host');
  expect(css).toContain('.sales-app.view-board .board-header-panel.board-foundation-header');
  expect(css).toContain('.catalog-section-nav.catalog-foundation-tabs');
  expect(catalog).toContain('items={CATALOG_SECTIONS.map(({ id, label }) => ({ id, label }))}');
  expect(css).toContain('.catalog-other-coming-soon');
  expect(main).toContain("import './design-system/workspace-visual-system-v2.css'");
 });
 it('keeps Suppliers as CRM-style directory plus full record without losing legacy mobile flow',()=>{
  expect(suppliers).toContain('supplier-directory-page');
  expect(suppliers).toContain('supplier-directory-table');
  expect(suppliers).toContain('setDirectoryOpen(false)');
  expect(suppliers).toContain('setDirectoryOpen(true)');
  expect(suppliers).toContain('supplier-record-back');
  expect(suppliers).toContain('<SupplierRelationshipPanels');
  expect(suppliers).toContain('supplier-mobile-reference-list');
  expect(css).toContain('.supplier-workbench.is-directory-hidden');
  expect(css).toContain('@media (min-width:901px) and (min-height:550px)');
  expect(css).toContain('.supplier-create-dialog');
 });
 it('preserves Quick Quote editor and phone layouts while compacting only Documents library',()=>{
  expect(css).toContain('.qmb-desktop-frame.is-library');
  expect(css).toContain('.qmb-library-heading-actions');
  expect(css).toContain('.connections-tabs.ss-section-tabs');
  expect(css).toContain('@media (max-width:760px)');
  expect(css).not.toContain('.qmb-quote-editor');
 });
});
