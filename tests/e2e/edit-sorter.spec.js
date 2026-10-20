import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DRAFT_FILE, readDraft, resetDraft } from './helpers/draft.js';

const thumbs = (page) => page.locator('.ed-sorter .ed-thumb');
const thumbOf = (page, id) => page.locator(`.ed-sorter .ed-thumb[data-thumb-id="${id}"]`);
const tool = (thumb, name) => thumb.getByRole('button', { name, exact: true });
const thumbIds = (page) => thumbs(page).evaluateAll((els) => els.map((e) => e.dataset.thumbId));
const draftIds = () => readDraft().slides.map((s) => s.id);
const status = (page) => page.locator('.ed-status');
const notesBox = (page) => page.getByRole('textbox', { name: 'Speaker notes' });
const canvasSlide = (page, id) => page.locator(`.ed-canvas .slide[data-slide-id="${id}"]`);

const SEED = JSON.parse(readFileSync('content/deck.json', 'utf8'));
const SEED_IDS = SEED.slides.map((s) => s.id);
const notesOf = (id) => SEED.slides.find((s) => s.id === id).notes;

/**
 * Drags thumbnail `from` onto the top part of thumbnail `to` (0-based). Both are put in
 * view first: a real pointer cannot scroll the list between press and move.
 */
async function dragThumb(page, from, to) {
  await thumbs(page).nth(Math.min(from, to)).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await thumbs(page).nth(from).dragTo(thumbs(page).nth(to), { targetPosition: { x: 160, y: 12 } });
}

