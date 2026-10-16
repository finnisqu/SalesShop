import { supabase } from '../lib/supabase';
import type { AcceptedQuoteSnapshot, SignatureDocument, SignatureMethod, SignatureRecord, SignatureStroke } from '../types/signature';

type DbRow = Record<string, unknown>;

function valueOrUndefined(value: unknown) {
  return value === null || value === undefined || value === '' ? undefined : String(value);
}

export async function loadNormalizedSignatures(organizationId: string): Promise<SignatureDocument | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('signatures')
    .select('*')
    .eq('organization_id', organizationId)
    .order('accepted_at', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  if (!rows.length) return null;

  const signatures: SignatureRecord[] = rows.map((row) => ({
    id: String(row.id),
    quoteId: String(row.quote_id),
    projectId: valueOrUndefined(row.project_id),
    companyId: valueOrUndefined(row.company_id),
    contactId: valueOrUndefined(row.contact_id),
    quoteNumber: String(row.quote_number),
    revision: Number(row.revision) || 0,
    signerName: String(row.signer_name),
    signerEmail: valueOrUndefined(row.signer_email),
    method: String(row.method) as SignatureMethod,
    signatureText: valueOrUndefined(row.signature_text),
    strokes: Array.isArray(row.strokes) ? row.strokes as SignatureStroke[] : [],
    consentText: String(row.consent_text ?? ''),
    acceptedAt: String(row.accepted_at),
    acceptedSnapshot: row.accepted_snapshot as AcceptedQuoteSnapshot,
  }));

  return { schemaVersion: 1, signatures };
}

export async function syncNormalizedSignatures(organizationId: string, document: SignatureDocument) {
  if (!supabase) return;
  if (document.schemaVersion !== 1) throw new Error('Unsupported Signature document schema.');
  if (!document.signatures.length) return;

  const { data, error } = await supabase
    .from('signatures')
    .select('id')
    .eq('organization_id', organizationId);
  if (error) throw error;

  const existing = new Set((data ?? []).map((row) => String(row.id)));
  const missing = document.signatures
    .filter((signature) => !existing.has(signature.id))
    .map((signature) => ({
      organization_id: organizationId,
      id: signature.id,
      quote_id: signature.quoteId,
      project_id: signature.projectId ?? null,
      company_id: signature.companyId ?? null,
      contact_id: signature.contactId ?? null,
      quote_number: signature.quoteNumber,
      revision: signature.revision,
      signer_name: signature.signerName,
      signer_email: signature.signerEmail ?? null,
      method: signature.method,
      signature_text: signature.signatureText ?? null,
      strokes: signature.strokes,
      consent_text: signature.consentText,
      accepted_at: signature.acceptedAt,
      accepted_snapshot: signature.acceptedSnapshot,
    }));

  if (!missing.length) return;
  const { error: insertError } = await supabase.from('signatures').insert(missing);
  if (insertError) throw insertError;
}
