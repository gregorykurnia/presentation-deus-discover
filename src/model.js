export const LAYOUTS = [
  'title', 'proof', 'problem', 'fit', 'video', 'modules', 'report',
  'trust', 'package', 'pilot', 'divider', 'appendix', 'table',
];

const SECTIONS = ['main', 'appendix'];

/** Returns a list of error messages; an empty list means the deck is valid. */
export function validateDeck(deck) {
  const errors = [];
  if (!deck || !Array.isArray(deck.slides)) return ['Deck: slides must be an array'];
  const seen = new Set();
  for (const [i, slide] of deck.slides.entries()) {
    if (!slide || typeof slide !== 'object' || Array.isArray(slide)) {
      errors.push(`Slide ${i + 1}: not a slide object`);
      continue;
    }
    if (!slide.id) {
      errors.push('Slide (no id): missing id');
      continue;
    }
    if (seen.has(slide.id)) errors.push(`Slide ${slide.id}: duplicate id`);
    seen.add(slide.id);
    if (!LAYOUTS.includes(slide.layout)) {
      errors.push(`Slide ${slide.id}: unknown layout '${slide.layout}'`);
    }
    if (!SECTIONS.includes(slide.section)) {
      errors.push(`Slide ${slide.id}: invalid section '${slide.section}'`);
    }
  }
  return errors;
}

export function visibleSlides(deck) {
  return deck.slides.filter((s) => !s.hidden);
}

/**
 * Main slides: "1".."n" (hidden skipped). Divider: "A". Appendix slides after
 * the divider: "A1".."An" (hidden skipped). Hidden or unknown slides: "".
 */
export function slideLabel(deck, slideId) {
  let main = 0;
  let appendix = 0;
  for (const slide of deck.slides) {
    if (slide.hidden) continue;
    let label;
    if (slide.section === 'appendix') {
      if (slide.layout === 'divider') label = 'A';
      else label = `A${++appendix}`;
    } else {
      label = String(++main);
    }
    if (slide.id === slideId) return label;
  }
  return '';
}

/** A slide's title: headline, else title, else the first nested block title (package: changes.title), else ''. */
export function slideTitle(slide) {
  const f = slide.fields ?? {};
  for (const v of [f.headline, f.title, ...Object.values(f).map((x) => x?.title)]) {
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

// ---------- Edits ----------
// Pure: each returns a new deck and never mutates its input. Unchanged slides
// are shared with the input deck. An unknown slide id throws.

function indexOf(deck, slideId) {
  const i = deck.slides.findIndex((s) => s.id === slideId);
  if (i < 0) throw new Error(`Unknown slide: ${slideId}`);
  return i;
}

function withSlide(deck, slideId, update) {
  const i = indexOf(deck, slideId);
  const slides = deck.slides.slice();
  slides[i] = update(deck.slides[i]);
  return { ...deck, slides };
}

/** Copy of an object or array with one key replaced. */
function assign(container, key, value) {
  if (Array.isArray(container)) {
    const copy = container.slice();
    copy[Number(key)] = value;
    return copy;
  }
  return { ...container, [key]: value };
}

/** Sets slide.fields at a dotted path ("stats.1.label"); the parent must exist. */
export function setField(deck, slideId, path, value) {
  const keys = path.split('.');
  const write = (node, depth) => {
    if (node == null || typeof node !== 'object') {
      throw new Error(`Slide ${slideId}: no field at '${keys.slice(0, depth).join('.') || path}' for '${path}'`);
    }
    const key = keys[depth];
    return assign(node, key, depth === keys.length - 1 ? value : write(node[key], depth + 1));
  };
  return withSlide(deck, slideId, (slide) => ({ ...slide, fields: write(slide.fields ?? {}, 0) }));
}

/**
 * Moves the slide at fromIndex to toIndex. Sections follow the position: with an
 * appendix divider, slides before it are "main" and it and everything after it
 * "appendix"; without one, the moved slide takes the section of the slide now
 * before it ("main" at the front).
 */
export function moveSlide(deck, fromIndex, toIndex) {
  const n = deck.slides.length;
  for (const i of [fromIndex, toIndex]) {
    if (!Number.isInteger(i) || i < 0 || i >= n) throw new RangeError(`Slide index ${i} is out of range (0-${n - 1})`);
  }
  const slides = deck.slides.slice();
  const [moved] = slides.splice(fromIndex, 1);
  slides.splice(toIndex, 0, moved);
  const divider = slides.findIndex((s) => s.layout === 'divider' && s.section === 'appendix');
  const sectionAt = (i) => {
    if (divider >= 0) return i < divider ? 'main' : 'appendix';
    return i === toIndex ? (slides[i - 1]?.section ?? 'main') : slides[i].section;
  };
  return {
    ...deck,
    slides: slides.map((s, i) => (s.section === sectionAt(i) ? s : { ...s, section: sectionAt(i) })),
  };
}

export function setHidden(deck, slideId, hidden) {
  return withSlide(deck, slideId, (slide) => ({ ...slide, hidden: Boolean(hidden) }));
}

/** Inserts a deep copy right after the original, with a new id ("<id>-copy", "<id>-copy-2", ...). */
export function duplicateSlide(deck, slideId) {
  const i = indexOf(deck, slideId);
  const taken = new Set(deck.slides.map((s) => s.id));
  let id = `${slideId}-copy`;
  for (let k = 2; taken.has(id); k += 1) id = `${slideId}-copy-${k}`;
  const slides = deck.slides.slice();
  slides.splice(i + 1, 0, { ...structuredClone(deck.slides[i]), id });
  return { ...deck, slides };
}

export function deleteSlide(deck, slideId) {
  const i = indexOf(deck, slideId);
  return { ...deck, slides: deck.slides.filter((_, k) => k !== i) };
}

/** Merges patch into slide.images[key] (created when missing): { src, fit, focus, label, callouts }. */
export function setImage(deck, slideId, key, patch) {
  return withSlide(deck, slideId, (slide) => ({
    ...slide,
    images: { ...slide.images, [key]: { ...slide.images?.[key], ...patch } },
  }));
}

/**
 * True when slide b differs from slide a only in its speaker notes (a notes edit,
 * or its undo): the slide looks the same, so it need not be drawn again.
 */
export function onlyNotesChanged(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete('notes');
  return [...keys].every((k) => a[k] === b[k]);
}

/** Replaces a slide's speaker notes; the same deck when they are unchanged. */
export function setNotes(deck, slideId, notes) {
  const value = String(notes ?? '');
  if (deck.slides[indexOf(deck, slideId)].notes === value) return deck;
  return withSlide(deck, slideId, (slide) => ({ ...slide, notes: value }));
}
