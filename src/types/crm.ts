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

/** Deal pipelines are independent of their shared stage progression. */
export const DEAL_PIPELINES = [
  {id:'residential',label:'Residential'},
  {id:'commercial',label:'Commercial'},
  {id:'multifamily',label:'Multifamily'},
] as const;
export type DealPipeline=(typeof DEAL_PIPELINES)[number]['id'];
export type DealPipelineFilter='all'|'unassigned'|DealPipeline;
export function normalizeDealPipeline(value:unknown):DealPipeline|undefined {
  return DEAL_PIPELINES.find(item=>item.id===value)?.id;
}
export function dealPipelineLabel(value:unknown):string {
  return DEAL_PIPELINES.find(item=>item.id===value)?.label??'Unassigned';
}
export function matchesDealPipeline(deal:{pipeline?:DealPipeline},filter:DealPipelineFilter):boolean {
  return filter==='all'||(filter==='unassigned'?!normalizeDealPipeline(deal.pipeline):deal.pipeline===filter);
}


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
  'quote-follow-up',
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
  'notebook-touchpoint',
  'manual-touchpoint',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Company {
  id: string;
  /** Creator-assigned owner. Shared organization access remains unchanged. */
  ownerUserId?: string;
  name: string;
  aliases?: string[];
  identityExclusions?: string[];
  kind: CompanyKind;
  annualUnits?: number;
  averageUnitValue?: number;
  expectedSharePct?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  /** Creator-assigned owner; null on pre-ownership legacy records. */
  ownerUserId?: string;
  companyId?: string;
  name: string;
  identityExclusions?: string[];
  email?: string;
  phone?: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export type DueDateResponsibility='internal'|'external'|'neutral';
export interface DueDateRevision {
 from?:string;to?:string;at:string;
 responsibility?:DueDateResponsibility;reason?:string;
}
export interface Project {
  id: string;
  name: string;
  companyId?: string;
  companyName?: string;
  stage: ProjectStage;
  pipeline?: DealPipeline;
  stageChangedAt?: string;
  dueDate?: string;
  /** First recorded bid deadline; never updated when dueDate changes. */
  originalDueDate?:string;
  /** Attribution controls whether rescheduling counts as a team delay. */
  dueDateResponsibility?:DueDateResponsibility;
  dueDateChangeReason?:string;
  dueDateHistory?:DueDateRevision[];
  /** Organization member explicitly responsible for this Deal. */
  assignedUserId?: string;
  amount?: number;
  nextAction?: string;
  lastTouchpoint?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityMetadata {
  /** Completed interaction saved in existing CRM metadata; no new table required. */
  interactionMethod?: 'email'|'call'|'text'|'video-call'|'in-person';
  /** Source actor for personal calendar display; remains in existing JSON metadata. */
  recordedByUserId?:string;
  /** Actual logging timestamp; differs from the sent date for historical external quotes. */
  recordedAt?:string;
  /** Additional associated CRM records beyond the legacy single-ID columns. */
  relatedRecords?:Array<{type:'contact'|'company'|'project'|'quote';id:string;label?:string}>;
  editedAt?:string;
  editedByUserId?:string;
  notes?: string;
  quoteNumber?: string;
  revision?: number;
  amount?: number;
  /** Submission created in a different quoting tool; no native quote document is implied. */
  externalQuoteSent?: boolean;
  externalQuoteFormat?: string;
  bidSentDate?: string;
  bidDueDate?: string;
  documentType?: 'quote' | 'pricing-schedule' | 'change-order';
  parentQuoteId?: string;
  fromStage?: ProjectStage;
  toStage?: ProjectStage;
  source?: 'manual' | 'quote' | 'system';
  /** Only a salesperson's explicit, revision-specific confirmation is delivery. */
  deliveryConfirmed?: boolean;
  deliveryMethod?: 'email' | 'text' | 'in-person' | 'other';
  /** Revision-scoped salesperson follow-up events, not quote lifecycle events. */
  followUpAction?: 'scheduled' | 'contacted' | 'cleared';
  followUpDueDate?: string;
  followUpMethod?: 'call' | 'email' | 'text' | 'meeting' | 'other';
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
  pipeline?: DealPipeline;
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

export type CompanyPatch = Partial<Pick<Company, 'name' | 'aliases' | 'identityExclusions' | 'kind' | 'annualUnits' | 'averageUnitValue' | 'expectedSharePct'>>;

export type ContactPatch = Partial<Pick<Contact, 'companyId' | 'name' | 'email' | 'phone' | 'title' | 'identityExclusions'>>;

export type ProjectPatch = Partial<Pick<
  Project,
  'name' | 'companyName' | 'stage' | 'pipeline' | 'dueDate' | 'dueDateResponsibility' | 'dueDateChangeReason' | 'amount' | 'nextAction' | 'lastTouchpoint'
>>;

export type ActivityInput = Omit<Activity, 'id' | 'occurredAt'> & { id?: string; occurredAt?: string };

export function companyAnnualPotential(company: Pick<Company, 'annualUnits' | 'averageUnitValue'>) {
  if (company.annualUnits === undefined || company.averageUnitValue === undefined) return undefined;
  return company.annualUnits * company.averageUnitValue;
}

export function companyEstimatedAnnualWork(company: Pick<Company, 'annualUnits' | 'averageUnitValue' | 'expectedSharePct'>) {
  const potential = companyAnnualPotential(company);
  if (potential === undefined) return undefined;
  const share = company.expectedSharePct === undefined ? 100 : Math.min(100, Math.max(0, company.expectedSharePct));
  return potential * (share / 100);
}
