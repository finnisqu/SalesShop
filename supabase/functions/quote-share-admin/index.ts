import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function readNamedKey(name: 'SUPABASE_PUBLISHABLE_KEYS' | 'SUPABASE_SECRET_KEYS', legacyName: string) {
  const raw = Deno.env.get(name);
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  const legacy = Deno.env.get(legacyName);
  if (!legacy) throw new Error(`Missing ${name}.`);
  return legacy;
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function publicShare(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: String(row.id),
    quoteId: String(row.quote_id),
    revision: Number(row.revision) || 0,
    token: String(row.public_token),
    status: String(row.status),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    createdAt: String(row.created_at),
    firstViewedAt: row.first_viewed_at ? String(row.first_viewed_at) : null,
    lastViewedAt: row.last_viewed_at ? String(row.last_viewed_at) : null,
    viewCount: Number(row.view_count) || 0,
    signedAt: row.signed_at ? String(row.signed_at) : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const publishableKey = readNamedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
    const secretKey = readNamedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!jwt) return json({ error: 'Authentication required.' }, 401);

    const userClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(jwt);
    if (userError || !userData.user) return json({ error: 'Invalid session.' }, 401);

    const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json() as {
      action?: 'get' | 'create' | 'regenerate' | 'revoke';
      organizationId?: string;
      quoteId?: string;
      revision?: number;
      shareId?: string;
    };
    const { action, organizationId, quoteId } = body;
    if (!action || !organizationId || !quoteId) return json({ error: 'Missing share request fields.' }, 400);

    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!membership) return json({ error: 'Workspace access denied.' }, 403);

    if (action === 'get') {
      let shareQuery = admin
        .from('quote_shares')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('quote_id', quoteId);
      if (body.revision !== undefined) shareQuery = shareQuery.eq('revision', body.revision);
      const { data, error } = await shareQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return json({ share: publicShare(data as Record<string, unknown> | null) });
    }

    if (action === 'revoke') {
      let query = admin.from('quote_shares').update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('organization_id', organizationId).eq('quote_id', quoteId);
      if (body.shareId) query = query.eq('id', body.shareId);
      const { error } = await query.neq('status', 'revoked');
      if (error) throw error;
      return json({ ok: true });
    }

    const { data: quote, error: quoteError } = await admin
      .from('quotes')
      .select('id, revision, status, archived_at')
      .eq('organization_id', organizationId)
      .eq('id', quoteId)
      .maybeSingle();
    if (quoteError) throw quoteError;
    if (!quote) return json({ error: 'Quote not found.' }, 404);
    if (quote.archived_at) return json({ error: 'Archived documents cannot create customer links. Restore the document first.' }, 409);
    const revision = body.revision ?? Number(quote.revision) ?? 0;
    if (revision !== Number(quote.revision)) return json({ error: 'Only the current quote revision can be shared.' }, 409);

    const { data: frozenRevision, error: revisionError } = await admin
      .from('quote_revisions')
      .select('revision')
      .eq('organization_id', organizationId)
      .eq('quote_id', quoteId)
      .eq('revision', revision)
      .maybeSingle();
    if (revisionError) throw revisionError;
    if (!frozenRevision) return json({ error: 'Send this quote first so its customer revision is frozen.' }, 409);

    if (action === 'create') {
      const { data: existing, error: existingError } = await admin
        .from('quote_shares')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('quote_id', quoteId)
        .eq('revision', revision)
        .in('status', ['active', 'signed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return json({ share: publicShare(existing as Record<string, unknown>) });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const { error: revokeError } = await admin.from('quote_shares')
      .update({ status: 'revoked', revoked_at: nowIso })
      .eq('organization_id', organizationId)
      .eq('quote_id', quoteId)
      .neq('status', 'revoked');
    if (revokeError) throw revokeError;

    const { data: signature } = await admin.from('signatures')
      .select('accepted_at')
      .eq('organization_id', organizationId)
      .eq('quote_id', quoteId)
      .eq('revision', revision)
      .maybeSingle();

    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const row = {
      organization_id: organizationId,
      id: `share_${crypto.randomUUID()}`,
      quote_id: quoteId,
      revision,
      public_token: randomToken(),
      status: signature ? 'signed' : 'active',
      expires_at: expires,
      created_by: userData.user.id,
      signed_at: signature?.accepted_at ?? null,
    };
    const { data: created, error: createError } = await admin.from('quote_shares').insert(row).select('*').single();
    if (createError) throw createError;
    return json({ share: publicShare(created as Record<string, unknown>) });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Share operation failed.' }, 500);
  }
});
