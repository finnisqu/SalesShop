import { supabaseKey, supabaseUrl } from '../lib/supabase';
import type { CommercialDocumentType } from '../types/quote';
import type { SignatureMethod, SignatureStroke } from '../types/signature';

export interface PublicQuoteSection {
  id: string;
  title: string;
  customerVisible: boolean;
}

export interface PublicQuoteLine {
  id: string;
  sectionId?: string;
  kind: string;
  description: string;
  pricingMode: 'direct' | 'quantity-rate' | 'none';
  quantity?: number;
  rate?: number;
  amount?: number;
  customerVisible: boolean;
  includeInTotal: boolean;
}

export interface PublicQuotePayload {
  quoteId: string;
  quoteNumber: string;
  documentType: CommercialDocumentType;
  revision: number;
  revisionLabel?: string;
  quoteDate: string;
  title: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  address?: string;
  sections: PublicQuoteSection[];
  lines: PublicQuoteLine[];
  customerColumns: { quantity: boolean; rate: boolean; lineAmount: boolean };
  customerNotes: string;
  acceptedTotal: number;
}

export interface PublicSignaturePayload {
  signerName: string;
  signerEmail: string | null;
  method: SignatureMethod;
  signatureText: string | null;
  strokes: SignatureStroke[];
  consentText: string;
  acceptedAt: string;
  acceptedSnapshot: PublicQuotePayload;
}

export interface PublicQuoteResponse {
  organizationName: string;
  quote: PublicQuotePayload;
  share: {
    status: 'active' | 'signed';
    expiresAt: string | null;
    viewCount: number;
  };
  signature: PublicSignaturePayload | null;
  consentText: string;
}

async function publicCall(body: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl}/functions/v1/quote-share-public`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as PublicQuoteResponse & { error?: string };
  if (!response.ok) throw new Error(data.error || `Document link request failed (${response.status}).`);
  return data;
}

export function viewPublicQuote(token: string) {
  return publicCall({ action: 'view', token });
}

export function signPublicQuote(token: string, input: {
  signerName: string;
  signerEmail?: string;
  method: SignatureMethod;
  signatureText?: string;
  strokes: SignatureStroke[];
  consented: boolean;
}) {
  return publicCall({ action: 'sign', token, ...input });
}
