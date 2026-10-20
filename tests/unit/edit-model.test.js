import { describe, it, expect } from 'vitest';
import {
  setField, moveSlide, setHidden, duplicateSlide, deleteSlide, setImage, setNotes, slideLabel, onlyNotesChanged,
} from '../../src/model.js';
import { createHistory } from '../../src/editor/history.js';

const slide = (id, extra = {}) => ({
  id,
  layout: 'appendix',
  section: 'main',
  hidden: false,
  fields: { headline: `${id} headline`, stats: [{ value: '1', label: 'one' }, { value: '2', label: 'two' }] },
  images: { photo: { src: 'assets/a.jpg', fit: 'cover', focus: [50, 50], label: 'Photo' } },
  notes: '',
  ...extra,
});

/** main: m1 m2 m3 | appendix: div a1 a2 */
function makeDeck() {
  return {
    id: 'd',
    rev: 7,
    slides: [
      slide('m1', { layout: 'title' }),
      slide('m2'),
      slide('m3'),
      slide('div', { layout: 'divider', section: 'appendix' }),
      slide('a1', { section: 'appendix' }),
      slide('a2', { section: 'appendix' }),
    ],
  };
}

/** Runs fn on a deck and checks the input deck was not changed in any way. */
function pure(fn) {
  const deck = makeDeck();
  const before = structuredClone(deck);
  const out = fn(deck);
  expect(deck).toEqual(before);
  expect(out).not.toBe(deck);
  return { deck, out };
}

const ids = (deck) => deck.slides.map((s) => s.id);
const sectionOf = (deck, id) => deck.slides.find((s) => s.id === id).section;

describe('setField', () => {
  it('sets a top-level field without mutating the deck', () => {
    const { out } = pure((d) => setField(d, 'm2', 'headline', 'New'));
    expect(out.slides[1].fields.headline).toBe('New');
    expect(out.rev).toBe(7);
  });

  it('sets a nested array path ("stats.1.label")', () => {
    const { deck, out } = pure((d) => setField(d, 'm2', 'stats.1.label', 'changed'));
    expect(out.slides[1].fields.stats[1]).toEqual({ value: '2', label: 'changed' });
    expect(Array.isArray(out.slides[1].fields.stats)).toBe(true);
    // untouched slides are shared, not copied
    expect(out.slides[0]).toBe(deck.slides[0]);
  });

  it('throws on an unknown slide id', () => {
    expect(() => setField(makeDeck(), 'nope', 'headline', 'x')).toThrow(/nope/);
  });

  it('throws on a path whose parent does not exist', () => {
    expect(() => setField(makeDeck(), 'm2', 'missing.deep.path', 'x')).toThrow(/missing/);
  });
});

describe('moveSlide', () => {
  it('moves a slide within the main section', () => {
    const { out } = pure((d) => moveSlide(d, 2, 0));
    expect(ids(out)).toEqual(['m3', 'm1', 'm2', 'div', 'a1', 'a2']);
    expect(sectionOf(out, 'm3')).toBe('main');
  });

  it('a main slide moved after the divider becomes an appendix slide', () => {
    const { out } = pure((d) => moveSlide(d, 1, 5));
    expect(ids(out)).toEqual(['m1', 'm3', 'div', 'a1', 'a2', 'm2']);
    expect(sectionOf(out, 'm2')).toBe('appendix');
    expect(slideLabel(out, 'm2')).toBe('A3');
  });

  it('an appendix slide moved before the divider becomes a main slide', () => {
    const { out } = pure((d) => moveSlide(d, 4, 1));
    expect(ids(out)).toEqual(['m1', 'a1', 'm2', 'm3', 'div', 'a2']);
    expect(sectionOf(out, 'a1')).toBe('main');
    expect(slideLabel(out, 'a1')).toBe('2');
    expect(slideLabel(out, 'a2')).toBe('A1');
  });

  it('an appendix slide moved to just before the divider becomes main', () => {
    const { out } = pure((d) => moveSlide(d, 5, 3));
    expect(ids(out)).toEqual(['m1', 'm2', 'm3', 'a2', 'div', 'a1']);
    expect(sectionOf(out, 'a2')).toBe('main');
  });

  it('moving the divider moves the boundary with it', () => {
    const { out } = pure((d) => moveSlide(d, 3, 2));
    expect(ids(out)).toEqual(['m1', 'm2', 'div', 'm3', 'a1', 'a2']);
    expect(out.slides.map((s) => s.section)).toEqual(['main', 'main', 'appendix', 'appendix', 'appendix', 'appendix']);
  });

  it('without a divider, a moved slide takes the section of the slide before it', () => {
    const deck = makeDeck();
    deck.slides.splice(3, 1);
    const out = moveSlide(deck, 0, 4);
    expect(ids(out)).toEqual(['m2', 'm3', 'a1', 'a2', 'm1']);
    expect(sectionOf(out, 'm1')).toBe('appendix');
    expect(sectionOf(moveSlide(deck, 4, 0), 'a2')).toBe('main');
  });

  it('throws on an index out of range', () => {
    expect(() => moveSlide(makeDeck(), 9, 0)).toThrow(RangeError);
    expect(() => moveSlide(makeDeck(), 0, -1)).toThrow(RangeError);
  });
});

