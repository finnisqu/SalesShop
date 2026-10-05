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

async function deleteStaleRows(table: Exclude<CrmTable, 'activities'>, organizationId: string, localIds: string[]) {
  if (!supabase) return;
  const { data, error } = await supabase
    .from(table)
    .select('id')
    .eq('organization_id', organizationId);
  if (error) throw error;

  const keep = new Set(localIds);
  const staleIds = (data ?? [])
    .map((row) => String(row.id))
    .filter((id) => !keep.has(id));
  if (!staleIds.length) return;

  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq('organization_id', organizationId)
    .in('id', staleIds);
  if (deleteError) throw deleteError;
}

async function serverProjectGuards(organizationId: string) {
  const guards = new Map<string, { stage: ProjectStage; amount?: number; lastTouchpoint?: string }>();
  if (!supabase) return guards;
  const { data, error } = await supabase
    .from('projects')
    .select('id,stage,amount,last_touchpoint')
    .eq('organization_id', organizationId);
  if (error) throw error;
  (data ?? []).forEach((row) => guards.set(String(row.id), {
    stage: String(row.stage) as ProjectStage,
    amount: numericOrUndefined(row.amount),
    lastTouchpoint: valueOrUndefined(row.last_touchpoint),
  }));
  return guards;
}

export async function syncNormalizedCrm(organizationId: string, document: CrmDocument) {
  if (!supabase) return;
  if (document.schemaVersion !== 3) throw new Error('Unsupported CRM document schema.');

  const companies = document.companies.map((company, sortOrder) => ({
    organization_id: organizationId,
    id: company.id,
    name: company.name,
    kind: company.kind,
    sort_order: sortOrder,
    created_at: company.createdAt,
    updated_at: company.updatedAt,
  }));
  const contacts = document.contacts.map((contact, sortOrder) => ({
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

  // A public signature can advance a Project while a salesperson still has an
  // older browser cache open. Closed Won/Completed customer outcomes are never
  // silently moved backward by that stale cache.
  const projectGuards = await serverProjectGuards(organizationId);
  const projects = document.projects.map((project, sortOrder) => {
    const server = projectGuards.get(project.id);
    let stage = project.stage;
    let amount = project.amount;
    let lastTouchpoint = project.lastTouchpoint;
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

  // Parent records first so foreign-key relationships are always valid.
  await upsertRows('companies', companies);
  await upsertRows('contacts', contacts);
  await upsertRows('projects', projects);
  await upsertRows('activities', activities);

  // Activities are append-only breadcrumbs. Customer View/Sign events can be
  // created server-side and must survive an older client's later sync.
  await deleteStaleRows('projects', organizationId, document.projects.map((project) => project.id));
  await deleteStaleRows('contacts', organizationId, document.contacts.map((contact) => contact.id));
  await deleteStaleRows('companies', organizationId, document.companies.map((company) => company.id));
}
