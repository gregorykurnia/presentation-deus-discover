// Saving safely (final review of Phase 2): no reloads on save, outside edits never
// overwritten, a conflict stops editing for good, and save errors are reported.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readDraft, resetDraft, writeDraft } from './helpers/draft.js';

const CONFLICT = 'Someone else changed this deck. Reload to see their changes.';
const HEADLINE = 'DEUS Game-Based Assessment';

const field = (page, slideId, path) => page.locator(`.slide[data-slide-id="${slideId}"] [data-field="${path}"]`);
const status = (page) => page.locator('.ed-status');
const banner = (page) => page.locator('.ed-conflict');
const notice = (page) => page.locator('.ed-notice');
const button = (page, name) => page.getByRole('button', { name, exact: true });
const uploadInput = (page) => page.locator('input[type="file"][data-upload-json]');
const isPut = (route) => route.request().method() === 'PUT';

/** Clicks into a field and puts the caret at its end. */
async function editEnd(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
  await page.keyboard.press('Control+End');
}

test.beforeEach(async ({ page }) => {
  resetDraft();
  await page.goto('/edit.html');
  await expect(page.locator('.ed-frame')).toHaveCount(23);
  await expect(status(page)).toHaveText('Saved');
});

test('with plain present.html open, a save never reloads the editor; present.html shows the draft after its own reload', async ({ page, context }) => {
  const present = await context.newPage();
  await present.goto('/present.html');
  await expect(present.locator('.slide.is-current')).toHaveCount(1);
  await page.bringToFront();
  await page.evaluate(() => { window.__notReloaded = true; });
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.type()); d.dismiss(); });

  const headline = field(page, 's-title', 'headline');
  await editEnd(page, headline);
  await page.keyboard.type(' Live.'); // the caret stays in the field while it saves
  await expect.poll(() => readDraft().slides[0].fields.headline).toBe(`${HEADLINE} Live.`);
  await expect(status(page)).toHaveText('Saved');
  await page.waitForTimeout(1000); // time for any reload to arrive
  expect(await page.evaluate(() => window.__notReloaded)).toBe(true);
  expect(dialogs).toEqual([]);
  await expect(headline).toBeFocused();

  await present.reload();
  await expect(present.locator('.slide.is-current [data-field="headline"]')).toHaveText(`${HEADLINE} Live.`);
  await present.close();
});

test('a deck file changed outside the editor (rev not bumped) is not overwritten: the next edit is a conflict', async ({ page }) => {
  const outside = readDraft();
  outside.slides[0].fields.subtitle = 'Changed in the file by hand';
  writeDraft(outside); // same rev, new content: Claude Code, git checkout, a text editor
  const headline = field(page, 's-title', 'headline');
  await editEnd(page, headline);
  await page.keyboard.type(' Mine.');
  await headline.blur();
  await expect(banner(page)).toContainText(CONFLICT);
  await expect(status(page)).toHaveText('Not saved');
  expect(readDraft()).toEqual(outside);
});

test('after a conflict the banner stays, other messages cannot replace it, and nothing can be edited', async ({ page }) => {
  const other = readDraft();
  other.rev = 99;
  other.slides[0].fields.subtitle = 'Their change';
  writeDraft(other);
  const headline = field(page, 's-title', 'headline');
  await editEnd(page, headline);
  await page.keyboard.type(' Mine.');
  await headline.blur();
  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText(CONFLICT);
  await expect(banner(page).getByRole('button', { name: 'Reload' })).toBeVisible();
  await expect(banner(page).getByRole('button', { name: 'Download my version' })).toBeVisible();

  // A later message (here: a broken file given to Upload JSON) does not replace it.
  await uploadInput(page).setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{ nope') });
  await page.waitForTimeout(300);
  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText(CONFLICT);
  await expect(banner(page)).not.toContainText("isn't valid JSON");

  // Nothing can be edited any more.
  const subtitle = field(page, 's-title', 'subtitle');
  await expect(subtitle).toHaveAttribute('contenteditable', 'false');
  const before = await subtitle.textContent();
  await subtitle.click();
  await page.keyboard.type('zzz');
  await expect(subtitle).toHaveText(before);
  for (const name of ['Undo', 'Redo', 'Upload JSON', 'Preview']) await expect(button(page, name)).toBeDisabled();
  await expect(button(page, 'Preview')).toHaveAttribute('title', /saved deck/);
  await expect(page.getByRole('textbox', { name: 'Speaker notes' })).toBeDisabled();
  const thumb = page.locator('.ed-thumb[data-thumb-id="s-proof"]');
  for (const name of ['Move up', 'Move down', 'Hide slide', 'Duplicate slide', 'Delete slide']) {
    await expect(thumb.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  await page.locator('.slide[data-slide-id="s-proof"] [data-image]').first().click();
  await expect(page.locator('.ed-pic')).toHaveCount(0);

  // "Download my version" keeps the edits that were not saved.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    banner(page).getByRole('button', { name: 'Download my version' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('deck-my-version.json');
  const mine = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(mine.slides[0].fields.headline).toBe(`${HEADLINE} Mine.`);
  expect(readDraft()).toEqual(other);
});

test('leaving asks only while a change is not saved, not just because a field has focus', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.type()); d.accept(); });
  const headline = field(page, 's-title', 'headline');
  await editEnd(page, headline);
  await page.keyboard.type(' Done.');
  await expect.poll(() => readDraft().slides[0].fields.headline).toBe(`${HEADLINE} Done.`);
  await expect(status(page)).toHaveText('Saved');
  await expect(headline).toBeFocused();
  await page.reload();
  await expect(status(page)).toHaveText('Saved');
  expect(dialogs).toEqual([]);

  // Not saved yet (still inside the autosave pause): the browser asks.
  await editEnd(page, field(page, 's-title', 'subtitle'));
  await page.keyboard.type('!');
  await page.reload();
  expect(dialogs).toEqual(['beforeunload']);
});

