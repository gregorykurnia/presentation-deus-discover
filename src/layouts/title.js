// Slide 1: hook in ten seconds. One focal point: the product name, with the two-line promise under it.
import { h, text, imageSlot, slideFrame } from './common.js';

export const name = 'title';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx, { content: false });
  el.append(
    imageSlot(slide, 'logo', ctx, { class: 'title__logo', group: 'main' }),
    text('h1', slide, 'headline', ctx, { class: 't-headline-xl title__headline', fit: true, lines: true, group: 'main' }),
    text('p', slide, 'subtitle', ctx, { class: 't-lead title__subtitle', fit: true, lines: true, group: 'main' }),
    h('div', { class: 'title__prep', 'data-no-overlap': 'main' },
      text('p', slide, 'preparedFor', ctx, { class: 'title__prepared', fit: true }),
      imageSlot(slide, 'clientLogo', ctx, { class: 'title__client' })),
  );
  return el;
}
