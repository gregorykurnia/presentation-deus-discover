// The HTTP layer shared by the Vercel function (api/router.js) and the dev plugin
// (scripts/lib/dev-api-plugin.js): handle(ctx, request) -> { status, headers, body }.
// request = { method, path, headers, body, cookies }; body is the raw request body
// (string or Buffer) or an already-parsed object; the response body is a JSON string.
// Errors are { error } JSON. Untrusted input is type-checked here, before deck-api.
import { HttpError, requireRole, roleOf } from './access.js';
import { requestCode, SESSION_DAYS, sessionEmail, signOut, verifyCode } from './auth.js';
import * as deck from './deck-api.js';
import { handleBlobUpload } from './upload.js';

export const SESSION_COOKIE = 'deus_session';
const GENERIC_ERROR = 'Something went wrong. Please try again.';
const PUBLISH_RACE = 'Someone else just published. Try again.';
const UNIQUE_VIOLATION = '23505'; // Postgres: two publishes took the same version number

/** "a=1; b=2" -> { a: '1', b: '2' }. */
export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    try { cookies[name] = decodeURIComponent(value); } catch { cookies[name] = value; }
  }
  return cookies;
}

function respond(status, data, headers = {}) {
  return {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
    body: JSON.stringify(data),
  };
}

const headerOf = (headers, name) => {
  const value = headers?.[name];
  return String(Array.isArray(value) ? value[0] : value ?? '');
};

const hostOf = (headers) => headerOf(headers, 'host').toLowerCase();
const isLocalHost = (host) => ['localhost', '127.0.0.1', '[::1]'].includes(host.replace(/:\d+$/, ''));

function sessionCookie(host, token, maxAge) {
  const parts = [`${SESSION_COOKIE}=${token}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${maxAge}`];
  if (!isLocalHost(host)) parts.push('Secure');
  return parts.join('; ');
}

/** State-changing requests must be JSON (except the dev upload) and, when an Origin is sent, from the site. */
function checkCsrf(env, { method, path, headers }) {
  if (method === 'GET' || method === 'HEAD') return;
  const type = headerOf(headers, 'content-type').split(';')[0].trim().toLowerCase();
  if (path !== '/api/upload-local' && type !== 'application/json') {
    throw new HttpError(403, 'Requests must be sent as JSON.');
  }
  const origin = headerOf(headers, 'origin');
  if (!origin) return;
  const allowed = [hostOf(headers)];
  try { if (env.DECK_SITE) allowed.push(new URL(env.DECK_SITE).host); } catch { /* not a URL */ }
  let host = null;
  try { host = new URL(origin).host; } catch { /* "null" or junk */ }
  if (!host || !allowed.includes(host)) throw new HttpError(403, 'This request did not come from the deck site.');
}

