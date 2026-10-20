// Ruling R5: the print path (PDF, QA) must not measure the report slide before its
// callouts are sized to the screenshot. With a screenshot of another aspect ratio
// that loads late, the callouts must still sit on the displayed image.
import { test, expect } from '@playwright/test';
import { readDraft, resetDraft, writeDraft } from './helpers/draft.js';
import { waitForPrintReady } from '../../scripts/lib/print-deck.js';

const OTHER_RATIO = 'assets/logo-lockup-dark.png'; // 1600x1294, the frame is 1180x740

test('print waits until the report callouts are placed on a screenshot of another aspect ratio', async ({ page }) => {
  resetDraft();
  const deck = readDraft();
  const report = deck.slides.find((s) => s.id === 's-report').images.report;
  report.src = OTHER_RATIO;
  report.fit = 'contain';
  writeDraft(deck);
  // The screenshot arrives late, after the deck has rendered.
  await page.route(`**/${OTHER_RATIO}`, async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });

  // Nothing orders an image's load handlers before its decode() promise: make them
  // run late (as a busy page could) so the print path has to wait for the sizing itself.
  await page.addInitScript(() => {
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (type !== 'load' || !(this instanceof HTMLImageElement) || typeof fn !== 'function') return add.call(this, type, fn, opts);
      return add.call(this, type, (e) => setTimeout(() => fn.call(this, e), 800), opts);
    };
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.emulateMedia({ media: 'print' });
  await page.goto('/present.html?source=draft&print');
  await page.waitForSelector('section.slide');
  const problems = await waitForPrintReady(page);
  expect(problems).toEqual([]);

  // Measured right after the wait, as export-pdf.js and qa.js do.
  const placed = await page.evaluate(() => {
    const slide = document.querySelector('.slide[data-slide-id="s-report"]');
    const frame = slide.querySelector('.report__frame');
    const img = frame.querySelector('[data-image="report"] img');
    const box = frame.getBoundingClientRect();
    const ar = img.naturalWidth / img.naturalHeight;
    // object-fit: contain, centred: the displayed picture inside the frame.
    const w = Math.min(box.width, box.height * ar);
    const h = Math.min(box.height, box.width / ar);
    const shown = { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, w, h };
    const dots = [...slide.querySelectorAll('[data-callout] .callout__dot')].map((d) => {
      const r = d.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    return { sized: frame.classList.contains('report__frame--sized'), shown, dots };
  });
  expect(placed.sized).toBe(true);
  const { callouts } = report;
  placed.dots.forEach((dot, i) => {
    expect(Math.abs(dot.x - (placed.shown.left + (callouts[i].x / 100) * placed.shown.w))).toBeLessThan(3);
  });
});
