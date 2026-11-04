import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const src=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('SalesShop streamlined workspace contract',()=>{
 const tasks=src('src/components/TasksWorkspace.tsx');
 const catalog=src('src/components/CatalogWorkspace.tsx');
 const connections=src('src/components/Connections.tsx');
 const beta=src('src/components/QuotesMobileBeta.tsx');
 const detailed=src('src/components/Quotes.tsx');
 const settings=src('src/components/CompanySettings.tsx');
 const menu=src('src/components/SalesDocumentActionsMenu.tsx');
 const css=src('src/workspace-refinement-v1.css');
 it('uses task count chips as single status filter and offers full history',()=>{
  expect(tasks).toContain('aria-pressed={filter===key}');
  expect(tasks).toContain("label:'All history'");
   expect(tasks).toContain('WorkspaceMoreMenu');
  expect(tasks).toContain('tasks-filter-help');
  expect(tasks).not.toContain('className="tasks-filter-row"');
 });
 it('removes duplicate Catalog context but keeps editor tabs',()=>{
  expect(catalog).not.toContain('catalog-current-section');
  expect(catalog).toContain('sectionScrollRef.current.scrollTop = 0');
  expect(catalog).toContain('MaterialsWorkspace embedded');
  expect(catalog).toContain('RatesWorkspace embedded');
  expect(catalog).toContain('SuppliersWorkspace');
 });
 it('keeps Companies, People and Deals creation inside modal sheets',()=>{
  expect(connections).toContain('createPortal(');
  expect(connections).toContain('connections-create-dialog');
  for(const p of ['addCompany','addPerson','addDeal'])
   expect(connections).toContain('onSubmit={'+p+'}');
  expect(connections).toContain('aria-modal="true"');
  expect(css).toContain('.connections-create-backdrop');
  expect(css).toContain('env(safe-area-inset-bottom)');
 });
 it('offers two named editors without duplicating saved quote records',()=>{
  expect(settings).toContain("title: 'Quote Editors'");
  expect(settings).toContain('settings-mobile-section-select');
  expect(settings).toContain('aria-label="Settings section"');
  expect(settings).toContain('visibleTabs.map');
  expect(css).toContain('.settings-mobile-section-select');
  expect(settings).toContain('Open Detailed Editor');
  expect(settings).toContain('Open Quick Quote');
  expect(beta).toContain("label:'Detailed Editor'");
  expect(beta).not.toContain('qmb-library-heading-actions');
  expect(beta).toContain('openDetailedQuoteEditor(quote?.id)');
  expect(menu).toContain('Open in Detailed Editor');
  expect(detailed).toContain('>Detailed Editor</button>');
  expect(detailed).toContain('>Quick Quote</button>');
 });
});
