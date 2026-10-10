import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('UI Foundation Batch 10 — CSS cleanup boundaries', () => {
  it('removes the retired document-setup accordion without discarding live quote fields', () => {
    const css = source('../quote-document-setup.css');
    const quotes = source('../components/Quotes.tsx');
    const fields = source('../components/QuoteEditorFields.tsx');

    expect(css).not.toMatch(/\.quote-document-setup(?:\b|-|\[)/);
    expect(css).not.toContain('.quote-details-grid > label:nth-child(4)');
    expect(quotes).not.toContain('quote-document-setup');
    expect(quotes).toContain('<QuoteDocumentSetupFields');
    expect(quotes).toContain('<QuoteRevisionLabelField');
    expect(css).toContain('.quote-document-type-switch');
    expect(css).toContain('.quote-document-meta-fields');
    expect(css).toContain('.quote-revision-label-field');
    expect(fields).toContain('className="quote-document-meta-fields quote-foundation-fields"');
    expect(fields).toContain('className="quote-revision-label-field"');
  });

  it('loads app theme and internal editor adapters after the legacy workspace CSS', () => {
    const main = source('../main.tsx');
    const order = [
      "./design-system/tokens.css",
      "./design-system/primitives.css",
      "./quote-document-setup.css",
      "./appearance-contrast.css",
      "./design-system/settings-adapter.css",
      "./design-system/connections-adapter.css",
      "./design-system/catalog-adapter.css",
      "./design-system/quotes-adapter.css",
      "./design-system/restricted-view-adapter.css",
      "./design-system/quote-editor-adapter.css",
    ];
    let previous = -1;
    for (const file of order) {
      const position = main.indexOf(`import '${file}';`);
      expect(position, `${file} must be loaded`).toBeGreaterThan(previous);
      previous = position;
    }
  });

  it('keeps internal quote colors and scroll controls isolated from customer documents', () => {
    const css = source('./quote-editor-adapter.css');
    const quoteShell = source('./quotes-adapter.css');
    expect(css).toContain('.sales-app.view-quotes');
    expect(css).toContain('max-height:min(66dvh,430px)');
    expect(css).toContain('font-size:16px');
    expect(css).toContain('-webkit-overflow-scrolling:touch');
    expect(quoteShell).toContain('.quote-mobile-menu-footer');
    expect(quoteShell).toContain('overflow-y:auto');
    // No active rule may target customer-facing document CSS.
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(withoutComments).not.toMatch(/\.customer-quote-|\.public-quote-|\.pricing-schedule-customer/);
  });
});
