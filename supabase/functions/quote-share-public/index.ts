import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CONSENT_TEXT = 'I agree to the commercial document shown and intend this electronic signature to confirm acceptance of this document and revision.';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function readSecretKey() {
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!legacy) throw new Error('Missing Supabase secret key.');
  return legacy;
}

type SnapshotLine = {
  id: string;
  sectionId?: string;
  kind: string;
  description: string;
  pricingMode: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  customerVisible: boolean;
  includeInTotal: boolean;
};

type Snapshot = {
  revision: number;
  label?: string;
  quoteDate: string;
  title: string;
  projectId?: string;
  companyId?: string;
  companyName?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  address?: string;
  sections?: Array<{ id: string; title: string; customerVisible: boolean }>;
  lines?: SnapshotLine[];
  customerColumns?: { quantity: boolean; rate: boolean; lineAmount: boolean };
  customerNotes?: string;
};

function lineTotal(line: SnapshotLine) {
  if (!line.includeInTotal || line.pricingMode === 'none') return 0;
  const raw = line.pricingMode === 'quantity-rate'
    ? Number(line.quantity ?? 0) * Number(line.rate ?? 0)
    : Number(line.amount ?? 0);
  return line.kind === 'discount' ? -Math.abs(raw) : raw;
}

function buildSafeQuote(snapshot: Snapshot, baseQuoteNumber: string, documentType: string) {
  const allLines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
  const total = allLines.reduce((sum, line) => sum + lineTotal(line), 0);
  const revision = Number(snapshot.revision) || 0;
  const quoteNumber = revision > 0 ? `${baseQuoteNumber}-R${revision}` : baseQuoteNumber;
  return {
    quoteId: '',
    quoteNumber,
    documentType,
    revision,
    revisionLabel: snapshot.label,
    quoteDate: snapshot.quoteDate,
    title: snapshot.title,
    projectId: snapshot.projectId,
    companyId: snapshot.companyId,
    companyName: snapshot.companyName,
    contactId: snapshot.contactId,
    contactName: snapshot.contactName,
    contactEmail: snapshot.contactEmail,
    address: snapshot.address,
    sections: (snapshot.sections ?? []).filter((section) => section.customerVisible),
    lines: allLines.filter((line) => line.customerVisible),
    customerColumns: snapshot.customerColumns ?? { quantity: false, rate: false, lineAmount: true },
    customerNotes: snapshot.customerNotes ?? '',
    acceptedTotal: total,
  };
}

