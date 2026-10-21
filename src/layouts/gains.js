// "What changes": the benefits, each one answering a pain. Two columns: today
// (muted, coral dash, like the problem slide) and with DEUS (bold, cobalt check).
import { h, text, slideFrame, fieldAt, arrow } from './common.js';

export const name = 'gains';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const rows = fieldAt(slide, 'rows') ?? [];
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline gains__headline', fit: true, group: 'main' }),
    h('div', { class: 'gains__table', 'data-no-overlap': 'main' },
      h('div', { class: 'gains__head' },
        text('span', slide, 'beforeLabel', ctx, { class: 'gains__label' }),
        h('span'),
        text('span', slide, 'afterLabel', ctx, { class: 'gains__label gains__label--after' })),
      rows.map((_, i) => h('div', { class: 'gains__row', 'data-fit': true },
        text('p', slide, `rows.${i}.before`, ctx, { class: 'gains__before' }),
        arrow('gains__arrow'),
        text('p', slide, `rows.${i}.after`, ctx, { class: 'gains__after' })))),
  );
  return el;
}
