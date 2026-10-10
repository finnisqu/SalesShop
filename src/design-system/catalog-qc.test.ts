import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const load=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const themes=load('../appearance-themes.css');
const qc=load('./catalog-qc.css');
const main=load('../main.tsx');
const legacy=load('../catalog-workspace.css');
const supplierLegacy=load('../materials-suppliers.css');
const query='(max-width: 700px), (orientation: landscape) and (max-height: 520px) and (pointer: coarse)';

function luminance(hex:string):number {
  let h=hex.replace('#','');
  if(h.length===3)h=[...h].map(c=>c+c).join('');
  const channels=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)
    .map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
}
function contrast(a:string,b:string):number {
  const x=luminance(a),y=luminance(b);
  return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

describe('UI Foundation Batch 6 — Catalog-wide QC',()=>{
  it('keeps every installed theme legible across base/card/tint and accent text',()=>{
    const matches=[...themes.matchAll(/:root\[data-sales-theme="([^"]+)"\]\s*\{([^}]+)\}/g)];
    expect(matches.length).toBeGreaterThanOrEqual(10);
    for(const [,name,body] of matches){
      const p=Object.fromEntries([...body.matchAll(/--ss-theme-(\w+):\s*(#[0-9a-fA-F]{3,8})/g)]
        .map(([,k,v])=>[k,v]));
      for(const key of ['ink','muted','card','base','tint','accent','contrast']){
        expect(p[key],`Theme ${name} missing ${key}`).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      }
      for(const surface of ['card','base','tint']){
        for(const foreground of ['ink','muted']){
          expect(contrast(p[foreground],p[surface]),
            `${name}: ${foreground} on ${surface} fails WCAG AA`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast(p.contrast,p.accent),`${name}: accent button text too faint`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  it('loads final Catalog QC rules after all specialized adapters',()=>{
    const imports=[
      './design-system/catalog-adapter.css',
      './design-system/materials-adapter.css',
      './design-system/sinks-adapter.css',
      './design-system/rates-adapter.css',
      './design-system/suppliers-adapter.css',
      './design-system/catalog-qc.css',
    ];
    const locations=imports.map(file=>main.indexOf(`import '${file}';`));
    expect(locations.every(n=>n>=0)).toBe(true);
    expect([...locations].sort((a,b)=>a-b)).toEqual(locations);
  });

  it('removes duplicate Catalog tab adornments and unscoped primary button rules',()=>{
    expect(legacy).not.toContain('.catalog-section-nav button.active::after');
    expect(legacy).not.toContain('.catalog-section-nav button.active span');
    expect(supplierLegacy).not.toMatch(/(?:^|\n)button\.primary\s*\{/);
    expect(supplierLegacy).toContain('.supplier-workbench button.primary');
    expect(supplierLegacy).not.toMatch(/(?:^|\n)button\.danger\s*,/);
  });

  it('keeps Supplier desktop navigator and record independently scrolling',()=>{
    expect(qc).toContain('.catalog-section-host.catalog-section-suppliers');
    expect(qc).toContain('display:flex;');
    expect(qc).toContain('overflow:hidden;');
    expect(qc).toContain('.catalog-section-host.catalog-section-suppliers>.supplier-workbench');
    expect(qc).toContain('flex:1 1 auto;');
    const supplier=load('./suppliers-adapter.css');
    expect(supplier).toContain('.supplier-nav-list');
    expect(supplier).toContain('overflow-y:auto');
    expect(supplier).toContain('.supplier-record');
  });

  it('uses one Catalog host scroll and disables nested rates/sinks scroll on touch phones',()=>{
    expect(qc).toContain(`@media ${query}`);
    expect(qc).toContain('.catalog-section-host > :is(');
    expect(qc).toContain('.rates-workspace.is-catalog-embedded');
    expect(qc).toContain('.sinks-workspace.is-catalog-embedded');
    expect(qc).toContain('max-height:none;');
    expect(qc).toContain('overflow:visible;');
    expect(qc).toContain('overflow-y:auto;');
    expect(qc).toContain('-webkit-overflow-scrolling:touch;');
    const catalog=load('./catalog-adapter.css');
    expect(catalog).toContain('catalog-header.catalog-foundation-heading');
    expect(catalog).toContain('catalog-section-nav.catalog-foundation-tabs');
    expect(catalog).toContain('display:none;');
  });

  it('keeps filter footer outside a single scrolling sheet content area',()=>{
    const shared=load('../components/MobileCatalogTools.tsx');
    expect(shared).toContain('<div className="mobile-catalog-tools-content">{children}</div>');
    expect(shared).toContain('<footer className="mobile-catalog-tools-footer">{footer}</footer>');
    expect(qc).toContain('.mobile-catalog-tools-content {');
    expect(qc).toContain('overflow-y:auto;');
    expect(qc).toContain('.mobile-catalog-tools-footer {');
    expect(qc).toContain('position:relative;');
    expect(qc).toContain('.mobile-catalog-filter-done {');
    expect(qc).toContain('min-height:44px;');
  });

  it('uses theme-based surfaces for expanded Suppliers details instead of ivory tiles',()=>{
    expect(qc).toContain('.supplier-mobile-reference-details>div');
    expect(qc).toContain('background:var(--ss-theme-card);');
    expect(qc).toContain('.supplier-mobile-reference-details>div>strong');
    expect(qc).toContain('color:var(--ss-theme-ink);');
    expect(qc).toContain('.supplier-pricing-history');
    // Pricing-publication details are styled by the 5E section adapter.
    const supplier=load('./suppliers-adapter.css');
    expect(supplier).toContain('.supplier-pricing-history');
    expect(supplier).toContain('.supplier-source-rules');
  });

  it('does not modify source pricing operations while unifying Catalog shell styles',()=>{
    const rate=load('../components/RatesWorkspace.tsx');
    const material=load('../components/MaterialsWorkspace.tsx');
    const sink=load('../components/SinksWorkspace.tsx');
    const supplier=load('../components/SuppliersWorkspace.tsx');
    expect(material).toContain('<CatalogAddToQuoteButton');
    expect(material).toContain('resolveStockMaterialCostReference');
    expect(sink).toContain('addVariant(selected.id)');
    expect(sink).toContain('<CatalogAddToQuoteButton');
    expect(rate).toContain('materialLevelCostBand');
    expect(rate).toContain('<CatalogAddToQuoteButton');
    expect(supplier).toContain('createRulesFromPublished(');
    expect(supplier).toContain('mergeSupplierProfiles(');
    expect(supplier).toContain('fetchSupplierImportPublicationHistory(200)');
  });
});
