// Slide 3: they should recognise their own pain. The headline carries it;
// three large lines underneath, no cards.
import { text, bulletList, slideFrame, disc } from './common.js';

export const name = 'problem';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  el.append(
    disc('two', 'problem__disc'),
    text('h2', slide, 'headline', ctx, { class: 't-headline problem__headline', fit: true, lines: true, group: 'main' }),
    bulletList(slide, 'bullets', ctx, { class: 'list--rule problem__list', group: 'main' }),
  );
  el.querySelector('.problem__list').setAttribute('data-fit', '');
  return el;
}
