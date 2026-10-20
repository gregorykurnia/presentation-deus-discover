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
  for (const slide of deck.slides) {
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
