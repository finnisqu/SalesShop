import { describe, expect, it } from 'vitest';
import type { Activity, Company, Contact, Project } from '../types/crm';
import type { Quote } from '../types/quote';
import type { SignatureRecord } from '../types/signature';
import { buildDashboardMetrics } from './dashboardMetrics';

const NOW = Date.parse('2026-10-06T12:00:00.000Z');

function quote(id: string, overrides: Partial<Quote> = {}): Quote {
  return {
    id,
    quoteNumber: `Q-20261006-${id}`,
    documentType: 'quote',
    originalQuoteDate: '2026-10-01',
    quoteDate: '2026-10-01',
    revision: 0,
    status: 'Draft',
    title: `Project ${id}`,
    sections: [],
    lines: [{
      id: `line-${id}`,
      kind: 'item',
      description: 'Countertops',
      pricingMode: 'direct',
      amount: 100,
      customerVisible: true,
      includeInTotal: true,
    }],
    customerColumns: { quantity: false, rate: false, lineAmount: true },
    customerNotes: '',
    internalNotes: '',
    history: [],
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  };
}

function signature(quoteId: string, acceptedTotal: number, overrides: Partial<SignatureRecord> = {}): SignatureRecord {
  return {
    id: `signature-${quoteId}`,
    quoteId,
    quoteNumber: `Q-${quoteId}`,
    revision: 0,
    signerName: 'Signer',
    method: 'typed',
    signatureText: 'Signer',
    strokes: [],
    consentText: 'Accepted',
    acceptedAt: '2026-10-05T12:00:00.000Z',
    acceptedSnapshot: {
      quoteId,
      quoteNumber: `Q-${quoteId}`,
      documentType: 'quote',
      revision: 0,
      quoteDate: '2026-10-01',
      title: `Project ${quoteId}`,
      sections: [],
      lines: [],
      customerColumns: { quantity: false, rate: false, lineAmount: true },
      customerNotes: '',
      acceptedTotal,
    },
    ...overrides,
  };
}

function project(id: string, overrides: Partial<Project> = {}): Project {
  return {
    id,
    name: `Project ${id}`,
    stage: 'Bid Sent',
    stageChangedAt: '2026-09-26T12:00:00.000Z',
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-10-05T12:00:00.000Z',
    ...overrides,
  };
}

function activity(id: string, occurredAt: string, overrides: Partial<Activity> = {}): Activity {
  return {
    id,
    type: 'project-created',
    summary: id,
    occurredAt,
    ...overrides,
  };
}

