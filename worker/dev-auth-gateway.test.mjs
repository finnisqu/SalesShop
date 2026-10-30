import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from './dev-auth-gateway.mjs';

const HOST = 'https://dev.salesshop.work';
const PASSWORD = 'test-only-private-gate-password-xyz';
let assetReads = 0;
function env(password = PASSWORD) {
  assetReads = 0;
  return {
    SALESSHOP_DEV_PASSWORD: password,
    ASSETS: { fetch: async (request) => {
      assetReads++;
      return new Response('private asset ' + new URL(request.url).pathname);
    } }
  };
}
function req(path, opts = {}) { return new Request(new URL(path, HOST), opts); }
function extractCsrf(html) {
  const token = /name="csrf" value="([^"]+)"/.exec(html)?.[1];
  assert.ok(token, 'GET login page must include a CSRF token');
  return token;
}
async function login(environment, supplied = PASSWORD, next = '/', requestHeaders = {}) {
  const loginPage = await worker.fetch(req('/_sales-dev-auth/login?next=' + encodeURIComponent(next)), environment);
  const csrf = extractCsrf(await loginPage.text());
  return worker.fetch(req('/_sales-dev-auth/login?next=' + encodeURIComponent(next), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...requestHeaders },
    body: new URLSearchParams({ password: supplied, csrf }).toString()
  }), environment);
}
function cookie(response) { return response.headers.get('Set-Cookie')?.split(';')[0] || ''; }

test('Wrangler guarantees authentication before every asset', () => {
  const conf = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(conf.main, './worker/auth-gateway.mjs');
  assert.equal(conf.assets.run_worker_first, true);
  assert.equal(conf.assets.binding, 'ASSETS');
  assert.equal(conf.assets.directory, './apps/web/dist');
});
test('missing or weak secret fails closed for HTML and asset paths', async () => {
  for (const secret of [undefined, 'short']) {
    const environment = env(secret);
    if (secret === undefined) delete environment.SALESSHOP_DEV_PASSWORD;
    for (const path of ['/', '/assets/index.js']) {
      const result = await worker.fetch(req(path, { headers: { Accept: 'text/html' } }), environment);
      assert.equal(result.status, 503);
    }
    assert.equal(assetReads, 0);
  }
});
test('anonymous navigation displays login and JS, CSS and other assets return 401', async () => {
  const environment = env();
  const page = await worker.fetch(req('/drawings/123?mode=slab', { headers: { Accept: 'text/html' } }), environment);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Unlock workspace/);
  assert.equal(page.headers.get('Cache-Control'), 'private, no-store, max-age=0');
  for (const path of ['/assets/app.js', '/assets/app.css', '/manifest.json']) {
    const asset = await worker.fetch(req(path, { headers: { Accept: 'text/javascript' } }), environment);
    assert.equal(asset.status, 401);
  }
  assert.equal(assetReads, 0);
});
test('invalid password and wrong-origin login do not unlock the app', async () => {
  const environment = env();
  assert.equal((await login(environment, 'incorrect')).status, 401);
  const crossOrigin = await worker.fetch(req('/_sales-dev-auth/login', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: PASSWORD }).toString()
  }), environment);
  assert.equal(crossOrigin.status, 403);
  const malformedCsrf = await worker.fetch(req('/_sales-dev-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: PASSWORD, csrf: 'forged' }).toString()
  }), environment);
  assert.equal(malformedCsrf.status, 403);
  assert.equal(assetReads, 0);
});
test('correct password sets signed Secure HttpOnly session; assets then load', async () => {
  const environment = env();
  const auth = await login(environment, PASSWORD, '/drawings/123');
  assert.equal(auth.status, 303);
  assert.equal(auth.headers.get('Location'), '/drawings/123');
  assert.match(auth.headers.get('Set-Cookie'), /HttpOnly; SameSite=Lax/);
  assert.match(auth.headers.get('Set-Cookie'), /Secure/);
  const assets = await worker.fetch(req('/assets/app.css', { headers: { Cookie: cookie(auth) } }), environment);
  assert.equal(assets.status, 200);
  assert.match(await assets.text(), /private asset/);
  assert.equal(assetReads, 1);
});
test('tampered and cross-host cookies fail', async () => {
  const environment = env();
  const valid = cookie(await login(environment));
  const forged = valid.replace(/[0-9a-f]$/, c => c === 'a' ? 'b' : 'a');
  const response = await worker.fetch(req('/assets/app.js', { headers: { Cookie: forged } }), environment);
  assert.equal(response.status, 401);
  const crossHost = await worker.fetch(new Request('https://salesshop-dev.example.workers.dev/assets/app.js', {
    headers: { Cookie: valid }
  }), environment);
  assert.equal(crossHost.status, 401);
  assert.equal(assetReads, 0);
});
test('logout confirmation and signed-out cookie', async () => {
  const environment = env();
  const valid = cookie(await login(environment));
  const page = await worker.fetch(req('/_sales-dev-auth/logout', { headers: { Cookie: valid } }), environment);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Sign out of SalesShop DEV/);
  const csrf = extractCsrf(html);
  const out = await worker.fetch(req('/_sales-dev-auth/logout', {
    method: 'POST',
    headers: { Cookie: valid, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrf }).toString()
  }), environment);
  assert.equal(out.status, 303);
  assert.match(out.headers.get('Set-Cookie'), /Max-Age=0/);
});
test('no open redirect from login next parameter', async () => {
  const environment = env();
  for (const unsafe of ['https://evil.example', '//evil.example', '/\\evil.example']) {
    const result = await login(environment, PASSWORD, unsafe);
    assert.equal(result.headers.get('Location'), '/');
  }
});
test('HTTP requests redirect to HTTPS before password entry', async () => {
  const environment = env();
  const result = await worker.fetch(new Request('http://cad.salesshop.work/'), environment);
  assert.equal(result.status, 308);
  assert.equal(result.headers.get('location'), 'https://dev.salesshop.work/');
  assert.equal(assetReads, 0);
});

