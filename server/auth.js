// Email-code sign-in and sessions. ctx = { db, env, now, mailer }; codes and session
// tokens are stored only as HMAC-SHA256 hashes keyed by env.AUTH_SECRET.
// Each check that could race is one SQL statement (no transactions: Neon HTTP driver).
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { HttpError, normalizeEmail, roleOf } from './access.js';

const MINUTE = 60 * 1000;
const CODE_LIFETIME = 10 * MINUTE;
const MAX_ATTEMPTS = 5;
const SEND_WINDOW = 15 * MINUTE;
const MAX_SENDS = 3;
export const SESSION_DAYS = 30;
const SESSION_LIFETIME = SESSION_DAYS * 24 * 60 * MINUTE;

const SENT_MESSAGE = 'If this email can edit the deck, a code is on its way.';
const TOO_MANY_MESSAGE = 'Too many codes. Try again in a few minutes.';
const EXPIRED_MESSAGE = 'Code expired. Request a new one.';
const WRONG_MESSAGE = "That code isn't right. Try again.";

function hash(ctx, value) {
  const secret = ctx.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set.');
  return createHmac('sha256', secret).update(value).digest('hex');
}

const later = (ctx, ms) => new Date(ctx.now().getTime() + ms).toISOString();

function cleanEmail(email) {
  const clean = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new HttpError(400, 'Enter a valid email address.');
  return clean;
}

/**
 * The same reply for every email, so nobody can probe the editor list. Every email,
 * editor or not, is held to 3 sends per 15 minutes (its send times are kept even
 * without a code), so the 429 reveals nothing either. Only editors and the owner get mail.
 */
export async function requestCode(ctx, { email }) {
  const who = cleanEmail(email);
  const canEdit = (await roleOf(ctx, who)) !== 'none';
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const now = ctx.now().toISOString();
  // One statement: drop send times older than the window, append this one, and set the
  // code, unless the window already holds MAX_SENDS sends (then no row is returned).
  const rows = await ctx.db.query(
    `insert into login_codes as l (email, code_hash, expires_at, attempts, sent_at)
     values ($1, $2, $3, 0, array[$4::timestamptz])
     on conflict (email) do update set
       code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
       sent_at = array(select t from unnest(l.sent_at) t where t > $5::timestamptz) || $4::timestamptz
     where (select count(*) from unnest(l.sent_at) t where t > $5::timestamptz) < $6
     returning email`,
    [who, canEdit ? hash(ctx, `${who}:${code}`) : null, canEdit ? later(ctx, CODE_LIFETIME) : null,
      now, later(ctx, -SEND_WINDOW), MAX_SENDS],
  );
  if (!rows.length) throw new HttpError(429, TOO_MANY_MESSAGE);
  if (canEdit) await ctx.mailer.send(who, code);
  return { message: SENT_MESSAGE };
}

/** A right code ends the login code and starts a 30-day session: { token, email }. */
export async function verifyCode(ctx, { email, code }) {
  const who = normalizeEmail(email);
  const now = ctx.now().toISOString();
  const codeHash = hash(ctx, `${who}:${String(code ?? '').trim()}`);
  // Clearing the code (not the row) keeps the send times, so the rate limit holds.
  const used = await ctx.db.query(
    `update login_codes set code_hash = null, expires_at = null, attempts = 0
     where email = $1 and code_hash = $2 and expires_at > $3 and attempts < $4 returning email`,
    [who, codeHash, now, MAX_ATTEMPTS],
  );
  if (!used.length) {
    const wrong = await ctx.db.query(
      `update login_codes set attempts = attempts + 1,
         code_hash = case when attempts + 1 >= $3 then null else code_hash end,
         expires_at = case when attempts + 1 >= $3 then null else expires_at end
       where email = $1 and code_hash is not null and expires_at > $2 returning attempts`,
      [who, now, MAX_ATTEMPTS],
    );
    if (wrong.length && wrong[0].attempts < MAX_ATTEMPTS) throw new HttpError(400, WRONG_MESSAGE);
    throw new HttpError(400, EXPIRED_MESSAGE);
  }
  const token = randomBytes(32).toString('base64url');
  await ctx.db.query(
    'insert into sessions (token_hash, email, expires_at) values ($1, $2, $3)',
    [hash(ctx, token), who, later(ctx, SESSION_LIFETIME)],
  );
  return { token, email: who };
}

/** The signed-in email for a session token, or null when missing, unknown or expired. */
export async function sessionEmail(ctx, token) {
  if (typeof token !== 'string' || !token) return null;
  const rows = await ctx.db.query(
    'select email from sessions where token_hash = $1 and expires_at > $2',
    [hash(ctx, token), ctx.now().toISOString()],
  );
  return rows[0]?.email ?? null;
}

export async function signOut(ctx, token) {
  if (typeof token !== 'string' || !token) return;
  await ctx.db.query('delete from sessions where token_hash = $1', [hash(ctx, token)]);
}
