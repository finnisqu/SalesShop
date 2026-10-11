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

function invitationEmail(company: string, role: 'admin' | 'member' | 'viewer', link: string, email: string, jobFunction: string) {
  const name = escapeHtml(company);
  const safeLink = escapeHtml(link);
  const safeRecipient = escapeHtml(email);
  const roleText = role === 'admin' ? 'administrator' : role === 'viewer' ? 'read-only viewer' : 'team member';
  const departments: Record<string,string> = { general: 'General member', salesperson: 'Salesperson', estimator: 'Estimator', purchasing: 'Purchasing', project_manager: 'Project Manager' };
  const departmentLabel = role === 'member' ? departments[jobFunction] ?? departments.general : null;
  return {
    subject: `${company} invited you to SalesShop`, 
    text: `The ${company} team invited ${email} to join its existing SalesShop workspace as a ${roleText}${departmentLabel ? ` (${departmentLabel})` : ''}.\n\nJoin the workspace using this private link:\n${link}\n\nThe invitation expires in seven days. Sign in or register with the invited email address. This message was sent because a workspace administrator invited you; if you didn't expect it, you can safely ignore it.`,
    html: `<!doctype html><html><body style="margin:0;padding:38px 16px;background:#f3f0e7;font-family:Arial,Helvetica,sans-serif;color:#2b2e27">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:540px;margin:0 auto;background:#fffdf6;border:1px solid #e2dccb;border-radius:8px">
    <tr><td style="padding:32px 32px 16px;border-bottom:1px solid #e8e3d5"><span style="display:inline-block;background:#2b3029;color:white;border-radius:5px;padding:8px 11px;font-weight:bold">S</span><span style="font-size:17px;font-weight:bold;margin-left:10px">SalesShop</span></td></tr>
    <tr><td style="padding:30px 32px 36px"><div style="text-transform:uppercase;letter-spacing:1.3px;font-size:11px;color:#8f8166;font-weight:bold">Team invitation</div>
    <h1 style="font-size:25px;font-weight:600;line-height:1.3;margin:16px 0">${name} invited you to SalesShop</h1>
    <p style="font-size:15px;line-height:1.65;color:#5a5b53">The ${name} team invited you to collaborate as a ${roleText}${departmentLabel ? ` (${departmentLabel})` : ''} in its existing SalesShop workspace.</p>
    <a href="${safeLink}" style="display:inline-block;padding:13px 20px;margin:16px 0 22px;background:#30392f;border-radius:5px;color:white;text-decoration:none;font-weight:bold;font-size:14px">Join ${name}</a>
    <p style="font-size:12px;line-height:1.6;color:#77776e">Sent to ${safeRecipient} at the request of your team's SalesShop administrator. This invitation expires in seven days. Sign in or register using that email address. If you weren't expecting this message, you can ignore it.</p>
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
      organizationId?: unknown; email?: unknown; role?: unknown; jobFunction?: unknown;
    } | null;
    const organizationId = typeof input?.organizationId === 'string' ? input.organizationId : '';
    const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
    const role = input?.role;
    const jobFunction = role === 'member' && typeof input?.jobFunction === 'string' ? input.jobFunction : 'general';
    if (!/^[a-f0-9-]{36}$/i.test(organizationId) || email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (role !== 'member' && role !== 'admin' && role !== 'viewer')
      || !['general','salesperson','estimator','purchasing','project_manager'].includes(jobFunction)) {
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
    const { data: rows, error: inviteError } = await db.rpc('create_team_invite_with_department', {
      target_organization: organizationId,
      target_email: email,
      target_role: role,
      target_job_function: jobFunction,
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
    const content = invitationEmail(company, role, link, email, jobFunction);
    let sent = false;
    let providerMessageId: string | null = null;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: FROM_EMAIL, to: [email], ...content }),
      });
      const providerResult = await response.json().catch(() => null) as { id?: string; message?: string } | null;
      sent = response.ok;
      if (sent) providerMessageId = typeof providerResult?.id === 'string' ? providerResult.id : null;
      else console.error('Resend rejected invitation submission', response.status, providerResult?.message ?? 'no error details');
    } catch (error) {
      console.error('Resend invitation network error', error instanceof Error ? error.message : 'unknown');
    }
    // If Resend rejects an email, the admin still receives this one-time link
    // to deliver manually; no confidential API credentials leave this function.
    return json(request, {
      sent, email, expiresAt: invitation.expires_at, providerMessageId,
      ...(!sent ? { invitationUrl: link, error: 'Email could not be delivered. Copy and share the invitation link instead.' } : {}),
    });
  } catch (error) {
    console.error('Team invitation operation failed', error instanceof Error ? error.message : 'unknown');
    return json(request, { error: 'Could not send the invitation. Please try again.' }, 500);
  }
});