test('Upload JSON with a slide that cannot be drawn lists it and changes nothing; the editor keeps working', async ({ page }) => {
  const bad = readDraft();
  bad.slides.find((s) => s.id === 's-proof').fields.stats = [null]; // passes validateDeck
  bad.slides[0].fields.headline = 'From the bad file';
  await uploadInput(page).setInputFiles({ name: 'hand-made.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(notice(page)).toContainText("hand-made.json has slides that can't be shown, so nothing was changed");
  await expect(notice(page)).toContainText('Slide 8 (s-proof)');
  await expect(field(page, 's-title', 'headline')).toHaveText(HEADLINE);
  await expect(button(page, 'Undo')).toBeDisabled();

  const headline = field(page, 's-title', 'headline');
  await editEnd(page, headline);
  await page.keyboard.type(' Still works.');
  await headline.blur();
  await expect.poll(() => readDraft().slides[0].fields.headline).toBe(`${HEADLINE} Still works.`);
  expect(readDraft().slides.find((s) => s.id === 's-proof').fields.stats[0]).not.toBeNull();
});

test('a save the store refuses (4xx) shows its detail and is not retried; the next change saves', async ({ page }) => {
  let puts = 0;
  await page.route('**/__deck', (route) => {
    if (!isPut(route)) return route.continue();
    puts += 1;
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ errors: ['Slide s-title: the server said no'] }) });
  });
  const subtitle = field(page, 's-title', 'subtitle');
  await editEnd(page, subtitle);
  await page.keyboard.type('!');
  await subtitle.blur();
  await expect(notice(page)).toContainText("Your latest changes couldn't be saved.");
  await expect(notice(page)).toContainText('Slide s-title: the server said no');
  await expect(status(page)).toHaveText('Not saved');
  await page.waitForTimeout(5000); // longer than the retry pause
  expect(puts).toBe(1);

  await page.unroute('**/__deck');
  await editEnd(page, subtitle);
  await page.keyboard.type('?');
  await subtitle.blur();
  await expect(status(page)).toHaveText('Saved');
  await expect(notice(page)).toBeHidden();
  expect(readDraft().slides[0].fields.subtitle).toMatch(/!\?$/);
});

test('a network failure while saving says so with the detail and keeps retrying until it saves', async ({ page }) => {
  let failures = 0;
  await page.route('**/__deck', (route) => {
    if (!isPut(route) || failures >= 1) return route.continue();
    failures += 1;
    return route.abort('internetdisconnected');
  });
  const subtitle = field(page, 's-title', 'subtitle');
  await editEnd(page, subtitle);
  await page.keyboard.type('!');
  await subtitle.blur();
  await expect(status(page)).toHaveText("Couldn't save. Retrying…");
  await expect(notice(page)).toContainText("Couldn't save your latest changes. Trying again every few seconds.");
  await expect(notice(page).locator('li')).toHaveCount(1); // the browser's own words
  await expect(status(page)).toHaveText('Saved', { timeout: 8000 });
  await expect(notice(page)).toBeHidden();
  expect(readDraft().slides[0].fields.subtitle).toMatch(/!$/);
});

test('Preview opens its window at once (before the save finishes), then shows the saved draft', async ({ page, context }) => {
  await page.route('**/__deck', async (route) => {
    if (isPut(route)) await new Promise((r) => setTimeout(r, 2500));
    return route.continue();
  });
  const headline = field(page, 's-title', 'headline');
  await editEnd(page, headline);
  await page.keyboard.type(' Slow.');
  const opened = context.waitForEvent('page', { timeout: 1500 });
  await button(page, 'Preview').click();
  const preview = await opened; // a popup blocker allows only windows opened inside the click
  await expect(preview).toHaveURL(/\/present\.html\?source=draft(#\d+)?$/, { timeout: 8000 });
  await expect(preview.locator('.slide.is-current [data-field="headline"]')).toHaveText(`${HEADLINE} Slow.`);
  await preview.close();
});
