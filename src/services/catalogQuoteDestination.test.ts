import { describe, expect, it } from 'vitest';
import { catalogQuoteDestinationLabel, catalogQuoteDestinationReference } from './catalogQuoteDestination';
import type { Quote } from '../types/quote';

type Destination = Pick<Quote, 'title' | 'companyName' | 'quoteDate' | 'quoteNumber' | 'documentType' | 'revision'>;

const draft: Destination = {
  title: 'Jim Powell',
  companyName: 'Powell Construction',
  quoteDate: '2026-10-07',
  quoteNumber: 'DRAFT-quote_ba37dffe-6a73-4b7a-ac86-d6b2fd3ec8cb',
  documentType: 'quote',
  revision: 0,
};

describe('Catalog quote destination labels', () => {
  it('leads with name, then company, then a readable draft date', () => {
    const label = catalogQuoteDestinationLabel(draft);
    expect(label).toBe('Jim Powell · Powell Construction · Oct 7, 2026 · Draft');
    expect(label).not.toContain('DRAFT-quote_');
  });

  it('shows the assigned quote number last, including its revision', () => {
    const label = catalogQuoteDestinationLabel({
      ...draft,
      title: 'Blue Jay Park',
      companyName: 'BAR Construction',
      quoteNumber: 'Q-20261005-001',
      revision: 1,
    });
    expect(label).toBe('Blue Jay Park · BAR Construction · Q-20261005-001-R1');
  });

  it('handles missing company or title without displaying empty separators', () => {
    expect(catalogQuoteDestinationLabel({
      ...draft,
      title: ' ',
      companyName: ' ',
    })).toBe('Untitled quote · Oct 7, 2026 · Draft');
  });

  it('provides a compact quote reference independent from its title punctuation', () => {
    expect(catalogQuoteDestinationReference({ ...draft, title: 'Church · Renovation' })).toBe('Oct 7, 2026 · Draft');
    expect(catalogQuoteDestinationReference({ ...draft, quoteNumber: 'Q-20261005-001' })).toBe('Q-20261005-001');
  });

  it('hides raw draft identifiers even when dates are unavailable', () => {
    expect(catalogQuoteDestinationLabel({
      ...draft,
      quoteDate: '',
    })).toBe('Jim Powell · Powell Construction · Draft');
  });
});
