// Editor shell (edit.html): toolbar, the column of editable slides, the deck
// state with undo/redo, and autosave through a store adapter (src/store/*.js).
//
//   startEditor({ store, plugins }) -> Promise<api | null>
//
// Plugins (Task 8 pictures, Task 9 sorter + notes) are functions called with the
// api below before the first render:
//   api.deck                   the current deck (immutable; never mutate it)
//   api.apply(nextDeck)        record an edit: undo step + re-render changed slides + autosave
//   api.onRender(fn)           fn(frames) after slides are (re)rendered; frame = .ed-frame,
//                              its slide is frame.querySelector('.slide')
//   api.frameOf(slideId)       the .ed-frame of a slide
//   api.store                  the store adapter (uploadImage, ...)
//   api.sidebar, api.drawer    empty, hidden regions to fill (unhide them when used)
import { renderSlide } from '../render.js';
import { setField, slideLabel, validateDeck } from '../model.js';
import { createHistory } from './history.js';
import { createAutosave } from './autosave.js';
import { attachTextEditing, checkFit, makeEditable } from './text.js';
import { PHASE3_MESSAGE } from '../store/local.js';

const CTX = { mode: 'edit', highlight: true, assetBase: '' };
const SLIDE_W = 1920;
const STAGE_MAX_W = 1280;
const FIT_WARNING = "Text doesn't fit";
const SAVE_TEXT = { pending: 'Saving…', saving: 'Saving…', saved: 'Saved', error: "Couldn't save. Retrying…", conflict: 'Not saved' };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) node.setAttribute(k, v === true ? '' : v);
  node.append(...children.filter((c) => c != null));
  return node;
}

/** "2" -> "Slide 2", "A" -> "Appendix", "A3" -> "Appendix A3", "" (hidden) -> "Hidden". */
function frameTitle(label) {
  if (!label) return 'Hidden';
  if (label === 'A') return 'Appendix';
  return label.startsWith('A') ? `Appendix ${label}` : `Slide ${label}`;
}

