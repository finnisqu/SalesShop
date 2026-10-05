import { supabase } from '../lib/supabase';
import type {
  Quote,
  QuoteDocument,
  QuoteLine,
  QuoteLineKind,
  QuotePricingMode,
  QuoteRevisionSnapshot,
  QuoteSection,
  QuoteStatus,
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

async function selectRows(table: QuoteTable, organizationId: string, orderColumn: string) {
  if (!supabase) return [] as DbRow[];
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', organizationId)
    .order(orderColumn, { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbRow[];
}

function groupByQuote<T>(rows: DbRow[], mapper: (row: DbRow) => T) {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => {
    const quoteId = String(row.quote_id);
    const current = grouped.get(quoteId) ?? [];
    current.push(mapper(row));
    grouped.set(quoteId, current);
  });
  return grouped;
}

export async function loadNormalizedQuotes(
  organizationId: string,
  preferredActiveQuoteId: string | null = null,
): Promise<QuoteDocument | null> {
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
  }));

  const linesByQuote = groupByQuote<QuoteLine>(lineRows, (row) => ({
    id: String(row.id),
    sectionId: valueOrUndefined(row.section_id),
    kind: String(row.kind) as QuoteLineKind,
    description: String(row.description),
    pricingMode: String(row.pricing_mode) as QuotePricingMode,
    quantity: numericOrUndefined(row.quantity),
    rate: numericOrUndefined(row.rate),
    amount: numericOrUndefined(row.amount),
    customerVisible: Boolean(row.customer_visible),
    includeInTotal: Boolean(row.include_in_total),
  }));

  const revisionsByQuote = groupByQuote<QuoteRevisionSnapshot>(revisionRows, (row) => {
    const snapshot = row.snapshot;
    if (snapshot && typeof snapshot === 'object') return snapshot as QuoteRevisionSnapshot;
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
    };
  });

  const quotes: Quote[] = quoteRows.map((row) => ({
    id: String(row.id),
    quoteNumber: String(row.quote_number),
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
    sections: sectionsByQuote.get(String(row.id)) ?? [],
    lines: linesByQuote.get(String(row.id)) ?? [],
    customerColumns: {
      quantity: Boolean(row.customer_quantity),
      rate: Boolean(row.customer_rate),
      lineAmount: Boolean(row.customer_line_amount),
    },
    customerNotes: String(row.customer_notes ?? ''),
    internalNotes: String(row.internal_notes ?? ''),
    history: revisionsByQuote.get(String(row.id)) ?? [],
    sentAt: valueOrUndefined(row.sent_at),
    viewedAt: valueOrUndefined(row.viewed_at),
    signedAt: valueOrUndefined(row.signed_at),
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
    onConflict: 'organization_id,quote_id,revision',
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

async function deleteStaleRows(
  table: Exclude<QuoteTable, 'quote_revisions'>,
  organizationId: string,
  localIds: string[],
) {
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

async function serverOutcomeGuards(organizationId: string) {
  const guards = new Map<string, { revision: number; status: QuoteStatus; viewedAt?: string; signedAt?: string }>();
  if (!supabase) return guards;
  const { data, error } = await supabase
    .from('quotes')
    .select('id,revision,status,viewed_at,signed_at')
    .eq('organization_id', organizationId);
  if (error) throw error;
  (data ?? []).forEach((row) => guards.set(String(row.id), {
    revision: Number(row.revision) || 0,
    status: String(row.status) as QuoteStatus,
    viewedAt: valueOrUndefined(row.viewed_at),
    signedAt: valueOrUndefined(row.signed_at),
  }));
  return guards;
}

export async function syncNormalizedQuotes(organizationId: string, document: QuoteDocument) {
  if (!supabase) return;
  if (document.schemaVersion !== 2) throw new Error('Unsupported Quote document schema.');

  // Customer actions happen server-side. Preserve those outcomes when an older
  // open SalesShop tab later saves its local cache.
  const guards = await serverOutcomeGuards(organizationId);
  const quotes = document.quotes.map((quote, sortOrder) => {
    const server = guards.get(quote.id);
    let status = quote.status;
    let viewedAt = quote.viewedAt;
    let signedAt = quote.signedAt;
    if (server && server.revision === quote.revision) {
      if (server.status === 'Signed' && quote.status !== 'Signed') {
        status = 'Signed';
        signedAt = server.signedAt ?? signedAt;
        viewedAt = server.viewedAt ?? viewedAt;
      } else if (server.status === 'Viewed' && quote.status === 'Sent') {
        status = 'Viewed';
        viewedAt = server.viewedAt ?? viewedAt;
      }
    }

    return {
      organization_id: organizationId,
      id: quote.id,
      quote_number: quote.quoteNumber,
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
      customer_quantity: quote.customerColumns.quantity,
      customer_rate: quote.customerColumns.rate,
      customer_line_amount: quote.customerColumns.lineAmount,
      customer_notes: quote.customerNotes,
      internal_notes: quote.internalNotes,
      sent_at: quote.sentAt ?? null,
      viewed_at: viewedAt ?? null,
      signed_at: signedAt ?? null,
      sort_order: sortOrder,
      created_at: quote.createdAt,
      updated_at: quote.updatedAt,
    };
  });

  const sections = document.quotes.flatMap((quote) => quote.sections.map((section, sortOrder) => ({
    organization_id: organizationId,
    id: section.id,
    quote_id: quote.id,
    title: section.title,
    customer_visible: section.customerVisible,
    sort_order: sortOrder,
  })));

  const lines = document.quotes.flatMap((quote) => quote.lines.map((line, sortOrder) => ({
    organization_id: organizationId,
    id: line.id,
    quote_id: quote.id,
    section_id: line.sectionId ?? null,
    kind: line.kind,
    description: line.description,
    pricing_mode: line.pricingMode,
    quantity: line.quantity ?? null,
    rate: line.rate ?? null,
    amount: line.amount ?? null,
    customer_visible: line.customerVisible,
    include_in_total: line.includeInTotal,
    sort_order: sortOrder,
  })));

  const revisions = document.quotes.flatMap((quote) => quote.history.map((revision) => ({
    organization_id: organizationId,
    quote_id: quote.id,
    revision: revision.revision,
    label: revision.label ?? null,
    quote_date: revision.quoteDate,
    captured_at: revision.capturedAt,
    status: revision.status,
    title: revision.title,
    snapshot: revision,
  })));

  await upsertRows('quotes', quotes);
  await upsertRows('quote_sections', sections);
  await upsertRows('quote_lines', lines);
  await insertRevisionSnapshots(revisions);

  await deleteStaleRows('quote_lines', organizationId, lines.map((line) => line.id));
  await deleteStaleRows('quote_sections', organizationId, sections.map((section) => section.id));
  await deleteStaleRows('quotes', organizationId, document.quotes.map((quote) => quote.id));
}
