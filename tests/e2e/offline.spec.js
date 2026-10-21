import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import deck from '../../content/deck.json' with { type: 'json' };

const root = resolve(import.meta.dirname, '../..');
const bundleDir = join(root, 'dist/offline');
const bundleHtml = join(bundleDir, 'deck.html');
const visible = deck.slides.filter((s) => !s.hidden);

// Build once per run so `npm run test:e2e` works from a clean checkout.
test.beforeAll(() => {
  execFileSync(process.execPath, ['scripts/build-offline.js'], { cwd: root, stdio: 'pipe' });
});

/** Opens a file:// URL with every http(s) request aborted; collects errors. */
async function openOffline(page, url) {
  const problems = [];
  const externalRequests = [];
  await page.route(/^https?:/, (route) => {
    externalRequests.push(route.request().url());
    return route.abort();
  });
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`console: ${msg.text()}`); });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => {
    // A preload="metadata" video reads its header, then the browser cancels the rest of the download.
    if (req.resourceType() === 'media' && req.failure()?.errorText === 'net::ERR_ABORTED') return;
    problems.push(`requestfailed: ${req.url()}`);
  });
  await page.goto(url);
  return { problems, externalRequests };
}

test('dist/offline/deck.html runs from file:// with the network blocked', async ({ page }) => {
  const { problems, externalRequests } = await openOffline(page, pathToFileURL(bundleHtml).href);
  await expect(page.locator('.slide.is-current')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);

  const fonts = await page.evaluate(() => [...document.fonts].map((f) => ({ family: f.family, status: f.status })));
  expect(fonts.length).toBeGreaterThan(0);
  for (const f of fonts) expect(f.status, `font ${f.family}`).toBe('loaded');
  expect(await page.evaluate(() => document.fonts.check('700 40px "DM Sans"'))).toBe(true);

  expect(await page.locator('img').count()).toBeGreaterThan(5);
  const broken = await page.evaluate(() => [...document.images]
    .filter((img) => !(img.complete && img.naturalWidth > 0))
    .map((img) => img.getAttribute('src')));
  expect(broken, 'images that did not load').toEqual([]);
  // Every video reached at least HAVE_METADATA (a missing file never does).
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('video')]
    .filter((v) => v.readyState < 1).map((v) => v.getAttribute('src')))).toEqual([]);

  // Every picture is in place (the labeled missing box is covered by the render unit tests).
  expect(await page.locator('.img-missing').count()).toBe(0);

  expect(externalRequests).toEqual([]);
  expect(problems).toEqual([]);
});

test('deck.html?print renders every visible slide from file://', async ({ page }) => {
  const { problems } = await openOffline(page, `${pathToFileURL(bundleHtml).href}?print`);
  await expect(page.locator('.slide')).toHaveCount(visible.length);
  expect(visible.length).toBe(21);
  expect(problems).toEqual([]);
});

test('the repo-root deck.html is the same file as the bundle copy', () => {
  expect(readFileSync(join(root, 'deck.html'), 'utf8')).toBe(readFileSync(bundleHtml, 'utf8'));
});

test('deck.html is self-contained: no external scripts or stylesheets, flag script first', () => {
  const html = readFileSync(bundleHtml, 'utf8');
  expect(html).not.toMatch(/<script[^>]+\ssrc=/);
  expect(html).not.toMatch(/<link[^>]+rel=["']?stylesheet/);
  expect(html).toMatch(/data:font\/woff2;base64,/);
  const firstScript = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  expect(firstScript).toMatch(/const SHOW_PLACEHOLDER_HIGHLIGHT = (true|false);/);
  expect(firstScript).toContain('globalThis.SHOW_PLACEHOLDER_HIGHLIGHT = SHOW_PLACEHOLDER_HIGHLIGHT;');
  expect(html.indexOf('SHOW_PLACEHOLDER_HIGHLIGHT')).toBeLessThan(html.indexOf('type="module"'));
});

test('dist/offline/assets holds only referenced images that exist', () => {
  const have = readdirSync(join(bundleDir, 'assets')).sort();
  const referenced = new Set(['logo-mark-wordmark-dark.svg']);
  const walk = (o) => {
    if (o && typeof o === 'object') {
      if (typeof o.src === 'string') referenced.add(o.src.replace(/^assets\//, ''));
      Object.values(o).forEach(walk);
    }
  };
  walk(deck);
  const expected = [...referenced].filter((f) => existsSync(join(root, 'assets', f))).sort();
  expect(have).toEqual(expected);
});
