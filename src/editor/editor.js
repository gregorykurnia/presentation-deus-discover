// Editor shell (edit.html): toolbar, the column of editable slides, the deck
// state with undo/redo, and autosave through a store adapter (src/store/*.js).
//
//   startEditor({ store, plugins }) -> Promise<api | null>
//
// Plugins (Task 8 pictures, Task 9 sorter + notes) are functions called with the
// api below before the first render:
//   api.deck                   the current deck (immutable; never mutate it)
//   api.apply(nextDeck)        record an edit: undo step + re-render changed slides + autosave
//   api.edit(nextDeck)         a live edit while typing (notes): re-render + autosave; all
//                              such edits become one undo step at api.commit() (or the next apply)
//   api.commit()               ends a live edit; resolves once it is saved
//   api.onChange(fn)           fn(deck) after every change of api.deck (edits, typing, undo)
//   api.onRender(fn)           fn(frames) after slides are (re)rendered; frame = .ed-frame,
//                              its slide is frame.querySelector('.slide')
//   api.current, api.setCurrent(id), api.onCurrent(fn)
//                              the slide being worked on (sidebar highlight, notes drawer)
//   api.frameOf(slideId)       the .ed-frame of a slide
//   api.canvas                 the column of .ed-frame elements
//   api.notify(title, lines)   shows a message (an error) above the slides; api.clearNotice()
//   api.store                  the store adapter (uploadImage, ...)
//   api.rev                    the draft's saved revision
//   api.readOnly, api.onReadOnly(fn)
//                              true (and fn() called once) after a save conflict: editing
//                              stops; apply/edit/undo do nothing; plugins disable their controls
//   api.sidebar, api.drawer    empty, hidden regions to fill (unhide them when used)
import { renderSlide } from '../render.js';
import { onlyNotesChanged, setField, slideLabel } from '../model.js';
import { createHistory } from './history.js';
import { createAutosave } from './autosave.js';
import { attachTextEditing, checkFit, makeEditable } from './text.js';
import { attachToolbar, downloadDeck } from './toolbar.js';

