import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const APP_ORIGIN = 'https://app.salesshop.work';
const ALLOWED_ORIGINS = new Set([APP_ORIGIN, 'https://finnisqu.github.io']);
const FROM_EMAIL = 'SalesShop <invites@salesshop.work>';

function headersFor(request: Request) {
  const origin = request.headers.get('Origin');
  return {
    ...(origin && ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(request: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headersFor(request), 'Content-Type': 'application/json' },
  });
}

function publishableKey() {
  const configured = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (configured) {
    try {
      const parsed = JSON.parse(configured) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch { /* use legacy key if present */ }
  }
  return Deno.env.get('SUPABASE_ANON_KEY') ?? '';
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function invitationEmail(company: string, role: 'admin' | 'member', link: string) {
  const name = escapeHtml(company);
  const safeLink = escapeHtml(link);
  const roleText = role === 'admin' ? 'administrator' : 'team member';
  return {
    subject: `You're invited to join ${company} on SalesShop`,
    text: `You've been invited to join ${company} as a ${roleText} on SalesShop. Open your private invitation: ${link}\n\nThis link expires in seven days. Use the invited email address to create an account or sign in. If you weren't expecting this invitation, you can ignore this email.`,
    html: `<!doctype html><html><body style="margin:0;padding:38px 16px;background:#f3f0e7;font-family:Arial,Helvetica,sans-serif;color:#2b2e27">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:540px;margin:0 auto;background:#fffdf6;border:1px solid #e2dccb;border-radius:8px">
    <tr><td style="padding:32px 32px 16px;border-bottom:1px solid #e8e3d5"><span style="display:inline-block;background:#2b3029;color:white;border-radius:5px;padding:8px 11px;font-weight:bold">S</span><span style="font-size:17px;font-weight:bold;margin-left:10px">SalesShop</span></td></tr>
    <tr><td style="padding:30px 32px 36px"><div style="text-transform:uppercase;letter-spacing:1.3px;font-size:11px;color:#8f8166;font-weight:bold">Team invitation</div>
    <h1 style="font-size:25px;font-weight:600;line-height:1.3;margin:16px 0">${name} invited you to SalesShop</h1>
    <p style="font-size:15px;line-height:1.65;color:#5a5b53">You've been invited to collaborate as a ${roleText}. Your quotes, contacts, and materials will be available in your team's existing workspace.</p>
    <a href="${safeLink}" style="display:inline-block;padding:13px 20px;margin:16px 0 22px;background:#30392f;border-radius:5px;color:white;text-decoration:none;font-weight:bold;font-size:14px">Join ${name}</a>
    <p style="font-size:12px;line-height:1.6;color:#77776e">The invitation expires in seven days and can only be accepted by the invited, email-verified account. If you already have a SalesShop account, use the sign-in option on the invitation page.</p>
    </td></tr></table>
    <p style="text-align:center;margin:20px auto;font-size:11px;color:#88877f">SalesShop · <a href="${APP_ORIGIN}" style="color:#65745d">app.salesshop.work</a></p>
    </body></html>`,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: headersFor(request) });
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(request, { error: 'Origin not allowed.' }, 403);

  try {
    const authHeader = request.headers.get('Authorization') ?? '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!jwt) return json(request, { error: 'Sign in to send invitations.' }, 401);

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const key = publishableKey();
    if (!url || !key) return json(request, { error: 'Supabase credentials not configured.' }, 503);

    const db = createClient(url, key, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: auth, error: authError } = await db.auth.getUser(jwt);
    if (authError || !auth.user) return json(request, { error: 'Session expired. Please sign in again.' }, 401);

    const input = await request.json().catch(() => null) as {
      organizationId?: unknown; email?: unknown; role?: unknown;
    } | null;
    const organizationId = typeof input?.organizationId === 'string' ? input.organizationId : '';
    const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
    const role = input?.role;
    if (!/^[a-f0-9-]{36}$/i.test(organizationId) || email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (role !== 'member' && role !== 'admin')) {
      return json(request, { error: 'Enter a valid recipient, workspace, and role.' }, 400);
    }

    // Never create an invitation if email delivery is not configured.
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return json(request, {
      error: 'Email delivery needs a RESEND_API_KEY secret in Supabase Edge Functions. Use Create link for now.',
      code: 'EMAIL_NOT_CONFIGURED',
    }, 503);

    // The authenticated caller's role is checked by this SECURITY DEFINER RPC.
    // It also restricts admin invitations to owners and generates a single-use token.
    const { data: rows, error: inviteError } = await db.rpc('create_team_invite', {
      target_organization: organizationId,
      target_email: email,
      target_role: role,
    });
    if (inviteError) return json(request, { error: inviteError.message }, 403);
    const invitation = (rows as Array<{ invite_token: string; expires_at: string }> | null)?.[0];
    if (!invitation?.invite_token || !/^[a-f0-9]{64}$/.test(invitation.invite_token)) {
      return json(request, { error: 'The invitation could not be created.' }, 500);
    }

    const link = `${APP_ORIGIN}/#invite=${invitation.invite_token}`;
    const { data: organization } = await db.from('organizations')
      .select('name').eq('id', organizationId).maybeSingle();
    const company = String(organization?.name ?? 'your team').trim().slice(0, 120) || 'your team';
    const content = invitationEmail(company, role, link);
    let sent = false;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: [email], ...content }),
      });
      sent = response.ok;
      if (!sent) console.error('Resend invitation delivery failed', response.status);
    } catch (error) {
      console.error('Resend invitation network error', error instanceof Error ? error.message : 'unknown');
    }
    // If Resend rejects an email, the admin still receives this one-time link
    // to deliver manually; no confidential API credentials leave this function.
    return json(request, {
      sent, email, expiresAt: invitation.expires_at,
      ...(!sent ? { invitationUrl: link, error: 'Email could not be delivered. Copy and share the invitation link instead.' } : {}),
    });
  } catch (error) {
    console.error('Team invitation operation failed', error instanceof Error ? error.message : 'unknown');
    return json(request, { error: 'Could not send the invitation. Please try again.' }, 500);
  }
});
