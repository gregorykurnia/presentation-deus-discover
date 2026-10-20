// Presenter library: one scaled slide at a time (or all slides stacked with ?print).
// Keys: Right/Space/PageDown next, Left/PageUp previous, Home/End, N notes, F fullscreen.
// No deck import here: the entry (present.js, later the Phase 3 viewer) passes the deck in.
//   startPresenter(deck, rootEl, { highlight, print, window }) -> { slides, destroy() }
import { renderDeck } from '../render.js';

const SLIDE_W = 1920;
const SLIDE_H = 1080;

/** 1-based slide position from a location hash like "#3"; null when absent or invalid. */
function indexFromHash(hash, count) {
  const n = Number.parseInt(String(hash).replace(/^#/, ''), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 1), count) - 1;
}

function emptyState(doc) {
  const box = doc.createElement('div');
  box.className = 'present-empty';
  const title = doc.createElement('p');
  title.className = 'present-empty__title';
  title.textContent = 'No slides to show';
  const line = doc.createElement('p');
  line.className = 'present-empty__text';
  line.textContent = 'Every slide in this deck is hidden. Show a slide in the editor to present it.';
  box.append(title, line);
  return box;
}

export function startPresenter(deckData, rootEl, options = {}) {
  const win = options.window ?? window;
  const doc = rootEl.ownerDocument;
  const printMode = options.print ?? new URLSearchParams(win.location.search).has('print');
  const ctx = {
    mode: printMode ? 'print' : 'present',
    highlight: options.highlight ?? globalThis.SHOW_PLACEHOLDER_HIGHLIGHT ?? true,
    assetBase: '',
  };
  const slides = renderDeck(deckData, ctx);

  if (printMode) {
    rootEl.append(...slides);
    return { slides, destroy() {} };
  }

  doc.body.classList.add('present');
  if (!slides.length) {
    // Every slide is hidden: say so calmly instead of failing on slides[0].
    rootEl.append(emptyState(doc));
    return { slides, destroy() {} };
  }
  rootEl.append(...slides);

  const counter = doc.createElement('div');
  counter.className = 'counter no-print';
  const notes = doc.createElement('div');
  notes.className = 'notes-panel no-print';
  notes.hidden = true;
  rootEl.append(counter, notes);

  let index = 0;

  function fit() {
    const scale = Math.min(win.innerWidth / SLIDE_W, win.innerHeight / SLIDE_H);
    const x = (win.innerWidth - SLIDE_W * scale) / 2;
    const y = (win.innerHeight - SLIDE_H * scale) / 2;
    slides[index].style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  function show(next, { updateHash = true } = {}) {
    const target = Math.min(Math.max(next, 0), slides.length - 1);
    // A video/audio in the slide being left must not keep playing unseen.
    slides[index].querySelectorAll('video, audio').forEach((m) => m.pause());
    slides[index].classList.remove('is-current');
    slides[index].style.transform = '';
    index = target;
    slides[index].classList.add('is-current');
    // Autoplaying clips start from the beginning each time their slide is shown.
    slides[index].querySelectorAll('video[autoplay]').forEach((m) => {
      m.currentTime = 0;
      Promise.resolve(m.play?.()).catch(() => {});
    });
    fit();
    counter.textContent = `${index + 1} / ${slides.length}`;
    notes.textContent = slides[index].dataset.notes ?? '';
    if (updateHash) win.history.replaceState(null, '', `#${index + 1}`);
  }

  function toggleFullscreen() {
    const result = doc.fullscreenElement
      ? doc.exitFullscreen()
      : doc.documentElement.requestFullscreen();
    // Browsers may refuse (no user gesture, headless); the deck keeps working.
    Promise.resolve(result).catch(() => {});
  }

  // Keys that belong to a focused control (video controls, form fields, editable text).
  function isTypingTarget(el) {
    return Boolean(el?.closest?.('video, audio, input, textarea, select'))
      || el?.isContentEditable === true;
  }

  function onKey(event) {
    if (isTypingTarget(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ':
        show(index + 1); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp':
        show(index - 1); break;
      case 'Home': show(0); break;
      case 'End': show(slides.length - 1); break;
      case 'n': case 'N': notes.hidden = !notes.hidden; break;
      case 'f': case 'F': toggleFullscreen(); break;
      default: return;
    }
    event.preventDefault();
  }

  function onHash() {
    const i = indexFromHash(win.location.hash, slides.length);
    if (i !== null && i !== index) show(i, { updateHash: false });
  }

  win.addEventListener('keydown', onKey);
  win.addEventListener('resize', fit);
  win.addEventListener('hashchange', onHash);
  show(indexFromHash(win.location.hash, slides.length) ?? 0);

  return {
    slides,
    destroy() {
      win.removeEventListener('keydown', onKey);
      win.removeEventListener('resize', fit);
      win.removeEventListener('hashchange', onHash);
    },
  };
}
