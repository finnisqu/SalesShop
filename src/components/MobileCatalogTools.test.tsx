import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MobileCatalogActiveFilters, MobileCatalogFilterSheet, MobileCatalogToolsSheet } from './MobileCatalogTools';

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

  it('shows a standalone Filter sheet with an explicit dismissal action even without selecting', () => {
    const html = renderToStaticMarkup(
      <MobileCatalogFilterSheet section="Materials" onClose={() => {}}>
        <label><span>Material family</span><select defaultValue="all"><option value="all">All families</option></select></label>
      </MobileCatalogFilterSheet>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Filter results"');
    expect(html).toContain('aria-label="Close Filter results"');
    expect(html).toContain('Done · View results');
    expect(html).toContain('All families');
  });

  it('isolates the Filter menu options between its header and action footer', () => {
    const html = renderToStaticMarkup(
      <MobileCatalogFilterSheet section="Materials" onClose={() => {}}>
        <label><span>Finish</span><select defaultValue="all"><option value="all">All finishes</option></select></label>
        <label><span>Thickness</span><select defaultValue="all"><option value="all">All thicknesses</option></select></label>
      </MobileCatalogFilterSheet>,
    );
    const head = html.indexOf('class="mobile-catalog-tools-header"');
    const body = html.indexOf('class="mobile-catalog-tools-content"');
    const finish = html.indexOf('All finishes');
    const thickness = html.indexOf('All thicknesses');
    const footer = html.indexOf('class="mobile-catalog-tools-footer"');
    const done = html.indexOf('Done · View results');
    expect(head).toBeGreaterThan(0);
    expect(body).toBeGreaterThan(head);
    expect(finish).toBeGreaterThan(body);
    expect(thickness).toBeGreaterThan(finish);
    expect(footer).toBeGreaterThan(thickness);
    expect(done).toBeGreaterThan(footer);
    expect(html).toContain('mobile-catalog-tools-sheet has-footer');
  });

  it('keeps the Sinks save status outside scrollable Tools content', () => {
    const html = renderToStaticMarkup(
      <MobileCatalogToolsSheet title="Sink tools" section="Sinks" description="Edit" onClose={() => {}} footer="Changes saved">
        <section><strong>Catalog visibility</strong></section>
      </MobileCatalogToolsSheet>,
    );
    expect(html.indexOf('Catalog visibility')).toBeLessThan(html.indexOf('Changes saved'));
    expect(html.indexOf('class="mobile-catalog-tools-content"')).toBeLessThan(html.indexOf('class="mobile-catalog-tools-footer"'));
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
