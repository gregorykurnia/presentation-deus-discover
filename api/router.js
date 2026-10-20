// The one Vercel Node function. vercel.json rewrites /api/:path* -> /api/router?route=:path*.
// It only translates HTTP: every check lives in server/http.js and the modules behind it.
import { createNeonDb } from '../server/db.js';
import { handle, parseCookies } from '../server/http.js';
import { createMailer } from '../server/mailer.js';

const MAX_BODY_BYTES = 5 * 1024 * 1024;
let ctx = null;

/** Built once per instance. createMailer throws in production without RESEND_API_KEY. */
function context() {
  ctx ??= {
    db: createNeonDb(process.env.DATABASE_URL),
    env: process.env,
    mailer: createMailer(process.env),
    now: () => new Date(),
  };
  return ctx;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function send(res, { status, headers, body }) {
  res.statusCode = status;
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(body);
}

export default async function router(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const route = url.searchParams.get('route') ?? '';
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
    if (body === null) {
      return send(res, { status: 413, headers: { 'content-type': 'application/json' }, body: '{"error":"Request is too large."}' });
    }
    return send(res, await handle(context(), {
      method: req.method,
      path: `/api/${route}`,
      headers: req.headers,
      body,
      cookies: parseCookies(req.headers.cookie),
    }));
  } catch (err) {
    console.error('API error:', err);
    return send(res, {
      status: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: '{"error":"Something went wrong. Please try again."}',
    });
  }
}
