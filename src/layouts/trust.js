// Slide 7: answer the sceptical psikolog. The headline on the left, the four
// credibility pillars on the right as one calm list: a title and a proof line each.
import { h, text, slideFrame, fieldAt } from './common.js';

export const name = 'trust';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const pillars = fieldAt(slide, 'pillars') ?? [];
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline-xl trust__headline', fit: true, lines: true, group: 'main' }),
    h('ul', { class: 'list list--rule trust__list', 'data-fit': true, 'data-no-overlap': 'main' },
      pillars.map((_, i) => h('li', { class: 'list__item trust__pillar' },
        text('h3', slide, `pillars.${i}.title`, ctx, { class: 'trust__title' }),
        text('p', slide, `pillars.${i}.text`, ctx, { class: 'trust__text' })))),
  );
  return el;
}
