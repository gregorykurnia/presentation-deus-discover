// Deck operations. Each is (ctx, who, input) -> result, with ctx = { db, env, now }.
// Anything that could race is one SQL statement; no transactions (Neon HTTP driver).
import seed from '../content/deck.json' with { type: 'json' };
import { validateDeck } from '../src/model.js';
import { CONFLICT_MESSAGE } from '../src/store/errors.js';
import { HttpError, normalizeEmail, requireRole } from './access.js';

const DECK_ID = 'deus-pitch';
const LOCKED_MESSAGE = 'Locked by the owner';

const stamp = (ctx) => ctx.now().toISOString();

/** The first read creates the draft from the bundled deck. */
async function ensureDraft(ctx) {
  await ctx.db.query(
    `insert into draft (id, deck, rev, locked, updated_by, updated_at)
     values ($1, $2::jsonb, 1, false, null, $3) on conflict (id) do nothing`,
    [DECK_ID, JSON.stringify(seed), stamp(ctx)],
  );
}

export async function getDraft(ctx, who) {
  const role = await requireRole(ctx, who);
  await ensureDraft(ctx);
  const [row] = await ctx.db.query('select deck, rev, locked from draft where id = $1', [DECK_ID]);
  return { deck: row.deck, rev: row.rev, locked: row.locked, role };
}

export async function saveDraft(ctx, who, { deck, expectedRev }) {
  await requireRole(ctx, who);
  const errors = validateDeck(deck);
  if (errors.length) throw new HttpError(400, errors.join('; '));
  await ensureDraft(ctx);
  const rows = await ctx.db.query(
    `update draft set deck = $1::jsonb, rev = rev + 1, updated_by = $2, updated_at = $3
     where id = $4 and rev = $5 and not locked returning rev`,
    [JSON.stringify(deck), normalizeEmail(who), stamp(ctx), DECK_ID, expectedRev],
  );
  if (rows.length) return { rev: rows[0].rev };
  await throwLockedOrConflict(ctx);
}

/** After a guarded update matched nothing: say why. */
async function throwLockedOrConflict(ctx) {
  const [row] = await ctx.db.query('select locked from draft where id = $1', [DECK_ID]);
  if (row.locked) throw new HttpError(423, LOCKED_MESSAGE);
  throw new HttpError(409, CONFLICT_MESSAGE);
}

export async function setLocked(ctx, who, { locked }) {
  await requireRole(ctx, who, ['owner']);
  await ensureDraft(ctx);
  await ctx.db.query('update draft set locked = $1 where id = $2', [Boolean(locked), DECK_ID]);
  return { locked: Boolean(locked) };
}

export async function publish(ctx, who) {
  await requireRole(ctx, who);
  await ensureDraft(ctx);
  const rows = await ctx.db.query(
    `insert into versions (deck_id, n, deck, published_by, published_at)
     select d.id, coalesce((select max(n) from versions where deck_id = d.id), 0) + 1,
            d.deck, $2, $3
     from draft d where d.id = $1 and not d.locked returning n`,
    [DECK_ID, normalizeEmail(who), stamp(ctx)],
  );
  if (!rows.length) throw new HttpError(423, LOCKED_MESSAGE);
  return { version: rows[0].n };
}

export async function listVersions(ctx, who) {
  await requireRole(ctx, who);
  const rows = await ctx.db.query(
    'select n, published_by, published_at from versions where deck_id = $1 order by n desc',
    [DECK_ID],
  );
  return rows.map((r) => ({ n: r.n, publishedBy: r.published_by, publishedAt: new Date(r.published_at).toISOString() }));
}

export async function restore(ctx, who, { n }) {
  await requireRole(ctx, who, ['owner']);
  await ensureDraft(ctx);
  const found = await ctx.db.query('select 1 from versions where deck_id = $1 and n = $2', [DECK_ID, n]);
  if (!found.length) throw new HttpError(404, 'That version does not exist.');
  const rows = await ctx.db.query(
    `update draft set deck = (select deck from versions where deck_id = $1 and n = $2),
            rev = rev + 1, updated_by = $3, updated_at = $4
     where id = $1 and not locked returning rev`,
    [DECK_ID, n, normalizeEmail(who), stamp(ctx)],
  );
  if (!rows.length) throw new HttpError(423, LOCKED_MESSAGE);
  return { rev: rows[0].rev };
}

/** Public: no sign-in. n = null means the latest version. */
export async function getPublished(ctx, n = null) {
  const rows = n == null
    ? await ctx.db.query('select n, deck from versions where deck_id = $1 order by n desc limit 1', [DECK_ID])
    : await ctx.db.query('select n, deck from versions where deck_id = $1 and n = $2', [DECK_ID, n]);
  if (!rows.length) throw new HttpError(404, 'Nothing has been published yet.');
  return { version: rows[0].n, deck: rows[0].deck };
}

export async function listEditors(ctx, who) {
  await requireRole(ctx, who, ['owner']);
  const rows = await ctx.db.query('select email, added_at from editors order by added_at, email');
  return rows.map((r) => ({ email: r.email, addedAt: new Date(r.added_at).toISOString() }));
}

export async function addEditor(ctx, who, { email }) {
  await requireRole(ctx, who, ['owner']);
  const clean = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new HttpError(400, 'Enter a valid email address.');
  if (clean === normalizeEmail(ctx.env.OWNER_EMAIL)) throw new HttpError(400, 'The owner already has full access.');
  await ctx.db.query('insert into editors (email, added_at) values ($1, $2) on conflict (email) do nothing', [clean, stamp(ctx)]);
  return { email: clean };
}

export async function removeEditor(ctx, who, { email }) {
  await requireRole(ctx, who, ['owner']);
  const clean = normalizeEmail(email);
  if (clean === normalizeEmail(ctx.env.OWNER_EMAIL)) throw new HttpError(400, "The owner can't be removed.");
  await ctx.db.query('delete from editors where email = $1', [clean]);
  return { email: clean };
}
