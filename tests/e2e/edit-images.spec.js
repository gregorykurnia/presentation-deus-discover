import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readDraft, resetDraft, writeDraft, UPLOAD_DIR } from './helpers/draft.js';

const FOREST = 'assets/extra/personality-forest.jpg';
const UPLOAD_SRC = /^assets\/uploads\/[0-9a-f]{16}\.jpg$/;

const slot = (page, slideId, key) => page.locator(`.slide[data-slide-id="${slideId}"] [data-image="${key}"]`);
const imageOf = (deck, slideId, key) => deck.slides.find((s) => s.id === slideId).images[key];
const popover = (page) => page.locator('.ed-pic');

/** Drops a file (bytes read here, a File built in the page) onto a locator. */
async function dropFile(page, locator, { path, name = basename(path), type, bytes }) {
  const b64 = (bytes ?? readFileSync(path)).toString('base64');
  const dataTransfer = await page.evaluateHandle(({ b64, name, type }) => {
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([data], name, { type }));
    return dt;
  }, { b64, name, type });
  await locator.scrollIntoViewIfNeeded();
  for (const type of ['dragenter', 'dragover', 'drop']) await locator.dispatchEvent(type, { dataTransfer });
}

/** Drags with the mouse from one page point to another. */
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

const center = (box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

async function openEditor(page) {
  await page.goto('/edit.html');
  await expect(page.locator('.ed-frame')).toHaveCount(22);
  await expect(page.locator('.ed-status')).toHaveText('Saved');
}

test.beforeEach(async ({ page }) => {
  resetDraft();
  await openEditor(page);
});

test('dropping personality-forest.jpg onto the Personality slot replaces it; Ctrl+Z puts the old one back', async ({ page }) => {
  const target = slot(page, 's-modules', 'personality');
  const before = imageOf(readDraft(), 's-modules', 'personality').src;
  await dropFile(page, target, { path: FOREST, type: 'image/jpeg' });

  await expect.poll(() => imageOf(readDraft(), 's-modules', 'personality').src).toMatch(UPLOAD_SRC);
  const src = imageOf(readDraft(), 's-modules', 'personality').src;
  // The upload went to the temp dir, never to the repo, and the dev server serves it.
  expect(existsSync(join(UPLOAD_DIR, basename(src)))).toBe(true);
  expect(existsSync(src)).toBe(false);
  const img = target.locator('img');
  await expect(img).toHaveAttribute('src', src);
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBe(1510);
  await expect(page.locator('.ed-status')).toHaveText('Saved');

  await page.keyboard.press('Control+z');
  await expect(target.locator('img')).toHaveAttribute('src', before);
  await expect.poll(() => imageOf(readDraft(), 's-modules', 'personality').src).toBe(before);
});

test('a GIF or a 12 MB photo is refused with a clear message and nothing changes', async ({ page }) => {
  const target = slot(page, 's-modules', 'personality');
  const notice = page.locator('.ed-notice');
  await dropFile(page, target, { name: 'party.gif', type: 'image/gif', bytes: Buffer.from('GIF89a') });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Please use a JPG, PNG or WebP image.');

  await dropFile(page, target, { name: 'phone.jpg', type: 'image/jpeg', bytes: Buffer.alloc(12 * 1024 * 1024) });
  await expect(notice).toContainText('Image is larger than 10 MB. Please use a smaller file.');
  expect(imageOf(readDraft(), 's-modules', 'personality').src).toBe('assets/module-personality.jpg');
  await expect(target.locator('img')).toHaveAttribute('src', 'assets/module-personality.jpg');
});

test('clicking a picture opens the popover; Fit and the focus point change the slide and the JSON', async ({ page }) => {
  const target = slot(page, 's-proof', 'photo');
  const img = target.locator('img');
  await target.scrollIntoViewIfNeeded();
  await target.click();
  await expect(popover(page)).toBeVisible();
  await expect(popover(page).getByRole('button', { name: 'Fill' })).toHaveAttribute('aria-pressed', 'true');

  // Drag the focus point to 20% / 30% of the picture.
  const pad = await popover(page).locator('.ed-pic__pad').boundingBox();
  const dot = await popover(page).locator('.ed-pic__dot').boundingBox();
  await drag(page, center(dot), { x: pad.x + pad.width * 0.2, y: pad.y + pad.height * 0.3 });
  await expect.poll(() => img.evaluate((el) => getComputedStyle(el).objectPosition)).toBe('20% 30%');
  await expect.poll(() => imageOf(readDraft(), 's-proof', 'photo').focus).toEqual([20, 30]);
  // The popover stays open on the re-rendered slide.
  await expect(popover(page)).toBeVisible();

  await popover(page).getByRole('button', { name: 'Fit' }).click();
  await expect.poll(() => target.locator('img').evaluate((el) => getComputedStyle(el).objectFit)).toBe('contain');
  await expect.poll(() => imageOf(readDraft(), 's-proof', 'photo').fit).toBe('contain');
  await expect(popover(page).getByRole('button', { name: 'Fit' })).toHaveAttribute('aria-pressed', 'true');

  // The arrow keys move the focus point too.
  await popover(page).locator('.ed-pic__dot').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => imageOf(readDraft(), 's-proof', 'photo').focus).toEqual([25, 30]);

  await page.keyboard.press('Escape');
  await expect(popover(page)).toBeHidden();
});

