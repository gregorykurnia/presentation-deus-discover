// Slide 1: hook in ten seconds. One focal point: the two-line promise.
import { h, text, imageSlot, slideFrame, disc } from './common.js';

export const name = 'title';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx, { content: false });
  el.append(
    disc('one', 'title__disc-one'),
    disc('two', 'title__disc-two'),
    imageSlot(slide, 'logo', ctx, { class: 'title__logo', group: 'main' }),
    text('h1', slide, 'headline', ctx, { class: 't-headline-xl title__headline', fit: true, lines: true, group: 'main' }),
    text('p', slide, 'subtitle', ctx, { class: 't-lead title__subtitle', fit: true, group: 'main' }),
    h('div', { class: 'title__prep', 'data-no-overlap': 'main' },
      text('p', slide, 'preparedFor', ctx, { class: 'title__prepared', fit: true }),
      imageSlot(slide, 'clientLogo', ctx, { class: 'title__client' })),
  );
  return el;
}
