// The editor toolbar's file and publishing buttons (edit.html): Preview, Download
// JSON, Upload JSON, and Publish / Lock (disabled until Phase 3, Ruling R2).
// Undo / Redo stay in editor.js with the history they drive.
import { slideLabel, validateDeck } from '../model.js';
import { renderSlide } from '../render.js';
import { PHASE3_MESSAGE } from '../store/local.js';

const PREVIEW_URL = 'present.html?source=draft';
const PREVIEW_AFTER_CONFLICT = 'Preview shows the saved deck. Reload the editor first.';

/** Saves the deck as a JSON file in the browser's downloads (pretty-printed, id and rev first). */
export function downloadDeck(doc, deck, rev, name = 'deck.json') {
  const { id, rev: _rev, ...rest } = deck;
  const json = `${JSON.stringify({ id, rev, ...rest }, null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = doc.createElement('a');
  a.href = url;
  a.download = name;
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Draws every slide the ways the editor does (edit canvas, print thumbnails) and
 * returns one line per slide that cannot be drawn: "Slide 2 (s-proof): <reason>".
 * A file can pass validateDeck() and still miss a nested field a layout needs.
 */
export function renderProblems(deck) {
  const problems = [];
  for (const slide of deck.slides) {
    const label = slideLabel(deck, slide.id);
    try {
      for (const mode of ['edit', 'print']) renderSlide(slide, { mode, highlight: true, assetBase: '', label });
    } catch (err) {
      const name = !label ? 'Hidden slide' : label === 'A' ? 'Appendix divider' : `Slide ${label}`;
      problems.push(`${name} (${slide.id}): ${err.message}`);
    }
  }
  return problems;
}

export function attachToolbar(api, { buttons, uploadInput }) {
  const doc = uploadInput.ownerDocument;
  const win = doc.defaultView;

  for (const name of ['publish', 'lock']) {
    buttons[name].disabled = true;
    buttons[name].title = PHASE3_MESSAGE;
  }

  // The window opens inside the click (popup blockers allow that), then shows the
  // draft once the last changes are saved.
  buttons.preview.addEventListener('click', () => {
    if (api.readOnly) return;
    const url = new URL(PREVIEW_URL, doc.baseURI).href;
    const preview = win.open('', '_blank');
    try {
      preview.document.title = 'Preview';
      preview.document.body.textContent = 'Saving your changes…';
    } catch { /* blocked or not ours to write: the URL below still applies */ }
    api.commit().then(() => {
      if (preview && !preview.closed) preview.location.href = url;
      else win.open(url, '_blank');
    });
  });

  buttons.download.addEventListener('click', async () => {
    await api.commit();
    downloadDeck(doc, api.deck, api.rev);
  });

  buttons.upload.addEventListener('click', () => uploadInput.click());
  uploadInput.addEventListener('change', async () => {
    const file = uploadInput.files[0];
    uploadInput.value = '';
    if (!file || api.readOnly) return;
    let next;
    try {
      next = JSON.parse(await file.text());
    } catch (err) {
      api.notify(`${file.name} isn't valid JSON, so nothing was changed.`, [err.message]);
      return;
    }
    const errors = validateDeck(next);
    if (errors.length) {
      api.notify(`${file.name} can't be used, so nothing was changed:`, errors);
      return;
    }
    const broken = renderProblems(next);
    if (broken.length) {
      api.notify(`${file.name} has slides that can't be shown, so nothing was changed:`, broken);
      return;
    }
    api.clearNotice();
    api.apply(next); // one undo step: Ctrl+Z brings the previous deck back
  });

  api.onReadOnly(() => {
    for (const name of ['upload', 'preview']) buttons[name].disabled = true;
    buttons.preview.title = PREVIEW_AFTER_CONFLICT;
  });
}