const CTX = { mode: 'edit', highlight: true, assetBase: '' };
const SLIDE_W = 1920;
const STAGE_MAX_W = 1280;
const FIT_WARNING = "Text doesn't fit";
const SAVE_TEXT = {
  pending: 'Saving…', saving: 'Saving…', saved: 'Saved', error: "Couldn't save. Retrying…", failed: 'Not saved', conflict: 'Not saved',
};
const CONFLICT_TEXT = 'Editing is paused so nothing gets mixed up. Your latest edits are not saved: '
  + 'Download my version keeps a copy of them. Reload shows the deck as it is now.';

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
  const conflictBanner = $('.ed-conflict');
  const buttons = Object.fromEntries([...doc.querySelectorAll('[data-action]')].map((b) => [b.dataset.action, b]));

  // ---------- Messages ----------
  let saveNoticeShown = false; // the notice shows a save problem (hidden again once saved)
  function hideNotice() {
    notice.hidden = true;
    saveNoticeShown = false;
  }

  function showNotice(title, lines = [], actions = []) {
    const close = el('button', { type: 'button', class: 'ed-notice__close', 'aria-label': 'Dismiss' }, '×');
    close.addEventListener('click', hideNotice);
    saveNoticeShown = false;
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
  let readOnly = false; // after a save conflict
  let retryNoticed = false; // the current run of failed saves has been reported
  const history = createHistory();
  history.push(deck);
  const rendered = new WeakMap(); // frame -> { slide, label } it was rendered from
  const renderListeners = [];
  const changeListeners = [];
  const currentListeners = [];
  const readOnlyListeners = [];
  let current = deck.slides[0]?.id ?? null;

  const autosave = createAutosave({
    save: (d, rev) => store.saveDraft(d, rev),
    rev: deck.rev,
    onStatus({ state, error }) {
      setStatus(state, SAVE_TEXT[state]);
      if (error) statusEl.title = error.message;
      else statusEl.removeAttribute('title');
      if (state === 'conflict') stopEditing(error.message);
      else if (state === 'error' && !retryNoticed) {
        // A network or server problem: say so once, with the detail, while it retries.
        retryNoticed = true;
        showNotice("Couldn't save your latest changes. Trying again every few seconds.", [error.message]);
        saveNoticeShown = true;
      } else if (state === 'failed') {
        // Refused by the store (4xx): not retried until the next change.
        showNotice("Your latest changes couldn't be saved.", [
          ...error.message.split('\n'),
          'They are still on this page. Download JSON keeps a copy of them.',
        ]);
        saveNoticeShown = true;
      } else if (state === 'saved') {
        retryNoticed = false;
        if (saveNoticeShown) hideNotice();
      }
    },
  });

  /** After a conflict: a banner no other message replaces, and no more edits. */
  function stopEditing(message) {
    if (readOnly) return;
    readOnly = true;
    const reload = el('button', { type: 'button', class: 'ed-btn ed-btn--primary' }, 'Reload');
    reload.addEventListener('click', () => doc.defaultView.location.reload());
    const keep = el('button', { type: 'button', class: 'ed-btn' }, 'Download my version');
    keep.addEventListener('click', () => downloadDeck(doc, deck, autosave.rev, 'deck-my-version.json'));
    conflictBanner.replaceChildren(
      el('div', { class: 'ed-conflict__body' },
        el('p', { class: 'ed-conflict__title' }, message),
        el('p', { class: 'ed-conflict__text' }, CONFLICT_TEXT)),
      el('div', { class: 'ed-conflict__actions' }, reload, keep));
    conflictBanner.hidden = false;
    if (saveNoticeShown) hideNotice(); // the banner says it all now
    canvas.classList.add('is-readonly');
    for (const field of canvas.querySelectorAll('[data-field]')) field.setAttribute('contenteditable', 'false');
    if (canvas.contains(doc.activeElement)) doc.activeElement.blur();
    updateButtons();
    readOnlyListeners.forEach((fn) => fn());
  }

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
    const slideEl = renderSlide(slide, { ...CTX, label });
    if (!readOnly) makeEditable(slideEl);
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
      if (was && was.label === label && onlyNotesChanged(was.slide, slide)) {
        // Unchanged, or only its speaker notes: no redraw (a <video> keeps playing, focus stays).
        if (was.slide !== slide) {
          frame.querySelector('.slide').setAttribute('data-notes', slide.notes ?? '');
          rendered.set(frame, { slide, label });
        }
        return frame;
      }
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
    buttons.undo.disabled = readOnly || !(typing || history.canUndo);
    buttons.redo.disabled = readOnly || typing || !history.canRedo;
  }

  /** Records the text typed into a field as one undo step. */
  function commitTyping() {
    if (!typing) return;
    typing = false;
    history.push(deck);
  }

  function setCurrent(id) {
    if (id === current || !slideById(id)) return;
    current = id;
    currentListeners.forEach((fn) => fn(id));
  }

  /** Tells the plugins; when the current slide is gone, the one now at its place is current. */
  function changed(prev) {
    if (current && !slideById(current)) {
      const at = Math.max(0, prev.slides.findIndex((s) => s.id === current));
      current = null;
      setCurrent(deck.slides[Math.min(at, deck.slides.length - 1)]?.id);
    }
    changeListeners.forEach((fn) => fn(deck));
  }

  function apply(next) {
    if (readOnly) return;
    commitTyping();
    if (next === deck) return;
    const prev = deck;
    deck = next;
    history.push(deck);
    sync();
    autosave.schedule(deck);
    updateButtons();
    changed(prev);
  }

  function edit(next) {
    if (readOnly || next === deck) return;
    const prev = deck;
    deck = next;
    typing = true;
    sync();
    autosave.schedule(deck);
    updateButtons();
    changed(prev);
  }

  function commit() {
    commitTyping();
    updateButtons();
    return autosave.flush();
  }

  function step(direction) {
    if (readOnly) return;
    commitTyping();
    const next = direction === 'undo' ? history.undo() : history.redo();
    if (next) {
      const prev = deck;
      deck = next;
      sync();
      autosave.schedule(deck);
      changed(prev);
    }
    updateButtons();
  }

  // ---------- Text editing ----------
  attachTextEditing(canvas, {
    onInput(field, value) {
      if (readOnly) return;
      const frame = field.closest('.ed-frame');
      deck = setField(deck, frame.dataset.slideId, field.dataset.field, value);
      // The frame now shows this text, so an undo back to the old slide re-renders it.
      rendered.set(frame, { ...rendered.get(frame), slide: slideById(frame.dataset.slideId) });
      typing = true;
      autosave.schedule(deck);
      updateFit(frame);
      updateButtons();
      changeListeners.forEach((fn) => fn(deck));
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
  buttons.undo.addEventListener('click', () => step('undo'));
  buttons.redo.addEventListener('click', () => step('redo'));

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
  // Next frame: resizing the slides changes the canvas height, which would re-notify
  // the observer inside its own callback (a "ResizeObserver loop" error).
  new ResizeObserver(() => doc.defaultView.requestAnimationFrame(resize)).observe(canvas);
  resize();

  // Ask before leaving only when a change has not reached the store.
  doc.defaultView.addEventListener('beforeunload', (e) => {
    if (autosave.unsaved) e.preventDefault();
  });

  // ---------- Start ----------
  const api = {
    get deck() { return deck; },
    apply,
    edit,
    commit,
    onChange(fn) { changeListeners.push(fn); },
    onRender(fn) { renderListeners.push(fn); },
    get current() { return current; },
    setCurrent,
    onCurrent(fn) { currentListeners.push(fn); },
    frameOf,
    canvas,
    notify: (title, lines = []) => showNotice(title, lines),
    clearNotice: hideNotice,
    get readOnly() { return readOnly; },
    onReadOnly(fn) { readOnlyListeners.push(fn); },
    store,
    get rev() { return autosave.rev; },
    sidebar: $('.ed-sidebar'),
    drawer: $('.ed-drawer'),
  };
  attachToolbar(api, { buttons, uploadInput: $('input[data-upload-json]') });
  plugins.forEach((plugin) => plugin(api));
  sync();
  updateButtons();
  setStatus('saved', SAVE_TEXT.saved);
  // Measure overflow again once DM Sans is in (the first pass may use fallback metrics).
  doc.fonts.ready.then(() => [...canvas.children].forEach(updateFit));
  return api;
}
