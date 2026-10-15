import type { SignatureRecord } from '../types/signature';
import type { CommercialDocumentType } from '../types/quote';

/**
 * The only fields permitted in the initial customer-commitment outcome model.
 * In particular: no Quote, QuoteLine, cost, margin, signatures/strokes, person,
 * employee productivity data, or mutable CRM activities are returned here.
 *
 * IMPORTANT: This client adapter is NOT an authorization boundary. A separate
 * server-side, RLS-enforced shop-outcomes API must enforce the same allowlist
 * before other employees may be permitted to request these records.
 */
export interface SignedShopOutcome {
  kind: 'signed-customer-commitment';
  signatureId: string;
  quoteId: string;
  quoteNumber: string;
  revision: number;
  documentType: CommercialDocumentType;
  title: string;
  projectId?: string;
  companyName?: string;
  acceptedAt: string;
  acceptedTotal: number;
}

/** Build an operational index from immutable accepted snapshots only. */
export function projectSignedShopOutcomes(
  signatures: readonly SignatureRecord[],
): SignedShopOutcome[] {
  const seen = new Set<string>();
  return signatures.flatMap(signature => {
    const record = signature.acceptedSnapshot;
    if (!signature.id || !record || !signature.acceptedAt
      || !Number.isFinite(record.acceptedTotal)
      || !Number.isFinite(Date.parse(signature.acceptedAt))
      || seen.has(signature.id)) return [];
    seen.add(signature.id);
    return [{
      kind: 'signed-customer-commitment' as const,
      signatureId: signature.id,
      quoteId: signature.quoteId,
      quoteNumber: record.quoteNumber,
      revision: record.revision,
      documentType: record.documentType ?? 'quote',
      title: record.title,
      ...(record.projectId ? { projectId: record.projectId } : {}),
      ...(record.companyName ? { companyName: record.companyName } : {}),
      acceptedAt: signature.acceptedAt,
      acceptedTotal: record.acceptedTotal,
    }];
  }).sort((a,b) => b.acceptedAt.localeCompare(a.acceptedAt));
}