export async function startEditor({ store, plugins = [], doc = document }) {
  const $ = (sel) => doc.querySelector(sel);
  const canvas = $('.ed-canvas');
  const statusEl = $('.ed-status');
  const notice = $('.ed-notice');
  const buttons = Object.fromEntries([...doc.querySelectorAll('[data-action]')].map((b) => [b.dataset.action, b]));
  const uploadInput = $('input[data-upload-json]');

  // ---------- Messages ----------
  function showNotice(title, lines = [], actions = []) {
    const close = el('button', { type: 'button', class: 'ed-notice__close', 'aria-label': 'Dismiss' }, '×');
    close.addEventListener('click', () => { notice.hidden = true; });
    notice.replaceChildren(
      el('div', { class: 'ed-notice__body' },
        el('p', { class: 'ed-notice__title' }, title),
        lines.length ? el('ul', { class: 'ed-notice__list' }, ...lines.map((l) => el('li', {}, l))) : null,
        actions.length ? el('div', { class: 'ed-notice__actions' }, ...actions) : null),
      close,
    );
    notice.hidden = false;
  }

  function setStatus(state, text) {
    statusEl.dataset.state = state;
    statusEl.textContent = text;
  }

  let loaded;
  try {
    loaded = await store.load();
  } catch (err) {
    setStatus('error', 'Not loaded');
    showNotice("The draft couldn't be loaded.", [err.message, 'The editor runs on the dev server: run npm run edit, then open /edit.html.']);
    return null;
  }

  // ---------- State ----------
  let deck = loaded.deck;
  let typing = false; // a field has text changes not yet recorded as an undo step
  const history = createHistory();
  history.push(deck);
  const rendered = new WeakMap(); // frame -> { slide, label } it was rendered from
  const renderListeners = [];

  const autosave = createAutosave({
    save: (d, rev) => store.saveDraft(d, rev),
    rev: deck.rev,
    onStatus({ state, error }) {
      setStatus(state, SAVE_TEXT[state]);
      if (state === 'conflict') {
        const reload = el('button', { type: 'button', class: 'ed-btn' }, 'Reload');
        reload.addEventListener('click', () => doc.defaultView.location.reload());
        showNotice(error.message, [], [reload]);
      }
    },
  });

  // ---------- Slides ----------
  const frameOf = (slideId) => [...canvas.children].find((f) => f.dataset.slideId === slideId) ?? null;
  const slideById = (id) => deck.slides.find((s) => s.id === id);

  function updateFit(frame) {
    const over = checkFit(frame.querySelector('.slide')) > 0;
    const warning = frame.querySelector('.ed-fit-warning');
    if (over && !warning) frame.querySelector('.ed-frame__bar').append(el('span', { class: 'ed-fit-warning' }, FIT_WARNING));
    if (!over && warning) warning.remove();
  }

  function buildFrame(slide, label) {
    const slideEl = makeEditable(renderSlide(slide, { ...CTX, label }));
    const frame = el('article', { class: 'ed-frame', 'data-slide-id': slide.id },
      el('div', { class: 'ed-frame__bar' },
        el('span', { class: `ed-frame__label${label ? '' : ' ed-frame__label--hidden'}` }, frameTitle(label)),
        el('span', { class: 'ed-frame__layout' }, slide.layout)),
      el('div', { class: 'ed-stage' }, slideEl));
    rendered.set(frame, { slide, label });
    return frame;
  }

  /** Re-renders the slides whose content or number changed; keeps the others (and their focus). */
  function sync() {
    const current = [...canvas.children];
    const byId = new Map(current.map((f) => [f.dataset.slideId, f]));
    const fresh = [];
    const next = deck.slides.map((slide) => {
      const label = slideLabel(deck, slide.id);
      const frame = byId.get(slide.id);
      const was = frame && rendered.get(frame);
      if (was && was.slide === slide && was.label === label) return frame;
      const built = buildFrame(slide, label);
      fresh.push(built);
      return built;
    });
    const sameOrder = current.length === next.length && current.every((f, i) => f.dataset.slideId === next[i].dataset.slideId);
    if (sameOrder) next.forEach((f, i) => { if (current[i] !== f) current[i].replaceWith(f); });
    else canvas.replaceChildren(...next);
    fresh.forEach(updateFit);
    if (fresh.length) renderListeners.forEach((fn) => fn(fresh));
  }

  function updateButtons() {
    buttons.undo.disabled = !(typing || history.canUndo);
    buttons.redo.disabled = typing || !history.canRedo;
  }

  /** Records the text typed into a field as one undo step. */
  function commitTyping() {
    if (!typing) return;
    typing = false;
    history.push(deck);
  }

  function apply(next) {
    commitTyping();
    if (next === deck) return;
    deck = next;
    history.push(deck);
    sync();
    autosave.schedule(deck);
    updateButtons();
  }

  function step(direction) {
    commitTyping();
    const next = direction === 'undo' ? history.undo() : history.redo();
    if (next) {
      deck = next;
      sync();
      autosave.schedule(deck);
    }
    updateButtons();
  }

  // ---------- Text editing ----------
  attachTextEditing(canvas, {
    onInput(field, value) {
      const frame = field.closest('.ed-frame');
      deck = setField(deck, frame.dataset.slideId, field.dataset.field, value);
      // The frame now shows this text, so an undo back to the old slide re-renders it.
      rendered.set(frame, { ...rendered.get(frame), slide: slideById(frame.dataset.slideId) });
      typing = true;
      autosave.schedule(deck);
      updateFit(frame);
      updateButtons();
    },
    onCommit(field) {
      const frame = field.closest('.ed-frame');
      if (!frame?.isConnected) return; // removed by an undo while focused
      commitTyping();
      const slide = slideById(frame.dataset.slideId);
      const { label } = rendered.get(frame);
      // Redraw the field's placeholder marks, sentence lines and glyphs in place.
      const fresh = renderSlide(slide, { ...CTX, label }).querySelector(`[data-field="${CSS.escape(field.dataset.field)}"]`);
      if (fresh) field.replaceChildren(...fresh.childNodes);
      rendered.set(frame, { slide, label });
      updateFit(frame);
      updateButtons();
      autosave.flush();
    },
    onHistory: step,
  });

  // ---------- Toolbar ----------
  for (const name of ['publish', 'lock']) {
    buttons[name].disabled = true;
    buttons[name].title = PHASE3_MESSAGE;
  }
  buttons.undo.addEventListener('click', () => step('undo'));
  buttons.redo.addEventListener('click', () => step('redo'));

  buttons.preview.addEventListener('click', async () => {
    commitTyping();
    await autosave.flush();
    doc.defaultView.open('present.html?source=draft', '_blank');
  });

  buttons.download.addEventListener('click', async () => {
    commitTyping();
    await autosave.flush();
    const { id, rev: _rev, ...rest } = deck;
    const json = `${JSON.stringify({ id, rev: autosave.rev, ...rest }, null, 2)}\n`;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = el('a', { href: url, download: 'deck.json' });
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
      showNotice(`${file.name} isn't valid JSON, so nothing was changed.`, [err.message]);
      return;
    }
    const errors = validateDeck(next);
    if (errors.length) {
      showNotice(`${file.name} can't be used, so nothing was changed:`, errors);
      return;
    }
    notice.hidden = true;
    apply(next); // one undo step: Ctrl+Z brings the previous deck back
  });

  // ---------- Keys, sizing, leaving ----------
  doc.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'z' || key === 'y') {
      e.preventDefault();
      step(key === 'z' && !e.shiftKey ? 'undo' : 'redo');
    }
  }, true);

  const resize = () => {
    const style = getComputedStyle(canvas);
    const inner = canvas.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const w = Math.max(240, Math.min(STAGE_MAX_W, inner));
    canvas.style.setProperty('--stage-w', `${w}px`);
    canvas.style.setProperty('--stage-scale', String(w / SLIDE_W));
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  doc.defaultView.addEventListener('beforeunload', (e) => {
    if (autosave.unsaved || typing) e.preventDefault();
  });

  // ---------- Start ----------
  const api = {
    get deck() { return deck; },
    apply,
    onRender(fn) { renderListeners.push(fn); },
    frameOf,
    store,
    sidebar: $('.ed-sidebar'),
    drawer: $('.ed-drawer'),
  };
  plugins.forEach((plugin) => plugin(api));
  sync();
  updateButtons();
  setStatus('saved', SAVE_TEXT.saved);
  // Measure overflow again once DM Sans is in (the first pass may use fallback metrics).
  doc.fonts.ready.then(() => [...canvas.children].forEach(updateFit));
  return api;
}
