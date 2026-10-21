// Slide 10: the ask. The headline is the next step; the terms underneath; the
// contact bar at the bottom: email left, website centre, phone right.
import { h, text, bulletList, slideFrame } from './common.js';

export const name = 'pilot';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline-xl pilot__headline', fit: true, lines: true, group: 'main' }),
    bulletList(slide, 'bullets', ctx, { class: 'list--check pilot__list', group: 'main' }),
    h('div', { class: 'glass pilot__contact', 'data-no-overlap': 'main' },
      ...['email', 'website', 'phone'].map((f) => text('p', slide, f, ctx, { class: `pilot__contact-text pilot__contact-${f}`, fit: true }))),
  );
  el.querySelector('.pilot__list').setAttribute('data-fit', '');
  return el;
}
