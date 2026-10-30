/**
 * Private SalesShop DEV shared-password gateway, adapted from the existing app gateway. Not user auth or a replacement for
 * future SalesShop/Supabase identity, roles or rate limiting.
 * run_worker_first MUST remain true for every asset.
 */
const COOKIE = '__Host_salesshop_dev_session';
const TTL = 12 * 60 * 60;
const FLAGS = 'Path=/; Secure; HttpOnly; SameSite=Lax';
const enc = new TextEncoder();

function headers(extra = {}) {
  return {
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    ...extra,
  };
}
function nextPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') ||
      value.startsWith('//') || value.includes('\\') || value.length > 2048) return '/';
  return value;
}
function hex(bytes) {
  return Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
}
function equal(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; ++i) difference |= a[i] ^ b[i];
  return difference === 0;
}
async function samePassword(candidate, configured) {
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(candidate)),
    crypto.subtle.digest('SHA-256', enc.encode(configured)),
  ]);
  return equal(new Uint8Array(a), new Uint8Array(b));
}
async function sign(password, hostname, payload) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return hex(new Uint8Array(await crypto.subtle.sign(
    'HMAC', key, enc.encode('salesshop-dev-session:v1:' + hostname + ':' + payload)
  )));
}
async function newToken(password, hostname) {
  const payload = 'v1.' + (Date.now() + TTL * 1000) + '.' + hex(crypto.getRandomValues(new Uint8Array(16)));
  return payload + '.' + await sign(password, hostname, payload);
}
const FORM_TTL_MS = 15 * 60 * 1000;
async function issueFormToken(password, hostname, action) {
  const payload = 'v1.' + (Date.now() + FORM_TTL_MS) + '.' + hex(crypto.getRandomValues(new Uint8Array(16)));
  return payload + '.' + await sign(password, hostname, 'form:' + action + ':' + payload);
}
async function verifyFormToken(raw, password, hostname, action) {
  if (typeof raw !== 'string' || raw.length > 256) return false;
  const match = /^v1\.(\d{13})\.([0-9a-f]{32})\.([0-9a-f]{64})$/.exec(raw);
  if (!match) return false;
  const expiry = Number(match[1]), now = Date.now();
  if (expiry <= now || expiry > now + FORM_TTL_MS + 60000) return false;
  const payload = 'v1.' + match[1] + '.' + match[2];
  const expected = await sign(password, hostname, 'form:' + action + ':' + payload);
  return equal(enc.encode(match[3]), enc.encode(expected));
}
function cookieFrom(request) {
  const value = request.headers.get('Cookie') || '';
  for (const part of value.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(COOKIE + '=')) return trimmed.slice(COOKIE.length + 1);
  }
  return null;
}
async function authorized(request, password, hostname) {
  const token = cookieFrom(request);
  if (!token || token.length > 256) return false;
  const match = /^v1\.(\d{13})\.([0-9a-f]{32})\.([0-9a-f]{64})$/.exec(token);
  if (!match) return false;
  const expiry = Number(match[1]), now = Date.now();
  if (expiry <= now || expiry > now + TTL * 1000 + 60000) return false;
  const payload = 'v1.' + match[1] + '.' + match[2];
  return equal(enc.encode(match[3]), enc.encode(await sign(password, hostname, payload)));
}
function loginHTML(next = '/', failed = false, signedOut = false, csrf = '') {
  const target = '/_sales-dev-auth/login?next=' + encodeURIComponent(nextPath(next));
  const message = failed
    ? '<p class="notice bad" role="alert">Incorrect password. Try again.</p>'
    : signedOut ? '<p class="notice" role="status">Signed out successfully.</p>' : '';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow,noarchive">' +
    '<title>SalesShop DEV · Sign in</title><style>' +
    ':root{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#172235}' +
    '*{box-sizing:border-box}body{margin:0;min-height:100vh;min-height:100dvh;' +
    'background:#f0f3f8;display:grid;place-items:center;padding:20px}' +
    'main{background:#fff;border:1px solid #dce3ee;border-radius:18px;' +
    'padding:32px;width:min(100%,400px);box-shadow:0 16px 50px #17223513}' +
    'h1{font-size:24px;margin:20px 0 8px}p{font-size:14px;color:#58687c;line-height:1.5}' +
    '.mark{background:#3f56db;color:#fff;display:grid;place-items:center;' +
    'width:44px;height:44px;border-radius:12px;font-size:20px;font-weight:800}' +
    'label{display:block;font-weight:600;font-size:13px;margin:24px 0 8px}' +
    'input{display:block;width:100%;padding:12px;border-radius:9px;border:1px solid #aebbcf;font:inherit;font-size:16px}' +
    'input:focus{outline:3px solid #adc1ff;outline-offset:1px}' +
    'button{width:100%;margin-top:16px;border:0;border-radius:9px;padding:13px;' +
    'font:inherit;font-weight:700;background:#344bd1;color:white;cursor:pointer}' +
    'button:hover{background:#243ab6}small{display:block;margin-top:25px;color:#72839a}' +
    '.notice{background:#eef2ff;padding:10px;border-radius:8px}' +
    '.bad{background:#fff0f0;color:#9b1c29}' +
    '</style></head><body><main><div class="mark" aria-hidden="true">C</div>' +
    '<h1>SalesShop DEV</h1><p>Private development workspace. Enter its password to continue.</p>' +
    message + '<form method="post" action="' + target + '">' +
    '<input type="hidden" name="csrf" value="' + csrf + '">' +
    '<label for="password">Workspace password</label>' +
    '<input id="password" name="password" type="password" autocomplete="current-password" required autofocus maxlength="512">' +
    '<button type="submit">Unlock workspace</button></form>' +
    '<small>Separate from SalesShop DEV Classic and SalesShop.</small></main></body></html>';
}
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status, headers: headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    })
  });
}
function redirect(location, cookie) {
  const h = new Headers(headers({ Location: location }));
  if (cookie) h.set('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers: h });
}
function isFormPost(request) {
  return (request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/x-www-form-urlencoded');
}
// CSRF is enforced with a host-bound, short-lived HMAC in every POST form.
// Browser Origin headers are not reliable for normal form navigation (they
// may be absent or "null"); an unforgeable form token is the security boundary.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      const secure = new URL(url);
      secure.protocol = 'https:';
      return new Response(null, { status: 308, headers: headers({ Location: secure.href }) });
    }
    const password = env.SALESSHOP_DEV_PASSWORD;
    // NEVER serve a static asset unless the secret is installed and strong.
    if (typeof password !== 'string' || password.length < 16) {
      return new Response('This workspace is temporarily unavailable.', {
        status: 503, headers: headers({ 'Content-Type': 'text/plain; charset=utf-8' })
      });
    }
    const hasSession = await authorized(request, password, url.hostname);
    const next = nextPath(url.searchParams.get('next'));
    if (url.pathname === '/_sales-dev-auth/login') {
      if (request.method === 'GET') {
        return hasSession ? redirect(next) : htmlResponse(loginHTML(
          next, false, url.searchParams.has('signed-out'),
          await issueFormToken(password, url.hostname, 'login')
        ));
      }
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: headers({ Allow: 'GET, POST' }) });
      }
      if (!isFormPost(request)) return new Response('Forbidden', { status: 403, headers: headers() });
      if (Number(request.headers.get('Content-Length') || 0) > 4096) {
        return new Response('Request too large', { status: 413, headers: headers() });
      }
      const body = await request.text();
      if (body.length > 4096) return new Response('Request too large', { status: 413, headers: headers() });
      const fields = new URLSearchParams(body);
      if (!await verifyFormToken(fields.get('csrf'), password, url.hostname, 'login')) {
        return new Response('Forbidden', { status: 403, headers: headers() });
      }
      const candidate = fields.get('password') || '';
      if (candidate.length <= 512 && await samePassword(candidate, password)) {
        const token = await newToken(password, url.hostname);
        return redirect(next, COOKIE + '=' + token + '; Max-Age=' + TTL + '; ' + FLAGS);
      }
      return htmlResponse(loginHTML(next, true, false, await issueFormToken(password, url.hostname, 'login')), 401);
    }
    if (url.pathname === '/_sales-dev-auth/logout') {
      if (!hasSession) return redirect('/_sales-dev-auth/login');
      if (request.method === 'GET') {
        return htmlResponse('<!doctype html><html lang="en"><meta charset="utf-8"><title>SalesShop DEV Sign out</title>' +
          '<meta name="viewport" content="width=device-width, initial-scale=1"><body style="font:16px system-ui;max-width:440px;margin:80px auto;padding:24px">' +
          '<h1>Sign out of SalesShop DEV?</h1><form action="/_sales-dev-auth/logout" method="post">' +
          '<input type="hidden" name="csrf" value="' + await issueFormToken(password, url.hostname, 'logout') + '">' +
          '<button style="padding:12px 24px;cursor:pointer">Sign out</button></form>' +
          '<p><a href="/">Return to workspace</a></p></body></html>');
      }
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: headers({ Allow: 'GET, POST' }) });
      }
      if (!isFormPost(request)) return new Response('Forbidden', { status: 403, headers: headers() });
      const body = await request.text();
      if (body.length > 4096 || !await verifyFormToken(
        new URLSearchParams(body).get('csrf'), password, url.hostname, 'logout'
      )) return new Response('Forbidden', { status: 403, headers: headers() });
      return redirect('/_sales-dev-auth/login?signed-out=1', COOKIE + '=; Max-Age=0; ' + FLAGS);
    }
    if (!hasSession) {
      const wantsPage = request.method === 'GET' && (request.headers.get('Accept') || '').includes('text/html');
      return wantsPage ? htmlResponse(loginHTML(
        url.pathname + url.search, false, false,
        await issueFormToken(password, url.hostname, 'login')
      )) :
        new Response('Authentication required', {
          status: 401, headers: headers({ 'Content-Type': 'text/plain; charset=utf-8' })
        });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: headers({ Allow: 'GET, HEAD' }) });
    }
    const result = await env.ASSETS.fetch(request);
    const responseHeaders = new Headers(result.headers);
    for (const [key, value] of Object.entries(headers())) responseHeaders.set(key, value);
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers: responseHeaders });
  }
};