test('Replace picture… in the popover uploads the chosen file', async ({ page }) => {
  const target = slot(page, 's-proof', 'photo');
  await target.scrollIntoViewIfNeeded();
  await target.click();
  const chooser = page.waitForEvent('filechooser');
  await popover(page).getByRole('button', { name: 'Replace picture…' }).click();
  await (await chooser).setFiles(FOREST);
  await expect.poll(() => imageOf(readDraft(), 's-proof', 'photo').src).toMatch(UPLOAD_SRC);
  await expect(target.locator('img')).toHaveAttribute('src', UPLOAD_SRC);
});

test('the video slide has a poster slot in edit mode; clicking an empty slot opens the file picker', async ({ page }) => {
  // The poster file exists now; a failed load shows the same empty box, so fail it to keep this path covered.
  await page.route('**/assets/demo-poster.jpg', (route) => route.fulfill({ status: 404 }));
  await openEditor(page);
  const poster = slot(page, 's-video', 'poster');
  await expect(poster).toHaveCount(1);
  await expect(poster).toHaveClass(/img-slot--missing/);
  await poster.scrollIntoViewIfNeeded();
  const chooser = page.waitForEvent('filechooser');
  await poster.click();
  await (await chooser).setFiles(FOREST);
  await expect.poll(() => imageOf(readDraft(), 's-video', 'poster').src).toMatch(UPLOAD_SRC);
  await expect(poster.locator('img')).toHaveAttribute('src', UPLOAD_SRC);
});

test('dragging a report callout updates its x/y in the JSON', async ({ page }) => {
  const frame = page.locator('.slide[data-slide-id="s-report"] .report__callouts');
  const dot = page.locator('.slide[data-slide-id="s-report"] [data-callout="0"] .callout__dot');
  await dot.scrollIntoViewIfNeeded();
  const area = await frame.boundingBox();
  await drag(page, center(await dot.boundingBox()), { x: area.x + area.width * 0.5, y: area.y + area.height * 0.4 });
  await expect.poll(() => {
    const c = imageOf(readDraft(), 's-report', 'report').callouts[0];
    return [Math.round(c.x), Math.round(c.y)];
  }).toEqual([50, 40]);
  expect(imageOf(readDraft(), 's-report', 'report').callouts[0].label).toBe('Role fit');
  const dropped = await page.locator('.slide[data-slide-id="s-report"] [data-callout="0"] .callout__dot').boundingBox();
  expect(Math.abs(center(dropped).x - (area.x + area.width * 0.5))).toBeLessThan(2);
  // A drag is one undo step.
  await page.keyboard.press('Control+z');
  await expect.poll(() => imageOf(readDraft(), 's-report', 'report').callouts[0].x).toBe(16);
});

test('report callouts sit on the displayed screenshot, not the frame, whatever its aspect ratio', async ({ page }) => {
  const deck = readDraft();
  imageOf(deck, 's-report', 'report').src = 'assets/logo.png'; // square, in a 1180x740 frame
  writeDraft(deck);
  await openEditor(page);
  const img = page.locator('.slide[data-slide-id="s-report"] [data-image="report"] img');
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const box = await img.boundingBox();
  // fit: contain -> a centred square as tall as the frame.
  const shown = { x: box.x + (box.width - box.height) / 2, width: box.height, y: box.y, height: box.height };
  for (const [i, c] of imageOf(deck, 's-report', 'report').callouts.entries()) {
    const dot = center(await page.locator(`.slide[data-slide-id="s-report"] [data-callout="${i}"] .callout__dot`).boundingBox());
    expect(Math.abs(dot.x - (shown.x + (shown.width * c.x) / 100)), `callout ${i} x`).toBeLessThan(2);
  }
});
