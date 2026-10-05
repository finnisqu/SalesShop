export const PROJECT_STAGES = [
  'Discovery',
  'Intent to Bid',
  'Bid Development',
  'Bid Sent',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
  'Discarded',
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const ACTIVITY_TYPES = [
  'project-created',
  'project-stage-changed',
  'quote-created',
  'quote-linked',
  'quote-sent',
  'quote-revision-created',
  'quote-viewed',
  'quote-signed',
  'quote-declined',
  'quote-expired',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Company {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  companyId?: string;
  companyName?: string;
  stage: ProjectStage;
  dueDate?: string;
  amount?: number;
  nextAction?: string;
  lastTouchpoint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityMetadata {
  quoteNumber?: string;
  revision?: number;
  amount?: number;
  fromStage?: ProjectStage;
  toStage?: ProjectStage;
  source?: 'manual' | 'quote' | 'system';
}

export interface Activity {
  id: string;
  type: ActivityType;
  summary: string;
  projectId?: string;
  companyId?: string;
  quoteId?: string;
  occurredAt: string;
  metadata?: ActivityMetadata;
}

export interface CrmDocument {
  schemaVersion: 2;
  companies: Company[];
  projects: Project[];
  activities: Activity[];
}

export interface CreateProjectDetails {
  companyName?: string;
  amount?: number;
  lastTouchpoint?: string;
  source?: 'manual' | 'quote' | 'system';
  quoteId?: string;
  quoteNumber?: string;
}

export interface StageChangeContext {
  source?: 'manual' | 'quote' | 'system';
  quoteId?: string;
  quoteNumber?: string;
}

export type ProjectPatch = Partial<Pick<
  Project,
  'name' | 'companyName' | 'stage' | 'dueDate' | 'amount' | 'nextAction' | 'lastTouchpoint'
>>;

export type ActivityInput = Omit<Activity, 'id' | 'occurredAt'> & { occurredAt?: string };
