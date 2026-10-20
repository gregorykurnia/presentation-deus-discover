// Slide 2: credibility at a glance. Full-height Telkom photo on the left, the
// numbers on the right (2x2, "Results in" sits above "1 day").
import { h, text, imageSlot, slideFrame, fieldAt } from './common.js';

export const name = 'proof';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const stats = fieldAt(slide, 'stats') ?? [];
  el.append(
    imageSlot(slide, 'photo', ctx, {
      class: 'proof__photo',
      group: 'main',
      overlay: [text('p', slide, 'caption', ctx, { class: 'pill pill--sm proof__caption', fit: true })],
    }),
    text('h2', slide, 'headline', ctx, { class: 't-headline-sm proof__headline', fit: true, lines: true, group: 'main' }),
    h('div', { class: 'proof__stats', 'data-fit': true, 'data-no-overlap': 'main' },
      stats.map((s, i) => h('div', { class: 'stat' },
        s.prefix != null
          ? text('p', slide, `stats.${i}.prefix`, ctx, { class: 'stat__prefix' })
          : h('span', { class: 'stat__prefix', 'aria-hidden': 'true' }),
        text('p', slide, `stats.${i}.value`, ctx, { class: 't-number stat__value' }),
        s.label != null
          ? text('p', slide, `stats.${i}.label`, ctx, { class: 'stat__label' })
          : h('span', { class: 'stat__label', 'aria-hidden': 'true' })))),
  );
  return el;
}
