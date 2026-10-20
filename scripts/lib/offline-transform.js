// Pure helpers for scripts/build-offline.js (unit-tested in tests/unit/offline-transform.test.js).
import { isUrlSrc } from '../../src/layouts/common.js';

/**
 * Ruling R3: sets `src` to null on every deck entry that points at a repo file that is
 * not on disk (`exists(path)`). URLs (data:, blob:, http(s):, absolute /) are uploads or
 * external links, not repo files, and are kept. Mutates and returns `deck`.
 */
export function nullMissingSrcs(deck, exists) {
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.src === 'string' && !isUrlSrc(o.src) && !exists(o.src)) o.src = null;
    Object.values(o).forEach(walk);
  };
  walk(deck);
  return deck;
}

/** True when the first classic <script> in <head> is the SHOW_PLACEHOLDER_HIGHLIGHT flag (true or false). */
export function startsWithFlagScript(html) {
  return /^\s*<script>\s*const SHOW_PLACEHOLDER_HIGHLIGHT = (true|false);/m.test(html.slice(html.indexOf('<head>')));
}
