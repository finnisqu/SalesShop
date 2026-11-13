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
  expect(html).toContain('tabindex="0"');
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
 it('preserves each Catalog table\'s existing data and row editing logic',()=>{
  expect(source('MaterialsWorkspace')).toContain('pagedMaterials.map');
  expect(source('RatesWorkspace')).toContain('pagedRates.map');
  expect(source('CatalogSinksWorktable')).toContain('pagedModels.map');
  expect(source('CatalogOtherWorktable')).toContain('pagedItems.map');
 });
});