function jsonBody(body) {
  if (body == null || body.length === 0) return {}; // '' or an empty Buffer: no body
  if (typeof body === 'string' || body instanceof Uint8Array) {
    const text = typeof body === 'string' ? body : Buffer.from(body).toString('utf8');
    try { body = JSON.parse(text); } catch { throw new HttpError(400, 'The request body is not valid JSON.'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Expected a JSON object.');
  return body;
}

const bad = (message) => { throw new HttpError(400, message); };
const string = (value, name) => (typeof value === 'string' ? value : bad(`${name} must be text.`));
const integer = (value, name) => (Number.isInteger(value) ? value : bad(`${name} must be a whole number.`));
const boolean = (value, name) => (typeof value === 'boolean' ? value : bad(`${name} must be true or false.`));
const object = (value, name) => (value && typeof value === 'object' && !Array.isArray(value) ? value : bad(`${name} must be an object.`));

async function publishOnce(ctx, who) {
  try {
    return await deck.publish(ctx, who);
  } catch (err) {
    if (err?.code === UNIQUE_VIOLATION) throw new HttpError(409, PUBLISH_RACE);
    throw err;
  }
}

/** Route table: 'METHOD /path' -> (ctx, req) -> { status?, data, headers? } */
const ROUTES = {
  'POST /api/auth/request-code': async (ctx, req) => ({
    data: await requestCode(ctx, { email: string(req.json.email, 'email') }),
  }),
  'POST /api/auth/verify': async (ctx, req) => {
    const { token, email } = await verifyCode(ctx, {
      email: string(req.json.email, 'email'), code: string(req.json.code, 'code'),
    });
    return {
      data: { email, role: await roleOf(ctx, email) },
      headers: { 'set-cookie': sessionCookie(hostOf(req.headers), token, SESSION_DAYS * 24 * 60 * 60) },
    };
  },
  'POST /api/auth/sign-out': async (ctx, req) => {
    await signOut(ctx, req.cookies[SESSION_COOKIE]);
    return { data: { ok: true }, headers: { 'set-cookie': sessionCookie(hostOf(req.headers), '', 0) } };
  },
  'GET /api/me': async (ctx, req) => {
    const email = await req.who();
    return { data: { email, role: email ? await roleOf(ctx, email) : 'none' } };
  },
  'GET /api/draft': async (ctx, req) => ({ data: await deck.getDraft(ctx, await req.who()) }),
  'PUT /api/draft': async (ctx, req) => ({
    data: await deck.saveDraft(ctx, await req.who(), {
      deck: object(req.json.deck, 'deck'), expectedRev: integer(req.json.expectedRev, 'expectedRev'),
    }),
  }),
  'POST /api/lock': async (ctx, req) => ({
    data: await deck.setLocked(ctx, await req.who(), { locked: boolean(req.json.locked, 'locked') }),
  }),
  'POST /api/publish': async (ctx, req) => ({ data: await publishOnce(ctx, await req.who()) }),
  'GET /api/versions': async (ctx, req) => ({ data: await deck.listVersions(ctx, await req.who()) }),
  'POST /api/restore': async (ctx, req) => ({
    data: await deck.restore(ctx, await req.who(), { n: integer(req.json.n, 'n') }),
  }),
  'GET /api/published': async (ctx) => ({
    data: await deck.getPublished(ctx, null),
    headers: { 'cache-control': 'public, s-maxage=30' },
  }),
  'GET /api/editors': async (ctx, req) => ({ data: await deck.listEditors(ctx, await req.who()) }),
  'POST /api/editors': async (ctx, req) => ({
    data: await deck.addEditor(ctx, await req.who(), { email: string(req.json.email, 'email') }),
  }),
  'DELETE /api/editors': async (ctx, req) => ({
    data: await deck.removeEditor(ctx, await req.who(), { email: string(req.json.email, 'email') }),
  }),
  'POST /api/upload': async (ctx, req) => ({
    data: await handleBlobUpload(ctx, await req.who(), { headers: req.headers, body: req.json }),
  }),
};

/** GET /api/published/:n — a version never changes, so it may be cached for good. */
async function publishedVersion(ctx, n) {
  if (!/^\d+$/.test(n)) bad('The version must be a whole number.');
  return {
    data: await deck.getPublished(ctx, Number(n)),
    headers: { 'cache-control': 'public, max-age=31536000, s-maxage=31536000, immutable' },
  };
}

/** Dev only (ctx.localUpload from the dev plugin): raw bytes, saved like Phase 2's /__upload. */
async function localUpload(ctx, req) {
  await requireRole(ctx, await req.who());
  if (!(req.body instanceof Uint8Array)) bad('Send the file as the request body.');
  const { status, json } = await ctx.localUpload(req.body, headerOf(req.headers, 'content-type'));
  return { status, data: json };
}

export async function handle(ctx, { method = 'GET', path = '', headers = {}, body, cookies = {} }) {
  method = method.toUpperCase();
  path = path.split('?')[0].replace(/\/+$/, '') || '/';
  try {
    checkCsrf(ctx.env, { method, path, headers });
    let who;
    const req = {
      headers,
      body,
      cookies,
      who: () => (who ??= sessionEmail(ctx, cookies[SESSION_COOKIE])),
    };
    let route = ROUTES[`${method} ${path}`];
    const version = method === 'GET' && /^\/api\/published\/([^/]+)$/.exec(path);
    if (version) route = (c) => publishedVersion(c, version[1]);
    if (path === '/api/upload-local' && method === 'POST' && ctx.localUpload) route = localUpload;
    if (!route) return respond(404, { error: 'Not found.' });
    if (route !== localUpload && method !== 'GET') req.json = jsonBody(body);
    const { status = 200, data, headers: extra } = await route(ctx, req);
    return respond(status, data, extra);
  } catch (err) {
    if (err instanceof HttpError) return respond(err.status, { error: err.message });
    (ctx.log ?? console.error)('API error:', method, path, err);
    return respond(500, { error: GENERIC_ERROR });
  }
}
