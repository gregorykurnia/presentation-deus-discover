import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDeckHandlers, storePaths, uploadedFile } from '../../scripts/lib/dev-store-plugin.js';
import { createLocalStore, PHASE3_MESSAGE } from '../../src/store/local.js';
import { ConflictError, CONFLICT_MESSAGE } from '../../src/store/errors.js';

const seed = { id: 'deus-pitch', rev: 3, slides: [{ id: 's-a', layout: 'title', section: 'main', hidden: false, fields: {}, images: {}, notes: '' }] };

describe('dev store handlers (file-backed draft, Ruling R1)', () => {
  let dir;
  let deckFile;
  let uploadDir;
  let api;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'deus-store-'));
    deckFile = join(dir, 'deck.json');
    uploadDir = join(dir, 'uploads');
    writeFileSync(deckFile, JSON.stringify(seed));
    api = createDeckHandlers({ deckFile, uploadDir, uploadPrefix: 'assets/uploads/' });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const onDisk = () => JSON.parse(readFileSync(deckFile, 'utf8'));

  it('GET returns the deck, unlocked, as an editor', () => {
    expect(api.getDeck()).toEqual({ status: 200, json: { deck: seed, locked: false, role: 'editor' } });
  });

  it('PUT with the current rev writes the deck with rev + 1', () => {
    const deck = structuredClone(seed);
    deck.slides[0].fields.headline = 'Edited';
    const res = api.putDeck({ deck, expectedRev: 3 });
    expect(res).toEqual({ status: 200, json: { rev: 4 } });
    expect(onDisk().rev).toBe(4);
    expect(onDisk().slides[0].fields.headline).toBe('Edited');
    // pretty-printed, so edits show up as readable git diffs
    expect(readFileSync(deckFile, 'utf8')).toMatch(/^\{\n {2}"id": "deus-pitch",\n {2}"rev": 4,/);
  });

  it('PUT with a stale rev is a 409 and leaves the file alone', () => {
    const res = api.putDeck({ deck: { ...seed, slides: [] }, expectedRev: 2 });
    expect(res.status).toBe(409);
    expect(res.json.rev).toBe(3);
    expect(onDisk()).toEqual(seed);
  });

  it('PUT of an invalid deck is a 400 with the validation errors', () => {
    const res = api.putDeck({ deck: { slides: [null] }, expectedRev: 3 });
    expect(res.status).toBe(400);
    expect(res.json.errors).toEqual(['Slide 1: not a slide object']);
    expect(onDisk()).toEqual(seed);
  });

  it('upload writes <content-hash>.<ext> and returns a relative src', () => {
    const bytes = Buffer.from('fake jpeg bytes');
    const res = api.upload(bytes, 'image/jpeg');
    expect(res.status).toBe(200);
    expect(res.json.src).toMatch(/^assets\/uploads\/[0-9a-f]{16}\.jpg$/);
    const file = join(uploadDir, res.json.src.split('/').pop());
    expect(readFileSync(file)).toEqual(bytes);
    // same bytes, same name
    expect(api.upload(bytes, 'image/jpeg').json.src).toBe(res.json.src);
  });

  it('upload rejects other content types', () => {
    const res = api.upload(Buffer.from('x'), 'image/gif');
    expect(res.status).toBe(415);
    expect(existsSync(uploadDir)).toBe(false);
  });
});

describe('dev store paths (env overrides)', () => {
  it('defaults to content/deck.json and assets/uploads under the root', () => {
    expect(storePaths('/repo', {})).toEqual({ deckFile: join('/repo', 'content/deck.json'), uploadDir: join('/repo', 'assets/uploads') });
  });

  it('takes DECK_FILE and UPLOAD_DIR from the environment (the e2e specs use temp dirs)', () => {
    expect(storePaths('/repo', { DECK_FILE: '.e2e/deck.json', UPLOAD_DIR: '/tmp/up' }))
      .toEqual({ deckFile: join('/repo', '.e2e/deck.json'), uploadDir: '/tmp/up' });
  });
});

describe('serving uploads from another directory', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'deus-up-'));
    writeFileSync(join(dir, 'abc.jpg'), 'x');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('maps /assets/uploads/<name> to the file in the upload dir', () => {
    expect(uploadedFile(dir, '/assets/uploads/abc.jpg')).toEqual({ file: join(dir, 'abc.jpg'), type: 'image/jpeg' });
  });

  it('ignores other paths, missing files and anything that leaves the upload dir', () => {
    expect(uploadedFile(dir, '/assets/logo.png')).toBeNull();
    expect(uploadedFile(dir, '/assets/uploads/nope.jpg')).toBeNull();
    expect(uploadedFile(dir, '/assets/uploads/../../etc/passwd')).toBeNull();
    expect(uploadedFile(dir, '/assets/uploads/%2e%2e/%2e%2e/etc/passwd')).toBeNull();
    expect(uploadedFile(dir, '/assets/uploads/')).toBeNull();
  });
});

describe('local store adapter', () => {
  const json = (status, body) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

  it('load() GETs /__deck', async () => {
    const fetch = vi.fn(() => json(200, { deck: seed, locked: false, role: 'editor' }));
    const store = createLocalStore({ fetch });
    await expect(store.load()).resolves.toEqual({ deck: seed, locked: false, role: 'editor' });
    expect(fetch).toHaveBeenCalledWith('/__deck', expect.objectContaining({ cache: 'no-store' }));
  });

  it('saveDraft() PUTs { deck, expectedRev } and resolves the new rev', async () => {
    const fetch = vi.fn(() => json(200, { rev: 4 }));
    const store = createLocalStore({ fetch });
    await expect(store.saveDraft(seed, 3)).resolves.toEqual({ rev: 4 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/__deck');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ deck: seed, expectedRev: 3 });
  });

  it('saveDraft() rejects with ConflictError on 409', async () => {
    const store = createLocalStore({ fetch: () => json(409, { rev: 9 }) });
    const err = await store.saveDraft(seed, 3).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.message).toBe('Someone else changed this deck. Reload to see their changes.');
    expect(CONFLICT_MESSAGE).toBe(err.message);
  });

  it('saveDraft() rejects with the server message on other errors', async () => {
    const store = createLocalStore({ fetch: () => json(400, { errors: ['Slide 1: not a slide object'] }) });
    await expect(store.saveDraft(seed, 3)).rejects.toThrow('Slide 1: not a slide object');
  });

  it('uploadImage() POSTs the file bytes with its type', async () => {
    const fetch = vi.fn(() => json(200, { src: 'assets/uploads/abc.png' }));
    const store = createLocalStore({ fetch });
    const file = new Blob(['png'], { type: 'image/png' });
    await expect(store.uploadImage(file)).resolves.toEqual({ src: 'assets/uploads/abc.png' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/__upload');
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('image/png');
    expect(init.body).toBe(file);
  });

  it('publish() and setLocked() wait for Phase 3 (Ruling R2)', async () => {
    const store = createLocalStore({ fetch: vi.fn() });
    expect(PHASE3_MESSAGE).toBe('Available after sign-in is set up (Phase 3)');
    await expect(store.publish(seed)).rejects.toThrow(PHASE3_MESSAGE);
    await expect(store.setLocked(true)).rejects.toThrow(PHASE3_MESSAGE);
  });
});
