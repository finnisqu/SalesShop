import { describe, expect, it } from 'vitest';
import type { Activity, Project } from '../types/crm';
import {
  applyProjectStageTransition,
  projectAttentionFlags,
  resolveProjectStageRequest,
} from './boardIntegrity';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Test Project',
    stage: 'Bid Sent',
    stageChangedAt: '2026-09-01T12:00:00.000Z',
    lastTouchpoint: '2026-09-01',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

function signedActivity(): Activity {
  return {
    id: 'activity-signed',
    type: 'quote-signed',
    summary: 'Quote signed',
    projectId: 'project-1',
    quoteId: 'quote-1',
    occurredAt: '2026-09-15T12:00:00.000Z',
  };
}

describe('board stage integrity', () => {
  it('does not create a transition when dropping a card back into its current stage', () => {
    const original = project();
    const result = applyProjectStageTransition(original, 'Bid Sent', [], '2026-10-06T12:00:00.000Z');
    expect(result.changed).toBe(false);
    expect(result.project).toBe(original);
  });

  it('records a dedicated stageChangedAt timestamp on a real move', () => {
    const result = applyProjectStageTransition(project(), 'Negotiation', [], '2026-10-06T12:00:00.000Z');
    expect(result.changed).toBe(true);
    expect(result.project.stage).toBe('Negotiation');
    expect(result.project.stageChangedAt).toBe('2026-10-06T12:00:00.000Z');
    expect(result.project.updatedAt).toBe('2026-10-06T12:00:00.000Z');
  });

  it('protects signed-quote wins from being dragged back into an unwon stage', () => {
    const original = project({ stage: 'Closed Won' });
    const resolved = resolveProjectStageRequest(original, 'Discovery', [signedActivity()]);
    expect(resolved.stage).toBe('Closed Won');
    expect(resolved.blockedReason).toMatch(/signed quote/i);

    const lost = resolveProjectStageRequest(original, 'Closed Lost', [signedActivity()]);
    expect(lost.stage).toBe('Closed Won');
  });

  it('allows a signed project to advance to Completed', () => {
    const result = applyProjectStageTransition(
      project({ stage: 'Closed Won' }),
      'Completed',
      [signedActivity()],
      '2026-10-06T12:00:00.000Z',
    );
    expect(result.changed).toBe(true);
    expect(result.project.stage).toBe('Completed');
  });

  it('does not regress Completed projects', () => {
    const result = applyProjectStageTransition(
      project({ stage: 'Completed' }),
      'Negotiation',
      [],
      '2026-10-06T12:00:00.000Z',
    );
    expect(result.changed).toBe(false);
    expect(result.project.stage).toBe('Completed');
  });
});

describe('board attention logic', () => {
  it('surfaces deterministic stale and follow-up flags without changing project state', () => {
    const flags = projectAttentionFlags(
      project({ stage: 'Negotiation', lastTouchpoint: '2026-09-01', dueDate: '2026-10-05' }),
      new Date('2026-10-06T12:00:00.000Z'),
    );
    expect(flags.map((flag) => flag.kind)).toEqual(expect.arrayContaining(['overdue', 'stale-touch', 'awaiting-response']));
  });

  it('flags won work with no next action', () => {
    const flags = projectAttentionFlags(
      project({ stage: 'Closed Won', lastTouchpoint: '2026-10-05', nextAction: undefined }),
      new Date('2026-10-06T12:00:00.000Z'),
    );
    expect(flags.some((flag) => flag.kind === 'won-no-next-action')).toBe(true);
  });
});
