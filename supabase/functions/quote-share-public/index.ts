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

type ScheduleItem = {
  sourceRow: number;
  series?: string;
  itemType?: string;
  planNumber?: string;
  planName?: string;
  optionCode?: string;
  description?: string;
  customerPrice?: number;
  displayType?: string;
  groupLabel?: string;
  priceLabel?: string;
  unitLabel?: string;
  colors?: string[];
  details?: string[];
  detailsLayout?: string;
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
  sections?: Array<{ id: string; title: string; customerVisible: boolean; customerDisplayMode?: 'detail' | 'summary'; customerTotal?: number; scope?: unknown; specification?: string }>;
  lines?: SnapshotLine[];
  customerColumns?: { quantity: boolean; rate: boolean; lineAmount: boolean };
  customerNotes?: string;
  pricingSchedule?: { customerItems?: ScheduleItem[] };
  customerTotal?: number;
  attachSelectionsSheet?: boolean;
};

function roundCurrency(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function lineTotal(line: SnapshotLine) {
  if (!line.includeInTotal || line.pricingMode === 'none') return 0;
  const raw = line.pricingMode === 'quantity-rate'
    ? Number(line.quantity ?? 0) * Number(line.rate ?? 0)
    : Number(line.amount ?? 0);
  return roundCurrency(line.kind === 'discount' ? -Math.abs(raw) : raw);
}

function safePublicLine(line: SnapshotLine) {
  return {
    id: String(line.id),
    sectionId: line.sectionId ? String(line.sectionId) : undefined,
    kind: String(line.kind),
    description: String(line.description ?? ''),
    pricingMode: String(line.pricingMode),
    quantity: typeof line.quantity === 'number' && Number.isFinite(line.quantity) ? line.quantity : undefined,
    rate: typeof line.rate === 'number' && Number.isFinite(line.rate) ? line.rate : undefined,
    amount: typeof line.amount === 'number' && Number.isFinite(line.amount) ? line.amount : undefined,
    customerVisible: Boolean(line.customerVisible),
    includeInTotal: Boolean(line.includeInTotal),
  };
}

/**
 * Presentation-only grouping; never edits source quote rows or customerTotal.
 * Each hidden charge becomes part of the first visible material/item charge.
 * Without a suitable visible host, an anonymous included work row preserves total.
 */
function publicItemizedLines(rows: SnapshotLine[], scopeId = 'general') {
  const visible = rows.filter(line => line.customerVisible !== false &&
    (line.includeInTotal || line.pricingMode === 'none'));
  const hiddenAmount = roundCurrency(rows.filter(line => line.customerVisible === false)
    .reduce((sum, line) => sum + lineTotal(line), 0));
  const host = visible.find(line => line.includeInTotal && line.pricingMode !== 'none' &&
    (line.kind === 'material' || line.kind === 'item'))
    ?? visible.find(line => line.includeInTotal && line.pricingMode !== 'none' && line.kind !== 'discount');
  const safe = visible.map(line => {
    const base = safePublicLine(line);
    if (host && line.id === host.id && hiddenAmount !== 0) {
      return { ...base, pricingMode: 'direct', amount: roundCurrency(lineTotal(line) + hiddenAmount),
        quantity: undefined, rate: undefined };
    }
    return base;
  });
  if (hiddenAmount !== 0 && !host) safe.push(safePublicLine({
    id: 'included-work-' + scopeId, sectionId: scopeId === 'general' ? undefined : scopeId,
    kind: 'item', description: 'Included work', pricingMode: 'direct',
    amount: hiddenAmount, includeInTotal: true, customerVisible: true,
  }));
  return safe;
}
function isGeneralTakeoffsTitle(section: { title?: unknown }): boolean {
  return String(section.title ?? '').trim().toLowerCase() === 'general takeoffs';
}
function publicGeneralSummary(rows: SnapshotLine[], id: string) {
  if (!rows.length) return [];
  const host = rows.find(line => line.customerVisible !== false && line.includeInTotal &&
    (line.kind === 'material' || line.kind === 'item'))
    ?? rows.find(line => line.customerVisible !== false && line.includeInTotal && line.pricingMode !== 'none');
  return [safePublicLine({
    id: 'general-summary-' + id, sectionId: id, kind: 'item',
    description: host?.description?.trim() || 'Countertops & included work',
    pricingMode: 'direct', amount: roundCurrency(rows.reduce((sum,line)=>sum+lineTotal(line),0)),
    includeInTotal: true, customerVisible: true,
  })];
}

function safeSectionSpecs(scope: unknown, existing: unknown): string | undefined {
  if(typeof existing==='string')return existing.slice(0,1300).trim()||undefined;
  if(!scope || typeof scope!=='object')return undefined;
  const obj=scope as Record<string,unknown>;
  const material=typeof obj.takeoffMaterial==='string'?obj.takeoffMaterial.slice(0,300).trim():'';
  const sinks=Array.isArray(obj.takeoffSinks)?obj.takeoffSinks.slice(0,100):[];
  const descriptors=sinks.filter(s=>s&&typeof s==='object').map(item=>{
    const sink=item as Record<string,unknown>;
    const count=Number(sink.count);
    if(!Number.isInteger(count)||count<1||count>1000)return '';
    const name=typeof sink.name==='string'&&sink.name.trim()?sink.name.trim().slice(0,160):
      sink.category==='vanity'?'Vanity sink':'Kitchen sink';
    return `${count} × ${name}`;
  }).filter(Boolean);
  return [material,...descriptors].filter(Boolean).join(' · ')||undefined;
}

function safePublicSection(
  section: { id?: unknown; title?: unknown; customerVisible?: unknown; customerDisplayMode?: unknown; customerTotal?: unknown; scope?: unknown; specification?: unknown },
  calculatedTotal?: number,
) {
  const customerDisplayMode = section.customerDisplayMode === 'summary' ? 'summary' : 'detail';
  const existingTotal = typeof section.customerTotal === 'number' && Number.isFinite(section.customerTotal)
    ? roundCurrency(section.customerTotal)
    : undefined;
  return {
    id: String(section.id ?? ''),
    title: String(section.title ?? ''),
    customerVisible: Boolean(section.customerVisible),
    customerDisplayMode,
    specification: safeSectionSpecs(section.scope,section.specification),
    customerTotal: customerDisplayMode === 'summary'
      ? roundCurrency(calculatedTotal ?? existingTotal ?? 0)
      : undefined,
  };
}

function safeAcceptedSnapshot(value: unknown) {
  if (!value || typeof value !== 'object') return value;
  const snapshot = value as Record<string, unknown>;
  const allLines = Array.isArray(snapshot.lines) ? snapshot.lines as SnapshotLine[] : [];
  const rawSections = Array.isArray(snapshot.sections)
    ? snapshot.sections as Array<{ id?: unknown; title?: unknown; customerVisible?: unknown; customerDisplayMode?: unknown; customerTotal?: unknown; scope?: unknown; specification?: unknown }>
    : [];
  const summarySectionIds = new Set(rawSections
    .filter((section) => section.customerDisplayMode === 'summary')
    .map((section) => String(section.id ?? '')));
  const hiddenSectionIds = new Set(rawSections
    .filter((section) => section.customerVisible === false)
    .map((section) => String(section.id ?? '')));
  // Accepted snapshots are already customer-safe; do not reprice or expose hidden
  // original rows here. Kept separate for compatibility with older signatures.
  const lines = allLines.filter(line => {
    const sectionId=String(line.sectionId??'');
    return line?.customerVisible !== false
      && !summarySectionIds.has(sectionId)
      && !hiddenSectionIds.has(sectionId);
  }).map(safePublicLine);

  const sections = rawSections
    .filter((section) => section.customerVisible !== false)
    .map((section) => {
      const id = String(section.id ?? '');
      const sectionLines = allLines.filter((line) => String(line.sectionId ?? '') === id);
      const sectionTotal = sectionLines.length
        ? sectionLines.reduce((sum, line) => sum + lineTotal(line), 0)
        : undefined;
      return safePublicSection(section, sectionTotal);
    });
  const {
    projectId: _projectId,
    companyId: _companyId,
    contactId: _contactId,
    projectMaterials: _privateProjectMaterials,
    ...publicSnapshot
  } = snapshot;
  return { ...publicSnapshot, sections, lines };
}


/** Customer-safe allowlist only. Never send raw geometry, hole spread, source
 * supplier costs, or internal variant references to a public quote visitor. */
function publicCustomerSelections(snapshot: Snapshot) {
  if (!snapshot.attachSelectionsSheet) return [];
  return (snapshot.sections??[]).filter(section=>section.customerVisible).map(section=>{
    const scope=section.scope&&typeof section.scope==='object'
      ?section.scope as Record<string,unknown>:{};
    const ref=scope.takeoffMaterialReference&&typeof scope.takeoffMaterialReference==='object'
      ?scope.takeoffMaterialReference as Record<string,unknown>:{};
    const variant=ref.snapshot&&typeof ref.snapshot==='object'
      ?ref.snapshot as Record<string,unknown>:{};
    const label=(value:unknown,limit=160)=>typeof value==='string'
      ?value.trim().slice(0,limit):'';
    const material=[label(scope.takeoffMaterial,300),label(variant.thickness),
      label(variant.finish)].filter(Boolean).join(' · ');
    const sinkModels=Array.isArray(scope.takeoffSinks)
      ?scope.takeoffSinks.slice(0,100).map(value=>{
        if(!value||typeof value!=='object')return '';
        const sink=value as Record<string,unknown>;
        const qty=Number(sink.count);
        return Number.isInteger(qty)&&qty>0&&qty<=1000
          ?qty+' × '+(label(sink.name)||'Sink'):'';
      }).filter(Boolean):[];
    const pieces=Array.isArray(scope.takeoffPieces)?scope.takeoffPieces.slice(0,500):[];
    const edgeProfiles=new Set<string>();
    const splashHeights=new Set<string>();
    for(const value of pieces) {
      if(!value||typeof value!=='object')continue;
      const piece=value as Record<string,unknown>;
      if(!(Number(piece.count)>0))continue;
      edgeProfiles.add(label(piece.edgeProfile)||label(scope.takeoffDefaultEdgeProfile)||'Flat');
      if(piece.backsplash||piece.leftSplash||piece.rightSplash){
        const n=Number(piece.splashHeightIn??scope.takeoffDefaultSplashHeightIn??4);
        if(Number.isFinite(n)&&n>=0&&n<=120)splashHeights.add(n+'″');
      }
    }
    if(!edgeProfiles.size&&label(scope.takeoffDefaultEdgeProfile))edgeProfiles.add(label(scope.takeoffDefaultEdgeProfile));
    const defaultSplash=scope.takeoffDefaultSplashHeightIn;
    if(!splashHeights.size&&typeof defaultSplash==='number'&&Number.isFinite(defaultSplash))
      splashHeights.add(defaultSplash+'″ default');
    return {id:section.id,area:isGeneralTakeoffsTitle(section)?'General':label(section.title),
      material:material||undefined,sinkModels,edgeProfiles:[...edgeProfiles],splashHeights:[...splashHeights]};
  }).filter(row=>row.material||row.sinkModels.length||row.edgeProfiles.length||row.splashHeights.length);
}

function buildSafeQuote(snapshot: Snapshot, baseQuoteNumber: string, documentType: string) {
  const allLines = Array.isArray(snapshot.lines) ? snapshot.lines : [];
  const calculatedTotal = roundCurrency(allLines.reduce((sum, line) => sum + lineTotal(line), 0));
  const total = typeof snapshot.customerTotal === 'number' && Number.isFinite(snapshot.customerTotal)
    ? roundCurrency(snapshot.customerTotal)
    : calculatedTotal;
  const revision = Number(snapshot.revision) || 0;
  const quoteNumber = revision > 0 ? `${baseQuoteNumber}-R${revision}` : baseQuoteNumber;
  const customerItems = Array.isArray(snapshot.pricingSchedule?.customerItems)
    ? snapshot.pricingSchedule.customerItems
    : [];
  return {
    quoteId: '',
    quoteNumber,
    documentType,
    revision,
    revisionLabel: snapshot.label,
    quoteDate: snapshot.quoteDate,
    title: snapshot.title,
    companyName: snapshot.companyName,
    contactName: snapshot.contactName,
    contactEmail: snapshot.contactEmail,
    address: snapshot.address,
    sections: (snapshot.sections ?? []).filter(section => section.customerVisible).map(section => {
      const sectionTotal = allLines.filter(line => line.sectionId === section.id)
        .reduce((sum,line) => sum + lineTotal(line), 0);
      const general=isGeneralTakeoffsTitle(section);
      return safePublicSection(general
        ? { ...section, customerDisplayMode: 'detail', scope: undefined, specification: undefined }
        : section, sectionTotal);
    }),
    lines: [
      ...publicItemizedLines(allLines.filter(line=>!line.sectionId ||
        !(snapshot.sections??[]).some(section=>section.id===line.sectionId))),
      ...(snapshot.sections ?? []).filter(section=>section.customerVisible).flatMap(section=>{
        const rows=allLines.filter(line=>line.sectionId===section.id);
        const general=isGeneralTakeoffsTitle(section);
        if (section.customerDisplayMode === 'summary') {
          return general ? publicGeneralSummary(rows,section.id) : [];
        }
        return publicItemizedLines(rows,section.id);
      }),
    ],
    customerColumns: snapshot.customerColumns ?? { quantity: false, rate: false, lineAmount: true },
    customerNotes: snapshot.customerNotes ?? '',
    selections: documentType === 'pricing-schedule' ? [] : publicCustomerSelections(snapshot),
    pricingSchedule: documentType === 'pricing-schedule' ? { customerItems } : undefined,
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
    acceptedSnapshot: safeAcceptedSnapshot(row.accepted_snapshot),
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

    const { data: share, error: shareError } = await admin.from('quote_shares').select('*').eq('public_token', body.token).maybeSingle();
    if (shareError) throw shareError;
    if (!share) return json({ error: 'This document link is not valid.' }, 404);
    if (share.status === 'revoked') return json({ error: 'This document link has been revoked.' }, 410);
    if (share.expires_at && new Date(share.expires_at).getTime() < Date.now() && share.status !== 'signed') return json({ error: 'This document link has expired.' }, 410);

    const [revisionResult, quoteResult, orgResult, signatureResult] = await Promise.all([
      admin.from('quote_revisions').select('snapshot').eq('organization_id', share.organization_id).eq('quote_id', share.quote_id).eq('revision', share.revision).single(),
      admin.from('quotes').select('*').eq('organization_id', share.organization_id).eq('id', share.quote_id).single(),
      admin.from('organizations').select('name,address,phone,email,website,logo_url,quote_contact_name,quote_contact_phone').eq('id', share.organization_id).single(),
      admin.from('signatures').select('*').eq('organization_id', share.organization_id).eq('quote_id', share.quote_id).eq('revision', share.revision).maybeSingle(),
    ]);
    if (revisionResult.error) throw revisionResult.error;
    if (quoteResult.error) throw quoteResult.error;
    if (orgResult.error) throw orgResult.error;
    if (signatureResult.error) throw signatureResult.error;

    if (quoteResult.data.archived_at && share.status !== 'signed') {
      return json({ error: 'This document has been archived and is no longer available.' }, 410);
    }

    const documentType = String(quoteResult.data.document_type ?? 'quote');
    const changeOrder = documentType === 'change-order';
    const pricingSchedule = documentType === 'pricing-schedule';
    const documentName = changeOrder ? 'Change Order' : pricingSchedule ? 'Pricing Schedule' : 'Quote';
    const snapshot = revisionResult.data.snapshot as Snapshot;
    const safeQuote = buildSafeQuote(snapshot, String(quoteResult.data.quote_number), documentType);
    safeQuote.quoteId = String(share.quote_id);
    let signature = safeSignature(signatureResult.data as Record<string, unknown> | null);
    const nowIso = new Date().toISOString();

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
      if (method === 'drawn' && !strokes.some((stroke) => Array.isArray(stroke.points) && stroke.points.length > 1)) return json({ error: 'Add a signature or choose Type name.' }, 400);

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
        accepted_snapshot: { ...safeQuote },
      };

      const { data: createdSignature, error: signError } = await admin.from('signatures').insert(signatureRow).select('*').single();
      if (signError) {
        if (signError.code === '23505') {
          const { data: existing } = await admin.from('signatures').select('*').eq('organization_id', share.organization_id).eq('quote_id', share.quote_id).eq('revision', share.revision).single();
          signature = safeSignature(existing as Record<string, unknown>);
        } else throw signError;
      } else signature = safeSignature(createdSignature as Record<string, unknown>);

      await admin.from('quote_shares').update({ status: 'signed', signed_at: nowIso, last_viewed_at: nowIso })
        .eq('organization_id', share.organization_id).eq('id', share.id);
      if (Number(quoteResult.data.revision) === Number(share.revision)) {
        await admin.from('quotes').update({ status: 'Signed', signed_at: nowIso, updated_at: nowIso })
          .eq('organization_id', share.organization_id).eq('id', share.quote_id);
      }

      let projectStageChanged = false;
      let previousStage: string | null = null;
      if (quoteResult.data.project_id) {
        const { data: project } = await admin.from('projects').select('id, name, stage').eq('organization_id', share.organization_id).eq('id', quoteResult.data.project_id).maybeSingle();
        if (project) {
          if (changeOrder) {
            const { error: touchError } = await admin.from('projects').update({ last_touchpoint: nowIso.slice(0, 10), updated_at: nowIso })
              .eq('organization_id', share.organization_id).eq('id', project.id);
            if (touchError) throw touchError;
          } else if (project.stage !== 'Closed Won' && project.stage !== 'Completed') {
            previousStage = String(project.stage);
            const projectUpdate: Record<string, unknown> = {
              stage: 'Closed Won',
              stage_changed_at: nowIso,
              last_touchpoint: nowIso.slice(0, 10),
              updated_at: nowIso,
            };
            if (!pricingSchedule) projectUpdate.amount = safeQuote.acceptedTotal;
            const { error: projectError } = await admin.from('projects').update(projectUpdate)
              .eq('organization_id', share.organization_id).eq('id', project.id);
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

      const valueText = pricingSchedule
        ? ''
        : ` · ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(safeQuote.acceptedTotal)}`;
      await admin.from('activities').insert({
        organization_id: share.organization_id,
        id: `activity_${crypto.randomUUID()}`,
        type: changeOrder ? 'change-order-signed' : 'quote-signed',
        summary: `${documentName} ${safeQuote.quoteNumber} signed${valueText}`,
        project_id: quoteResult.data.project_id,
        company_id: quoteResult.data.company_id,
        contact_id: quoteResult.data.contact_id,
        quote_id: share.quote_id,
        occurred_at: nowIso,
        metadata: {
          quoteNumber: safeQuote.quoteNumber,
          revision: share.revision,
          ...(pricingSchedule ? {} : { amount: safeQuote.acceptedTotal }),
          documentType,
          parentQuoteId: quoteResult.data.parent_quote_id,
          projectStageChanged,
        },
      });
    }

    const organization = {
      name: String(orgResult.data.name),
      address: orgResult.data.address ? String(orgResult.data.address) : undefined,
      phone: orgResult.data.phone ? String(orgResult.data.phone) : undefined,
      email: orgResult.data.email ? String(orgResult.data.email) : undefined,
      website: orgResult.data.website ? String(orgResult.data.website) : undefined,
      logoUrl: orgResult.data.logo_url ? String(orgResult.data.logo_url) : undefined,
      contactName: orgResult.data.quote_contact_name ? String(orgResult.data.quote_contact_name) : undefined,
      contactPhone: orgResult.data.quote_contact_phone ? String(orgResult.data.quote_contact_phone) : undefined,
    };

    return json({
      organizationName: organization.name,
      organization,
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
