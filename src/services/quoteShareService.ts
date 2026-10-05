import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useQuoteStore } from '../store/quoteStore';
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

async function invoke(body: Record<string, unknown>): Promise<ShareResponse> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('quote-share-admin', { body });
  if (error) throw error;
  const response = data as ShareResponse;
  if (response?.error) throw new Error(response.error);
  return response;
}

async function prepareCurrentRevision(quoteId: string) {
  const { organizationId } = requireCloudContext();
  let state = useQuoteStore.getState();
  let quote = state.quotes.find((candidate) => candidate.id === quoteId);
  if (!quote) throw new Error('Quote not found.');
  if (quote.status === 'Declined' || quote.status === 'Expired') {
    throw new Error(`${quote.status} quotes cannot be shared. Create or reopen a revision first.`);
  }

  if (quote.status === 'Draft' || quote.status === 'Ready') {
    state.recordSent(quoteId);
    state = useQuoteStore.getState();
    quote = state.quotes.find((candidate) => candidate.id === quoteId);
    if (!quote) throw new Error('Quote could not be prepared for sharing.');
  }

  // Do not rely on the normal 500ms cloud debounce here. A customer link must
  // never be issued before this exact sent revision is durably frozen in Supabase.
  await syncNormalizedQuotes(organizationId, {
    schemaVersion: 2,
    quotes: state.quotes,
    activeQuoteId: state.activeQuoteId,
  });

  return { quote, organizationId };
}

export async function getQuoteShare(quoteId: string) {
  const { organizationId } = requireCloudContext();
  const response = await invoke({ action: 'get', organizationId, quoteId });
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
  return `${window.location.origin}/q/${encodeURIComponent(share.token)}`;
}
