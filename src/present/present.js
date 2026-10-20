const SHOW_PLACEHOLDER_HIGHLIGHT = globalThis.SHOW_PLACEHOLDER_HIGHLIGHT ?? true;
// Presenter: one scaled slide at a time (or all slides stacked with ?print).
// Keys: Right/Space/PageDown next, Left/PageUp previous, Home/End, N notes, F fullscreen.
import { renderDeck } from '../render.js';
import deck from '../../content/deck.json';

const SLIDE_W = 1920;
const SLIDE_H = 1080;

/** 1-based slide position from a location hash like "#3"; null when absent or invalid. */
function indexFromHash(hash, count) {
  const n = Number.parseInt(String(hash).replace(/^#/, ''), 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 1), count) - 1;
}

export function startPresenter(deckData, rootEl, options = {}) {
  const win = options.window ?? window;
  const doc = rootEl.ownerDocument;
  const printMode = options.print ?? new URLSearchParams(win.location.search).has('print');
  const ctx = {
    mode: printMode ? 'print' : 'present',
    highlight: SHOW_PLACEHOLDER_HIGHLIGHT,
    assetBase: '',
  };
  const slides = renderDeck(deckData, ctx);

  if (printMode) {
    rootEl.append(...slides);
    return { slides, destroy() {} };
  }

  doc.body.classList.add('present');
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
    slides[index].classList.remove('is-current');
    slides[index].style.transform = '';
    index = target;
    slides[index].classList.add('is-current');
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

  function onKey(event) {
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

const root = typeof document !== 'undefined' && document.getElementById('deck-root');
if (root) startPresenter(deck, root);
