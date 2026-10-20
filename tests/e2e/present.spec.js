import { test, expect } from '@playwright/test';
import deck from '../../content/deck.json' with { type: 'json' };

const visible = deck.slides.filter((s) => !s.hidden);
const current = (page) => page.locator('.slide.is-current');
const currentId = (page) => current(page).getAttribute('data-slide-id');

test.beforeEach(async ({ page }) => {
  await page.goto('/present.html');
  await expect(current(page)).toHaveCount(1);
});

test('shows exactly one visible slide, the first', async ({ page }) => {
  await expect(page.locator('.slide:visible')).toHaveCount(1);
  expect(await currentId(page)).toBe(visible[0].id);
});

test('ArrowRight and Space advance; ArrowLeft goes back; stops at the ends', async ({ page }) => {
  await page.keyboard.press('ArrowLeft');
  expect(await currentId(page)).toBe(visible[0].id);
  await page.keyboard.press('ArrowRight');
  expect(await currentId(page)).toBe(visible[1].id);
  await page.keyboard.press('Space');
  expect(await currentId(page)).toBe(visible[2].id);
  await page.keyboard.press('ArrowLeft');
  expect(await currentId(page)).toBe(visible[1].id);
  for (let i = 0; i < visible.length + 3; i += 1) await page.keyboard.press('ArrowRight');
  expect(await currentId(page)).toBe(visible[visible.length - 1].id);
});

test('#3 opens the 3rd visible slide and the hash follows navigation', async ({ page }) => {
  await page.goto('/present.html#3');
  await page.reload();
  expect(await currentId(page)).toBe(visible[2].id);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#4');
  await page.reload();
  expect(await currentId(page)).toBe(visible[3].id);
});

test('N toggles the notes panel with the current slide notes', async ({ page }) => {
  const panel = page.locator('.notes-panel');
  await expect(panel).toBeHidden();
  await page.keyboard.press('n');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(visible[0].notes.slice(0, 30));
  await page.keyboard.press('ArrowRight');
  await expect(panel).toContainText(visible[1].notes.slice(0, 30));
  await page.keyboard.press('n');
  await expect(panel).toBeHidden();
});

test('F requests fullscreen', async ({ page }) => {
  await page.evaluate(() => {
    window.__fs = 0;
    document.documentElement.requestFullscreen = () => { window.__fs += 1; return Promise.resolve(); };
  });
  await page.keyboard.press('f');
  expect(await page.evaluate(() => window.__fs)).toBe(1);
});

test('placeholder highlight flag is a classic global set to true', async ({ page }) => {
  expect(await page.evaluate(() => globalThis.SHOW_PLACEHOLDER_HIGHLIGHT)).toBe(true);
  await expect(page.locator('mark.ph').first()).toBeAttached();
});

for (const [w, h] of [[1280, 720], [1000, 900]]) {
  test(`slide keeps 16:9 and fits a ${w}x${h} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const box = await current(page).boundingBox();
    expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
    expect(box.x).toBeGreaterThanOrEqual(-0.5);
    expect(box.y).toBeGreaterThanOrEqual(-0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(w + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(h + 0.5);
    // the slide fills the limiting dimension
    expect(Math.max(box.width / w, box.height / h)).toBeGreaterThan(0.99);
  });
}

test('rescales on resize', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const a = await current(page).boundingBox();
  await page.setViewportSize({ width: 800, height: 600 });
  await expect.poll(async () => (await current(page).boundingBox()).width).toBeLessThan(a.width);
});

test('?print renders all visible slides unscaled with no UI', async ({ page }) => {
  await page.goto('/present.html?print');
  await expect(page.locator('section.slide')).toHaveCount(visible.length);
  const first = page.locator('section.slide').first();
  expect(await first.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  const box = await first.boundingBox();
  expect(Math.round(box.width)).toBe(1920);
  expect(Math.round(box.height)).toBe(1080);
  await expect(page.locator('.notes-panel')).toHaveCount(0);
  await expect(page.locator('.counter')).toHaveCount(0);
});
