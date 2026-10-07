import { supabase } from '../lib/supabase';
import {
  isDraftQuoteNumber,
  quoteLinesTotal,
  type CommercialDocumentType,
  type PricingScheduleData,
  type Quote,
  type QuoteDocument,
  type QuoteLine,
  type QuoteLineKind,
  type QuoteLineMaterialReference,
  type QuoteLineRateReference,
  type QuoteLineSinkReference,
  type QuotePricingMode,
  type QuoteRevisionSnapshot,
  type QuoteSection,
  type QuoteLineQuantitySource,
  type QuoteAreaScope,
  type QuoteStatus,
} from '../types/quote';

type QuoteTable = 'quotes' | 'quote_sections' | 'quote_lines' | 'quote_revisions';
type DbRow = Record<string, unknown>;

function valueOrUndefined(value: unknown) {
  return value === null || value === undefined || value === '' ? undefined : String(value);
}

function numericOrUndefined(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function materialReferenceOrUndefined(value: unknown): QuoteLineMaterialReference | undefined {
  return value && typeof value === 'object' ? value as QuoteLineMaterialReference : undefined;
}

function rateReferenceOrUndefined(value: unknown): QuoteLineRateReference | undefined {
  return value && typeof value === 'object' ? value as QuoteLineRateReference : undefined;
}

function areaScopeOrUndefined(value: unknown): QuoteAreaScope | undefined {
  return value && typeof value === 'object' ? value as QuoteAreaScope : undefined;
}

function quantitySourceOrUndefined(value: unknown): QuoteLineQuantitySource | undefined {
  return value && typeof value === 'object' ? value as QuoteLineQuantitySource : undefined;
}

function sinkReferenceOrUndefined(value: unknown): QuoteLineSinkReference | undefined {
  return value && typeof value === 'object' ? value as QuoteLineSinkReference : undefined;
}

function pricingScheduleOrUndefined(value: unknown): PricingScheduleData | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const schedule = value as PricingScheduleData;
  return { ...schedule, customerItems: Array.isArray(schedule.customerItems) ? schedule.customerItems : [] };
}


function atLeastAsNew(localValue: string, serverValue?: string) {
  if (!serverValue) return true;
  const localTime = Date.parse(localValue);
  const serverTime = Date.parse(serverValue);
  if (!Number.isFinite(localTime) || !Number.isFinite(serverTime)) return localValue >= serverValue;
  return localTime >= serverTime;
}

