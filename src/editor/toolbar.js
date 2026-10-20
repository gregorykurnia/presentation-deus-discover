// The editor toolbar's file and publishing buttons (edit.html): Preview, Download
// JSON, Upload JSON, and Publish / Lock (disabled until Phase 3, Ruling R2).
// Undo / Redo stay in editor.js with the history they drive.
import { validateDeck } from '../model.js';
import { PHASE3_MESSAGE } from '../store/local.js';

export function attachToolbar(api, { buttons, uploadInput }) {
  const doc = uploadInput.ownerDocument;

  for (const name of ['publish', 'lock']) {
    buttons[name].disabled = true;
    buttons[name].title = PHASE3_MESSAGE;
  }

  buttons.preview.addEventListener('click', async () => {
    await api.commit();
    doc.defaultView.open('present.html?source=draft', '_blank');
  });

  buttons.download.addEventListener('click', async () => {
    await api.commit();
    const { id, rev: _rev, ...rest } = api.deck;
    const json = `${JSON.stringify({ id, rev: api.rev, ...rest }, null, 2)}\n`;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = doc.createElement('a');
    a.href = url;
    a.download = 'deck.json';
    doc.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  buttons.upload.addEventListener('click', () => uploadInput.click());
  uploadInput.addEventListener('change', async () => {
    const file = uploadInput.files[0];
    uploadInput.value = '';
    if (!file) return;
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
    api.clearNotice();
    api.apply(next); // one undo step: Ctrl+Z brings the previous deck back
  });
}
