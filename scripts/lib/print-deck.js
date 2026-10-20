// Shared by export-pdf.js, scripts/qa.js, scripts/placeholders.js and
// scripts/build-offline.js: where the deck and the outputs are, make sure the offline
// build is current, then open dist/offline/deck.html?print (file://) in headless
// Chromium, fully loaded.
//
// Env overrides (the e2e specs use them so the real files are never touched):
//   DECK_FILE      the deck JSON to read (default content/deck.json; the dev store's draft)
//   DECK_OUT_DIR   write every output here instead of the repo: deck.html, offline/,
//                  DEUS-Pitch.pdf, placeholders.md, qa/
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { visibleSlides } from '../../src/model.js';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Input and output paths, from DECK_FILE / DECK_OUT_DIR or the repo defaults. */
export function deckPaths(env = process.env) {
  const out = env.DECK_OUT_DIR ? resolve(root, env.DECK_OUT_DIR) : null;
  return {
    deckFile: resolve(root, env.DECK_FILE || join('content', 'deck.json')),
    offlineDir: out ? join(out, 'offline') : join(root, 'dist', 'offline'),
    deckHtml: join(out ?? root, 'deck.html'),
    pdf: join(out ?? root, 'DEUS-Pitch.pdf'),
    placeholders: join(out ?? root, 'placeholders.md'),
    qaDir: join(out ?? root, 'qa'),
  };
}

export const paths = deckPaths();
export const bundleHtml = join(paths.offlineDir, 'deck.html');
export const pdfPath = paths.pdf;

export function loadDeck() {
  return JSON.parse(readFileSync(paths.deckFile, 'utf8'));
}

export const visibleCount = (deck) => visibleSlides(deck).length;

/** Newest mtime (ms) under the given paths (files or directories). */
function newestMtime(paths) {
  let newest = 0;
  const visit = (p) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) readdirSync(p).forEach((f) => visit(join(p, f)));
    else newest = Math.max(newest, st.mtimeMs);
  };
  paths.forEach(visit);
  return newest;
}

const BUILD_INPUTS = ['src', 'content', 'assets', 'present.html', 'scripts/build-offline.js', 'package.json']
  .map((p) => join(root, p)).concat(paths.deckFile);

// With another DECK_FILE, a bundle built earlier may hold a different deck whatever
// its age: build once per run.
let bundleHoldsDeck = paths.deckFile === resolve(root, 'content', 'deck.json');

/** Runs `npm run export:offline` when dist/offline/deck.html is missing or older than its sources. */
export function ensureOfflineBuild({ force = false } = {}) {
  const stale = !bundleHoldsDeck || !existsSync(bundleHtml) || statSync(bundleHtml).mtimeMs < newestMtime(BUILD_INPUTS);
  if (!force && !stale) return false;
  console.log('Building the offline deck (scripts/build-offline.js) ...');
  execFileSync(process.execPath, [join(root, 'scripts', 'build-offline.js')], { cwd: root, stdio: 'inherit' });
  bundleHoldsDeck = true;
  return true;
}

/** True when DEUS-Pitch.pdf is missing or older than the built deck. */
export function pdfIsStale() {
  return !existsSync(pdfPath) || statSync(pdfPath).mtimeMs < statSync(bundleHtml).mtimeMs;
}

/**
 * Opens the print view at 1920x1080 with print media emulated, waits for fonts
 * and every image's decode(). Returns { page, problems } where problems lists
 * page errors, failed requests and images that did not decode.
 */
export async function openPrintDeck(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const problems = [];
  page.on('pageerror', (err) => problems.push(`page error: ${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console error: ${msg.text()}`); });
  page.on('requestfailed', (req) => problems.push(`request failed: ${req.url()}`));
  await page.route(/^https?:/, (route) => {
    problems.push(`network request blocked (deck must be offline): ${route.request().url()}`);
    return route.abort();
  });
  await page.emulateMedia({ media: 'print' });
  await page.goto(`${pathToFileURL(bundleHtml).href}?print`, { waitUntil: 'load' });
  await page.waitForSelector('section.slide');
  problems.push(...await waitForPrintReady(page));
  return { page, problems };
}

/**
 * Waits for fonts, every image's decode(), and then for every report frame whose
 * screenshot loaded to be sized to it (src/layouts/report.js), so the callouts sit
 * on the displayed picture before anything is measured or printed (Ruling R5).
 * Returns the problems found ("image did not decode: <src>", unsized frames).
 */
export async function waitForPrintReady(page, { timeout = 10_000 } = {}) {
  const undecoded = await page.evaluate(async () => {
    await document.fonts.ready;
    const bad = [];
    await Promise.all([...document.images].map((img) => img.decode().catch(() => bad.push(img.getAttribute('src')))));
    await document.fonts.ready;
    return bad;
  });
  const problems = undecoded.map((src) => `image did not decode: ${src}`);
  const allSized = () => [...document.querySelectorAll('.report__frame')]
    .filter((frame) => {
      const img = frame.querySelector('[data-image] img');
      return img?.complete && img.naturalWidth > 0 && !frame.classList.contains('report__frame--sized');
    }).length === 0;
  try {
    await page.waitForFunction(allSized, null, { timeout });
  } catch {
    problems.push('report callouts were not placed on the screenshot (report__frame--sized never set)');
  }
  return problems;
}

/** Page count of a PDF via pdfinfo (poppler). */
export function pdfPageCount(file) {
  const out = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  const m = out.match(/^Pages:\s+(\d+)/m);
  if (!m) throw new Error(`pdfinfo did not report a page count for ${file}`);
  return Number(m[1]);
}
