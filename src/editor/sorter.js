// Slide sorter (edit.html, left sidebar), as an editor plugin (see editor.js):
//   - one live thumbnail per slide, rendered like the PDF and scaled to 240px,
//     numbered like the presenter (hidden slides: dimmed, "Hidden", no number);
//   - drag a thumbnail to reorder (HTML5 drag and drop), or Move up / Move down
//     (buttons, so keyboard users can reorder too);
//   - Hide / Show, Duplicate, and Delete (confirmed in the page, never confirm());
//   - the current slide (api.current) is highlighted: clicking a thumbnail scrolls
//     to that slide, and scrolling the slides makes the one in view current.
// Every change is one api.apply() step (undo + autosave).
import { renderSlide } from '../render.js';
import {
  deleteSlide, duplicateSlide, moveSlide, onlyNotesChanged, setHidden, slideLabel, slideTitle,
} from '../model.js';
import { createConfirm } from './confirm.js';

const CTX = { mode: 'print', highlight: true, assetBase: '' };
const DRAG_TYPE = 'application/x-deus-slide';

// 20x20 line icons, drawn with currentColor.
const ICONS = {
  up: 'M10 15.5v-11M5.5 9 10 4.5 14.5 9',
  down: 'M10 4.5v11M5.5 11 10 15.5 14.5 11',
  hide: 'M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5ZM10 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM3.5 16.5l13-13',
  show: 'M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5ZM10 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z',
  duplicate: 'M7.5 7.5h8v8h-8zM4.5 12.5v-8h8',
  delete: 'M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6M8.7 9v4M11.3 9v4',
};

function el(doc, tag, attrs = {}, ...children) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) node.setAttribute(k, v === true ? '' : v);
  node.append(...children.filter((c) => c != null));
  return node;
}