describe('setHidden', () => {
  it('hides and unhides a slide', () => {
    const { out } = pure((d) => setHidden(d, 'm2', true));
    expect(out.slides[1].hidden).toBe(true);
    expect(setHidden(out, 'm2', false).slides[1].hidden).toBe(false);
  });

  it('throws on an unknown slide id', () => {
    expect(() => setHidden(makeDeck(), 'nope', true)).toThrow(/nope/);
  });
});

describe('duplicateSlide', () => {
  it('inserts a deep copy with a new id right after the original', () => {
    const { deck, out } = pure((d) => duplicateSlide(d, 'm2'));
    expect(ids(out)).toEqual(['m1', 'm2', 'm2-copy', 'm3', 'div', 'a1', 'a2']);
    const copy = out.slides[2];
    expect({ ...copy, id: 'm2' }).toEqual(deck.slides[1]);
    expect(copy.fields).not.toBe(deck.slides[1].fields);
    expect(copy.images.photo).not.toBe(deck.slides[1].images.photo);
  });

  it('never reuses an existing id', () => {
    const twice = duplicateSlide(duplicateSlide(makeDeck(), 'a1'), 'a1');
    expect(ids(twice)).toEqual(['m1', 'm2', 'm3', 'div', 'a1', 'a1-copy-2', 'a1-copy', 'a2']);
    expect(new Set(ids(twice)).size).toBe(8);
    expect(sectionOf(twice, 'a1-copy')).toBe('appendix');
  });

  it('throws on an unknown slide id', () => {
    expect(() => duplicateSlide(makeDeck(), 'nope')).toThrow(/nope/);
  });
});

describe('deleteSlide', () => {
  it('removes the slide', () => {
    const { out } = pure((d) => deleteSlide(d, 'm3'));
    expect(ids(out)).toEqual(['m1', 'm2', 'div', 'a1', 'a2']);
  });

  it('throws on an unknown slide id', () => {
    expect(() => deleteSlide(makeDeck(), 'nope')).toThrow(/nope/);
  });
});

describe('setNotes', () => {
  it('replaces the speaker notes of one slide', () => {
    const { out } = pure((d) => setNotes(d, 'm2', 'Say this.'));
    expect(out.slides[1].notes).toBe('Say this.');
  });

  it('shares the other slides with the input deck', () => {
    const deck = makeDeck();
    const out = setNotes(deck, 'm2', 'x');
    expect(out.slides[0]).toBe(deck.slides[0]);
    expect(out.slides[2]).toBe(deck.slides[2]);
  });

  it('returns the same deck when the notes are unchanged', () => {
    const deck = makeDeck();
    expect(setNotes(deck, 'm2', '')).toBe(deck);
  });

  it('throws on an unknown slide id', () => {
    expect(() => setNotes(makeDeck(), 'nope', 'x')).toThrow(/nope/);
  });
});

