import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MobileCatalogReferenceCard, MobileCatalogReferenceList } from './MobileCatalogReferenceCard';

describe('shared mobile Catalog reference', () => {
  it('keeps the name, source, and price in the same interactive summary', () => {
    const html = renderToStaticMarkup(
      <MobileCatalogReferenceCard
        title="Calacatta Laza"
        subtitle="MSI · Quartz"
        price="$12.50/SF"
        priceMeta="Stock purchase program"
        expanded={false}
        onToggle={() => {}}
      />,
    );
    expect(html).toContain('Calacatta Laza');
    expect(html).toContain('MSI · Quartz');
    expect(html).toContain('$12.50/SF');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('mobile-catalog-reference-trigger');
  });

  it('does not create expensive detail content for collapsed cards', () => {
    const details = vi.fn(() => <div>Loaded slab variants</div>);
    const props = {
      title: 'Mestre Cream',
      subtitle: 'Terrazzo',
      price: '$23.40/SF',
      onToggle: () => {},
      details,
    };
    const collapsed = renderToStaticMarkup(<MobileCatalogReferenceCard {...props} expanded={false} />);
    expect(details).not.toHaveBeenCalled();
    expect(collapsed).not.toContain('Loaded slab variants');

    const expanded = renderToStaticMarkup(<MobileCatalogReferenceCard {...props} expanded />);
    expect(details).toHaveBeenCalledTimes(1);
    expect(expanded).toContain('Loaded slab variants');
    expect(expanded).toContain('aria-expanded="true"');
    expect(expanded).toContain('aria-controls=');
  });

  it('provides an accessible reset action for a filtered empty catalog', () => {
    const html = renderToStaticMarkup(
      <MobileCatalogReferenceList
        label="Materials" empty emptyMessage="No matching materials"
        onReset={() => {}} resetLabel="Show all materials"
      >
        <p>Hidden</p>
      </MobileCatalogReferenceList>,
    );
    expect(html).toContain('No matching materials');
    expect(html).toContain('Show all materials');
    expect(html).toContain('type="button"');
    expect(html).not.toContain('Hidden');
  });

  it('shows an empty state instead of a blank catalog', () => {
    const html = renderToStaticMarkup(
      <MobileCatalogReferenceList label="Materials" empty emptyMessage="No matches">
        <p>Should not appear</p>
      </MobileCatalogReferenceList>,
    );
    expect(html).toContain('No matches');
    expect(html).not.toContain('Should not appear');
  });
});
