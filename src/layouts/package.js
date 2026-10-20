// Slides 9-10: packages. One card per tier (name, candidates, price, then the
// optional price per test, price per candidate, tests and validity) in a row; what
// every tier includes in a strip below. On two cards or fewer the pills sit top right. The card count follows the content, so
// each product's packages reuse it.
import { h, text, slideFrame, fieldAt } from './common.js';

export const name = 'package';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const tiers = fieldAt(slide, 'tiers') ?? [];
  const includes = fieldAt(slide, 'includes') ?? [];
  // Two cards or fewer are wide: the pills move to the top right corner.
  const wide = tiers.length <= 2;
  const row = h('div', { class: `package__tiers${wide ? ' package__tiers--wide' : ''}`, 'data-no-overlap': 'main' },
    tiers.map((_, i) => h('article', { class: 'glass package__tier', 'data-fit': true },
      h('div', { class: 'package__head' },
        text('h3', slide, `tiers.${i}.name`, ctx, { class: 'package__name' }),
        h('p', { class: 'package__amount' },
          text('span', slide, `tiers.${i}.amount`, ctx, { class: 'package__number' }),
          text('span', slide, `tiers.${i}.unit`, ctx, { class: 'package__unit' }))),
      h('div', { class: 'package__body' },
        text('p', slide, `tiers.${i}.price`, ctx, { class: 'package__price' }),
        optional(slide, `tiers.${i}.perTest`, ctx, 'p', 'package__per-test'),
        optional(slide, `tiers.${i}.perCandidate`, ctx, 'p', 'package__each'),
        h('div', { class: 'package__pills' },
          optional(slide, `tiers.${i}.tests`, ctx, 'span', 'pill package__tests'),
          optional(slide, `tiers.${i}.validity`, ctx, 'span', 'pill package__validity'))))));
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

/** A text field rendered only when the tier has it (not every product's cards carry every line). */
function optional(slide, path, ctx, tag, cls) {
  return fieldAt(slide, path) == null ? null : text(tag, slide, path, ctx, { class: cls });
}
