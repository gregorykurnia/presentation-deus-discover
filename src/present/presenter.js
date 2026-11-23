// Presenter library: one scaled slide at a time (or all slides stacked with ?print).
// Keys: Right/Space/PageDown next, Left/PageUp previous, Home/End, N notes, F fullscreen.
// Touch: swipe left/up or tap the right two-thirds for next; swipe right/down or tap the left third back.
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

  // The screen's size in CSS px. Not innerWidth: on phones that grows with any content wider
  // than the screen, so a slide sized from it widens the page, which widens the slide again
  // until it sits off-screen. (jsdom has no layout, so tests fall back to innerWidth.)
  function viewport() {
    const de = doc.documentElement;
    return { w: de.clientWidth || win.innerWidth, h: de.clientHeight || win.innerHeight };
  }

  function fit() {
    const { w, h } = viewport();
    const scale = Math.min(w / SLIDE_W, h / SLIDE_H);
    const x = (w - SLIDE_W * scale) / 2;
    const y = (h - SLIDE_H * scale) / 2;
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
    // So do cycling pictures (img.cycle), from the first one.
    slides[index].querySelectorAll('.img-slot[data-cycle] .img-slot__next').forEach((el) => {
      el.getAnimations?.().forEach((a) => { a.currentTime = 0; });
    });
    // The trailer does too, with sound. Browsers allow sound only after a key press or click
    // on the page (arriving by arrow key or clicker counts); before that it plays muted.
    slides[index].querySelectorAll('video[data-play-on-show]').forEach((m) => {
      m.currentTime = 0;
      m.muted = false;
      Promise.resolve(m.play?.()).catch(() => {
        m.muted = true;
        Promise.resolve(m.play?.()).catch(() => {});
      });
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

  // Phones and tablets: swipe left or up for the next slide, right or down for the previous one;
  // a tap on the right two-thirds of the screen goes forward, on the left third back.
  // Touches on links, buttons and media controls are left to them, and so is a pinch or a pan
  // while the page is zoomed in.
  const SWIPE_MIN = 40; // px of finger travel that counts as a swipe
  const TAP_MAX = 12; // px of finger travel that still counts as a tap
  let touchStart = null;

  function isControl(el) {
    return Boolean(el?.closest?.('a, button, video, audio, input, textarea, select, label, [role="button"]'))
      || el?.isContentEditable === true;
  }

  function onTouchStart(event) {
    const zoomed = (win.visualViewport?.scale ?? 1) > 1.05;
    touchStart = event.touches?.length === 1 && !zoomed && !isControl(event.target)
      ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
      : null;
  }

  function onTouchEnd(event) {
    const start = touchStart;
    touchStart = null;
    const touch = event.changedTouches?.[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    let step;
    if (Math.max(ax, ay) >= SWIPE_MIN) {
      step = ax >= ay ? (dx < 0 ? 1 : -1) : (dy < 0 ? 1 : -1);
    } else if (ax <= TAP_MAX && ay <= TAP_MAX) {
      step = touch.clientX < viewport().w / 3 ? -1 : 1;
    } else {
      return;
    }
    // Stop the browser's follow-up click landing on whatever sits there on the new slide.
    if (event.cancelable) event.preventDefault();
    show(index + step);
  }

  function onTouchCancel() { touchStart = null; }

  function onHash() {
    const i = indexFromHash(win.location.hash, slides.length);
    if (i !== null && i !== index) show(i, { updateHash: false });
  }

  win.addEventListener('keydown', onKey);
  win.addEventListener('resize', fit);
  win.addEventListener('hashchange', onHash);
  win.addEventListener('touchstart', onTouchStart, { passive: true });
  win.addEventListener('touchend', onTouchEnd, { passive: false });
  win.addEventListener('touchcancel', onTouchCancel);
  show(indexFromHash(win.location.hash, slides.length) ?? 0);

  return {
    slides,
    destroy() {
      win.removeEventListener('keydown', onKey);
      win.removeEventListener('resize', fit);
      win.removeEventListener('hashchange', onHash);
      win.removeEventListener('touchstart', onTouchStart);
      win.removeEventListener('touchend', onTouchEnd);
      win.removeEventListener('touchcancel', onTouchCancel);
    },
  };
}
