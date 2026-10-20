// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import seed from '../../content/deck.json';
import { CONFLICT_MESSAGE } from '../../src/store/errors.js';
import { roleOf } from '../../server/access.js';
import { createMemoryDb, migrate } from '../../server/db.js';
import * as api from '../../server/deck-api.js';

const OWNER = 'gregory.kurnia@deushcs.com';
const EDITOR = 'thania.ferdinanto@deushcs.com';

let ctx;
beforeEach(async () => {
  const db = await createMemoryDb();
  await db.query('insert into editors (email) values ($1)', [EDITOR]);
  ctx = { db, env: { OWNER_EMAIL: OWNER }, now: () => new Date('2026-10-20T10:00:00Z') };
});

const fails = async (promise, status, message) => {
  const error = await promise.then(() => null, (e) => e);
  expect(error, 'expected a rejection').not.toBeNull();
  expect(error.status).toBe(status);
  if (message) expect(error.message).toBe(message);
};

const edited = (deck, title) => ({ ...deck, title });

describe('access', () => {
  it('401 signed out, 403 stranger, 404 nothing published', async () => {
    await fails(api.getDraft(ctx, null), 401);
    await fails(api.getDraft(ctx, 'stranger@x.com'), 403);
    await fails(api.getPublished(ctx, null), 404);
  });

  it('seeds the draft on first read and reports the role', async () => {
    const draft = await api.getDraft(ctx, EDITOR);
    expect(draft).toMatchObject({ rev: 1, locked: false, role: 'editor' });
    expect(draft.deck).toEqual(seed);
    expect((await api.getDraft(ctx, ` ${OWNER.toUpperCase()} `)).role).toBe('owner');
  });

  it('migrate is idempotent', async () => {
    await migrate(ctx.db);
    await migrate(ctx.db);
    expect((await api.getDraft(ctx, OWNER)).rev).toBe(1);
  });
});

describe('saveDraft', () => {
  it('bumps rev, rejects a stale rev with 409, and an invalid deck with 400', async () => {
    const { deck, rev } = await api.getDraft(ctx, EDITOR);
    expect(await api.saveDraft(ctx, EDITOR, { deck: edited(deck, 'A'), expectedRev: rev })).toEqual({ rev: rev + 1 });
    await fails(api.saveDraft(ctx, EDITOR, { deck: edited(deck, 'B'), expectedRev: rev }), 409, CONFLICT_MESSAGE);
    await fails(api.saveDraft(ctx, EDITOR, { deck: { slides: 'no' }, expectedRev: rev + 1 }), 400);
    expect((await api.getDraft(ctx, EDITOR)).deck.title).toBe('A');
  });

  it('a stranger cannot save', async () => {
    const { deck, rev } = await api.getDraft(ctx, EDITOR);
    await fails(api.saveDraft(ctx, 'stranger@x.com', { deck, expectedRev: rev }), 403);
    await fails(api.saveDraft(ctx, null, { deck, expectedRev: rev }), 401);
  });
});

describe('lock', () => {
  it('blocks saving (owner too) and publishing; only the owner can lock', async () => {
    const { deck, rev } = await api.getDraft(ctx, EDITOR);
    await fails(api.setLocked(ctx, EDITOR, { locked: true }), 403);
    await api.setLocked(ctx, OWNER, { locked: true });
    for (const who of [EDITOR, OWNER]) {
      await fails(api.saveDraft(ctx, who, { deck, expectedRev: rev }), 423, 'Locked by the owner');
    }
    await fails(api.publish(ctx, EDITOR), 423, 'Locked by the owner');
    await api.setLocked(ctx, OWNER, { locked: false });
    expect(await api.saveDraft(ctx, EDITOR, { deck, expectedRev: rev })).toEqual({ rev: rev + 1 });
  });
});

describe('publish', () => {
  it('numbers versions, serves them publicly, and ignores later saves', async () => {
    const first = await api.getDraft(ctx, EDITOR);
    expect(await api.publish(ctx, EDITOR)).toEqual({ version: 1 });
    await api.saveDraft(ctx, EDITOR, { deck: edited(first.deck, 'Second'), expectedRev: first.rev });
    expect(await api.publish(ctx, OWNER)).toEqual({ version: 2 });
    expect((await api.getPublished(ctx, null)).version).toBe(2);
    expect((await api.getPublished(ctx, 1)).deck).toEqual(first.deck);
    await api.saveDraft(ctx, EDITOR, { deck: edited(first.deck, 'Third'), expectedRev: first.rev + 1 });
    expect((await api.getPublished(ctx, 2)).deck.title).toBe('Second');
    await fails(api.getPublished(ctx, 9), 404);
    const list = await api.listVersions(ctx, EDITOR);
    expect(list.map((v) => v.n)).toEqual([2, 1]);
    expect(list[0]).toMatchObject({ publishedBy: OWNER, publishedAt: '2026-10-20T10:00:00.000Z' });
    await fails(api.listVersions(ctx, null), 401);
  });

  it('versions cannot be updated or deleted', async () => {
    await api.publish(ctx, OWNER);
    await expect(ctx.db.query("update versions set deck = '{}'::jsonb")).rejects.toThrow();
    await expect(ctx.db.query('delete from versions')).rejects.toThrow();
    expect((await api.getPublished(ctx, 1)).deck).toEqual(seed);
  });
});

describe('restore and editors', () => {
  it('only the owner restores; it copies the version into the draft', async () => {
    const first = await api.getDraft(ctx, EDITOR);
    await api.publish(ctx, EDITOR);
    await api.saveDraft(ctx, EDITOR, { deck: edited(first.deck, 'Later'), expectedRev: first.rev });
    await fails(api.restore(ctx, EDITOR, { n: 1 }), 403);
    await fails(api.restore(ctx, OWNER, { n: 7 }), 404);
    expect(await api.restore(ctx, OWNER, { n: 1 })).toEqual({ rev: first.rev + 2 });
    expect((await api.getDraft(ctx, OWNER)).deck).toEqual(first.deck);
    await api.setLocked(ctx, OWNER, { locked: true });
    await fails(api.restore(ctx, OWNER, { n: 1 }), 423);
  });

  it('only the owner manages editors; emails are normalised; the owner stays', async () => {
    await fails(api.addEditor(ctx, EDITOR, { email: 'a@b.com' }), 403);
    await fails(api.removeEditor(ctx, EDITOR, { email: EDITOR }), 403);
    await fails(api.listEditors(ctx, EDITOR), 403);
    await api.addEditor(ctx, OWNER, { email: ' Audrey.Wijaya@DEUSHCS.com ' });
    expect((await api.listEditors(ctx, OWNER)).map((e) => e.email)).toContain('audrey.wijaya@deushcs.com');
    expect(await roleOf(ctx, 'AUDREY.wijaya@deushcs.com')).toBe('editor');
    await fails(api.addEditor(ctx, OWNER, { email: 'not an email' }), 400);
    await fails(api.removeEditor(ctx, OWNER, { email: OWNER }), 400);
    await api.removeEditor(ctx, OWNER, { email: EDITOR });
    expect(await roleOf(ctx, EDITOR)).toBe('none');
    await fails(api.getDraft(ctx, EDITOR), 403);
  });
});
