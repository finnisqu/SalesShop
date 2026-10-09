import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MaterialsFilterFields } from '../components/MaterialsFilterFields';

const page = readFileSync(new URL('../components/MaterialsWorkspace.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./materials-adapter.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');
const sharedSheet = readFileSync(new URL('../components/MobileCatalogTools.tsx', import.meta.url), 'utf8');

const inputs = {
  programFilter: 'stock' as const,
  materialFamilyFilter: 'all' as const,
  materialTypeFilter: 'Quartz',
  brandFilter: 'Vicostone',
  finishFilter: 'Honed',
  thicknessFilter: '3cm',
  materialTypes: ['Quartz', 'Granite'],
  brands: ['Vicostone', 'Caesarstone'],
  finishes: ['Honed', 'Polished'],
  thicknesses: ['2cm', '3cm'],
  activeFilterCount: 5,
  onProgramChange: () => {},
  onFamilyChange: () => {},
  onTypeChange: () => {},
  onBrandChange: () => {},
  onFinishChange: () => {},
  onThicknessChange: () => {},
  onClear: () => {},
};

describe('UI Foundation Batch 5B — Materials', () => {
  it('renders one reusable accessible set of filter fields with controlled values', () => {
    const html = renderToStaticMarkup(<MaterialsFilterFields idPrefix="material-test" {...inputs} />);
    for (const [name, id] of [
      ['Program', 'program'], ['Material family', 'family'], ['Material type', 'type'],
      ['Brand', 'brand'], ['Finish', 'finish'], ['Thickness', 'thickness'],
    ]) {
      expect(html).toContain(`for="material-test-${id}"`);
      expect(html).toContain(`id="material-test-${id}"`);
      expect(html).toContain(`>${name}</label>`);
    }
    expect((html.match(/<select/g) || [])).toHaveLength(6);
    expect(html).toContain('value="stock" selected=""');
    expect(html).toContain('value="Vicostone" selected=""');
    expect(html).toContain('Clear filters');
    expect(html).not.toContain('disabled=""');
  });

  it('keeps desktop and mobile filter IDs distinct and clear-filters disabled only when empty', () => {
    const desktop = renderToStaticMarkup(<MaterialsFilterFields idPrefix="materials-desktop" {...inputs} />);
    const mobile = renderToStaticMarkup(<MaterialsFilterFields idPrefix="materials-mobile" {...inputs} activeFilterCount={0} />);
    expect(desktop).toContain('materials-desktop-program');
    expect(mobile).toContain('materials-mobile-program');
    expect(mobile).toContain('disabled=""');
    expect(page).toContain('<MaterialsFilterFields idPrefix="materials-desktop" {...filterFields} />');
    expect(page).toContain('<MaterialsFilterFields idPrefix="materials-mobile" {...filterFields} />');
  });

  it('preserves material price/filter sorting, variants, comparisons and quote insertion', () => {
    for (const required of [
      'settings.stockMaterials', 'filter((material) => material.active)',
      'resolveStockMaterialCostReference', "sort === 'cost-asc'", "sort === 'cost-desc'",
      'setBrandFilter', 'setFinishFilter', 'setThicknessFilter',
      'setPinnedKeys', 'restoreScrollAnchor', 'renderVariantBrowser',
      'materialPurchaseCostPerSf', 'materialPurchaseSlabCost',
      '<CatalogAddToQuoteButton', '<CatalogQuoteInsert',
      '<MaterialRateBook query={query}', '<SupplierImportLauncher',
      'mobileFilterOpen', 'mobileToolsOpen',
    ]) {
      expect(page, `Missing Materials operation: ${required}`).toContain(required);
    }
    expect(page).toContain('Search colors, suppliers, brands, finishes…');
  });

  it('preserves mobile sheet scroll/footer ownership instead of pinning buttons over filters', () => {
    expect(sharedSheet).toContain('mobile-catalog-tools-content');
    expect(sharedSheet).toContain('<footer className="mobile-catalog-tools-footer">');
    expect(css).toContain('.mobile-catalog-tools-content');
    expect(css).toContain('overflow-y:auto');
    expect(css).toContain('.mobile-catalog-tools-footer');
    expect(css).toContain('position:relative');
    expect(css).toContain('flex:none');
  });

  it('uses token-based foreground/background pairs and keeps the mobile search row intact', () => {
    expect(css).toContain('.sales-app.view-catalog .materials-workspace');
    for (const required of [
      '--ss-materials-ink','--ss-materials-card','--ss-materials-muted',
      '.materials-foundation-search','grid-area:search','font-size:16px',
      '.materials-foundation-filter-fields','.materials-sort-control',
      '.materials-comparison-board','.materials-reference-card',
      '.mobile-catalog-reference-price>strong','.mobile-catalog-tools-sheet',
    ]) {
      expect(css, `Missing Materials design rule: ${required}`).toContain(required);
    }
    expect(css).not.toContain('!important');
    expect(css).not.toContain('calc(100dvh - 50px)');
    expect(main.indexOf("import './design-system/materials-adapter.css'"))
      .toBeGreaterThan(main.indexOf("import './design-system/catalog-adapter.css'"));
    expect(main.indexOf("import './design-system/materials-adapter.css'"))
      .toBeGreaterThan(main.indexOf("import './appearance-contrast.css'"));
  });
});