function safeSignature(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    signerName: String(row.signer_name),
    signerEmail: row.signer_email ? String(row.signer_email) : null,
    method: String(row.method),
    signatureText: row.signature_text ? String(row.signature_text) : null,
    strokes: Array.isArray(row.strokes) ? row.strokes : [],
    consentText: String(row.consent_text),
    acceptedAt: String(row.accepted_at),
    acceptedSnapshot: row.accepted_snapshot,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, readSecretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json() as {
      action?: 'view' | 'sign';
      token?: string;
      signerName?: string;
      signerEmail?: string;
      method?: 'drawn' | 'typed';
      signatureText?: string;
      strokes?: Array<{ id: string; points: Array<{ x: number; y: number }> }>;
      consented?: boolean;
    };
    if (!body.action || !body.token) return json({ error: 'Invalid share request.' }, 400);

    const { data: share, error: shareError } = await admin.from('quote_shares')
      .select('*')
      .eq('public_token', body.token)
      .maybeSingle();
    if (shareError) throw shareError;
    if (!share) return json({ error: 'This document link is not valid.' }, 404);
    if (share.status === 'revoked') return json({ error: 'This document link has been revoked.' }, 410);
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now() && share.status !== 'signed') {
      return json({ error: 'This document link has expired.' }, 410);
    }

    const [revisionResult, quoteResult, orgResult, signatureResult] = await Promise.all([
      admin.from('quote_revisions').select('snapshot').eq('organization_id', share.organization_id).eq('quote_id', share.quote_id).eq('revision', share.revision).single(),
      admin.from('quotes').select('*').eq('organization_id', share.organization_id).eq('id', share.quote_id).single(),
      admin.from('organizations').select('name').eq('id', share.organization_id).single(),
      admin.from('signatures').select('*').eq('organization_id', share.organization_id).eq('quote_id', share.quote_id).eq('revision', share.revision).maybeSingle(),
    ]);
    if (revisionResult.error) throw revisionResult.error;
    if (quoteResult.error) throw quoteResult.error;
    if (orgResult.error) throw orgResult.error;
    if (signatureResult.error) throw signatureResult.error;

    const documentType = String(quoteResult.data.document_type ?? 'quote');
    const changeOrder = documentType === 'change-order';
    const documentName = changeOrder ? 'Change Order' : documentType === 'pricing-schedule' ? 'Pricing Schedule' : 'Quote';
    const snapshot = revisionResult.data.snapshot as Snapshot;
    const safeQuote = buildSafeQuote(snapshot, String(quoteResult.data.quote_number), documentType);
    safeQuote.quoteId = String(share.quote_id);
    let signature = safeSignature(signatureResult.data as Record<string, unknown> | null);
    const now = new Date();
    const nowIso = now.toISOString();

    if (body.action === 'view') {
      const firstView = !share.first_viewed_at;
      const { error: viewError } = await admin.from('quote_shares').update({
        first_viewed_at: share.first_viewed_at ?? nowIso,
        last_viewed_at: nowIso,
        view_count: Number(share.view_count ?? 0) + 1,
      }).eq('organization_id', share.organization_id).eq('id', share.id);
      if (viewError) throw viewError;

      if (firstView && quoteResult.data.status === 'Sent' && Number(quoteResult.data.revision) === Number(share.revision)) {
        await admin.from('quotes').update({ status: 'Viewed', viewed_at: nowIso, updated_at: nowIso })
          .eq('organization_id', share.organization_id).eq('id', share.quote_id).eq('status', 'Sent');
        await admin.from('activities').insert({
          organization_id: share.organization_id,
          id: `activity_${crypto.randomUUID()}`,
          type: changeOrder ? 'change-order-viewed' : 'quote-viewed',
          summary: `${documentName} ${safeQuote.quoteNumber} viewed`,
          project_id: quoteResult.data.project_id,
          company_id: quoteResult.data.company_id,
          contact_id: quoteResult.data.contact_id,
          quote_id: share.quote_id,
          occurred_at: nowIso,
          metadata: { quoteNumber: safeQuote.quoteNumber, revision: share.revision, documentType, parentQuoteId: quoteResult.data.parent_quote_id },
        });
      }
    }

    if (body.action === 'sign' && !signature) {
      if (share.status !== 'active') return json({ error: 'This document is no longer available for signature.' }, 409);
      const signerName = body.signerName?.trim() ?? '';
      const signerEmail = body.signerEmail?.trim() || null;
      const method = body.method === 'typed' ? 'typed' : 'drawn';
      const strokes = Array.isArray(body.strokes) ? body.strokes : [];
      if (!signerName) return json({ error: 'Enter the signer name.' }, 400);
      if (!body.consented) return json({ error: 'Acceptance must be confirmed before signing.' }, 400);
      if (method === 'drawn' && !strokes.some((stroke) => Array.isArray(stroke.points) && stroke.points.length > 1)) {
        return json({ error: 'Add a signature or choose Type name.' }, 400);
      }

      const acceptedSnapshot = { ...safeQuote };
      const signatureRow = {
        organization_id: share.organization_id,
        id: `signature_${crypto.randomUUID()}`,
        quote_id: share.quote_id,
        project_id: quoteResult.data.project_id,
        company_id: quoteResult.data.company_id,
        contact_id: quoteResult.data.contact_id,
        quote_number: quoteResult.data.quote_number,
        revision: share.revision,
        signer_name: signerName,
        signer_email: signerEmail,
        method,
        signature_text: method === 'typed' ? (body.signatureText?.trim() || signerName) : null,
        strokes: method === 'drawn' ? strokes : [],
        consent_text: CONSENT_TEXT,
        accepted_at: nowIso,
        accepted_snapshot: acceptedSnapshot,
      };

      const { data: createdSignature, error: signError } = await admin.from('signatures').insert(signatureRow).select('*').single();
      if (signError) {
        if (signError.code === '23505') {
          const { data: existing } = await admin.from('signatures').select('*')
            .eq('organization_id', share.organization_id).eq('quote_id', share.quote_id).eq('revision', share.revision).single();
          signature = safeSignature(existing as Record<string, unknown>);
        } else {
          throw signError;
        }
      } else {
        signature = safeSignature(createdSignature as Record<string, unknown>);
      }

      await admin.from('quote_shares').update({ status: 'signed', signed_at: nowIso, last_viewed_at: nowIso })
        .eq('organization_id', share.organization_id).eq('id', share.id);

      if (Number(quoteResult.data.revision) === Number(share.revision)) {
        await admin.from('quotes').update({ status: 'Signed', signed_at: nowIso, updated_at: nowIso })
          .eq('organization_id', share.organization_id).eq('id', share.quote_id);
      }

      let projectStageChanged = false;
      let previousStage: string | null = null;
      if (quoteResult.data.project_id) {
        const { data: project } = await admin.from('projects').select('id, name, stage')
          .eq('organization_id', share.organization_id).eq('id', quoteResult.data.project_id).maybeSingle();
        if (project) {
          if (changeOrder) {
            const { error: touchError } = await admin.from('projects').update({
              last_touchpoint: nowIso.slice(0, 10),
              updated_at: nowIso,
            }).eq('organization_id', share.organization_id).eq('id', project.id);
            if (touchError) throw touchError;
          } else if (project.stage !== 'Closed Won' && project.stage !== 'Completed') {
            previousStage = String(project.stage);
            const { error: projectError } = await admin.from('projects').update({
              stage: 'Closed Won',
              amount: safeQuote.acceptedTotal,
              last_touchpoint: nowIso.slice(0, 10),
              updated_at: nowIso,
            }).eq('organization_id', share.organization_id).eq('id', project.id);
            if (projectError) throw projectError;
            projectStageChanged = true;

            await admin.from('activities').insert({
              organization_id: share.organization_id,
              id: `activity_${crypto.randomUUID()}`,
              type: 'project-stage-changed',
              summary: `${project.name} moved from ${previousStage} to Closed Won`,
              project_id: project.id,
              company_id: quoteResult.data.company_id,
              contact_id: quoteResult.data.contact_id,
              quote_id: share.quote_id,
              occurred_at: nowIso,
              metadata: { fromStage: previousStage, toStage: 'Closed Won', quoteNumber: safeQuote.quoteNumber },
            });
          }
        }
      }

      await admin.from('activities').insert({
        organization_id: share.organization_id,
        id: `activity_${crypto.randomUUID()}`,
        type: changeOrder ? 'change-order-signed' : 'quote-signed',
        summary: `${documentName} ${safeQuote.quoteNumber} signed · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(safeQuote.acceptedTotal)}`,
        project_id: quoteResult.data.project_id,
        company_id: quoteResult.data.company_id,
        contact_id: quoteResult.data.contact_id,
        quote_id: share.quote_id,
        occurred_at: nowIso,
        metadata: { quoteNumber: safeQuote.quoteNumber, revision: share.revision, amount: safeQuote.acceptedTotal, documentType, parentQuoteId: quoteResult.data.parent_quote_id, projectStageChanged },
      });
    }

    return json({
      organizationName: String(orgResult.data.name),
      quote: safeQuote,
      share: {
        status: body.action === 'sign' || signature ? 'signed' : String(share.status),
        expiresAt: share.expires_at ? String(share.expires_at) : null,
        viewCount: Number(share.view_count ?? 0) + (body.action === 'view' ? 1 : 0),
      },
      signature,
      consentText: CONSENT_TEXT,
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Document request failed.' }, 500);
  }
});
