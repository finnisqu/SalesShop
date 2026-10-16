/**
 * Server-only allowlist for immutable signed operational commitments.
 * No signer identity, signature strokes, private quote lines, internal costs,
 * activities, or full accepted snapshots may ever leave this boundary.
 */
export type SignatureSource = {
  id: string;
  quote_id: string;
  revision: number;
  accepted_at: string;
  accepted_snapshot: Record<string, unknown> | null;
};

export function signedOutcome(row: SignatureSource) {
  const snapshot = row.accepted_snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const amount = snapshot.acceptedTotal;
  const date = Date.parse(row.accepted_at);
  if (typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isFinite(date)
    || !row.id || !row.quote_id) return null;
  const documentType = snapshot.documentType;
  return {
    kind: 'signed-customer-commitment' as const,
    signatureId: row.id,
    quoteId: row.quote_id,
    quoteNumber: typeof snapshot.quoteNumber === 'string' ? snapshot.quoteNumber : '',
    revision: row.revision,
    documentType: documentType === 'pricing-schedule' || documentType === 'change-order' ? documentType : 'quote',
    title: typeof snapshot.title === 'string' ? snapshot.title : '',
    ...(typeof snapshot.projectId === 'string' && snapshot.projectId ? { projectId: snapshot.projectId } : {}),
    ...(typeof snapshot.companyName === 'string' && snapshot.companyName ? { companyName: snapshot.companyName } : {}),
    acceptedAt: row.accepted_at,
    acceptedTotal: amount,
  };
}
