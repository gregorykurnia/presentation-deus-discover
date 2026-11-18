// Slide 2: where HR uses the assessment. The headline, then one card per use in a
// row: an icon disc (alternating cobalt and coral), the use and one plain sentence.
// Each use's `key` picks its icon; an unknown key gets no icon.
import { h, text, slideFrame, fieldAt } from './common.js';

export const name = 'usage';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Line icons on a 24-unit grid, drawn in currentColor. */
export const ICONS = {
  recruitment: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M19 8v6M22 11h-6'],
  mapping: ['M4.5 3h4A1.5 1.5 0 0 1 10 4.5v4A1.5 1.5 0 0 1 8.5 10h-4A1.5 1.5 0 0 1 3 8.5v-4A1.5 1.5 0 0 1 4.5 3z',
    'M15.5 3h4A1.5 1.5 0 0 1 21 4.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 8.5v-4A1.5 1.5 0 0 1 15.5 3z',
    'M15.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5z',
    'M4.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-4A1.5 1.5 0 0 1 4.5 14z'],
  development: ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  promotion: ['M17 11l-5-5-5 5', 'M17 18l-5-5-5 5'],
  leadership: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
};

function icon(key, i) {
  const disc = h('span', { class: `usage__icon usage__icon--${i % 2 ? 'coral' : 'cobalt'}`, 'aria-hidden': 'true' });
  const paths = ICONS[key];
  if (!paths) return disc;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('focusable', 'false');
  for (const d of paths) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  disc.append(svg);
  return disc;
}

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const uses = fieldAt(slide, 'uses') ?? [];
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline usage__headline', fit: true, group: 'main' }),
    h('ul', { class: 'usage__row', 'data-no-overlap': 'main' },
      uses.map((u, i) => h('li', { class: 'glass usage__card' },
        icon(u?.key, i),
        h('div', { class: 'usage__copy', 'data-fit': true },
          text('h3', slide, `uses.${i}.title`, ctx, { class: 'usage__title' }),
          text('p', slide, `uses.${i}.text`, ctx, { class: 'usage__text' }))))),
  );
  return el;
}
