import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageHeader, Panel, SectionTabs } from './components';

const page = readFileSync(new URL('../components/CatalogWorkspace.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./catalog-adapter.css', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../main.tsx', import.meta.url), 'utf8');
const chrome = readFileSync(new URL('../components/MobileAppChrome.tsx', import.meta.url), 'utf8');

describe('UI Foundation Batch 5A — Catalog shell', () => {
  it('renders shared Catalog section tabs with one accessible active section', () => {
    const items = [
      { id: 'materials', label: 'Materials', description: 'Surfaces & slab costs' },
      { id: 'sinks', label: 'Sinks', description: 'Models & variants' },
      { id: 'other', label: 'Other', description: 'Accessories & shop inputs' },
      { id: 'rates', label: 'Rates', description: 'Labor & pricing rules' },
      { id: 'suppliers', label: 'Suppliers', description: 'Sources & price lists' },
    ];
    const html = renderToStaticMarkup(<SectionTabs items={items} selected="rates"
      onSelect={() => {}} aria-label="Catalog sections" className="catalog-section-nav" />);
    expect(html).toContain('aria-label="Catalog sections"');
    expect(html).toContain('class="ss-section-tabs catalog-section-nav"');
    expect(html).toContain('aria-current="page"');
    expect((html.match(/aria-current="page"/g) ?? [])).toHaveLength(1);
    expect((html.match(/type="button"/g) ?? [])).toHaveLength(5);
    expect(html).toContain('Suppliers');
  });

  it('composes the shared header and coming-soon panel without an extra global toolbar', () => {
    const header = renderToStaticMarkup(<PageHeader className="catalog-header"
      eyebrow="Commercial source of truth" title="Catalog"
      description="Materials and rates" actions={<strong>Materials</strong>} />);
    expect(header).toContain('ss-page-header__intro');
    expect(header).toContain('catalog-header');
    expect(header).toContain('Materials and rates');
    const panel = renderToStaticMarkup(<Panel className="catalog-other-card"
      heading={<h2>Other</h2>}><p>Accessories & shop inputs</p></Panel>);
    expect(panel).toContain('ss-panel__header');
    expect(panel).toContain('ss-panel__body');
    expect(panel).toContain('Accessories &amp; shop inputs');
  });

  it('keeps all five Catalog sections and their existing workspaces mounted', () => {
    for (const required of [
      "id: 'materials'", "id: 'sinks'", "id: 'other'", "id: 'rates'", "id: 'suppliers'",
      '<PageHeader', '<SectionTabs', '<Panel',
      'onSelect={setSection}', 'sectionScrollRef.current.scrollTop = 0',
      'MaterialsWorkspace embedded', 'SinksWorkspace embedded',
      'RatesWorkspace embedded', '<SuppliersWorkspace />',
      'catalog-section-host', 'catalog-current-section',
    ]) {
      expect(page, `Catalog shell lost: ${required}`).toContain(required);
    }
  });

  it('preserves mobile drawer navigation and the touch-first browsing workspace', () => {
    expect(chrome).toContain('catalogSection');
    expect(chrome).toContain('setCatalogSection');
    expect(chrome).toContain('mobile-app-drawer');
    expect(chrome).toContain("view === 'catalog'");
    expect(css).toContain('@media(max-width:700px)');
    expect(css).toContain('.catalog-header.catalog-foundation-heading');
    expect(css).toContain('display:none;');
    expect(css).toContain('.catalog-section-nav.catalog-foundation-tabs');
    expect(css).toContain('overflow-y:auto;');
    expect(css).not.toContain('calc(100dvh - 50px)');
    expect(css).not.toContain('!important');
  });

  it('uses route-scoped paired colors, clear active tabs and intended scroll ownership', () => {
    expect(css).toContain('.sales-app.view-catalog');
    expect(css).toContain('--ss-catalog-ink');
    expect(css).toContain('--ss-catalog-card');
    expect(css).toContain('--ss-catalog-muted');
    expect(css).toContain('.ss-section-tab.active');
    expect(css).toContain('.catalog-section-host');
    expect(css).toContain('min-height:0');
    expect(entry.indexOf("import './design-system/catalog-adapter.css'"))
      .toBeGreaterThan(entry.indexOf("import './appearance-contrast.css'"));
    expect(entry.indexOf("import './design-system/catalog-adapter.css'"))
      .toBeGreaterThan(entry.indexOf("import './design-system/connections-adapter.css'"));
  });
});