/** ids with the one at `from` moved to `to` (indexes). */
function moved(ids, from, to) {
  const out = ids.slice();
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

/** The draft as Preview (present.html?source=draft) shows it: visible slide ids and header numbers. */
async function previewOf(context) {
  const preview = await context.newPage();
  await preview.goto('/present.html?source=draft');
  await expect(preview.locator('.slide.is-current')).toHaveCount(1);
  const shown = await preview.locator('section.slide').evaluateAll((els) => els.map((e) => ({
    id: e.dataset.slideId,
    num: e.querySelector('.slide-header__num')?.textContent ?? null,
  })));
  await preview.close();
  return shown;
}

test.beforeEach(async ({ page }) => {
  resetDraft();
  await page.goto('/edit.html');
  await expect(page.locator('.ed-frame')).toHaveCount(22);
  await expect(thumbs(page)).toHaveCount(22);
  await expect(status(page)).toHaveText('Saved');
});

test('the sidebar shows a 240px live thumbnail per slide, numbered like the presenter', async ({ page }) => {
  await expect(page.locator('.ed-sidebar')).toBeVisible();
  expect(await thumbIds(page)).toEqual(SEED_IDS);
  const box = await thumbs(page).first().locator('.ed-thumb__stage').boundingBox();
  expect(Math.round(box.width)).toBe(240);
  expect(Math.round(box.height)).toBe(135);
  const nums = await thumbs(page).locator('.ed-thumb__num').allTextContents();
  expect(nums.slice(0, 11)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']);
  expect(nums.at(-1)).toBe('A11');
  // Thumbnails are pictures, not a second copy of the editable fields.
  await expect(page.locator('.ed-sorter [data-slide-id], .ed-sorter [contenteditable]')).toHaveCount(0);
});

test('drag thumbnail 5 above thumbnail 3: the order, the numbers and Preview follow', async ({ page, context }) => {
  const want = moved(SEED_IDS, 4, 2);
  await dragThumb(page, 4, 2);

  await expect.poll(() => thumbIds(page)).toEqual(want);
  await expect(thumbOf(page, 's-modules').locator('.ed-thumb__num')).toHaveText('3');
  await expect(thumbOf(page, 's-fit').locator('.ed-thumb__num')).toHaveText('4');
  await expect(page.locator('.ed-frame[data-slide-id="s-modules"] .ed-frame__label')).toHaveText('Slide 3');
  expect(await page.locator('.ed-frame').evaluateAll((els) => els.map((e) => e.dataset.slideId))).toEqual(want);
  await expect.poll(draftIds).toEqual(want);
  await expect(status(page)).toHaveText('Saved');

  const shown = await previewOf(context);
  expect(shown.map((s) => s.id)).toEqual(want);
  expect(shown.find((s) => s.id === 's-modules').num).toBe('03');
  expect(shown.find((s) => s.id === 's-fit').num).toBe('04');

  await page.keyboard.press('Control+z');
  await expect.poll(() => thumbIds(page)).toEqual(SEED_IDS);
});

test('dropping a thumbnail where it already is changes nothing (no empty undo step)', async ({ page }) => {
  await dragThumb(page, 2, 2);
  await dragThumb(page, 2, 3);
  expect(await thumbIds(page)).toEqual(SEED_IDS);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('keyboard users move a slide with the up/down buttons; focus stays on the button', async ({ page }) => {
  const down = tool(thumbOf(page, 's-problem'), 'Move down');
  await down.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => thumbIds(page)).toEqual(moved(SEED_IDS, 1, 2));
  await expect(down).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => thumbIds(page)).toEqual(moved(SEED_IDS, 1, 3));
  await expect(thumbOf(page, 's-problem').locator('.ed-thumb__num')).toHaveText('4');

  const up = tool(thumbOf(page, 's-title'), 'Move up');
  await expect(up).toBeDisabled();
  await expect(tool(thumbOf(page, 'a11-research'), 'Move down')).toBeDisabled();
  await expect.poll(draftIds).toEqual(moved(SEED_IDS, 1, 3));
});

test('hide slide 8: Preview skips it, its thumbnail is dimmed and labeled "Hidden", the numbers close up', async ({ page, context }) => {
  const thumb = thumbs(page).nth(7);
  await expect(thumb).toHaveAttribute('data-thumb-id', 's-proof');
  await tool(thumb, 'Hide slide').click();

  await expect(thumb).toHaveClass(/is-hidden/);
  await expect(thumb.locator('.ed-thumb__badge')).toHaveText('Hidden');
  await expect(thumb.locator('.ed-thumb__badge')).toBeVisible();
  const opacity = await thumb.locator('.ed-thumb__stage').evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(opacity).toBeLessThan(0.7);
  await expect(thumb.locator('.ed-thumb__num')).toHaveText('');
  await expect(thumbOf(page, 's-package').locator('.ed-thumb__num')).toHaveText('8');
  await expect(page.locator('.ed-frame[data-slide-id="s-proof"] .ed-frame__label')).toHaveText('Hidden');
  await expect(tool(thumb, 'Show slide')).toBeVisible();
  await expect.poll(() => readDraft().slides.find((s) => s.id === 's-proof').hidden).toBe(true);
  await expect(status(page)).toHaveText('Saved');

  const shown = await previewOf(context);
  expect(shown).toHaveLength(21);
  expect(shown.map((s) => s.id)).not.toContain('s-proof');
  expect(shown.find((s) => s.id === 's-package').num).toBe('08');

  await tool(thumb, 'Show slide').click();
  await expect(thumb).not.toHaveClass(/is-hidden/);
  await expect(thumb.locator('.ed-thumb__num')).toHaveText('8');
});

test('Duplicate puts a copy right after the original', async ({ page }) => {
  await tool(thumbOf(page, 's-fit'), 'Duplicate slide').click();
  const want = [...SEED_IDS.slice(0, 3), 's-fit-copy', ...SEED_IDS.slice(3)];
  await expect.poll(() => thumbIds(page)).toEqual(want);
  await expect(page.locator('.ed-frame')).toHaveCount(23);
  await expect(thumbOf(page, 's-fit-copy').locator('.ed-thumb__num')).toHaveText('4');
  await expect.poll(draftIds).toEqual(want);
  const draft = readDraft();
  const [a, b] = ['s-fit', 's-fit-copy'].map((id) => draft.slides.find((s) => s.id === id));
  expect({ ...b, id: 's-fit' }).toEqual(a);
});

test('Delete asks inside the page (never a browser confirm()); Cancel keeps the slide, Delete removes it', async ({ page }) => {
  let nativeDialogs = 0;
  page.on('dialog', (d) => { nativeDialogs += 1; d.dismiss(); });
  const confirm = page.getByRole('dialog', { name: 'Delete slide 2?' });

  await tool(thumbOf(page, 's-problem'), 'Delete slide').click();
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("Today's assessments check if they can do the job.");
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirm).toBeHidden();
  await expect(thumbs(page)).toHaveCount(22);

  await tool(thumbOf(page, 's-problem'), 'Delete slide').click();
  await page.keyboard.press('Escape');
  await expect(confirm).toBeHidden();
  await expect(thumbs(page)).toHaveCount(22);

  await tool(thumbOf(page, 's-problem'), 'Delete slide').click();
  await confirm.getByRole('button', { name: 'Delete slide' }).click();
  await expect(confirm).toBeHidden();
  await expect(thumbs(page)).toHaveCount(21);
  await expect(page.locator('.ed-frame')).toHaveCount(21);
  await expect.poll(draftIds).toEqual(SEED_IDS.filter((id) => id !== 's-problem'));
  expect(nativeDialogs).toBe(0);

  await page.keyboard.press('Control+z');
  await expect.poll(() => thumbIds(page)).toEqual(SEED_IDS);
});

test('the notes drawer edits the current slide notes: data-notes and the draft follow, Ctrl+Z undoes', async ({ page }) => {
  const box = notesBox(page);
  await expect(page.locator('.ed-drawer')).toBeVisible();
  await expect(page.locator('.ed-notes__slide')).toHaveText('Slide 1');
  await expect(box).toHaveValue(notesOf('s-title'));

  await thumbOf(page, 's-proof').locator('.ed-thumb__view').click();
  await expect(page.locator('.ed-notes__slide')).toHaveText('Slide 8');
  await expect(box).toHaveValue(notesOf('s-proof'));
  await expect(thumbOf(page, 's-proof')).toHaveClass(/is-current/);

  await box.fill('Pause here. Then show the photo.');
  await expect(canvasSlide(page, 's-proof')).toHaveAttribute('data-notes', 'Pause here. Then show the photo.');
  await box.blur();
  await expect.poll(() => readDraft().slides.find((s) => s.id === 's-proof').notes).toBe('Pause here. Then show the photo.');
  await expect(status(page)).toHaveText('Saved');

  await page.keyboard.press('Control+z');
  await expect(box).toHaveValue(notesOf('s-proof'));
  await expect(canvasSlide(page, 's-proof')).toHaveAttribute('data-notes', notesOf('s-proof'));

  // Scrolling the slides makes the one in view current.
  await page.locator('.ed-frame[data-slide-id="s-modules"]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(page.locator('.ed-notes__slide')).toHaveText('Slide 5');
  await expect(box).toHaveValue(notesOf('s-modules'));
});

test('typing speaker notes updates data-notes without redrawing the slide or its thumbnail', async ({ page }) => {
  const box = notesBox(page);
  const thumbSlide = thumbOf(page, 's-video').locator('.slide');
  await thumbOf(page, 's-video').locator('.ed-thumb__view').click();
  await expect(page.locator('.ed-notes__slide')).toHaveText('Slide 4');
  // Mark the drawn elements: a redraw would replace them (and restart the video).
  await canvasSlide(page, 's-video').evaluate((el) => { el.__drawn = 'once'; });
  await thumbSlide.evaluate((el) => { el.__drawn = 'once'; });

  await box.click();
  await page.keyboard.press('Control+End');
  await box.pressSequentially(' Smile.');
  await expect(canvasSlide(page, 's-video')).toHaveAttribute('data-notes', `${notesOf('s-video')} Smile.`);
  await box.blur();
  await expect.poll(() => readDraft().slides.find((s) => s.id === 's-video').notes).toBe(`${notesOf('s-video')} Smile.`);
  await page.keyboard.press('Control+z');
  await expect(canvasSlide(page, 's-video')).toHaveAttribute('data-notes', notesOf('s-video'));
  expect(await canvasSlide(page, 's-video').evaluate((el) => el.__drawn)).toBe('once');
  expect(await thumbSlide.evaluate((el) => el.__drawn)).toBe('once');
});

test('placeholders and the PDF re-run on the edited draft follow its order and skip hidden slides', async ({ page }) => {
  test.setTimeout(240_000);
  const realFiles = ['content/deck.json', 'placeholders.md', 'deck.html', 'DEUS-Pitch.pdf'];
  const before = realFiles.map((f) => (existsSync(f) ? statSync(f).mtimeMs : null));

  await tool(thumbOf(page, 's-trust'), 'Hide slide').click(); // slide 7
  await tool(thumbOf(page, 's-video'), 'Move up').click(); // slide 4 -> 3
  await tool(thumbOf(page, 's-pilot'), 'Delete slide').click(); // slide 10
  await page.getByRole('dialog').getByRole('button', { name: 'Delete slide' }).click();
  await expect(status(page)).toHaveText('Saved');
  const draft = readDraft();
  expect(draft.slides.map((s) => s.id).slice(0, 5)).toEqual(['s-title', 's-problem', 's-video', 's-fit', 's-modules']);

  const out = mkdtempSync(join(tmpdir(), 'deus-sorter-'));
  try {
    const env = { ...process.env, DECK_FILE: DRAFT_FILE, DECK_OUT_DIR: out };
    execFileSync(process.execPath, ['scripts/placeholders.js'], { env, stdio: 'pipe' });
    const md = readFileSync(join(out, 'placeholders.md'), 'utf8');
    const headings = md.split('\n').filter((l) => l.startsWith('## Slide')).map((l) => l.replace(/:.*/, ''));
    // Slides 3 to 6 have no text placeholders; their asset to-dos carry the new numbers.
    expect(md).toContain('- [ ] Slide 3: Product demo video');
    expect(md).toContain('- [ ] Slide 6: Replace report screenshot');
    expect(md).toContain('## Slide 8: What it changes');
    expect(md).not.toContain('Built for Indonesians'); // hidden
    expect(md).not.toContain("See if we pick who you'd pick"); // deleted
    expect(headings.slice(0, 2)).toEqual(['## Slide 8', '## Slide A1']);

    execFileSync(process.execPath, ['export-pdf.js', '--source', 'local'], { env, stdio: 'pipe', timeout: 200_000 });
    const pdf = join(out, 'DEUS-Pitch.pdf');
    const visible = draft.slides.filter((s) => !s.hidden);
    expect(visible).toHaveLength(20);
    expect(execFileSync('pdfinfo', [pdf], { encoding: 'utf8' })).toMatch(/^Pages:\s+20$/m);
    const page3 = execFileSync('pdftotext', ['-f', '3', '-l', '3', pdf, '-'], { encoding: 'utf8' });
    expect(page3).toContain('This is what your candidates play');
    const all = execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });
    expect(all).not.toContain('Built for Indonesians');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
  // The real deck, checklist, offline deck and PDF were not touched.
  expect(realFiles.map((f) => (existsSync(f) ? statSync(f).mtimeMs : null))).toEqual(before);
});
