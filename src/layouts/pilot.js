// Slide 10: the ask. The headline is the next step; the terms underneath; the
// contact line as a bar at the bottom. Discs bookend the title slide.
import { h, text, bulletList, slideFrame, disc } from './common.js';

export const name = 'pilot';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  el.append(
    disc('one', 'pilot__disc-one'),
    disc('two', 'pilot__disc-two'),
    text('h2', slide, 'headline', ctx, { class: 't-headline-xl pilot__headline', fit: true, lines: true, group: 'main' }),
    bulletList(slide, 'bullets', ctx, { class: 'list--check pilot__list', group: 'main' }),
    h('div', { class: 'glass pilot__contact', 'data-no-overlap': 'main' },
      text('p', slide, 'contact', ctx, { class: 'pilot__contact-text', fit: true })),
  );
  el.querySelector('.pilot__list').setAttribute('data-fit', '');
  return el;
}
