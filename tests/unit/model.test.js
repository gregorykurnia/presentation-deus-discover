import { describe, it, expect } from 'vitest';
import { validateDeck, visibleSlides, slideLabel, LAYOUTS } from '../../src/model.js';

const slide = (id, layout, extra = {}) => ({
  id,
  layout,
  section: 'main',
  hidden: false,
  fields: {},
  images: {},
  notes: '',
  ...extra,
});

describe('LAYOUTS', () => {
  it('lists the 15 layouts', () => {
    expect(LAYOUTS).toEqual([
      'title', 'proof', 'problem', 'fit', 'video', 'modules', 'report',
      'trust', 'package', 'pilot', 'divider', 'appendix', 'table', 'journey', 'gains',
    ]);
  });
});

describe('validateDeck', () => {
  it('returns [] for a valid deck', () => {
    const deck = { id: 'd', rev: 1, slides: [slide('s-a', 'title'), slide('s-b', 'proof')] };
    expect(validateDeck(deck)).toEqual([]);
  });

  it('flags an unknown layout', () => {
    const deck = { id: 'd', rev: 1, slides: [slide('s-x', 'foo')] };
    expect(validateDeck(deck)).toContain("Slide s-x: unknown layout 'foo'");
  });

  it('flags duplicate ids', () => {
    const deck = { id: 'd', rev: 1, slides: [slide('s-a', 'title'), slide('s-a', 'proof')] };
    expect(validateDeck(deck)).toContain("Slide s-a: duplicate id");
  });

  it('reports null or non-object slide entries instead of throwing (Upload JSON)', () => {
    const deck = { id: 'd', rev: 1, slides: [slide('s-a', 'title'), null, 'x'] };
    expect(() => validateDeck(deck)).not.toThrow();
    expect(validateDeck(deck)).toEqual(['Slide 2: not a slide object', 'Slide 3: not a slide object']);
  });

  it('flags a bad section', () => {
    const deck = { id: 'd', rev: 1, slides: [slide('s-a', 'title', { section: 'x' })] };
    expect(validateDeck(deck)).toContain("Slide s-a: invalid section 'x'");
  });
});

describe('visibleSlides', () => {
  it('drops hidden slides', () => {
    const deck = {
      slides: [slide('s-a', 'title'), slide('s-b', 'proof', { hidden: true }), slide('s-c', 'problem')],
    };
    expect(visibleSlides(deck).map((s) => s.id)).toEqual(['s-a', 's-c']);
  });
});

describe('slideLabel', () => {
  const deck = {
    slides: [
      slide('s-a', 'title'),
      slide('s-b', 'proof', { hidden: true }),
      slide('s-c', 'problem'),
      slide('s-div', 'divider', { section: 'appendix' }),
      slide('a1', 'appendix', { section: 'appendix' }),
      slide('a2', 'appendix', { section: 'appendix', hidden: true }),
      slide('a3', 'appendix', { section: 'appendix' }),
    ],
  };

  it('numbers main slides in order, skipping hidden', () => {
    expect(slideLabel(deck, 's-a')).toBe('1');
    expect(slideLabel(deck, 's-c')).toBe('2');
  });

  it('labels the divider "A"', () => {
    expect(slideLabel(deck, 's-div')).toBe('A');
  });

  it('labels appendix slides A1.. skipping hidden', () => {
    expect(slideLabel(deck, 'a1')).toBe('A1');
    expect(slideLabel(deck, 'a3')).toBe('A2');
  });

  it('returns "" for hidden or unknown slides', () => {
    expect(slideLabel(deck, 's-b')).toBe('');
    expect(slideLabel(deck, 'nope')).toBe('');
  });
});
