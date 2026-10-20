// Slide 8: answer the sceptical psikolog. The headline on the left, the four
// evidence lines on the right as one calm list.
import { text, bulletList, slideFrame, disc } from './common.js';

export const name = 'trust';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  el.append(
    disc('one', 'trust__disc'),
    text('h2', slide, 'headline', ctx, { class: 't-headline-xl trust__headline', fit: true, lines: true, group: 'main' }),
    bulletList(slide, 'bullets', ctx, { class: 'list--rule trust__list', group: 'main' }),
  );
  el.querySelector('.trust__list').setAttribute('data-fit', '');
  return el;
}
