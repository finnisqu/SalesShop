import { readLocalDocument, writeLocalDocument } from './cloudAwareStorage';
import type { SignatureDocument, SignatureRecord } from '../types/signature';

export interface SignatureRepository {
  load(): SignatureDocument;
  save(document: SignatureDocument): void;
}

function normalizeRecord(raw: Partial<SignatureRecord>): SignatureRecord | null {
  if (!raw.id || !raw.quoteId || !raw.quoteNumber || !raw.signerName || !raw.acceptedAt || !raw.acceptedSnapshot) return null;
  return {
    id: raw.id,
    quoteId: raw.quoteId,
    projectId: raw.projectId,
    companyId: raw.companyId,
    contactId: raw.contactId,
    quoteNumber: raw.quoteNumber,
    revision: typeof raw.revision === 'number' ? raw.revision : 0,
    signerName: raw.signerName,
    signerEmail: raw.signerEmail,
    method: raw.method === 'typed' ? 'typed' : 'drawn',
    signatureText: raw.signatureText,
    strokes: Array.isArray(raw.strokes) ? raw.strokes : [],
    consentText: raw.consentText ?? '',
    acceptedAt: raw.acceptedAt,
    acceptedSnapshot: raw.acceptedSnapshot,
  };
}

export const localSignatureRepository: SignatureRepository = {
  load() {
    const parsed = readLocalDocument('signatures') as { schemaVersion?: number; signatures?: unknown[] } | null;
    if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.signatures)) {
      return { schemaVersion: 1, signatures: [] };
    }
    return {
      schemaVersion: 1,
      signatures: parsed.signatures
        .map((item) => normalizeRecord(item as Partial<SignatureRecord>))
        .filter((item): item is SignatureRecord => Boolean(item)),
    };
  },

  save(document) {
    writeLocalDocument('signatures', document);
  },
};
