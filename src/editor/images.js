// Picture fields in the editor (edit.html), as an editor plugin (see editor.js):
//   - click an empty [data-image] slot, or drop a file on any slot -> upload and replace;
//   - click a filled slot -> a small popover: Fill / Fit, the focus point, Replace…;
//   - drag a callout on the report slide -> its x/y (percent of the displayed screenshot).
// Every change is one api.apply() step (undo + autosave). Uploads go through
// store.uploadImage(file) -> { src }.
import { setImage } from '../model.js';

const MB = 1024 * 1024;

const KINDS = {
  photo: {
    types: { 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] },
    max: 10 * MB,
    tooBig: 'Image is larger than 10 MB. Please use a smaller file.',
    wrongType: 'Please use a JPG, PNG or WebP image.',
    noun: 'picture',
    hint: 'JPG, PNG or WebP, up to 10 MB',
  },
  video: {
    types: { 'video/mp4': ['mp4'] },
    max: 200 * MB,
    tooBig: 'Video is larger than 200 MB. Please use a smaller file.',
    wrongType: 'Please use an MP4 video.',
    noun: 'video',
    hint: 'MP4, up to 200 MB',
  },
};
const EXT_TYPES = Object.fromEntries(Object.values(KINDS)
  .flatMap((k) => Object.entries(k.types).flatMap(([type, exts]) => exts.map((ext) => [ext, type]))));

/** The file's media type; when the browser gives none, the type of its extension (or ''). */
function typeOf(file) {
  if (file.type) return file.type;
  const dot = file.name?.lastIndexOf('.') ?? -1;
  return dot < 0 ? '' : (EXT_TYPES[file.name.slice(dot + 1).toLowerCase()] ?? '');
}

/**
 * null when the file can go into a slot of this kind, else the message to show
 * (Ruling R4): 'photo' = JPG/PNG/WebP up to 10 MB, 'video' = MP4 up to 200 MB.
 */
export function checkImageFile(file, kind = 'photo') {
  const spec = KINDS[kind];
  if (!(typeOf(file) in spec.types)) return spec.wrongType;
  if (file.size > spec.max) return spec.tooBig;
  return null;
}

/** The kind of slot an image key is: the video slide's "video" plays an MP4; the rest are photos. */
export const slotKind = (key) => (key === 'video' ? 'video' : 'photo');

/** The file as uploaded: a type-less file gets the type of its extension (the server checks it). */
export function uploadableFile(file) {
  if (file.type) return file;
  const type = typeOf(file);
  return type ? new File([file], file.name, { type, lastModified: file.lastModified }) : file;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round1 = (v) => Math.round(v * 10) / 10;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) node.setAttribute(k, v === true ? '' : v);
  node.append(...children.filter((c) => c != null));
  return node;
}

/** Calls onMove(e) for every pointer move until release, then onEnd(). */
function trackPointer(target, down, onMove, onEnd) {
  target.setPointerCapture?.(down.pointerId);
  const move = (e) => onMove(e);
  const end = () => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', end);
    onEnd();
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
}