describe('dashboard metric integrity', () => {
  it('keeps change orders out of sales close rate while retaining their accepted value', () => {
    const salesOne = quote('001', { status: 'Signed', sentAt: '2026-10-01T12:00:00.000Z' });
    const salesTwo = quote('002', { status: 'Sent', sentAt: '2026-10-02T12:00:00.000Z' });
    const changeOrder = quote('003', {
      documentType: 'change-order',
      status: 'Signed',
      sentAt: '2026-10-03T12:00:00.000Z',
    });
    const metrics = buildDashboardMetrics(
      [salesOne, salesTwo, changeOrder],
      [
        signature('001', 100),
        signature('003', 50, { acceptedSnapshot: { ...signature('003', 50).acceptedSnapshot, documentType: 'change-order' } }),
      ],
      [],
      [],
      [],
      [],
      NOW,
    );

    expect(metrics.quotesSent).toBe(2);
    expect(metrics.closeRate).toBe(0.5);
    expect(metrics.signaturesReceived).toBe(2);
    expect(metrics.acceptedValue).toBe(150);
  });

  it('excludes archived and already-signed documents from pending customer decisions', () => {
    const pending = quote('pending', { status: 'Sent', sentAt: '2026-10-01T12:00:00.000Z' });
    const archived = quote('archived', { status: 'Sent', sentAt: '2026-10-01T12:00:00.000Z', archivedAt: '2026-10-04T12:00:00.000Z' });
    const signed = quote('signed', { status: 'Viewed', sentAt: '2026-10-01T12:00:00.000Z' });
    const metrics = buildDashboardMetrics(
      [pending, archived, signed],
      [signature('signed', 100)],
      [],
      [],
      [],
      [],
      NOW,
    );

    expect(metrics.pendingSignatures.map((item) => item.id)).toEqual(['pending']);
  });

  it('builds a monotonic current quote funnel and timing metrics', () => {
    const draft = quote('draft');
    const sent = quote('sent', { status: 'Sent', sentAt: '2026-10-01T12:00:00.000Z' });
    const viewed = quote('viewed', {
      status: 'Viewed',
      sentAt: '2026-10-01T12:00:00.000Z',
      viewedAt: '2026-10-03T12:00:00.000Z',
    });
    const signed = quote('signed', {
      status: 'Signed',
      sentAt: '2026-10-01T12:00:00.000Z',
      viewedAt: '2026-10-02T12:00:00.000Z',
    });
    const archived = quote('archived', {
      status: 'Sent',
      sentAt: '2026-10-01T12:00:00.000Z',
      archivedAt: '2026-10-02T12:00:00.000Z',
    });

    const metrics = buildDashboardMetrics(
      [draft, sent, viewed, signed, archived],
      [signature('signed', 100, { acceptedAt: '2026-10-05T12:00:00.000Z' })],
      [],
      [],
      [],
      [],
      NOW,
    );

    expect(metrics.quoteFunnel).toMatchObject({
      drafts: 1,
      sent: 3,
      viewed: 2,
      signed: 1,
    });
    expect(metrics.quoteFunnel.viewRate).toBeCloseTo(2 / 3);
    expect(metrics.quoteFunnel.closeRate).toBeCloseTo(1 / 3);
    expect(metrics.quoteFunnel.medianDaysToView).toBe(2);
    expect(metrics.quoteFunnel.medianDaysToSign).toBe(4);
  });

  it('measures pipeline aging from stageChangedAt rather than ordinary card edits', () => {
    const metrics = buildDashboardMetrics(
      [],
      [],
      [
        project('a', { stage: 'Bid Sent', stageChangedAt: '2026-09-26T12:00:00.000Z', updatedAt: '2026-10-06T11:00:00.000Z', amount: 100 }),
        project('b', { stage: 'Bid Sent', stageChangedAt: '2026-09-16T12:00:00.000Z', updatedAt: '2026-10-06T11:00:00.000Z', amount: 200 }),
      ],
      [],
      [],
      [],
      NOW,
    );

    const bidSent = metrics.pipelineByStage.find((stage) => stage.stage === 'Bid Sent');
    expect(bidSent).toMatchObject({ projectCount: 2, value: 300, medianAgeDays: 15, oldestAgeDays: 20 });
  });

  it('ranks overdue projects and customer-viewed quotes into the morning attention queue', () => {
    const overdueProject = project('overdue', {
      name: 'Overdue project',
      dueDate: '2026-10-01',
      amount: 500_000,
      lastTouchpoint: '2026-09-01',
    });
    const viewedQuote = quote('viewed', {
      title: 'Viewed quote',
      status: 'Viewed',
      sentAt: '2026-10-01T12:00:00.000Z',
      viewedAt: '2026-10-05T12:00:00.000Z',
    });
    const metrics = buildDashboardMetrics(
      [viewedQuote],
      [],
      [overdueProject],
      [],
      [],
      [],
      NOW,
    );

    expect(metrics.attention[0]).toMatchObject({ kind: 'project', priority: 'high', title: 'Overdue project' });
    expect(metrics.attention.some((item) => item.kind === 'quote' && item.title === 'Viewed quote' && item.priority === 'high')).toBe(true);
  });

  it('resurfaces valuable dormant accounts only when they have no active project', () => {
    const dormant: Company = {
      id: 'company-dormant',
      name: 'Dormant Builder',
      kind: 'customer',
      annualUnits: 100,
      averageUnitValue: 4000,
      expectedSharePct: 50,
      createdAt: '2025-01-01T12:00:00.000Z',
      updatedAt: '2026-01-01T12:00:00.000Z',
    };
    const active: Company = { ...dormant, id: 'company-active', name: 'Active Builder' };
    const contacts: Contact[] = [];
    const metrics = buildDashboardMetrics(
      [],
      [],
      [project('active-project', { companyId: active.id, companyName: active.name, stage: 'Bid Development' })],
      [],
      [dormant, active],
      contacts,
      NOW,
    );

    expect(metrics.accountsNeedingLove).toHaveLength(1);
    expect(metrics.accountsNeedingLove[0]).toMatchObject({
      companyId: dormant.id,
      expectedAnnualWork: 200_000,
    });
  });

  it('sorts recent activity newest first and limits the briefing', () => {
    const activities = Array.from({ length: 10 }, (_, index) =>
      activity(`activity-${index}`, `2026-10-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`),
    );
    const metrics = buildDashboardMetrics([], [], [], activities, [], [], NOW);
    expect(metrics.recentActivity).toHaveLength(8);
    expect(metrics.recentActivity[0].id).toBe('activity-9');
    expect(metrics.recentActivity.at(-1)?.id).toBe('activity-2');
  });
});
