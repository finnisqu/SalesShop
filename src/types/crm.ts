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

export interface CrmDocument {
  schemaVersion: 1;
  companies: Company[];
  projects: Project[];
}

export type ProjectPatch = Partial<Pick<
  Project,
  'name' | 'companyName' | 'stage' | 'dueDate' | 'amount' | 'nextAction' | 'lastTouchpoint'
>>;