function icon(doc, name) {
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

/** "slide 3", "slide A2", "the appendix divider", "this hidden slide" (mid-sentence). */
function nameOf(label) {
  if (!label) return 'this hidden slide';
  return label === 'A' ? 'the appendix divider' : `slide ${label}`;
}

export function sorterPlugin(api) {
  const side = api.sidebar;
  const doc = side.ownerDocument;
  const win = doc.defaultView;
  const h = (...args) => el(doc, ...args);
  const count = h('span', { class: 'ed-sorter__count' });
  const list = h('ol', { class: 'ed-sorter' });
  side.append(h('div', { class: 'ed-sorter__head' }, h('h2', { class: 'ed-sorter__title' }, 'Slides'), count), list);
  side.hidden = false;

  const items = new Map(); // slide id -> item
  const indexOf = (id) => api.deck.slides.findIndex((s) => s.id === id);

  function toolButton(name, label, extra = '') {
    return h('button', { type: 'button', class: `ed-tool${extra}`, 'data-do': name, 'aria-label': label, title: label }, icon(doc, name));
  }

  function createItem(id) {
    const stage = h('div', { class: 'ed-thumb__stage', inert: true });
    const view = h('button', { type: 'button', class: 'ed-thumb__view', 'data-do': 'view' },
      stage, h('span', { class: 'ed-thumb__badge' }, 'Hidden'));
    const tools = {
      up: toolButton('up', 'Move up'),
      down: toolButton('down', 'Move down'),
      hide: toolButton('hide', 'Hide slide'),
      duplicate: toolButton('duplicate', 'Duplicate slide'),
      delete: toolButton('delete', 'Delete slide', ' ed-tool--danger'),
    };
    const num = h('span', { class: 'ed-thumb__num', 'aria-hidden': 'true' });
    const li = h('li', { class: 'ed-thumb', draggable: 'true', 'data-thumb-id': id },
      num,
      h('div', { class: 'ed-thumb__body' }, view,
        h('div', { class: 'ed-thumb__tools' },
          tools.up, tools.down, h('span', { class: 'ed-thumb__sep', 'aria-hidden': 'true' }),
          tools.hide, tools.duplicate, tools.delete)));
    return { li, num, stage, view, tools, slide: null, label: null };
  }

  /** Re-renders the thumbnail only when its slide (other than its notes) or number changed. */
  function paint(item, slide, label) {
    const same = item.label === label && onlyNotesChanged(item.slide, slide);
    item.slide = slide;
    if (same) return;
    item.label = label;
    const thumb = renderSlide(slide, { ...CTX, label });
    // A picture of the slide: not a second copy of the editor's slide (tests, notes, ids).
    thumb.removeAttribute('data-slide-id');
    thumb.removeAttribute('data-notes');
    item.stage.replaceChildren(thumb);
  }

  function setState(item, slide, label, i, n) {
    item.num.textContent = label;
    item.li.classList.toggle('is-hidden', Boolean(slide.hidden));
    item.view.setAttribute('aria-label', label ? `Go to ${nameOf(label)}` : 'Go to hidden slide');
    const hideLabel = slide.hidden ? 'Show slide' : 'Hide slide';
    const { hide } = item.tools;
    if (hide.getAttribute('aria-label') !== hideLabel) {
      hide.setAttribute('aria-label', hideLabel);
      hide.title = hideLabel;
      hide.replaceChildren(icon(doc, slide.hidden ? 'show' : 'hide'));
    }
    const locked = api.readOnly; // after a save conflict: look and go to, nothing else
    item.tools.up.disabled = locked || i === 0;
    item.tools.down.disabled = locked || i === n - 1;
    item.tools.hide.disabled = locked;
    item.tools.duplicate.disabled = locked;
    item.tools.delete.disabled = locked || n === 1; // a deck keeps at least one slide
    item.li.draggable = !locked;
  }

  function refresh() {
    const { deck } = api;
    const n = deck.slides.length;
    const keep = new Set(deck.slides.map((s) => s.id));
    for (const [id, item] of items) {
      if (!keep.has(id)) {
        item.li.remove();
        items.delete(id);
      }
    }
    const active = doc.activeElement;
    deck.slides.forEach((slide, i) => {
      let item = items.get(slide.id);
      if (!item) items.set(slide.id, (item = createItem(slide.id)));
      const label = slideLabel(deck, slide.id);
      paint(item, slide, label);
      setState(item, slide, label, i, n);
      if (list.children[i] !== item.li) list.insertBefore(item.li, list.children[i] ?? null);
    });
    // Moving a thumbnail in the DOM drops focus: give it back (to the other arrow at an
    // end), and keep the moved thumbnail in view for keyboard users.
    if (active && list.contains(active)) {
      if (active !== doc.activeElement) {
        const target = active.disabled ? active.closest('.ed-thumb__tools').querySelector('[data-do="up"]:not(:disabled), [data-do="down"]:not(:disabled)') : active;
        target?.focus({ preventScroll: true });
      }
      reveal(items.get(active.closest('.ed-thumb').dataset.thumbId));
    }
    const hidden = deck.slides.filter((s) => s.hidden).length;
    count.textContent = `${n}${hidden ? ` · ${hidden} hidden` : ''}`;
    markCurrent();
    if (revealPending) {
      revealPending = false;
      reveal(items.get(api.current));
    }
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    win.requestAnimationFrame(() => {
      queued = false;
      refresh();
    });
  }

  // ---------- Current slide ----------
  let pinned = null; // a slide chosen by click: stays current while it is in view
  let revealPending = false; // a new thumbnail (a duplicate) became current before it was drawn
  let pointerInside = false; // never scroll the list under the user's pointer
  side.addEventListener('pointerenter', () => { pointerInside = true; });
  side.addEventListener('pointerleave', () => { pointerInside = false; });

  /** Scrolls the sidebar (only the sidebar, not the page) so the thumbnail is in view. */
  function reveal(item) {
    if (!item || pointerInside) return;
    const box = side.getBoundingClientRect();
    const r = item.li.getBoundingClientRect();
    const pad = 12;
    if (r.top < box.top + pad) side.scrollTop -= box.top + pad - r.top;
    else if (r.bottom > box.bottom - pad) side.scrollTop += r.bottom - (box.bottom - pad);
  }

  function markCurrent() {
    for (const [id, item] of items) {
      const on = id === api.current;
      item.li.classList.toggle('is-current', on);
      if (on) item.view.setAttribute('aria-current', 'true');
      else item.view.removeAttribute('aria-current');
    }
    for (const frame of api.canvas.children) frame.classList.toggle('is-current', frame.dataset.slideId === api.current);
  }

  function goTo(id) {
    pinned = id;
    api.setCurrent(id);
    api.frameOf(id)?.scrollIntoView({ block: 'start' });
  }

  /** The visible band of the page between the toolbar and the notes drawer. */
  function band() {
    const top = doc.querySelector('.ed-toolbar')?.getBoundingClientRect().bottom ?? 0;
    const drawer = api.drawer && !api.drawer.hidden ? api.drawer.getBoundingClientRect().top : win.innerHeight;
    return { top, bottom: Math.min(drawer, win.innerHeight) };
  }

  function track() {
    const { top, bottom } = band();
    if (pinned) {
      const r = api.frameOf(pinned)?.getBoundingClientRect();
      if (r && r.bottom > top + 40 && r.top < bottom - 40) return;
      pinned = null;
    }
    const line = top + (bottom - top) * 0.3;
    let best = null;
    let bestDistance = Infinity;
    for (const frame of api.canvas.children) {
      const r = frame.getBoundingClientRect();
      const distance = r.top > line ? r.top - line : Math.max(0, line - r.bottom);
      if (distance < bestDistance) {
        best = frame;
        bestDistance = distance;
      }
    }
    if (best) api.setCurrent(best.dataset.slideId);
  }

  let tracking = false;
  win.addEventListener('scroll', () => {
    if (tracking) return;
    tracking = true;
    win.requestAnimationFrame(() => {
      tracking = false;
      track();
    });
  }, { passive: true });

  // Working on a slide in the canvas makes it current.
  const choose = (e) => {
    const frame = e.target.closest?.('.ed-frame');
    if (!frame) return;
    pinned = frame.dataset.slideId;
    api.setCurrent(pinned);
  };
  api.canvas.addEventListener('pointerdown', choose);
  api.canvas.addEventListener('focusin', choose);

  api.onCurrent((id) => {
    markCurrent();
    const item = items.get(id);
    if (item) reveal(item);
    else revealPending = true;
  });
  api.onRender(markCurrent);
  api.onChange(schedule);
  api.onReadOnly(() => {
    endDrag();
    refresh();
  });

  // ---------- Buttons ----------
  function move(from, to) {
    if (to < 0 || to >= api.deck.slides.length || to === from) return;
    api.apply(moveSlide(api.deck, from, to));
  }

  list.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-do]');
    const li = button?.closest('.ed-thumb');
    if (!li || button.disabled) return;
    const id = li.dataset.thumbId;
    const i = indexOf(id);
    if (i < 0) return;
    const slide = api.deck.slides[i];
    switch (button.dataset.do) {
      case 'view': goTo(id); break;
      case 'up': move(i, i - 1); break;
      case 'down': move(i, i + 1); break;
      case 'hide': api.apply(setHidden(api.deck, id, !slide.hidden)); break;
      case 'duplicate': {
        const next = duplicateSlide(api.deck, id);
        api.apply(next);
        goTo(next.slides[i + 1].id);
        break;
      }
      case 'delete': askDelete(slide); break;
      default:
    }
  });

  // ---------- Delete, confirmed in the page ----------
  const ask = createConfirm(doc);

  async function askDelete(slide) {
    const heading = slideTitle(slide);
    const ok = await ask({
      title: `Delete ${nameOf(slideLabel(api.deck, slide.id))}?`,
      text: `${heading ? `“${heading}” and its` : 'The slide and its'} speaker notes will be removed. Undo (Ctrl+Z) brings it back.`,
      confirmLabel: 'Delete slide',
    });
    const i = indexOf(slide.id);
    if (!ok || i < 0) return;
    api.apply(deleteSlide(api.deck, slide.id));
    // Focus the thumbnail that took its place (the deleted one is gone).
    refresh();
    const next = api.deck.slides[Math.min(i, api.deck.slides.length - 1)];
    items.get(next?.id)?.view.focus({ preventScroll: true });
  }

  // ---------- Drag and drop ----------
  let dragId = null;
  let drop = null; // { li, after }

  function showDrop(next) {
    if (drop?.li === next?.li && drop?.after === next?.after) return;
    drop?.li.classList.remove('is-drop-before', 'is-drop-after');
    drop = next;
    drop?.li.classList.add(drop.after ? 'is-drop-after' : 'is-drop-before');
  }

  /** The thumbnail nearest to a pointer y, and whether the drop goes after it. */
  function dropAt(y) {
    const lis = [...list.children];
    const li = lis.find((x) => x.getBoundingClientRect().bottom > y) ?? lis.at(-1);
    if (!li) return null;
    const r = li.getBoundingClientRect();
    return { li, after: y > r.top + r.height / 2 };
  }

  function endDrag() {
    items.get(dragId)?.li.classList.remove('is-dragging');
    dragId = null;
    showDrop(null);
  }

  list.addEventListener('dragstart', (e) => {
    const li = e.target.closest?.('.ed-thumb');
    if (!li) return;
    if (api.readOnly) {
      e.preventDefault();
      return;
    }
    dragId = li.dataset.thumbId;
    // Only our own type: a thumbnail dropped on a text field must not insert text.
    e.dataTransfer.setData(DRAG_TYPE, dragId);
    e.dataTransfer.effectAllowed = 'move';
    win.requestAnimationFrame(() => li.classList.add('is-dragging'));
  });
  list.addEventListener('dragover', (e) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    showDrop(dropAt(e.clientY));
  });
  list.addEventListener('dragleave', (e) => {
    if (dragId && !list.contains(e.relatedTarget)) showDrop(null);
  });
  list.addEventListener('drop', (e) => {
    if (!dragId) return;
    e.preventDefault();
    const target = dropAt(e.clientY);
    const from = indexOf(dragId);
    endDrag();
    if (!target || from < 0) return;
    let to = indexOf(target.li.dataset.thumbId) + (target.after ? 1 : 0);
    if (from < to) to -= 1;
    move(from, to);
  });
  list.addEventListener('dragend', endDrag);

  refresh();
}
