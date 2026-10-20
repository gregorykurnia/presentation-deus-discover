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

test('placeholder highlight flag is the first script and a classic global', async ({ page }) => {
  // Vite's dev server injects its own module client first; the flag is the first classic script.
  const first = await page.evaluate(() => document.querySelector('script:not([type="module"])').textContent);
  expect(first).toMatch(/const SHOW_PLACEHOLDER_HIGHLIGHT = (true|false);/);
  expect(first).toContain('globalThis.SHOW_PLACEHOLDER_HIGHLIGHT = SHOW_PLACEHOLDER_HIGHLIGHT;');
  expect(await page.evaluate(() => typeof globalThis.SHOW_PLACEHOLDER_HIGHLIGHT)).toBe('boolean');
});

test('placeholders are highlighted when the flag is true', async ({ page }) => {
  await expect(page.locator('mark.ph').first()).toBeAttached();
});

test('flag false: no placeholder is highlighted (variant served with the flag flipped)', async ({ page }) => {
  await page.route(/\/present\.html(\?.*)?$/, async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace(
      /const SHOW_PLACEHOLDER_HIGHLIGHT = true;/,
      'const SHOW_PLACEHOLDER_HIGHLIGHT = false;',
    );
    await route.fulfill({ response: res, body });
  });
  await page.goto('/present.html?print');
  await expect(page.locator('.slide').first()).toBeAttached();
  expect(await page.evaluate(() => globalThis.SHOW_PLACEHOLDER_HIGHLIGHT)).toBe(false);
  await expect(page.locator('mark.ph')).toHaveCount(0);
  // the placeholder text is still there, only unhighlighted
  expect(await page.evaluate(() => document.body.textContent)).toContain('[Company]');
});

test('leaving a slide pauses media inside it', async ({ page }) => {
  await page.evaluate(() => {
    const v = document.createElement('video');
    v.id = 'probe';
    window.__paused = 0;
    v.pause = () => { window.__paused += 1; };
    document.querySelector('.slide.is-current').append(v);
  });
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => window.__paused)).toBe(1);
});

for (const tag of ['video', 'input', 'textarea', 'select']) {
  test(`navigation keys are ignored while a <${tag}> has focus`, async ({ page }) => {
    const first = await currentId(page);
    await page.evaluate((t) => {
      const el = document.createElement(t);
      el.id = 'probe';
      if (t === 'video') el.controls = true;
      el.tabIndex = 0;
      document.querySelector('.slide.is-current').append(el);
      el.focus();
    }, tag);
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('End');
    expect(await currentId(page)).toBe(first);
  });
}

test('navigation keys are ignored in a contenteditable element', async ({ page }) => {
  const first = await currentId(page);
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.contentEditable = 'true';
    document.querySelector('.slide.is-current').append(el);
    el.focus();
  });
  await page.keyboard.press('ArrowRight');
  expect(await currentId(page)).toBe(first);
});

for (const [w, h] of [[1280, 720], [1000, 900]]) {
  test(`slide keeps 16:9 and fits a ${w}x${h} viewport`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    // The browser fires `resize` on its next frame, so retry until the slide has been refit.
    await expect(async () => {
      const box = await current(page).boundingBox();
      expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
      expect(box.x).toBeGreaterThanOrEqual(-0.5);
      expect(box.y).toBeGreaterThanOrEqual(-0.5);
      expect(box.x + box.width).toBeLessThanOrEqual(w + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(h + 0.5);
      // the slide fills the limiting dimension
      expect(Math.max(box.width / w, box.height / h)).toBeGreaterThan(0.99);
    }).toPass({ timeout: 3000 });
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