export function imagesPlugin(api) {
  const { canvas } = api;
  const doc = canvas.ownerDocument;
  const win = doc.defaultView;
  const slotAt = (node) => node?.closest?.('.ed-stage [data-image]') ?? null;
  const where = (slot) => ({ slideId: slot.closest('.ed-frame').dataset.slideId, key: slot.dataset.image });
  const slotOf = ({ slideId, key }) => api.frameOf(slideId)?.querySelector(`.slide [data-image="${CSS.escape(key)}"]`) ?? null;
  const imageOf = ({ slideId, key }) => api.deck.slides.find((s) => s.id === slideId)?.images?.[key] ?? {};
  const isEmpty = (slot) => slot.classList.contains('img-slot--missing');

  // ---------- Upload ----------
  async function replace(at, file) {
    const spec = KINDS[slotKind(at.key)];
    const problem = checkImageFile(file, slotKind(at.key));
    if (problem) {
      api.notify(problem, [`${file.name} was not used.`]);
      return;
    }
    slotOf(at)?.classList.add('ed-uploading');
    try {
      const { src } = await api.store.uploadImage(uploadableFile(file));
      api.apply(setImage(api.deck, at.slideId, at.key, { src }));
    } catch (err) {
      slotOf(at)?.classList.remove('ed-uploading');
      api.notify(`The ${spec.noun} couldn't be uploaded.`, [err.message]);
    }
  }

  const input = el('input', { type: 'file', hidden: true, 'data-image-input': '' });
  doc.body.append(input);
  let picking = null;
  function pick(at) {
    picking = at;
    input.accept = Object.keys(KINDS[slotKind(at.key)].types).join(',');
    input.click();
  }
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = '';
    if (file && picking) replace(picking, file);
  });

  // ---------- Drop ----------
  let dropTarget = null;
  const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files');
  function setDropTarget(slot) {
    if (slot === dropTarget) return;
    dropTarget?.classList.remove('ed-drop-target');
    dropTarget = slot;
    dropTarget?.classList.add('ed-drop-target');
  }
  // A file dropped anywhere else must not open in the tab (and lose the editor).
  doc.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const slot = slotAt(e.target);
    e.dataTransfer.dropEffect = slot ? 'copy' : 'none';
    setDropTarget(slot);
  });
  doc.addEventListener('dragleave', (e) => {
    if (dropTarget && !dropTarget.contains(e.relatedTarget)) setDropTarget(null);
  });
  doc.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDropTarget(null);
    const slot = slotAt(e.target);
    const file = e.dataTransfer.files[0];
    if (slot && file) replace(where(slot), file);
  });

  // ---------- Popover ----------
  let open = null; // { at, el, parts }

  function buildPopover(at) {
    const kind = slotKind(at.key);
    const spec = KINDS[kind];
    const title = el('p', { class: 'ed-pic__title' });
    const close = el('button', { type: 'button', class: 'ed-pic__close', 'aria-label': 'Close' }, '×');
    close.addEventListener('click', closePopover);
    const replaceBtn = el('button', { type: 'button', class: 'ed-btn ed-pic__replace' }, `Replace ${spec.noun}…`);
    replaceBtn.addEventListener('click', () => pick(at));
    const parts = { title };
    const body = [];
    if (kind === 'photo') {
      parts.thumb = el('img', { class: 'ed-pic__thumb', alt: '', draggable: 'false' });
      parts.dot = el('button', { type: 'button', class: 'ed-pic__dot' });
      parts.pad = el('div', { class: 'ed-pic__pad' }, parts.thumb, parts.dot);
      parts.fit = Object.fromEntries([['cover', 'Fill'], ['contain', 'Fit']].map(([value, label]) => {
        const b = el('button', { type: 'button', class: 'ed-seg__btn', 'aria-pressed': 'false' }, label);
        b.addEventListener('click', () => api.apply(setImage(api.deck, at.slideId, at.key, { fit: value })));
        return [value, b];
      }));
      body.push(
        el('div', { class: 'ed-pic__stage' }, parts.pad),
        el('p', { class: 'ed-pic__hint' }, 'Drag the dot onto what must stay in view.'),
        el('div', { class: 'ed-pic__row' },
          el('span', { class: 'ed-pic__label', id: 'ed-pic-size' }, 'Size'),
          el('div', { class: 'ed-seg', role: 'group', 'aria-labelledby': 'ed-pic-size' }, parts.fit.cover, parts.fit.contain)),
      );
      wireFocus(at, parts);
    }
    const pop = el('div', { class: 'ed-pic', role: 'dialog', 'aria-label': `${spec.noun[0].toUpperCase()}${spec.noun.slice(1)} options` },
      el('div', { class: 'ed-pic__head' }, title, close),
      ...body,
      el('div', { class: 'ed-pic__foot' }, replaceBtn, el('span', { class: 'ed-pic__meta' }, spec.hint)));
    return { el: pop, parts };
  }

  const focusOf = (at) => (Array.isArray(imageOf(at).focus) ? imageOf(at).focus : [50, 50]);

  function showFocus(parts, [x, y]) {
    parts.dot.style.left = `${x}%`;
    parts.dot.style.top = `${y}%`;
    parts.dot.setAttribute('aria-label', `Focus point: ${x}% across, ${y}% down. Arrow keys move it.`);
  }

  function setFocus(at, focus) {
    const [x, y] = focusOf(at);
    if (focus[0] !== x || focus[1] !== y) api.apply(setImage(api.deck, at.slideId, at.key, { focus }));
  }

  function wireFocus(at, parts) {
    parts.pad.addEventListener('pointerdown', (down) => {
      if (down.button !== 0) return;
      down.preventDefault();
      parts.dot.focus({ preventScroll: true });
      let focus = focusOf(at);
      const follow = (e) => {
        const r = parts.pad.getBoundingClientRect();
        focus = [
          Math.round(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)),
          Math.round(clamp(((e.clientY - r.top) / r.height) * 100, 0, 100)),
        ];
        showFocus(parts, focus);
        slotOf(at)?.style.setProperty('--img-focus', `${focus[0]}% ${focus[1]}%`); // live, applied on release
      };
      follow(down);
      trackPointer(parts.pad, down, follow, () => setFocus(at, focus));
    });
    parts.dot.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 1 : 5;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!delta) return;
      e.preventDefault();
      const [x, y] = focusOf(at);
      setFocus(at, [clamp(x + delta[0], 0, 100), clamp(y + delta[1], 0, 100)]);
    });
  }

  /** Shows the popover's state for the slot as it is now rendered; closes it if the slot is gone or empty. */
  function refresh() {
    const slot = slotOf(open.at);
    if (!slot || isEmpty(slot)) {
      closePopover();
      return;
    }
    doc.querySelectorAll('.ed-pic-active').forEach((s) => s !== slot && s.classList.remove('ed-pic-active'));
    slot.classList.add('ed-pic-active');
    const image = imageOf(open.at);
    const { parts } = open;
    parts.title.textContent = image.label || open.at.key;
    if (parts.thumb) {
      const media = slot.querySelector(':scope > img');
      if (media && parts.thumb.getAttribute('src') !== media.getAttribute('src')) parts.thumb.setAttribute('src', media.getAttribute('src'));
      for (const [value, b] of Object.entries(parts.fit)) b.setAttribute('aria-pressed', String((image.fit ?? 'cover') === value));
      showFocus(parts, focusOf(open.at));
    }
    place(slot);
  }

  /** Beside the slot when there is room, else over its top-right corner. Page coordinates. */
  function place(slot) {
    const pop = open.el;
    const r = slot.getBoundingClientRect();
    const w = pop.offsetWidth;
    const gap = 12;
    const vw = doc.documentElement.clientWidth;
    let left;
    if (r.right + gap + w <= vw - gap) left = r.right + gap;
    else if (r.left - gap - w >= gap) left = r.left - gap - w;
    else left = clamp(r.right - gap - w, gap, vw - gap - w);
    const top = Math.max(r.top + (left > r.left && left < r.right ? gap : 0), 72);
    pop.style.left = `${left + win.scrollX}px`;
    pop.style.top = `${top + win.scrollY}px`;
  }

  function openPopover(at) {
    if (open && open.at.slideId === at.slideId && open.at.key === at.key) return;
    closePopover();
    open = { at, ...buildPopover(at) };
    doc.body.append(open.el);
    refresh();
  }

  function closePopover() {
    if (!open) return;
    open.el.remove();
    doc.querySelectorAll('.ed-pic-active').forEach((s) => s.classList.remove('ed-pic-active'));
    open = null;
  }

  canvas.addEventListener('click', (e) => {
    const slot = slotAt(e.target);
    if (!slot || slot.classList.contains('ed-uploading')) return;
    e.preventDefault(); // e.g. no play/pause on the video while editing
    if (isEmpty(slot)) {
      closePopover();
      pick(where(slot));
    } else openPopover(where(slot));
  });
  doc.addEventListener('pointerdown', (e) => {
    if (open && !open.el.contains(e.target) && !slotAt(e.target)) closePopover();
  });
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) closePopover();
  });
  win.addEventListener('resize', () => open && refresh());
  api.onRender((frames) => {
    if (open && frames.some((f) => f.dataset.slideId === open.at.slideId)) refresh();
  });

  // ---------- Report callouts ----------
  canvas.addEventListener('pointerdown', (down) => {
    const mark = down.target.closest?.('.ed-stage [data-callout]');
    if (!mark || down.button !== 0) return;
    down.preventDefault();
    const at = { slideId: mark.closest('.ed-frame').dataset.slideId, key: 'report' };
    const index = Number(mark.dataset.callout);
    const callouts = imageOf(at).callouts ?? [];
    const start = callouts[index];
    if (!start) return;
    const r = mark.parentElement.getBoundingClientRect(); // the displayed screenshot
    // Keep the grab point under the pointer: move by the pointer's offset, no jump.
    const dx = down.clientX - (r.left + (start.x / 100) * r.width);
    const dy = down.clientY - (r.top + (start.y / 100) * r.height);
    let pos = null;
    mark.classList.add('is-dragging');
    trackPointer(mark, down, (e) => {
      pos = {
        x: round1(clamp(((e.clientX - dx - r.left) / r.width) * 100, 0, 100)),
        y: round1(clamp(((e.clientY - dy - r.top) / r.height) * 100, 0, 100)),
      };
      mark.style.left = `${pos.x}%`;
      mark.style.setProperty('--y', `${pos.y}%`);
      mark.classList.toggle('callout--left', pos.x > 75);
    }, () => {
      mark.classList.remove('is-dragging');
      if (!pos || (pos.x === start.x && pos.y === start.y)) return;
      const next = callouts.map((c, i) => (i === index ? { ...c, ...pos } : c));
      api.apply(setImage(api.deck, at.slideId, at.key, { callouts: next }));
    });
  });
}
