import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import {signedOutcome, type SignatureSource} from './projection.ts';

// Read-only, allowlisted operational projection. This endpoint is intentionally
// separate from quotes, quote revisions, and private salesperson CRM records.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function key(name: 'SUPABASE_PUBLISHABLE_KEYS' | 'SUPABASE_SECRET_KEYS', fallback: string) {
  const raw = Deno.env.get(name);
  if (raw) {
    const keys = JSON.parse(raw) as Record<string, string>;
    if (keys.default) return keys.default;
  }
  const legacy = Deno.env.get(fallback);
  if (!legacy) throw new Error('Missing Supabase configuration.');
  return legacy;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const authorization = req.headers.get('Authorization') ?? '';
    const jwt = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!jwt) return json({ error: 'Authentication required.' }, 401);

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const userClient = createClient(url, key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: identity, error: identityError } = await userClient.auth.getUser(jwt);
    if (identityError || !identity.user) return json({ error: 'Invalid session.' }, 401);

    const body = await req.json() as { organizationId?: unknown };
    const organizationId = body?.organizationId;
    if (typeof organizationId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
      return json({ error: 'Invalid workspace.' }, 400);
    }

    const admin = createClient(url, key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify this exact signed-in user belongs to this exact organization.
    // Administrative scope is needed for aggregate operational commitments.
    // A workspace member, salesperson or viewer never gets the organization feed.
    const { data: membership, error: membershipError } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', identity.user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return json({ error: 'Shop outcomes access denied.' }, 403);
    }

    // ONLY immutable accepted signing evidence; never query draft quotes,
    // customer intelligence, quote lines/costs, or generic sales activities.
    const { data: signatures, error: signaturesError } = await admin
      .from('signatures')
      .select('id,quote_id,revision,accepted_at,accepted_snapshot')
      .eq('organization_id', organizationId)
      .order('accepted_at', { ascending: false })
      .limit(100);
    if (signaturesError) throw signaturesError;

    const outcomes = (signatures ?? [])
      .map(row => signedOutcome(row as SignatureSource))
      .filter((row): row is NonNullable<typeof row> => row !== null);
    return json({ outcomes, limit: 100 });
  } catch {
    // Do not echo database errors or payload fragments to the caller.
    return json({ error: 'Could not load shop outcomes.' }, 500);
  }
});