test('landing-page form posts succeed with no Origin and with null Origin', async () => {
  for (const origin of [undefined, 'null']) {
    const environment = env();
    const page = await worker.fetch(req('/', { headers: { Accept: 'text/html' } }), environment);
    const token = extractCsrf(await page.text());
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (origin) headers.Origin = origin;
    const result = await worker.fetch(req('/_sales-dev-auth/login?next=%2F', {
      method: 'POST', headers, body: new URLSearchParams({ password: PASSWORD, csrf: token }).toString()
    }), environment);
    assert.equal(result.status, 303);
    assert.match(result.headers.get('Set-Cookie'), /HttpOnly/);
  }
});
test('missing, forged, and cross-host login form tokens are forbidden', async () => {
  const environment = env();
  const token = extractCsrf(await (await worker.fetch(req('/_sales-dev-auth/login'), environment)).text());
  const base = { 'Content-Type': 'application/x-www-form-urlencoded' };
  for (const csrf of ['', token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')]) {
    const response = await worker.fetch(req('/_sales-dev-auth/login', {
      method: 'POST', headers: base, body: new URLSearchParams({ password: PASSWORD, csrf }).toString()
    }), environment);
    assert.equal(response.status, 403);
  }
  const otherHost = await worker.fetch(new Request('https://other.example.workers.dev/_sales-dev-auth/login', {
    method: 'POST', headers: base, body: new URLSearchParams({ password: PASSWORD, csrf: token }).toString()
  }), environment);
  assert.equal(otherHost.status, 403);
});
test('logout requires form token, not only a session', async () => {
  const environment = env();
  const valid = cookie(await login(environment));
  const response = await worker.fetch(req('/_sales-dev-auth/logout', {
    method: 'POST', headers: { Cookie: valid, 'Content-Type': 'application/x-www-form-urlencoded' }, body: ''
  }), environment);
  assert.equal(response.status, 403);
});
