import type { Activity, Project, ProjectStage } from '../types/crm';

const CLOSED_WON_FACT_TYPES = new Set(['quote-signed']);
const TERMINAL_STAGES = new Set<ProjectStage>(['Completed', 'Closed Lost', 'Discarded']);

export interface ProjectStageTransition {
  project: Project;
  changed: boolean;
  blockedReason?: string;
}

export function projectHasSignedQuoteFact(projectId: string, activities: Activity[]) {
  return activities.some((activity) => activity.projectId === projectId && CLOSED_WON_FACT_TYPES.has(activity.type));
}

export function resolveProjectStageRequest(
  project: Project,
  requestedStage: ProjectStage,
  activities: Activity[],
): { stage: ProjectStage; blockedReason?: string } {
  if (project.stage === 'Completed' && requestedStage !== 'Completed') {
    return { stage: 'Completed', blockedReason: 'Completed projects cannot be moved backward.' };
  }

  if (projectHasSignedQuoteFact(project.id, activities)) {
    const signedAllowed = requestedStage === 'Closed Won' || requestedStage === 'Completed';
    if (!signedAllowed) {
      return {
        stage: project.stage === 'Completed' ? 'Completed' : 'Closed Won',
        blockedReason: 'A signed quote establishes this project as won.',
      };
    }
  }

  return { stage: requestedStage };
}

export function applyProjectStageTransition(
  project: Project,
  requestedStage: ProjectStage,
  activities: Activity[],
  occurredAt: string,
): ProjectStageTransition {
  const resolution = resolveProjectStageRequest(project, requestedStage, activities);
  if (resolution.stage === project.stage) {
    return {
      project,
      changed: false,
      blockedReason: resolution.blockedReason,
    };
  }

  return {
    project: {
      ...project,
      stage: resolution.stage,
      stageChangedAt: occurredAt,
      updatedAt: occurredAt,
    },
    changed: true,
    blockedReason: resolution.blockedReason,
  };
}

export type ProjectAttentionKind = 'overdue' | 'due-soon' | 'stale-touch' | 'awaiting-response' | 'won-no-next-action';

export interface ProjectAttentionFlag {
  kind: ProjectAttentionKind;
  label: string;
}

function daysBetween(dateKey: string, now: Date) {
  const date = new Date(`${dateKey}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return undefined;
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

export function projectAttentionFlags(project: Project, now = new Date()): ProjectAttentionFlag[] {
  const flags: ProjectAttentionFlag[] = [];
  if (!TERMINAL_STAGES.has(project.stage) && project.dueDate) {
    const dueDaysAgo = daysBetween(project.dueDate, now);
    if (dueDaysAgo !== undefined) {
      if (dueDaysAgo > 0) flags.push({ kind: 'overdue', label: 'Past due' });
      else if (dueDaysAgo >= -2) flags.push({ kind: 'due-soon', label: 'Due soon' });
    }
  }

  if (project.lastTouchpoint && !TERMINAL_STAGES.has(project.stage)) {
    const touchDaysAgo = daysBetween(project.lastTouchpoint, now);
    if (touchDaysAgo !== undefined && touchDaysAgo >= 21) {
      flags.push({ kind: 'stale-touch', label: `${touchDaysAgo}d since touch` });
    }
    if ((project.stage === 'Bid Sent' || project.stage === 'Negotiation') && touchDaysAgo !== undefined && touchDaysAgo >= 7) {
      flags.push({ kind: 'awaiting-response', label: 'Follow-up due' });
    }
  }

  if (project.stage === 'Closed Won' && !project.nextAction?.trim()) {
    flags.push({ kind: 'won-no-next-action', label: 'Add next action' });
  }

  return flags;
}
