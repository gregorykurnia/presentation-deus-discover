// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryDb, migrate } from '../../server/db.js';
import { handle, parseCookies } from '../../server/http.js';
import { createMailer } from '../../server/mailer.js';
import { handleBlobUpload, uploadRules } from '../../server/upload.js';

const OWNER = 'gregory.kurnia@deushcs.com';
const EDITOR = 'thania.ferdinanto@deushcs.com';
const STRANGER = 'stranger@example.com';
const MB = 1024 * 1024;

let db;
let ctx;
let mail;
let logged;
let blobCalls;

beforeAll(async () => {
  db = await createMemoryDb(); // shared: PGlite takes a couple of seconds to start
});

beforeEach(async () => {
  for (const table of ['login_codes', 'sessions', 'editors', 'draft']) await db.query(`delete from ${table}`);
  await db.query('drop table versions'); // its trigger blocks delete; migrate makes it again
  await migrate(db);
  await db.query('insert into editors (email) values ($1)', [EDITOR]);
  mail = [];
  logged = [];
  blobCalls = [];
  ctx = {
    db,
    env: { OWNER_EMAIL: OWNER, AUTH_SECRET: 'test-secret', BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_test' },
    now: () => new Date('2026-10-20T10:00:00Z'),
    mailer: { send: async (to, code) => { mail.push({ to, code }); } },
    blob: {
      handleUpload: async (options) => {
        blobCalls.push(options);
        const { pathname, clientPayload } = options.body.payload;
        const rules = await options.onBeforeGenerateToken(pathname, clientPayload, false);
        return { type: options.body.type, clientToken: 'fake-token', rules };
      },
    },
    log: (...args) => logged.push(args),
  };
});

/** A request as the router and the dev plugin pass it: JSON, from the site itself. */
function call(method, path, { body, cookies = {}, headers = {} } = {}) {
  return handle(ctx, {
    method,
    path,
    headers: { host: 'deck.vercel.app', 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    cookies,
  }).then((res) => ({ ...res, json: res.body ? JSON.parse(res.body) : null }));
}

async function signIn(email, headers = {}) {
  await call('POST', '/api/auth/request-code', { body: { email }, headers });
  const { code } = mail.at(-1);
  const res = await call('POST', '/api/auth/verify', { body: { email, code }, headers });
  expect(res.status).toBe(200);
  const token = /deus_session=([^;]+)/.exec(res.headers['set-cookie'])[1];
  return { res, cookies: { deus_session: token } };
}

describe('CSRF', () => {
  it('a state-changing request must be JSON from the site', async () => {
    const plain = await call('POST', '/api/auth/request-code', {
      body: { email: EDITOR }, headers: { 'content-type': 'text/plain' },
    });
    expect(plain.status).toBe(403);
    const evil = await call('POST', '/api/auth/request-code', {
      body: { email: EDITOR }, headers: { origin: 'https://evil.example' },
    });
    expect(evil.status).toBe(403);
    expect(mail).toHaveLength(0);
    const same = await call('POST', '/api/auth/request-code', {
      body: { email: EDITOR }, headers: { origin: 'https://deck.vercel.app', 'content-type': 'application/json; charset=utf-8' },
    });
    expect(same.status).toBe(200);
    expect(same.json).toEqual({ message: 'If this email can edit the deck, a code is on its way.' });
  });
});

describe('session cookie', () => {
  it('is HttpOnly, SameSite=Lax, Path=/, 30 days, Secure except on localhost', async () => {
    const { res } = await signIn(EDITOR);
    const cookie = res.headers['set-cookie'];
    for (const flag of ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=2592000', 'Secure']) expect(cookie).toContain(flag);
    expect(res.json).toEqual({ email: EDITOR, role: 'editor' });
    expect(res.body).not.toContain(/deus_session=([^;]+)/.exec(cookie)[1]); // the token is only in the cookie

    const local = await signIn(OWNER, { host: 'localhost:5181' });
    expect(local.res.headers['set-cookie']).toContain('HttpOnly');
    expect(local.res.headers['set-cookie']).not.toContain('Secure');
  });

  it('/api/me reports the role; sign-out ends the session and clears the cookie', async () => {
    expect((await call('GET', '/api/me')).json).toEqual({ email: null, role: 'none' });
    const { cookies } = await signIn(EDITOR);
    expect((await call('GET', '/api/me', { cookies })).json).toEqual({ email: EDITOR, role: 'editor' });
    const out = await call('POST', '/api/auth/sign-out', { cookies });
    expect(out.status).toBe(200);
    expect(out.headers['set-cookie']).toContain('Max-Age=0');
    expect((await call('GET', '/api/me', { cookies })).json).toEqual({ email: null, role: 'none' });
  });

  it('a removed editor counts as none at once', async () => {
    const { cookies } = await signIn(EDITOR);
    await db.query('delete from editors');
    expect((await call('GET', '/api/me', { cookies })).json).toEqual({ email: EDITOR, role: 'none' });
    expect((await call('GET', '/api/draft', { cookies })).status).toBe(403);
  });

  it('parseCookies reads a Cookie header', () => {
    expect(parseCookies('a=1; deus_session=abc%3D; b')).toEqual({ a: '1', deus_session: 'abc=' });
    expect(parseCookies(undefined)).toEqual({});
  });
});

describe('deck routes', () => {
  it('draft, save, lock, publish, versions, restore and editors', async () => {
    expect((await call('GET', '/api/draft')).status).toBe(401);
    const editor = (await signIn(EDITOR)).cookies;
    const owner = (await signIn(OWNER)).cookies;
    const draft = await call('GET', '/api/draft', { cookies: editor });
    expect(draft.status).toBe(200);
    expect(draft.headers['cache-control']).toBe('no-store');
    const { deck, rev } = draft.json;
    const saved = await call('PUT', '/api/draft', { cookies: editor, body: { deck: { ...deck, title: 'A' }, expectedRev: rev } });
    expect(saved.json).toEqual({ rev: rev + 1 });
    expect((await call('PUT', '/api/draft', { cookies: editor, body: { deck, expectedRev: rev } })).status).toBe(409);

    expect((await call('POST', '/api/lock', { cookies: editor, body: { locked: true } })).status).toBe(403);
    expect((await call('POST', '/api/lock', { cookies: owner, body: { locked: true } })).json).toEqual({ locked: true });
    const locked = await call('POST', '/api/publish', { cookies: editor });
    expect(locked.status).toBe(423);
    expect(locked.json).toEqual({ error: 'Locked by the owner' });
    await call('POST', '/api/lock', { cookies: owner, body: { locked: false } });

    // An empty body (as Node hands over a POST with none) counts as {}.
    const published = await handle(ctx, {
      method: 'POST', path: '/api/publish', headers: { host: 'deck.vercel.app', 'content-type': 'application/json' },
      body: Buffer.alloc(0), cookies: editor,
    });
    expect(JSON.parse(published.body)).toEqual({ version: 1 });
    expect((await call('GET', '/api/versions', { cookies: editor })).json.map((v) => v.n)).toEqual([1]);
    expect((await call('POST', '/api/restore', { cookies: owner, body: { n: 1 } })).json).toEqual({ rev: rev + 2 });

    expect((await call('GET', '/api/editors', { cookies: editor })).status).toBe(403);
    expect((await call('POST', '/api/editors', { cookies: owner, body: { email: 'Audrey.Wijaya@deushcs.com' } })).json)
      .toEqual({ email: 'audrey.wijaya@deushcs.com' });
    expect((await call('GET', '/api/editors', { cookies: owner })).json.map((e) => e.email)).toContain('audrey.wijaya@deushcs.com');
    expect((await call('DELETE', '/api/editors', { cookies: owner, body: { email: 'audrey.wijaya@deushcs.com' } })).json)
      .toEqual({ email: 'audrey.wijaya@deushcs.com' });
  });

  it('published is public and cached: briefly for the latest, forever for a number', async () => {
    const none = await call('GET', '/api/published');
    expect(none.status).toBe(404);
    expect(none.json.error).toBeTruthy();
    const { cookies } = await signIn(EDITOR);
    await call('POST', '/api/publish', { cookies });
    const latest = await call('GET', '/api/published');
    expect(latest.json.version).toBeGreaterThanOrEqual(1);
    expect(latest.headers['cache-control']).toContain('s-maxage=30');
    const first = await call('GET', '/api/published/1');
    expect(first.json.version).toBe(1);
    expect(first.headers['cache-control']).toContain('immutable');
  });

  it('two publishes at once: the loser gets 409, not 500', async () => {
    const { cookies } = await signIn(EDITOR);
    const real = ctx.db;
    ctx.db = {
      query: async (text, params) => {
        if (/insert into versions/.test(text)) throw Object.assign(new Error('duplicate key value'), { code: '23505' });
        return real.query(text, params);
      },
    };
    const res = await call('POST', '/api/publish', { cookies });
    expect(res.status).toBe(409);
    expect(res.json).toEqual({ error: 'Someone else just published. Try again.' });
  });
});

describe('input checks', () => {
  it('rejects wrong types with 400', async () => {
    const owner = (await signIn(OWNER)).cookies;
    const { rev } = (await call('GET', '/api/draft', { cookies: owner })).json;
    const deck = (await call('GET', '/api/draft', { cookies: owner })).json.deck;
    const bad = [
      ['PUT', '/api/draft', { deck, expectedRev: String(rev) }],
      ['PUT', '/api/draft', { deck, expectedRev: 1.5 }],
      ['PUT', '/api/draft', { deck: 'nope', expectedRev: rev }],
      ['POST', '/api/lock', { locked: 'yes' }],
      ['POST', '/api/restore', { n: '1' }],
      ['POST', '/api/editors', { email: ['a@b.com'] }],
      ['DELETE', '/api/editors', {}],
      ['POST', '/api/auth/request-code', { email: 42 }],
      ['POST', '/api/auth/verify', { email: EDITOR, code: 123456 }],
    ];
    for (const [method, path, body] of bad) {
      const res = await call(method, path, { cookies: owner, body });
      expect(res.status, `${method} ${path} ${JSON.stringify(body)}`).toBe(400);
      expect(res.json.error).toBeTruthy();
    }
    expect((await call('GET', '/api/published/abc')).status).toBe(400);
    const broken = await handle(ctx, {
      method: 'POST', path: '/api/lock', headers: { host: 'deck.vercel.app', 'content-type': 'application/json' },
      body: '{not json', cookies: owner,
    });
    expect(broken.status).toBe(400);
  });

  it('unknown routes are 404; unexpected errors are a generic 500, logged', async () => {
    expect((await call('GET', '/api/nope')).status).toBe(404);
    expect((await call('POST', '/api/me')).status).toBe(404);
    const { cookies } = await signIn(EDITOR);
    ctx.db = { query: async () => { throw new Error('connection refused at 10.0.0.1'); } };
    const res = await call('GET', '/api/draft', { cookies });
    expect(res.status).toBe(500);
    expect(res.json).toEqual({ error: 'Something went wrong. Please try again.' });
    expect(res.body).not.toContain('10.0.0.1');
    expect(String(logged[0])).toContain('10.0.0.1');
  });
});

describe('uploads', () => {
  it('rules per kind', () => {
    expect(uploadRules('photo')).toEqual({ allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'], maximumSizeInBytes: 10 * MB });
    expect(uploadRules('video')).toEqual({ allowedContentTypes: ['video/mp4'], maximumSizeInBytes: 200 * MB });
    expect(() => uploadRules('pdf')).toThrow(expect.objectContaining({ status: 400 }));
  });

  const tokenRequest = (pathname, clientPayload) => ({
    headers: {},
    body: { type: 'blob.generate-client-token', payload: { pathname, clientPayload, multipart: false } },
  });

  it('refuses signed-out and non-editors before any token', async () => {
    const request = tokenRequest('decks/deus-pitch/uploads/a.jpg', 'photo');
    await expect(handleBlobUpload(ctx, null, request)).rejects.toMatchObject({ status: 401 });
    await expect(handleBlobUpload(ctx, STRANGER, request)).rejects.toMatchObject({ status: 403 });
    expect(blobCalls).toHaveLength(0);
  });

  it('passes the kind rules, the token and a random suffix to handleUpload', async () => {
    const photo = await handleBlobUpload(ctx, EDITOR, tokenRequest('decks/deus-pitch/uploads/a.jpg', 'photo'));
    expect(photo.rules).toEqual({ ...uploadRules('photo'), addRandomSuffix: true });
    expect(blobCalls[0].token).toBe('vercel_blob_rw_test');
    const video = await handleBlobUpload(ctx, OWNER, tokenRequest('decks/deus-pitch/uploads/b.mp4', 'video'));
    expect(video.rules).toEqual({ ...uploadRules('video'), addRandomSuffix: true });
    await expect(handleBlobUpload(ctx, EDITOR, tokenRequest('decks/deus-pitch/uploads/c.gif', 'gif')))
      .rejects.toMatchObject({ status: 400 });
    await expect(handleBlobUpload(ctx, EDITOR, tokenRequest('other/c.jpg', 'photo')))
      .rejects.toMatchObject({ status: 400 });
    await expect(handleBlobUpload(ctx, EDITOR, tokenRequest('decks/deus-pitch/uploads/../x.jpg', 'photo')))
      .rejects.toMatchObject({ status: 400 });
    await expect(handleBlobUpload(ctx, EDITOR, { headers: {}, body: { type: 'blob.upload-completed', payload: {} } }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('POST /api/upload needs an editor session', async () => {
    const body = tokenRequest('decks/deus-pitch/uploads/a.jpg', 'photo').body;
    expect((await call('POST', '/api/upload', { body })).status).toBe(401);
    const { cookies } = await signIn(EDITOR);
    const res = await call('POST', '/api/upload', { body, cookies });
    expect(res.status).toBe(200);
    expect(res.json.clientToken).toBe('fake-token');
  });

  it('POST /api/upload-local exists only when the dev plugin provides it, and needs a session', async () => {
    const bytes = Buffer.from('fake png');
    const local = (cookies) => handle(ctx, {
      method: 'POST', path: '/api/upload-local', headers: { host: 'localhost:5181', 'content-type': 'image/png' },
      body: bytes, cookies,
    });
    expect((await local({})).status).toBe(404);
    const saved = [];
    ctx.localUpload = (data, type) => { saved.push([data, type]); return { status: 200, json: { src: 'assets/uploads/x.png' } }; };
    expect((await local({})).status).toBe(401);
    const { cookies } = await signIn(EDITOR);
    const res = await local(cookies);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ src: 'assets/uploads/x.png' });
    expect(saved).toEqual([[bytes, 'image/png']]);
  });
});

describe('mailer', () => {
  let dir;
  afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  it('refuses production without a Resend key', () => {
    expect(() => createMailer({ NODE_ENV: 'production' })).toThrow(/RESEND_API_KEY/);
  });

  it('prints the code locally, and appends it to MAIL_LOG when set', async () => {
    dir = mkdtempSync(join(tmpdir(), 'deus-mail-'));
    const file = join(dir, 'mail.log');
    const lines = [];
    const mailer = createMailer({ MAIL_LOG: file }, (line) => lines.push(line));
    await mailer.send('x@y.com', '123456');
    await mailer.send('a@b.com', '654321');
    expect(lines).toEqual(['Login code for x@y.com: 123456', 'Login code for a@b.com: 654321']);
    expect(readFileSync(file, 'utf8')).toBe('x@y.com 123456\na@b.com 654321\n');
  });

  it('sends through Resend when a key is set', async () => {
    const requests = [];
    const fakeFetch = async (url, init) => { requests.push({ url, init }); return { ok: true, status: 200 }; };
    const mailer = createMailer({ RESEND_API_KEY: 're_test', MAIL_FROM: 'DEUS Deck <deck@deushcs.com>', NODE_ENV: 'production' }, () => {}, fakeFetch);
    await mailer.send('x@y.com', '123456');
    expect(requests[0].url).toBe('https://api.resend.com/emails');
    expect(requests[0].init.headers.authorization).toBe('Bearer re_test');
    const sent = JSON.parse(requests[0].init.body);
    expect(sent).toMatchObject({ from: 'DEUS Deck <deck@deushcs.com>', to: ['x@y.com'] });
    expect(sent.text).toContain('123456');
    const failing = createMailer({ RESEND_API_KEY: 're_test', MAIL_FROM: 'a@b.com' }, () => {}, async () => ({ ok: false, status: 422, text: async () => 'bad' }));
    await expect(failing.send('x@y.com', '1')).rejects.toThrow();
  });
});
