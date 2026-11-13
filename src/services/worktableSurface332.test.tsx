import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {WorktableSurface} from '../components/WorktableChrome';

const source=(path:string)=>readFileSync(new URL('../components/'+path+'.tsx',import.meta.url),'utf8');

describe('Batch 332a — one rounded table surface for Records and Catalog',()=>{
 it('provides an accessible scrolling region and preserves caller-specific classes',()=>{
  const html=renderToStaticMarkup(
   <WorktableSurface className="rates-reference-table-wrap catalog-product-scroll"
    label="Sinks catalog results"><table><thead><tr><th>Model</th></tr></thead>
    <tbody><tr><td>Example</td></tr></tbody></table></WorktableSurface>,
  );
  expect(html).toContain('class="ss-worktable-surface rates-reference-table-wrap catalog-product-scroll"');
  expect(html).toContain('role="region"');
  expect(html).toContain('aria-label="Sinks catalog results"');
  expect(html).toMatch(/tabindex="0"/i);
  expect(html.match(/<table/g)).toHaveLength(1);
 });
 it('routes all five catalog reference tables through the same component',()=>{
  const expected=[
   ['MaterialsWorkspace','Materials catalog worktable',1],
   ['RatesWorkspace','Rates catalog worktable',2],
   ['CatalogSinksWorktable','Sinks catalog worktable',1],
   ['CatalogOtherWorktable','Other catalog worktable',1],
  ] as const;
  for(const [file,label,count] of expected){
   const content=source(file);
   expect(content).toContain("from './WorktableChrome'");
   expect(content).toContain('label="'+label+'"');
   expect(content.match(/<WorktableSurface /g)).toHaveLength(count);
   expect(content.match(/<\/WorktableSurface>/g)).toHaveLength(count);
   expect(content).not.toContain('ss-worktable-surface">');
  }
  expect(source('ConnectionsTable')).toContain('<WorktableSurface className="connections-table-scroll"');
  expect(source('SuppliersWorkspace')).toContain('<WorktableSurface className="supplier-directory-table-scroll"');
 });

 it('uses one trigger style for shared Filters and Actions menus',()=>{
  const css=readFileSync(new URL('../worktable-chrome.css',import.meta.url),'utf8');
  expect(css).toContain(':is(.ss-worktable-action-menu,.ss-worktable-filter-menu)>summary{');
  expect(css).toContain('min-height:var(--ss-worktable-control-size)');
  expect(css).toContain(':is(.ss-worktable-action-menu,.ss-worktable-filter-menu)[open]>summary');
  expect(css).toContain('.ss-worktable-surface:focus-visible');
  expect(css).toContain('outline-offset:-2px');
  expect(css).not.toContain('.ss-worktable-filter-menu>summary{');
  expect(css).not.toContain('.ss-worktable-action-menu>summary{');
 });
 it('follows the shared workbook density for Catalog headings and ordinary rows',()=>{
  const css=readFileSync(new URL('../catalog-product-worktable.css',import.meta.url),'utf8');
  const shared=readFileSync(new URL('../workbook-table-foundation.css',import.meta.url),'utf8');
  expect(css).toContain('height:var(--ss-workbook-heading-height,40px)');
  expect(css).toContain('height:var(--ss-workbook-row-height,51px)');
  expect(css).toContain('padding:var(--ss-workbook-cell-pad-y,9px) 12px');
  expect(shared).toContain('--ss-workbook-row-height:41px');
  expect(shared).toContain('[data-ss-workbook-density="compact"]');
  expect(css).toContain('tbody tr:not(.materials-variant-expanded-row)>td');
  // The mobile Catalog override retains auto-sized cells.
  expect(css).toContain('height:auto;');
 });
 it('preserves each Catalog table\'s existing data and row editing logic',()=>{
  expect(source('MaterialsWorkspace')).toContain('pagedMaterials.map');
  expect(source('RatesWorkspace')).toContain('pagedRates.map');
  expect(source('CatalogSinksWorktable')).toContain('pagedModels.map');
  expect(source('CatalogOtherWorktable')).toContain('pagedItems.map');
 });
});
