import type { SignedShopOutcome } from './shopOutcomeProjection';

/**
 * Defensive client allowlist. Even if a future response includes extra
 * customer/private fields, no such fields are retained in the UI's state.
 * The server remains the security boundary.
 */
export function sanitizeSignedShopOutcomes(items: unknown): SignedShopOutcome[] {
  if (!Array.isArray(items)) throw new Error('Invalid shop outcomes response.');
  return items.flatMap((item: unknown): SignedShopOutcome[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const value = item as Record<string, unknown>;
    if (value.kind !== 'signed-customer-commitment'
      || typeof value.signatureId !== 'string' || !value.signatureId
      || typeof value.quoteId !== 'string' || !value.quoteId
      || typeof value.quoteNumber !== 'string'
      || !Number.isInteger(value.revision) || (value.revision as number) < 0
      || !['quote', 'change-order', 'pricing-schedule'].includes(String(value.documentType))
      || typeof value.title !== 'string'
      || typeof value.acceptedAt !== 'string'
      || !Number.isFinite(Date.parse(value.acceptedAt))
      || typeof value.acceptedTotal !== 'number'
      || !Number.isFinite(value.acceptedTotal)) return [];
    return [{
      kind: 'signed-customer-commitment',
      signatureId: value.signatureId,
      quoteId: value.quoteId,
      quoteNumber: value.quoteNumber,
      revision: value.revision as number,
      documentType: value.documentType as SignedShopOutcome['documentType'],
      title: value.title,
      ...(typeof value.projectId === 'string' && value.projectId ? { projectId: value.projectId } : {}),
      ...(typeof value.companyName === 'string' && value.companyName ? { companyName: value.companyName } : {}),
      acceptedAt: value.acceptedAt,
      acceptedTotal: value.acceptedTotal,
    }];
  });
}
