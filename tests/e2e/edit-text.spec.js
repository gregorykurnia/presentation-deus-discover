import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readDraft, resetDraft, writeDraft } from './helpers/draft.js';

const PHASE3 = 'Available after sign-in is set up (Phase 3)';
const CONFLICT = 'Someone else changed this deck. Reload to see their changes.';
const HEADLINE = 'Fit the role, they perform. Fit your company, they stay.';

const field = (page, slideId, path) => page.locator(`.slide[data-slide-id="${slideId}"] [data-field="${path}"]`);
const frame = (page, slideId) => page.locator(`.ed-frame:has(> .ed-stage > .slide[data-slide-id="${slideId}"])`);
const status = (page) => page.locator('.ed-status');

/** Clicks into a field and puts the caret at its end. */
async function editEnd(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
  await page.keyboard.press('Control+End');
}

test.beforeEach(async ({ page }) => {
  resetDraft();
  await page.goto('/edit.html');
  await expect(page.locator('.ed-frame')).toHaveCount(22);
  await expect(status(page)).toHaveText('Saved');
});

test('click the slide-1 headline, type, blur: the draft file updates within 1.5s and the toolbar says Saved', async ({ page }) => {
  const headline = field(page, 's-title', 'headline');
  await expect(headline).toHaveAttribute('contenteditable', 'plaintext-only');
  await editEnd(page, headline);
  await page.keyboard.type(' Today.');
  await headline.blur();
  await expect.poll(() => readDraft().slides[0].fields.headline, { timeout: 1500 }).toBe(`${HEADLINE} Today.`);
  await expect(status(page)).toHaveText('Saved');
  expect(readDraft().rev).toBeGreaterThan(1);
  // After blur the field is redrawn with its sentence lines again.
  await expect(headline.locator('.line')).toHaveCount(3);
});

test('pasting rich text inserts plain text only', async ({ page }) => {
  const subtitle = field(page, 's-title', 'subtitle');
  await subtitle.click();
  await page.keyboard.press('Control+A');
  await subtitle.evaluate((el) => {
    const data = new DataTransfer();
    data.setData('text/html', '<b style="color:red">Bold</b> <a href="https://example.test">link</a>');
    data.setData('text/plain', 'Bold\nlink');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(subtitle).toHaveText('Bold link');
  await expect(subtitle.locator('b, a, [style]')).toHaveCount(0);
  await subtitle.blur();
  await expect.poll(() => readDraft().slides[0].fields.subtitle).toBe('Bold link');
});

test('300 extra characters in a stat label: red outline + "Text doesn\'t fit", same font size; Ctrl+Z restores it', async ({ page }) => {
  const label = field(page, 's-proof', 'stats.0.label');
  const box = page.locator('.slide[data-slide-id="s-proof"] .proof__stats');
  const warning = frame(page, 's-proof').getByText("Text doesn't fit");
  await expect(box).not.toHaveClass(/fits-error/);
  await expect(warning).toHaveCount(0);

  await editEnd(page, label);
  await page.keyboard.type(' word'.repeat(60));
  await expect(label).toHaveText(`MT candidates${' word'.repeat(60)}`);
  await expect(box).toHaveClass(/fits-error/);
  expect(await box.evaluate((el) => getComputedStyle(el).outlineColor)).toBe('rgb(229, 37, 42)');
  await expect(warning).toBeVisible();
  expect(await label.evaluate((el) => getComputedStyle(el).fontSize)).toBe('28px');

  await page.keyboard.press('Control+z');
  await expect(label).toHaveText('MT candidates');
  await expect(box).not.toHaveClass(/fits-error/);
  await expect(warning).toHaveCount(0);
  await expect.poll(() => readDraft().slides[1].fields.stats[0].label).toBe('MT candidates');

  await page.keyboard.press('Control+Shift+z');
  await expect(label).toHaveText(`MT candidates${' word'.repeat(60)}`);
  await expect(box).toHaveClass(/fits-error/);
});

test('toolbar Undo / Redo buttons step through edits', async ({ page }) => {
  const undo = page.getByRole('button', { name: 'Undo' });
  const redo = page.getByRole('button', { name: 'Redo' });
  await expect(undo).toBeDisabled();
  const subtitle = field(page, 's-title', 'subtitle');
  await editEnd(page, subtitle);
  await page.keyboard.type('!');
  await subtitle.blur();
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(subtitle).not.toContainText('!');
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(subtitle).toContainText('!');
});

test('Publish and Lock are disabled until sign-in exists (Phase 3)', async ({ page }) => {
  for (const name of ['Publish', 'Lock']) {
    const button = page.getByRole('button', { name });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('title', PHASE3);
  }
});

test('Preview opens present.html?source=draft showing the saved draft', async ({ page, context }) => {
  const headline = field(page, 's-title', 'headline');
  await editEnd(page, headline);
  await page.keyboard.type(' Draft.');
  const [preview] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Preview' }).click(),
  ]);
  await expect(preview).toHaveURL(/\/present\.html\?source=draft$/);
  await expect(preview.locator('.slide.is-current [data-field="headline"]')).toHaveText(`${HEADLINE} Draft.`);
  await preview.close();
});

test('a save against a draft someone else changed shows the conflict message and does not overwrite', async ({ page }) => {
  const other = readDraft();
  other.rev = 99;
  other.slides[0].fields.subtitle = 'Their change';
  writeDraft(other);
  const headline = field(page, 's-title', 'headline');
  await editEnd(page, headline);
  await page.keyboard.type(' Mine.');
  await headline.blur();
  await expect(page.getByRole('alert')).toContainText(CONFLICT);
  expect(readDraft()).toEqual(other);
});

test('Download JSON saves the current draft', async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download JSON' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('deck.json');
  expect(JSON.parse(readFileSync(await download.path(), 'utf8'))).toEqual(readDraft());
});

test('Upload JSON shows validation errors in the page, and a valid file replaces the draft', async ({ page }) => {
  const input = page.locator('input[type="file"][data-upload-json]');
  const bad = { id: 'x', rev: 1, slides: [null, { id: 's-x', layout: 'nope', section: 'main' }] };
  await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Slide 1: not a slide object');
  await expect(alert).toContainText("Slide s-x: unknown layout 'nope'");
  expect(readDraft().rev).toBe(1);

  await input.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ nope') });
  await expect(alert).toContainText("isn't valid JSON");

  const good = readDraft();
  good.slides[0].fields.headline = 'Uploaded headline';
  await input.setInputFiles({ name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good)) });
  await expect(field(page, 's-title', 'headline')).toHaveText('Uploaded headline');
  await expect.poll(() => readDraft().slides[0].fields.headline).toBe('Uploaded headline');
});
