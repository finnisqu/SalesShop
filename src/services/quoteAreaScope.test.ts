import { describe, expect, it } from 'vitest';
import type { Quote, QuoteLine, QuoteSection } from '../types/quote';
import {
  QUOTE_AREA_SCOPE_META,
  applyAreaScopeQuantity,
  areaScopeSummary,
  compatibleAreaScopeFields,
  resolveLineAreaScopeState,
} from './quoteAreaScope';

function section(overrides: Partial<QuoteSection> = {}): QuoteSection {
  return {
    id: 'area-kitchen',
    title: 'Kitchen',
    customerVisible: true,
    scope: {
      countertopSf: 62,
      splashLf: 18,
      fullHeightSplashSf: 12,
      kitchenSinkCount: 1,
      vanitySinkCount: 0,
      cutoutCount: 2,
    },
    ...overrides,
  };
}

function line(overrides: Partial<QuoteLine> = {}): QuoteLine {
  return {
    id: 'line-1',
    sectionId: 'area-kitchen',
    kind: 'rate',
    description: 'Fabrication',
    pricingMode: 'quantity-rate',
    quantity: 62,
    rate: 14.5,
    customerVisible: true,
    includeInTotal: true,
    ...overrides,
  };
}

function quote(area = section(), quoteLine = line()): Quote {
  return {
    id: 'quote-1',
    quoteNumber: 'DRAFT-quote-1',
    documentType: 'quote',
    originalQuoteDate: '2026-10-07',
    quoteDate: '2026-10-07',
    revision: 0,
    status: 'Draft',
    title: 'Area scope test',
    sections: [area],
    lines: [quoteLine],
    customerColumns: { quantity: true, rate: true, lineAmount: true },
    customerNotes: '',
    internalNotes: '',
    history: [],
    createdAt: '2026-10-07T18:30:00.000Z',
    updatedAt: '2026-10-07T18:30:00.000Z',
  };
}

describe('quote area scope', () => {
  it('keeps the visible quote scope focused on countertop square feet and sinks', () => {
    expect(areaScopeSummary(section())).toBe('62 SF · 1 sink');
  });

  it('captures an explicit area quantity without creating a live formula', () => {
    const patch = applyAreaScopeQuantity(section(), 'countertopSf', '2026-10-07T18:40:00.000Z');

    expect(patch).toEqual({
      quantity: 62,
      quantitySource: {
        kind: 'area-scope',
        sectionId: 'area-kitchen',
        field: 'countertopSf',
        capturedValue: 62,
        appliedAt: '2026-10-07T18:40:00.000Z',
      },
    });
  });

  it('detects a changed area value while retaining the quoted captured quantity', () => {
    const linked = line({
      quantity: 62,
      quantitySource: {
        kind: 'area-scope',
        sectionId: 'area-kitchen',
        field: 'countertopSf',
        capturedValue: 62,
        appliedAt: '2026-10-07T18:40:00.000Z',
      },
    });
    const changedArea = section({ scope: { ...section().scope, countertopSf: 68 } });
    const state = resolveLineAreaScopeState(quote(changedArea, linked), linked);

    expect(linked.quantity).toBe(62);
    expect(state?.currentValue).toBe(68);
    expect(state?.changed).toBe(true);
  });

  it('recommends scope fields based on product and rate semantics', () => {
    expect(compatibleAreaScopeFields(line({ kind: 'material' }))).toEqual(['countertopSf']);
    expect(compatibleAreaScopeFields(line({
      kind: 'sink',
      sinkReference: {
        sinkModelId: 'sink-3218',
        variantId: 'variant-1',
        snapshot: {
          capturedAt: '2026-10-07T18:30:00.000Z',
          sinkModelId: 'sink-3218',
          sinkModelName: 'Kitchen 3218',
          category: 'kitchen',
          variantId: 'variant-1',
          variantLabel: 'Standard',
          configuration: 'single',
          ada: false,
        },
      },
    }))).toEqual(['kitchenSinkCount']);
    expect(compatibleAreaScopeFields(line({
      rateReference: {
        rateBookItemId: 'cutout',
        snapshot: {
          capturedAt: '2026-10-07T18:30:00.000Z',
          rateBookItemId: 'cutout',
          category: 'sink',
          name: 'Sink Cutout',
          unit: 'each',
          pricingBehavior: 'suggested',
        },
      },
    }))).toEqual([]);
  });

  it('keeps future scope metadata under the hood while surfacing only the focused v1 fields', async () => {
    const { QUOTE_AREA_SCOPE_VISIBLE_FIELDS } = await import('./quoteAreaScope');
    expect(Object.keys(QUOTE_AREA_SCOPE_META)).toHaveLength(6);
    expect(QUOTE_AREA_SCOPE_VISIBLE_FIELDS).toEqual(['countertopSf', 'kitchenSinkCount', 'vanitySinkCount']);
    expect(QUOTE_AREA_SCOPE_META.countertopSf.unit).toBe('SF');
  });
});
