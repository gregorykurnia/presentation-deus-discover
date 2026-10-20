// Slide 9: packages. One card per tier (name, candidates, price, price per
// candidate, validity) in a row; what every tier includes in a strip below.
// The card count follows the content, so another product's packages can reuse it.
import { h, text, slideFrame, fieldAt } from './common.js';

export const name = 'package';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const tiers = fieldAt(slide, 'tiers') ?? [];
  const includes = fieldAt(slide, 'includes') ?? [];
  const row = h('div', { class: 'package__tiers', 'data-no-overlap': 'main' },
    tiers.map((_, i) => h('article', { class: 'glass package__tier', 'data-fit': true },
      text('h3', slide, `tiers.${i}.name`, ctx, { class: 'package__name' }),
      h('p', { class: 'package__amount' },
        text('span', slide, `tiers.${i}.amount`, ctx, { class: 'package__number' }),
        text('span', slide, `tiers.${i}.unit`, ctx, { class: 'package__unit' })),
      text('p', slide, `tiers.${i}.price`, ctx, { class: 'package__price' }),
      text('p', slide, `tiers.${i}.perCandidate`, ctx, { class: 'package__each' }),
      text('p', slide, `tiers.${i}.validity`, ctx, { class: 'pill package__validity' }))));
  row.style.setProperty('--tiers', Math.max(tiers.length, 1));
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline package__headline', fit: true, group: 'main' }),
    row,
    h('div', { class: 'package__includes', 'data-fit': true, 'data-no-overlap': 'main' },
      text('h3', slide, 'includesTitle', ctx, { class: 'package__includes-title' }),
      h('ul', { class: 'list list--check package__includes-list' },
        includes.map((_, i) => h('li', { class: 'list__item' },
          text('span', slide, `includes.${i}`, ctx, { class: 'list__text' }))))),
  );
  return el;
}