describe('onlyNotesChanged', () => {
  it('is true when a slide differs from another only in its notes (a notes edit or its undo)', () => {
    const deck = makeDeck();
    const out = setNotes(deck, 'm2', 'Say this.');
    expect(onlyNotesChanged(deck.slides[1], out.slides[1])).toBe(true);
    expect(onlyNotesChanged(out.slides[1], deck.slides[1])).toBe(true);
  });

  it('is false for any other change, and for no slide', () => {
    const deck = makeDeck();
    const s = deck.slides[1];
    expect(onlyNotesChanged(s, setField(deck, 'm2', 'headline', 'x').slides[1])).toBe(false);
    expect(onlyNotesChanged(s, setHidden(deck, 'm2', true).slides[1])).toBe(false);
    expect(onlyNotesChanged(s, { ...s, notes: 'n', extra: 1 })).toBe(false);
    expect(onlyNotesChanged(undefined, s)).toBe(false);
  });
});

describe('setImage', () => {
  it('merges a patch into an existing image', () => {
    const { out } = pure((d) => setImage(d, 'm2', 'photo', { src: 'assets/uploads/x.jpg', focus: [20, 80] }));
    expect(out.slides[1].images.photo).toEqual({ src: 'assets/uploads/x.jpg', fit: 'cover', focus: [20, 80], label: 'Photo' });
  });

  it('creates a missing image entry', () => {
    const out = setImage(makeDeck(), 'm2', 'poster', { src: 'assets/p.jpg' });
    expect(out.slides[1].images.poster).toEqual({ src: 'assets/p.jpg' });
  });

  it('creates the images object when a slide has none', () => {
    const deck = makeDeck();
    delete deck.slides[1].images;
    expect(setImage(deck, 'm2', 'photo', { fit: 'contain' }).slides[1].images).toEqual({ photo: { fit: 'contain' } });
  });

  it('throws on an unknown slide id', () => {
    expect(() => setImage(makeDeck(), 'nope', 'photo', {})).toThrow(/nope/);
  });
});

describe('createHistory', () => {
  const d = (n) => ({ n });

  it('undo/redo walk back and forth through pushed decks', () => {
    const h = createHistory();
    h.push(d(0));
    h.push(d(1));
    h.push(d(2));
    expect(h.undo()).toEqual(d(1));
    expect(h.undo()).toEqual(d(0));
    expect(h.undo()).toBeNull();
    expect(h.redo()).toEqual(d(1));
    expect(h.redo()).toEqual(d(2));
    expect(h.redo()).toBeNull();
  });

  it('a push after an undo drops the redo branch', () => {
    const h = createHistory();
    h.push(d(0));
    h.push(d(1));
    h.undo();
    h.push(d(5));
    expect(h.redo()).toBeNull();
    expect(h.undo()).toEqual(d(0));
  });

  it('keeps at most `limit` undo steps', () => {
    const h = createHistory(3);
    for (let i = 0; i <= 10; i += 1) h.push(d(i));
    expect(h.undo()).toEqual(d(9));
    expect(h.undo()).toEqual(d(8));
    expect(h.undo()).toEqual(d(7));
    expect(h.undo()).toBeNull();
  });

  it('defaults to 50 undo steps', () => {
    const h = createHistory();
    for (let i = 0; i <= 60; i += 1) h.push(d(i));
    let steps = 0;
    while (h.undo()) steps += 1;
    expect(steps).toBe(50);
  });

  it('ignores pushing the current deck again', () => {
    const h = createHistory();
    const a = d(0);
    h.push(a);
    h.push(a);
    expect(h.undo()).toBeNull();
  });

  it('reports canUndo / canRedo', () => {
    const h = createHistory();
    expect(h.canUndo).toBe(false);
    h.push(d(0));
    h.push(d(1));
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
    h.undo();
    expect(h.canRedo).toBe(true);
  });
});
