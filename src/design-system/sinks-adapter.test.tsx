import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, Field, PageHeader } from './components';

const page = readFileSync(new URL('../components/SinksWorkspace.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./sinks-adapter.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');

describe('UI Foundation Batch 5C — Sinks', () => {
  it('uses shared header and search primitives with actual labels and app-safe actions', () => {
    const heading = renderToStaticMarkup(<PageHeader eyebrow="Product catalog"
      title="Sinks" description="Sink models and variants"
      actions={<Button variant="secondary">Edit catalog</Button>} />);
    expect(heading).toContain('ss-page-header__title');
    expect(heading).toContain('Product catalog');
    expect(heading).toContain('type="button"');
    const field = renderToStaticMarkup(<Field id="sinks-catalog-search" label="Search sink catalog">
      {(props) => <input {...props} type="search" value="3218" readOnly />}
    </Field>);
    expect(field).toContain('for="sinks-catalog-search"');
    expect(field).toContain('id="sinks-catalog-search"');
    expect(field).toContain('type="search"');
    expect(page).toContain('<PageHeader className="sinks-workspace-header');
    expect(page).toContain('<Field className="sinks-foundation-search"');
    expect(page).toContain('onClick={() => setEditing((value) => !value)}');
  });

  it('keeps category selection as an accessible filter, not a fake tab list', () => {
    expect(page).toContain('role="group" aria-label="Filter sink category"');
    expect(page).toContain("aria-pressed={category === 'all'}");
    expect(page).toContain('aria-pressed={category === item}');
    expect(page).toContain('onClick={() => setCategory(item)}');
    expect(page).not.toContain('role="tablist" aria-label="Sink categories"');
    const html = renderToStaticMarkup(<Button variant="quiet" aria-pressed={true}>Kitchen</Button>);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('type="button"');
  });

  it('preserves sink model, pricing, variant editing and quote-insertion operations', () => {
    for (const required of [
      'useSinkCatalogStore', 'addModel(', 'updateModel(selected.id',
      'addVariant(selected.id)', 'updateVariant(selected.id, variant.id',
      'duplicateVariant(selected.id, variant.id)', 'deleteVariant(selected.id, variant.id)',
      'selected.variants.length > 1', 'window.confirm',
      'variant.internalCost', 'variant.sellPrice', 'variant.effectiveDate',
      'variant.history.length > 1', 'variant.default', 'variant.ada',
      'CatalogAddToQuoteButton', "kind: 'sink'", 'CatalogQuoteInsert',
      'setMobileToolsOpen(true)', 'setExpandedMobileSinkId',
      'MobileCatalogReferenceCard', 'MobileCatalogToolsSheet',
    ]) {
      expect(page, `Sinks feature missing: ${required}`).toContain(required);
    }
    expect(page).toContain('priceMeta=');
    expect(page).toContain('priceAriaLabel=');
  });

  it('pairs sink card, variants, money inputs and expanded mobile surfaces with theme tokens', () => {
    expect(css).toContain('.sales-app.view-catalog .sinks-workspace');
    for (const target of [
      '--ss-sinks-ink','--ss-sinks-card','--ss-sinks-muted','--ss-sinks-border',
      '.sinks-foundation-search input[type="search"]',
      '.sinks-catalog-shell','.sinks-model-list>button.active',
      '.sinks-variant-card>header','.sinks-variant-reference>div',
      '.sinks-money-input','.sinks-variant-editor input',
      '.mobile-catalog-reference-card.is-expanded',
      '.mobile-catalog-reference-card.is-expanded>.mobile-catalog-reference-details',
      '.sinks-mobile-variant-price','.mobile-catalog-tools-sheet',
    ]) {
      expect(css, `Missing Sinks shared color/shape rule: ${target}`).toContain(target);
    }
    expect(css).toContain('background:var(--ss-sinks-card)');
    expect(css).toContain('color:var(--ss-sinks-ink)');
    expect(css).not.toContain('background:#fffaf0');
  });

  it('preserves search-first mobile layout, 16px editing inputs, and a scrolling sheet body', () => {
    expect(css).toContain('(orientation: landscape) and (max-height: 520px) and (pointer: coarse)');
    expect(css).toContain('font-size:16px');
    expect(css).toContain('min-height:44px');
    expect(css).toContain('.sinks-foundation-search');
    expect(css).toContain('.mobile-catalog-tools-content');
    expect(css).toContain('overflow-y:auto');
    expect(css).toContain('.mobile-catalog-tools-footer');
    expect(css).toContain('position:relative');
    expect(css).not.toContain('calc(100dvh - 50px)');
    expect(main.indexOf("import './design-system/sinks-adapter.css'"))
      .toBeGreaterThan(main.indexOf("import './design-system/materials-adapter.css'"));
    expect(main.indexOf("import './design-system/sinks-adapter.css'"))
      .toBeGreaterThan(main.indexOf("import './appearance-contrast.css'"));
  });
});
