// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryDb } from '../../server/db.js';
import { requestCode, sessionEmail, signOut, verifyCode } from '../../server/auth.js';

const OWNER = 'gregory.kurnia@deushcs.com';
const EDITOR = 'thania.ferdinanto@deushcs.com';
const STRANGER = 'stranger@example.com';
const SENT = 'If this email can edit the deck, a code is on its way.';
const EXPIRED = 'Code expired. Request a new one.';
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

let db;
let ctx;
let mail;
let time;
const advance = (ms) => { time = new Date(time.getTime() + ms); };

beforeAll(async () => {
  db = await createMemoryDb(); // shared: PGlite takes a couple of seconds to start
  await db.query('insert into editors (email) values ($1)', [EDITOR]);
});

beforeEach(async () => {
  await db.query('delete from login_codes');
  await db.query('delete from sessions');
  mail = [];
  time = new Date('2026-10-20T10:00:00Z');
  ctx = {
    db,
    env: { OWNER_EMAIL: OWNER, AUTH_SECRET: 'test-secret' },
    now: () => time,
    mailer: { send: async (to, code) => { mail.push({ to, code }); } },
  };
});

const fails = async (promise, status, message) => {
  const error = await promise.then(() => null, (e) => e);
  expect(error, 'expected a rejection').not.toBeNull();
  expect(error.status).toBe(status);
  if (message) expect(error.message).toBe(message);
};

const lastCode = () => mail.at(-1).code;

describe('requestCode', () => {
  it('answers the same for an editor and a stranger; only the editor gets mail', async () => {
    expect(await requestCode(ctx, { email: ` ${EDITOR.toUpperCase()} ` })).toEqual({ message: SENT });
    expect(await requestCode(ctx, { email: STRANGER })).toEqual({ message: SENT });
    expect(mail).toHaveLength(1);
    expect(mail[0].to).toBe(EDITOR);
    expect(mail[0].code).toMatch(/^\d{6}$/);
    await requestCode(ctx, { email: OWNER });
    expect(mail.map((m) => m.to)).toEqual([EDITOR, OWNER]);
  });

  it('stores a hash, never the code', async () => {
    await requestCode(ctx, { email: EDITOR });
    const [row] = await db.query('select code_hash from login_codes where email = $1', [EDITOR]);
    expect(row.code_hash).toBeTruthy();
    expect(row.code_hash).not.toBe(lastCode());
    expect(row.code_hash).not.toContain(lastCode());
  });

  it('allows 3 codes per 15 minutes, for editors and strangers alike', async () => {
    for (const email of [EDITOR, STRANGER]) {
      for (let i = 0; i < 3; i += 1) await requestCode(ctx, { email });
      await fails(requestCode(ctx, { email }), 429, 'Too many codes. Try again in a few minutes.');
    }
    expect(mail).toHaveLength(3);
    advance(15 * MINUTE);
    expect(await requestCode(ctx, { email: EDITOR })).toEqual({ message: SENT });
    expect(await requestCode(ctx, { email: STRANGER })).toEqual({ message: SENT });
    expect(mail).toHaveLength(4);
  });
});

describe('verifyCode', () => {
  it('5 wrong codes delete the code', async () => {
    await requestCode(ctx, { email: EDITOR });
    const code = lastCode();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i += 1) {
      await fails(verifyCode(ctx, { email: EDITOR, code: wrong }), 400, "That code isn't right. Try again.");
    }
    await fails(verifyCode(ctx, { email: EDITOR, code: wrong }), 400, EXPIRED);
    await fails(verifyCode(ctx, { email: EDITOR, code }), 400, EXPIRED);
    // The send history stays, so deleting the code does not reset the rate limit.
    await requestCode(ctx, { email: EDITOR });
    await requestCode(ctx, { email: EDITOR });
    await fails(requestCode(ctx, { email: EDITOR }), 429);
  });

  it('a code expires after 10 minutes', async () => {
    await requestCode(ctx, { email: EDITOR });
    advance(10 * MINUTE);
    await fails(verifyCode(ctx, { email: EDITOR, code: lastCode() }), 400, EXPIRED);
  });

  it('a stranger, or an email with no code, gets the same expired message', async () => {
    await requestCode(ctx, { email: STRANGER });
    await fails(verifyCode(ctx, { email: STRANGER, code: '123456' }), 400, EXPIRED);
    await fails(verifyCode(ctx, { email: 'nobody@example.com', code: '123456' }), 400, EXPIRED);
  });

  it('a right code makes a 30-day session, stored hashed, that sign-out ends', async () => {
    await requestCode(ctx, { email: EDITOR });
    const code = lastCode();
    const { token, email } = await verifyCode(ctx, { email: ` ${EDITOR.toUpperCase()}`, code });
    expect(email).toBe(EDITOR);
    expect(token.length).toBeGreaterThanOrEqual(43); // 32 random bytes
    expect(await sessionEmail(ctx, token)).toBe(EDITOR);
    const rows = await db.query('select token_hash from sessions');
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toBe(token);
    // The code is used up.
    await fails(verifyCode(ctx, { email: EDITOR, code }), 400, EXPIRED);

    advance(30 * DAY - MINUTE);
    expect(await sessionEmail(ctx, token)).toBe(EDITOR);
    advance(MINUTE);
    expect(await sessionEmail(ctx, token)).toBeNull();

    time = new Date('2026-10-20T10:00:00Z');
    await signOut(ctx, token);
    expect(await sessionEmail(ctx, token)).toBeNull();
  });

  it('unknown or missing tokens are no session', async () => {
    expect(await sessionEmail(ctx, 'nope')).toBeNull();
    expect(await sessionEmail(ctx, undefined)).toBeNull();
    await signOut(ctx, undefined);
  });
});
