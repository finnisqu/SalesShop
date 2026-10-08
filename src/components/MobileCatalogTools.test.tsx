import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MobileCatalogActiveFilters, MobileCatalogToolsSheet } from './MobileCatalogTools';

describe('mobile catalog shared controls', () => {
  it('labels the same accessible dialog across catalog sections', () => {
    const html = renderToStaticMarkup(
      <MobileCatalogToolsSheet title="Rate tools" section="Rates" description="Manage rates" onClose={() => {}}>
        <section><strong>Mode</strong><button type="button">Reference</button></section>
      </MobileCatalogToolsSheet>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Rate tools"');
    expect(html).toContain('Catalog · Rates');
    expect(html).toContain('aria-label="Close Rate tools"');
  });

  it('renders dismissible filter buttons and Clear all only for multiple selections', () => {
    const items = [
      { key: 'brand', label: 'Caesarstone', onRemove: () => {} },
      { key: 'program', label: 'STOCK', onRemove: () => {} },
    ];
    const html = renderToStaticMarkup(<MobileCatalogActiveFilters items={items} onClear={() => {}} />);
    expect(html).toContain('Remove filter Caesarstone');
    expect(html).toContain('Remove filter STOCK');
    expect(html).toContain('Clear all');
    const single = renderToStaticMarkup(<MobileCatalogActiveFilters items={items.slice(0, 1)} onClear={() => {}} />);
    expect(single).not.toContain('Clear all');
    expect(renderToStaticMarkup(<MobileCatalogActiveFilters items={[]} />)).toBe('');
  });
});
