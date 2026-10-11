import { appAbsoluteUrl } from '../lib/appUrl';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useCrmStore } from '../store/crmStore';
import { useQuoteStore } from '../store/quoteStore';
import { syncNormalizedCrm } from './normalizedCrmSync';
import { syncNormalizedQuotes } from './normalizedQuoteSync';

export interface QuoteShare {
  id: string;
  quoteId: string;
  revision: number;
  token: string;
  status: 'active' | 'revoked' | 'signed';
  expiresAt: string | null;
  createdAt: string;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  signedAt: string | null;
}

interface ShareResponse {
  share: QuoteShare | null;
  error?: string;
}

function requireCloudContext() {
  const auth = useAuthStore.getState();
  if (!supabase || !auth.organizationId || !auth.session) {
    throw new Error('Customer links require an authenticated SalesShop cloud workspace.');
  }
  return { organizationId: auth.organizationId };
}

async function edgeFunctionErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : 'Customer link request failed.';
  if (!error || typeof error !== 'object' || !('context' in error)) return fallback;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return fallback;

  try {
    const payload = await context.clone().json() as { error?: unknown; message?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
  } catch {
    // Keep the SDK message when the response body is not JSON.
  }
  return fallback;
}

async function invoke(body: Record<string, unknown>): Promise<ShareResponse> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('quote-share-admin', { body });
  if (error) throw new Error(await edgeFunctionErrorMessage(error));
  const response = data as ShareResponse;
  if (response?.error) throw new Error(response.error);
  return response;
}

async function prepareCurrentRevision(quoteId: string) {
  const { organizationId } = requireCloudContext();
  const client = supabase;
  if (!client) throw new Error('Supabase is not configured.');

  let state = useQuoteStore.getState();
  let quote = state.quotes.find((candidate) => candidate.id === quoteId);
  if (!quote) throw new Error('Commercial document not found.');
  if (quote.archivedAt) throw new Error('Archived documents cannot be shared. Restore the document first.');
  if (quote.status === 'Declined' || quote.status === 'Expired') {
    throw new Error(`${quote.status} documents cannot be shared. Create or reopen a revision first.`);
  }

  if (quote.status === 'Draft' || quote.status === 'Ready') {
    await state.recordSent(quoteId);
    state = useQuoteStore.getState();
    quote = state.quotes.find((candidate) => candidate.id === quoteId);
    if (!quote || quote.status === 'Draft' || quote.status === 'Ready') {
      throw new Error('The document could not be prepared for sharing.');
    }
  }

  // Sharing is an explicit write intent. Refresh the local edit timestamp before
  // the durability sync so a previously interrupted number-assignment/send flow
  // cannot leave a legitimate Sent revision behind a newer server clock value.
  useQuoteStore.getState().touchQuote(quoteId);
  state = useQuoteStore.getState();
  quote = state.quotes.find((candidate) => candidate.id === quoteId);
  if (!quote) throw new Error('Commercial document not found.');

  // Do not rely on the normal cloud debounce here. A customer link must never
  // be issued before the exact revision AND its CRM identity are durable.
  const crm = useCrmStore.getState();
  crm.hydrate();
  const hydratedCrm = useCrmStore.getState();
  await syncNormalizedCrm(organizationId, {
    schemaVersion: 3,
    companies: hydratedCrm.companies,
    contacts: hydratedCrm.contacts,
    projects: hydratedCrm.projects,
    activities: hydratedCrm.activities,
  });
  await syncNormalizedQuotes(organizationId, {
    schemaVersion: 2,
    quotes: state.quotes,
    activeQuoteId: state.activeQuoteId,
  });

  const { data: frozenRevision, error: freezeError } = await client
    .from('quote_revisions')
    .select('revision')
    .eq('organization_id', organizationId)
    .eq('quote_id', quoteId)
    .eq('revision', quote.revision)
    .maybeSingle();
  if (freezeError) throw freezeError;
  if (!frozenRevision) {
    throw new Error('SalesShop could not freeze this quote revision for sharing. Please try again after cloud sync finishes.');
  }

  return { quote, organizationId };
}

export async function getQuoteShare(quoteId: string) {
  const { organizationId } = requireCloudContext();
  const quote = useQuoteStore.getState().quotes.find((candidate) => candidate.id === quoteId);
  const response = await invoke({
    action: 'get',
    organizationId,
    quoteId,
    revision: quote?.revision,
  });
  return response.share;
}

export async function createQuoteShare(quoteId: string, regenerate = false) {
  const { quote, organizationId } = await prepareCurrentRevision(quoteId);
  const response = await invoke({
    action: regenerate ? 'regenerate' : 'create',
    organizationId,
    quoteId,
    revision: quote.revision,
  });
  if (!response.share) throw new Error('SalesShop did not return a customer link.');
  return response.share;
}

export async function revokeQuoteShare(quoteId: string, shareId?: string) {
  const { organizationId } = requireCloudContext();
  await invoke({ action: 'revoke', organizationId, quoteId, shareId });
}

export function quoteShareUrl(share: Pick<QuoteShare, 'token'>) {
  return appAbsoluteUrl(`/q/${encodeURIComponent(share.token)}`);
}
