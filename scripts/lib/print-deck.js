// Shared by export-pdf.js and scripts/qa.js: make sure the offline build is current,
// then open dist/offline/deck.html?print (file://) in headless Chromium, fully loaded.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { visibleSlides } from '../../src/model.js';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const bundleHtml = join(root, 'dist', 'offline', 'deck.html');
export const pdfPath = join(root, 'DEUS-Pitch.pdf');

export function loadDeck() {
  return JSON.parse(readFileSync(join(root, 'content', 'deck.json'), 'utf8'));
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
  .map((p) => join(root, p));

/** Runs `npm run export:offline` when dist/offline/deck.html is missing or older than its sources. */
export function ensureOfflineBuild({ force = false } = {}) {
  const stale = !existsSync(bundleHtml) || statSync(bundleHtml).mtimeMs < newestMtime(BUILD_INPUTS);
  if (!force && !stale) return false;
  console.log('Building the offline deck (scripts/build-offline.js) ...');
  execFileSync(process.execPath, [join(root, 'scripts', 'build-offline.js')], { cwd: root, stdio: 'inherit' });
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
  const undecoded = await page.evaluate(async () => {
    await document.fonts.ready;
    const bad = [];
    await Promise.all([...document.images].map((img) => img.decode().catch(() => bad.push(img.getAttribute('src')))));
    await document.fonts.ready;
    return bad;
  });
  for (const src of undecoded) problems.push(`image did not decode: ${src}`);
  return { page, problems };
}

/** Page count of a PDF via pdfinfo (poppler). */
export function pdfPageCount(file) {
  const out = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  const m = out.match(/^Pages:\s+(\d+)/m);
  if (!m) throw new Error(`pdfinfo did not report a page count for ${file}`);
  return Number(m[1]);
}
