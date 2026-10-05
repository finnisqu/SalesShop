export const PROJECT_STAGES = [
  'Discovery',
  'Intent to Bid',
  'Bid Development',
  'Bid Sent',
  'Negotiation',
  'Closed Won',
  'Completed',
  'Closed Lost',
  'Discarded',
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const ACCOUNT_STAGES = [
  'Discovery',
  'Outreach',
  'Connected',
  'Quoted',
  'Won',
  'Active',
  'Cold',
  'Lost',
  'Non-Customer',
] as const;

export type AccountStage = (typeof ACCOUNT_STAGES)[number];
export type CompanyKind = 'customer' | 'non-customer';

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
  'change-order-created',
  'change-order-sent',
  'change-order-revision-created',
  'change-order-viewed',
  'change-order-signed',
  'change-order-declined',
  'change-order-expired',
  'contact-created',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Company {
  id: string;
  name: string;
  kind: CompanyKind;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  companyId?: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
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
  documentType?: 'quote' | 'pricing-schedule' | 'change-order';
  parentQuoteId?: string;
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
  contactId?: string;
  quoteId?: string;
  occurredAt: string;
  metadata?: ActivityMetadata;
}

export interface CrmDocument {
  schemaVersion: 3;
  companies: Company[];
  contacts: Contact[];
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

export interface ContactInput {
  companyId?: string;
  name?: string;
  email?: string;
  phone?: string;
  title?: string;
  source?: 'manual' | 'quote' | 'system';
  quoteId?: string;
}

export type CompanyPatch = Partial<Pick<Company, 'name' | 'kind'>>;

export type ProjectPatch = Partial<Pick<
  Project,
  'name' | 'companyName' | 'stage' | 'dueDate' | 'amount' | 'nextAction' | 'lastTouchpoint'
>>;

export type ActivityInput = Omit<Activity, 'id' | 'occurredAt'> & { occurredAt?: string };
