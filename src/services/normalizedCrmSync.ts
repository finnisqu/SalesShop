import { supabase } from '../lib/supabase';
import type {
  Activity,
  ActivityMetadata,
  ActivityType,
  Company,
  CompanyKind,
  Contact,
  CrmDocument,
  Project,
  ProjectStage,
} from '../types/crm';

const CRM_TABLES = ['activities', 'projects', 'contacts', 'companies'] as const;
type CrmTable = (typeof CRM_TABLES)[number];
type DbRow = Record<string, unknown>;

function valueOrUndefined(value: unknown) {
  return value === null || value === undefined || value === '' ? undefined : String(value);
}

function numericOrUndefined(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function atLeastAsNew(localValue: string, serverValue?: string) {
  if (!serverValue) return true;
  const localTime = Date.parse(localValue);
  const serverTime = Date.parse(serverValue);
  if (!Number.isFinite(localTime) || !Number.isFinite(serverTime)) return localValue >= serverValue;
  return localTime >= serverTime;
}

async function selectRows(table: CrmTable, organizationId: string) {
  if (!supabase) return [] as DbRow[];
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbRow[];
}

export async function loadNormalizedCrm(organizationId: string): Promise<CrmDocument | null> {
  if (!supabase) return null;

  const [companyRows, contactRows, projectRows, activityRows] = await Promise.all([
    selectRows('companies', organizationId),
    selectRows('contacts', organizationId),
    selectRows('projects', organizationId),
    selectRows('activities', organizationId),
  ]);

  if (!companyRows.length && !contactRows.length && !projectRows.length && !activityRows.length) return null;

  const companies: Company[] = companyRows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    kind: (row.kind === 'non-customer' ? 'non-customer' : 'customer') as CompanyKind,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
  const companyNames = new Map(companies.map((company) => [company.id, company.name]));

  const contacts: Contact[] = contactRows.map((row) => ({
    id: String(row.id),
    companyId: valueOrUndefined(row.company_id),
    name: String(row.name),
    email: valueOrUndefined(row.email),
    phone: valueOrUndefined(row.phone),
    title: valueOrUndefined(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));

  const projects: Project[] = projectRows.map((row) => {
    const companyId = valueOrUndefined(row.company_id);
    return {
      id: String(row.id),
      name: String(row.name),
      companyId,
      companyName: companyId ? companyNames.get(companyId) : undefined,
      stage: String(row.stage) as ProjectStage,
      dueDate: valueOrUndefined(row.due_date),
      amount: numericOrUndefined(row.amount),
      nextAction: valueOrUndefined(row.next_action),
      lastTouchpoint: valueOrUndefined(row.last_touchpoint),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  });

  const activities: Activity[] = activityRows.map((row) => ({
    id: String(row.id),
    type: String(row.type) as ActivityType,
    summary: String(row.summary),
    projectId: valueOrUndefined(row.project_id),
    companyId: valueOrUndefined(row.company_id),
    contactId: valueOrUndefined(row.contact_id),
    quoteId: valueOrUndefined(row.quote_id),
    occurredAt: String(row.occurred_at),
    metadata: row.metadata && typeof row.metadata === 'object'
      ? row.metadata as ActivityMetadata
      : undefined,
  }));

  return { schemaVersion: 3, companies, contacts, projects, activities };
}

async function upsertRows(table: CrmTable, rows: Record<string, unknown>[]) {
  if (!supabase || !rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, {
    onConflict: 'organization_id,id',
  });
  if (error) throw error;
}

interface ServerCrmGuards {
  companies: Map<string, string>;
  contacts: Map<string, string>;
  projects: Map<string, { updatedAt: string; stage: ProjectStage; amount?: number; lastTouchpoint?: string }>;
}

async function serverCrmGuards(organizationId: string): Promise<ServerCrmGuards> {
  const guards: ServerCrmGuards = {
    companies: new Map(),
    contacts: new Map(),
    projects: new Map(),
  };
  if (!supabase) return guards;

  const [companies, contacts, projects] = await Promise.all([
    supabase.from('companies').select('id,updated_at').eq('organization_id', organizationId),
    supabase.from('contacts').select('id,updated_at').eq('organization_id', organizationId),
    supabase.from('projects').select('id,updated_at,stage,amount,last_touchpoint').eq('organization_id', organizationId),
  ]);
  if (companies.error) throw companies.error;
  if (contacts.error) throw contacts.error;
  if (projects.error) throw projects.error;

  (companies.data ?? []).forEach((row) => guards.companies.set(String(row.id), String(row.updated_at)));
  (contacts.data ?? []).forEach((row) => guards.contacts.set(String(row.id), String(row.updated_at)));
  (projects.data ?? []).forEach((row) => guards.projects.set(String(row.id), {
    updatedAt: String(row.updated_at),
    stage: String(row.stage) as ProjectStage,
    amount: numericOrUndefined(row.amount),
    lastTouchpoint: valueOrUndefined(row.last_touchpoint),
  }));
  return guards;
}

export async function syncNormalizedCrm(organizationId: string, document: CrmDocument) {
  if (!supabase) return;
  if (document.schemaVersion !== 3) throw new Error('Unsupported CRM document schema.');

  // Every browser starts from a snapshot. Treat Supabase as the shared source of
  // truth: a stale snapshot may add its own new records, but it cannot overwrite
  // records another salesperson has updated more recently and it never infers
  // deletion merely because a server row is missing from this browser's cache.
  const guards = await serverCrmGuards(organizationId);

  const companies = document.companies
    .filter((company) => atLeastAsNew(company.updatedAt, guards.companies.get(company.id)))
    .map((company, sortOrder) => ({
      organization_id: organizationId,
      id: company.id,
      name: company.name,
      kind: company.kind,
      sort_order: sortOrder,
      created_at: company.createdAt,
      updated_at: company.updatedAt,
    }));

  const contacts = document.contacts
    .filter((contact) => atLeastAsNew(contact.updatedAt, guards.contacts.get(contact.id)))
    .map((contact, sortOrder) => ({
      organization_id: organizationId,
      id: contact.id,
      company_id: contact.companyId ?? null,
      name: contact.name,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      title: contact.title ?? null,
      sort_order: sortOrder,
      created_at: contact.createdAt,
      updated_at: contact.updatedAt,
    }));

  const projects = document.projects
    .filter((project) => atLeastAsNew(project.updatedAt, guards.projects.get(project.id)?.updatedAt))
    .map((project, sortOrder) => {
      const server = guards.projects.get(project.id);
      let stage = project.stage;
      let amount = project.amount;
      let lastTouchpoint = project.lastTouchpoint;
      // Customer acceptance is authoritative even when a local clock happens to
      // be ahead. Never regress these terminal customer/business outcomes.
      if (server?.stage === 'Completed' && project.stage !== 'Completed') {
        stage = 'Completed';
        amount = server.amount ?? amount;
        lastTouchpoint = server.lastTouchpoint ?? lastTouchpoint;
      } else if (server?.stage === 'Closed Won' && project.stage !== 'Closed Won' && project.stage !== 'Completed') {
        stage = 'Closed Won';
        amount = server.amount ?? amount;
        lastTouchpoint = server.lastTouchpoint ?? lastTouchpoint;
      }
      return {
        organization_id: organizationId,
        id: project.id,
        company_id: project.companyId ?? null,
        name: project.name,
        stage,
        due_date: project.dueDate ?? null,
        amount: amount ?? null,
        next_action: project.nextAction ?? null,
        last_touchpoint: lastTouchpoint ?? null,
        sort_order: sortOrder,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
      };
    });

  // Activities are append-only breadcrumbs. Upserting known IDs is idempotent,
  // while server-created customer events remain untouched if this browser never saw them.
  const activities = document.activities.map((activity, sortOrder) => ({
    organization_id: organizationId,
    id: activity.id,
    type: activity.type,
    summary: activity.summary,
    project_id: activity.projectId ?? null,
    company_id: activity.companyId ?? null,
    contact_id: activity.contactId ?? null,
    quote_id: activity.quoteId ?? null,
    occurred_at: activity.occurredAt,
    metadata: activity.metadata ?? null,
    sort_order: sortOrder,
  }));

  await upsertRows('companies', companies);
  await upsertRows('contacts', contacts);
  await upsertRows('projects', projects);
  await upsertRows('activities', activities);
}

export async function deleteNormalizedProject(organizationId: string, projectId: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', projectId);
  if (error) throw error;
}
