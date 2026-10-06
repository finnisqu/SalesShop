import { describe, expect, it } from 'vitest';
import {
  canPermanentlyDeleteQuote,
  createQuoteRevisionSnapshot,
  quoteCanCreateRevision,
  quoteIsCommerciallyEditable,
  sanitizeQuotePatchForStatus,
} from './quoteIntegrity';
import {
  quoteLineTotal,
  quoteTotal,
  type Quote,
  type QuoteLine,
} from '../types/quote';

function line(overrides: Partial<QuoteLine> = {}): QuoteLine {
  return {
    id: 'line-1',
    kind: 'item',
    description: 'Countertops',
    pricingMode: 'direct',
    amount: 0,
    customerVisible: true,
    includeInTotal: true,
    ...overrides,
  };
}

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-1',
    quoteNumber: 'DRAFT-quote-1',
    documentType: 'quote',
    originalQuoteDate: '2026-10-06',
    quoteDate: '2026-10-06',
    revision: 0,
    status: 'Draft',
    title: 'Test Project',
    pricingDivision: 'Commercial',
    sections: [{ id: 'section-1', title: 'Base', customerVisible: true }],
    lines: [line({ amount: 100 })],
    customerColumns: { quantity: true, rate: true, lineAmount: true },
    customerNotes: 'Customer note',
    internalNotes: 'Private note',
    history: [],
    createdAt: '2026-10-06T12:00:00.000Z',
    updatedAt: '2026-10-06T12:00:00.000Z',
    ...overrides,
  };
}

describe('quote money integrity', () => {
  it('rounds each commercial line to cents and treats discounts as negative', () => {
    expect(quoteLineTotal(line({ pricingMode: 'quantity-rate', quantity: 3, rate: 19.999 }))).toBe(60);
    expect(quoteLineTotal(line({ kind: 'discount', amount: 10.005 }))).toBe(-10.01);
    expect(quoteLineTotal(line({ includeInTotal: false, amount: 999 }))).toBe(0);
    expect(quoteLineTotal(line({ pricingMode: 'none', amount: 999 }))).toBe(0);
  });

  it('produces a stable cents-safe quote total', () => {
    const subject = quote({
      lines: [
        line({ id: 'a', pricingMode: 'quantity-rate', quantity: 3, rate: 19.999 }),
        line({ id: 'b', amount: 10.01 }),
        line({ id: 'c', kind: 'discount', amount: 5.005 }),
      ],
    });
    expect(quoteTotal(subject)).toBe(65);
  });
});

describe('quote revision snapshots', () => {
  it('freezes customer-facing data, private material provenance, pricing context, and total', () => {
    const subject = quote({
      lines: [line({
        amount: 125.55,
        materialReference: {
          materialId: 'material-1',
          variantId: 'variant-1',
          purchaseOptionId: 'price-1',
          stockProgram: true,
          pricingSource: 'stock-level',
          sourceCostPerSf: 12.8,
          guideRate: 34,
          stockEquivalentLevel: 'Level 1',
        },
      })],
    });
    const frozen = createQuoteRevisionSnapshot(subject, '2026-10-06T13:00:00.000Z', 'Sent');

    subject.lines[0].description = 'Changed later';
    subject.lines[0].amount = 999;
    subject.sections[0].title = 'Changed later';

    expect(frozen.status).toBe('Sent');
    expect(frozen.customerTotal).toBe(125.55);
    expect(frozen.pricingDivision).toBe('Commercial');
    expect(frozen.lines[0].description).toBe('Countertops');
    expect(frozen.lines[0].materialReference?.sourceCostPerSf).toBe(12.8);
    expect(frozen.sections[0].title).toBe('Base');
  });
});

describe('quote lifecycle integrity', () => {
  it('allows customer-facing edits only while Draft or Ready', () => {
    expect(quoteIsCommerciallyEditable(quote())).toBe(true);
    expect(quoteIsCommerciallyEditable(quote({ status: 'Ready' }))).toBe(true);
    expect(quoteIsCommerciallyEditable(quote({ status: 'Sent' }))).toBe(false);
    expect(quoteIsCommerciallyEditable(quote({ archivedAt: '2026-10-06T14:00:00.000Z' }))).toBe(false);
  });

  it('drops customer-facing edits after Send but preserves status/internal-note writes', () => {
    const patch = sanitizeQuotePatchForStatus(quote({ status: 'Sent' }), {
      title: 'Mutated',
      customerNotes: 'Mutated',
      internalNotes: 'Allowed',
      status: 'Viewed',
    });
    expect(patch).toEqual({ internalNotes: 'Allowed', status: 'Viewed' });
  });

  it('only permanently deletes untouched draft identities; business records archive instead', () => {
    const draft = quote();
    expect(canPermanentlyDeleteQuote(draft, [draft])).toBe(true);
    expect(canPermanentlyDeleteQuote(quote({ quoteNumber: 'Q-20261006-001', status: 'Sent' }), [])).toBe(false);
    expect(canPermanentlyDeleteQuote(quote({ history: [createQuoteRevisionSnapshot(draft, '2026-10-06T13:00:00.000Z')] }), [])).toBe(false);
  });

  it('only creates revisions from previously issued non-signed states', () => {
    expect(quoteCanCreateRevision({ status: 'Sent' })).toBe(true);
    expect(quoteCanCreateRevision({ status: 'Viewed' })).toBe(true);
    expect(quoteCanCreateRevision({ status: 'Declined' })).toBe(true);
    expect(quoteCanCreateRevision({ status: 'Expired' })).toBe(true);
    expect(quoteCanCreateRevision({ status: 'Draft' })).toBe(false);
    expect(quoteCanCreateRevision({ status: 'Signed' })).toBe(false);
  });
});
