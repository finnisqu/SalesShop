import { supabase } from '../lib/supabase';
import {forEachCloudWriteBatch} from './cloudWriteBatches';
import type { AcceptedQuoteSnapshot, SignatureDocument, SignatureMethod, SignatureRecord, SignatureStroke } from '../types/signature';

type DbRow = Record<string, unknown>;

function valueOrUndefined(value: unknown) {
  return value === null || value === undefined || value === '' ? undefined : String(value);
}

const SIGNATURE_PAGE_SIZE=500;
/** The customer signature trail is immutable; load all authorized pages
 * before determining whether an ID is genuinely new. */
async function selectSignatureRows(organizationId:string,columns:string,orderColumn:string){
  if(!supabase)return [] as DbRow[];
  const rows:DbRow[]=[];
  for(let start=0;;start+=SIGNATURE_PAGE_SIZE){
    const base=supabase.from('signatures').select(columns)
      .eq('organization_id',organizationId)
      .order(orderColumn,{ascending:true});
    const query=orderColumn==='id'?base:base.order('id',{ascending:true});
    const {data,error}=await query.range(start,start+SIGNATURE_PAGE_SIZE-1);
    if(error)throw error;
    const page=(data??[]) as DbRow[];
    rows.push(...page);
    if(page.length<SIGNATURE_PAGE_SIZE)return rows;
  }
}

export async function loadNormalizedSignatures(organizationId: string): Promise<SignatureDocument | null> {
  if (!supabase) return null;
  const rows=await selectSignatureRows(organizationId,'*','accepted_at');
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

  const existingRows=await selectSignatureRows(organizationId,'id','id');
  const existing=new Set(existingRows.map(row=>String(row.id)));
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

  await forEachCloudWriteBatch(missing,async batch=>{
    const {error}=await supabase.from('signatures').insert(batch);
    if(error)throw error;
  });
}
