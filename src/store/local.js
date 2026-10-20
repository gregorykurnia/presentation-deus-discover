// Local store adapter (Phase 2, Ruling R1): the draft is the deck file on disk,
// read and written through the dev server (scripts/lib/dev-store-plugin.js), so
// node scripts (PDF, placeholders) and git see every edit. Works under `npm run dev`.
//
// Store interface (shared with the Firebase adapter):
//   load()                      -> Promise<{ deck, locked, role }>
//   saveDraft(deck, expectedRev) -> Promise<{ rev }>   rejects with ConflictError
//   uploadImage(file)           -> Promise<{ src }>
//   publish(deck)               -> Promise<{ version }>
//   setLocked(bool)             -> Promise<void>
import { ConflictError } from './errors.js';

export const PHASE3_MESSAGE = 'Available after sign-in is set up (Phase 3)';

async function errorFrom(res) {
  let body = {};
  try { body = await res.json(); } catch { /* not JSON */ }
  const detail = body.errors?.join('\n') ?? body.error ?? res.statusText;
  return new Error(detail || `Request failed (${res.status})`);
}

export function createLocalStore({ fetch = globalThis.fetch.bind(globalThis), base = '' } = {}) {
  return {
    async load() {
      const res = await fetch(`${base}/__deck`, { cache: 'no-store' });
      if (!res.ok) throw await errorFrom(res);
      return res.json();
    },

    async saveDraft(deck, expectedRev) {
      const res = await fetch(`${base}/__deck`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deck, expectedRev }),
      });
      if (res.status === 409) throw new ConflictError();
      if (!res.ok) throw await errorFrom(res);
      return res.json();
    },

    async uploadImage(file) {
      const res = await fetch(`${base}/__upload`, {
        method: 'POST',
        headers: { 'content-type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) throw await errorFrom(res);
      return res.json();
    },

    async publish() {
      throw new Error(PHASE3_MESSAGE);
    },

    async setLocked() {
      throw new Error(PHASE3_MESSAGE);
    },
  };
}
