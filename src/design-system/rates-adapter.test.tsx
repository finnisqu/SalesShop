import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageHeader, Button, Field } from './components';
import { RatesFilterFields } from '../components/RatesFilterFields';

const page = readFileSync(new URL('../components/RatesWorkspace.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./rates-adapter.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');

const fields = {
  behaviorFilter: 'cost-reference' as const,
  unitFilter: 'sf' as const,
  overrideFilter: 'has' as const,
  availableUnits: ['sf', 'each'] as Array<'sf' | 'each'>,
  activeFilterCount: 3,
  onBehaviorChange: () => {},
  onUnitChange: () => {},
  onOverrideChange: () => {},
  onClear: () => {},
};

describe('UI Foundation Batch 5D — Rates', () => {
  it('renders one labeled and controlled set of three filters', () => {
    const html = renderToStaticMarkup(<RatesFilterFields idPrefix="rates-qa" {...fields} />);
    for (const key of ['behavior', 'unit', 'overrides']) {
      expect(html).toContain(`id="rates-qa-${key}"`);
      expect(html).toContain(`for="rates-qa-${key}"`);
    }
    expect((html.match(/<select/g) ?? [])).toHaveLength(3);
    expect(html).toContain('Pricing behavior');
    expect(html).toContain('Division pricing');
    expect(html).toContain('Clear filters');
    expect(html).not.toContain('disabled=""');
    const disabled = renderToStaticMarkup(<RatesFilterFields idPrefix="rates-none" {...fields} activeFilterCount={0} />);
    expect(disabled).toContain('disabled=""');
  });

  it('shares the same filtering state between desktop and mobile sheets', () => {
    expect(page).toContain('<RatesFilterFields idPrefix="rates-desktop"');
    expect(page).toContain('<RatesFilterFields idPrefix="rates-mobile"');
    expect(page).toContain('onBehaviorChange={setBehaviorFilter}');
    expect(page).toContain('onUnitChange={setUnitFilter}');
    expect(page).toContain('onOverrideChange={setOverrideFilter}');
    expect(page).toContain('onClear={clearReferenceFilters}');
    expect(page).toContain("setOverrideFilter('all')");
    expect(page).toContain("setUnitFilter('all')");
    expect(page).toContain("setBehaviorFilter('all')");
  });

  it('keeps reference/editor modes and category selection accessible', () => {
    const header=renderToStaticMarkup(<PageHeader eyebrow="Company pricing reference" title="Rates"
      actions={<Button variant="secondary">Edit pricing</Button>} />);
    expect(header).toContain('ss-page-header__title');
    expect(header).toContain('type="button"');
    const field=renderToStaticMarkup(<Field id="rates-catalog-search" label="Search pricing reference">
      {(control)=><input {...control} type="search" value="fabrication" readOnly />}
    </Field>);
    expect(field).toContain('for="rates-catalog-search"');
    expect(field).toContain('id="rates-catalog-search"');
    expect(page).toContain('<PageHeader className="rates-workspace-header');
    expect(page).toContain('role="group" aria-label="Filter rate category"');
    expect(page).toContain('aria-pressed={category === tab}');
    expect(page).toContain('aria-pressed={editing}');
    expect(page).toContain('aria-pressed={!editing}');
    expect(page).toContain('onClick={() => selectCategory(tab)}');
    expect(page).toContain('syncEditorCategory(category)');
  });

  it('preserves price sorting, cost bands, division overrides, history and quote insertion', () => {
    for (const required of [
      'useRateBookStore', 'useMaterialLevelGuideStore',
      "rateSort === 'cost-asc'", "rateSort === 'sell-asc'",
      "rateSort === 'sell-desc'", "rateSort === 'effective-desc'",
      'divisionOverrides.length', 'marginLabel(item)',
      'materialLevelCostBand(guide.rules, rule)', 'guide.slabPricingMultiplier',
      'historyCount', 'addRateItem(nextCategory)',
      '<RateBook />', '<CatalogAddToQuoteButton',
      "kind: 'rate'", '<CatalogQuoteInsert',
      '<MobileCatalogReferenceCard', '<MobileCatalogFilterSheet',
      '<MobileCatalogToolsSheet',
    ]) expect(page, `Rate behavior changed: ${required}`).toContain(required);
  });

  it('uses route-scoped paired theme colors for rate cards, editors and mobile controls', () => {
    for (const required of [
      '.sales-app.view-catalog .rates-workspace',
      '--ss-rates-ink','--ss-rates-card','--ss-rates-muted',
      '.rates-foundation-search','.rates-foundation-filter-fields',
      '.rates-sort-control','.rates-reference-table td',
      '.rates-mobile-price-details>div','.rate-book-view',
      '.mobile-catalog-reference-card.is-expanded','.mobile-catalog-tools-sheet',
      '.rates-foundation-filter-popover',
    ]) expect(css, `Missing Rates theme contract: ${required}`).toContain(required);
    expect(css).not.toContain('calc(100dvh - 50px)');
    expect(main.indexOf("import './design-system/rates-adapter.css'"))
      .toBeGreaterThan(main.indexOf("import './design-system/sinks-adapter.css'"));
  });

  it('keeps landscape phones in the compact mobile layout with accessible sheet fields', () => {
    expect(css).toContain('(orientation: landscape) and (max-height: 520px) and (pointer: coarse)');
    expect(css).toContain('font-size:16px');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('overflow-y:auto');
    expect(css).toContain('.mobile-catalog-tools-footer');
    expect(css).toContain('position:relative');
    expect(page).toContain('onClick={() => setMobileToolsOpen(true)}');
    expect(page).toContain('onClose={() => setMobileFilterOpen(false)}');
  });
});