async function selectRows(table: QuoteTable, organizationId: string, orderColumn: string) {
  if (!supabase) return [] as DbRow[];
  const { data, error } = await supabase.from(table).select('*').eq('organization_id', organizationId).order(orderColumn, { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbRow[];
}

function groupByQuote<T>(rows: DbRow[], mapper: (row: DbRow) => T) {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => {
    const quoteId = String(row.quote_id);
    grouped.set(quoteId, [...(grouped.get(quoteId) ?? []), mapper(row)]);
  });
  return grouped;
}

export async function loadNormalizedQuotes(organizationId: string, preferredActiveQuoteId: string | null = null): Promise<QuoteDocument | null> {
  if (!supabase) return null;
  const [quoteRows, sectionRows, lineRows, revisionRows] = await Promise.all([
    selectRows('quotes', organizationId, 'sort_order'),
    selectRows('quote_sections', organizationId, 'sort_order'),
    selectRows('quote_lines', organizationId, 'sort_order'),
    selectRows('quote_revisions', organizationId, 'revision'),
  ]);
  if (!quoteRows.length) return null;

  const sectionsByQuote = groupByQuote<QuoteSection>(sectionRows, (row) => ({
    id: String(row.id),
    title: String(row.title),
    customerVisible: Boolean(row.customer_visible),
    scope: areaScopeOrUndefined(row.scope),
  }));
  const linesByQuote = groupByQuote<QuoteLine>(lineRows, (row) => ({
    id: String(row.id),
    sectionId: valueOrUndefined(row.section_id),
    kind: String(row.kind) as QuoteLineKind,
    description: String(row.description),
    pricingMode: String(row.pricing_mode) as QuotePricingMode,
    quantity: numericOrUndefined(row.quantity),
    quantitySource: quantitySourceOrUndefined(row.quantity_source),
    rate: numericOrUndefined(row.rate),
    amount: numericOrUndefined(row.amount),
    internalCost: numericOrUndefined(row.internal_cost),
    customerVisible: Boolean(row.customer_visible),
    includeInTotal: Boolean(row.include_in_total),
    materialReference: materialReferenceOrUndefined(row.material_reference),
    sinkReference: sinkReferenceOrUndefined(row.sink_reference),
    rateReference: rateReferenceOrUndefined(row.rate_reference),
  }));
  const revisionsByQuote = groupByQuote<QuoteRevisionSnapshot>(revisionRows, (row) => {
    const snapshot = row.snapshot;
    if (snapshot && typeof snapshot === 'object') {
      const revision = snapshot as QuoteRevisionSnapshot;
      return {
        ...revision,
        pricingSchedule: pricingScheduleOrUndefined(revision.pricingSchedule),
        customerTotal: typeof revision.customerTotal === 'number'
          ? revision.customerTotal
          : quoteLinesTotal(revision.lines ?? []),
      };
    }
    return {
      revision: Number(row.revision) || 0,
      label: valueOrUndefined(row.label),
      quoteDate: String(row.quote_date),
      capturedAt: String(row.captured_at),
      status: String(row.status) as QuoteStatus,
      title: String(row.title),
      sections: [],
      lines: [],
      customerColumns: { quantity: false, rate: false, lineAmount: true },
      customerNotes: '',
      customerTotal: 0,
    };
  });

  const quotes: Quote[] = quoteRows.map((row) => ({
    id: String(row.id),
    quoteNumber: String(row.quote_number),
    documentType: String(row.document_type ?? 'quote') as CommercialDocumentType,
    parentQuoteId: valueOrUndefined(row.parent_quote_id),
    changeOrderNumber: numericOrUndefined(row.change_order_number),
    originalQuoteDate: String(row.original_quote_date),
    quoteDate: String(row.quote_date),
    revision: Number(row.revision) || 0,
    revisionLabel: valueOrUndefined(row.revision_label),
    status: String(row.status) as QuoteStatus,
    title: String(row.title),
    projectId: valueOrUndefined(row.project_id),
    companyId: valueOrUndefined(row.company_id),
    companyName: valueOrUndefined(row.company_name),
    contactId: valueOrUndefined(row.contact_id),
    contactName: valueOrUndefined(row.contact_name),
    contactEmail: valueOrUndefined(row.contact_email),
    address: valueOrUndefined(row.address),
    pricingDivision: valueOrUndefined(row.pricing_division) as Quote['pricingDivision'],
    sections: sectionsByQuote.get(String(row.id)) ?? [],
    lines: linesByQuote.get(String(row.id)) ?? [],
    customerColumns: {
      quantity: Boolean(row.customer_quantity), rate: Boolean(row.customer_rate), lineAmount: Boolean(row.customer_line_amount),
    },
    customerNotes: String(row.customer_notes ?? ''),
    internalNotes: String(row.internal_notes ?? ''),
    pricingSchedule: pricingScheduleOrUndefined(row.pricing_schedule),
    history: revisionsByQuote.get(String(row.id)) ?? [],
    sentAt: valueOrUndefined(row.sent_at),
    viewedAt: valueOrUndefined(row.viewed_at),
    signedAt: valueOrUndefined(row.signed_at),
    archivedAt: valueOrUndefined(row.archived_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));

  const activeQuoteId = preferredActiveQuoteId && quotes.some((quote) => quote.id === preferredActiveQuoteId)
    ? preferredActiveQuoteId
    : quotes[0]?.id ?? null;
  return { schemaVersion: 2, quotes, activeQuoteId };
}

async function upsertRows(table: Exclude<QuoteTable, 'quote_revisions'>, rows: Record<string, unknown>[]) {
  if (!supabase || !rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'organization_id,id' });
  if (error) throw error;
}

async function insertRevisionSnapshots(rows: Record<string, unknown>[]) {
  if (!supabase || !rows.length) return;
  const { error } = await supabase.from('quote_revisions').upsert(rows, {
    onConflict: 'organization_id,quote_id,revision', ignoreDuplicates: true,
  });
  if (error) throw error;
}

interface ServerQuoteGuard {
  revision: number;
  status: QuoteStatus;
  quoteNumber: string;
  documentType: CommercialDocumentType;
  parentQuoteId?: string;
  changeOrderNumber?: number;
  viewedAt?: string;
  signedAt?: string;
  updatedAt: string;
}

async function serverQuoteGuards(organizationId: string) {
  const guards = new Map<string, ServerQuoteGuard>();
  if (!supabase) return guards;
  const { data, error } = await supabase
    .from('quotes')
    .select('id,revision,status,quote_number,document_type,parent_quote_id,change_order_number,viewed_at,signed_at,updated_at')
    .eq('organization_id', organizationId);
  if (error) throw error;
  (data ?? []).forEach((row) => guards.set(String(row.id), {
    revision: Number(row.revision) || 0,
    status: String(row.status) as QuoteStatus,
    quoteNumber: String(row.quote_number),
    documentType: String(row.document_type ?? 'quote') as CommercialDocumentType,
    parentQuoteId: valueOrUndefined(row.parent_quote_id),
    changeOrderNumber: numericOrUndefined(row.change_order_number),
    viewedAt: valueOrUndefined(row.viewed_at),
    signedAt: valueOrUndefined(row.signed_at),
    updatedAt: String(row.updated_at),
  }));
  return guards;
}

export async function syncNormalizedQuotes(organizationId: string, document: QuoteDocument) {
  if (!supabase) return;
  if (document.schemaVersion !== 2) throw new Error('Unsupported Quote document schema.');
  const guards = await serverQuoteGuards(organizationId);
  const acceptedQuotes = document.quotes.filter((quote) => atLeastAsNew(quote.updatedAt, guards.get(quote.id)?.updatedAt));
  const acceptedIds = new Set(acceptedQuotes.map((quote) => quote.id));

  const quotes = acceptedQuotes.map((quote, sortOrder) => {
    const server = guards.get(quote.id);
    let status = quote.status;
    let quoteNumber = quote.quoteNumber;
    let documentType = quote.documentType;
    let parentQuoteId = quote.parentQuoteId;
    let changeOrderNumber = quote.changeOrderNumber;
    let viewedAt = quote.viewedAt;
    let signedAt = quote.signedAt;
    if (server && !isDraftQuoteNumber(server.quoteNumber)) {
      quoteNumber = server.quoteNumber;
      documentType = server.documentType;
      parentQuoteId = server.parentQuoteId;
      changeOrderNumber = server.changeOrderNumber;
    }
    if (server && server.revision === quote.revision) {
      if (server.status === 'Signed' && quote.status !== 'Signed') {
        status = 'Signed'; signedAt = server.signedAt ?? signedAt; viewedAt = server.viewedAt ?? viewedAt;
      } else if (server.status === 'Viewed' && quote.status === 'Sent') {
        status = 'Viewed'; viewedAt = server.viewedAt ?? viewedAt;
      }
    }
    return {
      organization_id: organizationId,
      id: quote.id,
      quote_number: quoteNumber,
      document_type: documentType,
      parent_quote_id: parentQuoteId ?? null,
      change_order_number: changeOrderNumber ?? null,
      original_quote_date: quote.originalQuoteDate,
      quote_date: quote.quoteDate,
      revision: quote.revision,
      revision_label: quote.revisionLabel ?? null,
      status,
      title: quote.title,
      project_id: quote.projectId ?? null,
      company_id: quote.companyId ?? null,
      company_name: quote.companyName ?? null,
      contact_id: quote.contactId ?? null,
      contact_name: quote.contactName ?? null,
      contact_email: quote.contactEmail ?? null,
      address: quote.address ?? null,
      pricing_division: quote.pricingDivision ?? null,
      customer_quantity: quote.customerColumns.quantity,
      customer_rate: quote.customerColumns.rate,
      customer_line_amount: quote.customerColumns.lineAmount,
      customer_notes: quote.customerNotes,
      internal_notes: quote.internalNotes,
      pricing_schedule: quote.pricingSchedule ?? null,
      sent_at: quote.sentAt ?? null,
      viewed_at: viewedAt ?? null,
      signed_at: signedAt ?? null,
      archived_at: quote.archivedAt ?? null,
      sort_order: sortOrder,
      created_at: quote.createdAt,
      updated_at: quote.updatedAt,
    };
  });

  const sections = acceptedQuotes.flatMap((quote) => quote.sections.map((section, sortOrder) => ({
    organization_id: organizationId,
    id: section.id,
    quote_id: quote.id,
    title: section.title,
    customer_visible: section.customerVisible,
    scope: section.scope ?? null,
    sort_order: sortOrder,
  })));
  const lines = acceptedQuotes.flatMap((quote) => quote.lines.map((line, sortOrder) => ({
    organization_id: organizationId,
    id: line.id,
    quote_id: quote.id,
    section_id: line.sectionId ?? null,
    kind: line.kind,
    description: line.description,
    pricing_mode: line.pricingMode,
    quantity: line.quantity ?? null,
    quantity_source: line.quantitySource ?? null,
    rate: line.rate ?? null,
    amount: line.amount ?? null,
    internal_cost: line.internalCost ?? null,
    customer_visible: line.customerVisible,
    include_in_total: line.includeInTotal,
    material_reference: line.materialReference ?? null,
    sink_reference: line.sinkReference ?? null,
    rate_reference: line.rateReference ?? null,
    sort_order: sortOrder,
  })));

  const revisions = document.quotes
    .filter((quote) => acceptedIds.has(quote.id))
    .flatMap((quote) => quote.history.map((revision) => {
      const frozen: QuoteRevisionSnapshot = revision.pricingSchedule || revision.revision !== quote.revision
        ? revision
        : { ...revision, pricingSchedule: quote.pricingSchedule ? structuredClone(quote.pricingSchedule) : undefined };
      return {
        organization_id: organizationId,
        quote_id: quote.id,
        revision: revision.revision,
        label: revision.label ?? null,
        quote_date: revision.quoteDate,
        captured_at: revision.capturedAt,
        status: revision.status,
        title: revision.title,
        snapshot: structuredClone(frozen),
      };
    }));

  await upsertRows('quotes', quotes);
  await upsertRows('quote_sections', sections);
  await upsertRows('quote_lines', lines);
  await insertRevisionSnapshots(revisions);
}

export async function deleteNormalizedQuote(organizationId: string, quoteId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('quotes').delete().eq('organization_id', organizationId).eq('id', quoteId);
  if (error) throw error;
}

export async function deleteNormalizedQuoteLine(organizationId: string, lineId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('quote_lines').delete().eq('organization_id', organizationId).eq('id', lineId);
  if (error) throw error;
}

export async function deleteNormalizedQuoteSection(organizationId: string, sectionId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('quote_sections').delete().eq('organization_id', organizationId).eq('id', sectionId);
  if (error) throw error;
}
