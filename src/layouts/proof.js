// Slide 2: credibility at a glance. Headline and the numbers on the left (2x2,
// "Results in" sits above "1 day"); on the right the Telkom group photo as a wide
// card and, under it, the optional quotes (Bahasa, verbatim). Candidate quotes
// carry no "by"; the client's quote names the team, never a person.
import { h, text, imageSlot, slideFrame, fieldAt } from './common.js';

export const name = 'proof';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const stats = fieldAt(slide, 'stats') ?? [];
  el.append(
    imageSlot(slide, 'photo', ctx, { class: 'proof__photo', group: 'main' }),
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
  const quotes = fieldAt(slide, 'quotes') ?? [];
  if (quotes.length) {
    el.classList.add('proof--quotes');
    el.append(h('div', { class: 'proof__quotes', 'data-fit': true, 'data-no-overlap': 'main' },
      quotes.map((q, i) => h('blockquote', { class: `quote proof__quote${q.by != null ? ' proof__quote--client' : ''}` },
        text('p', slide, `quotes.${i}.text`, ctx, { class: 'quote__text' }),
        q.by != null ? text('cite', slide, `quotes.${i}.by`, ctx, { class: 'quote__by' }) : null))));
  }
  return el;
}
