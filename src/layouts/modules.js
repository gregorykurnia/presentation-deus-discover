// Slide 6: what we measure. Four large screenshots in one row, each with the
// module name, what it measures and which fit it feeds; the footer below.
import { h, text, imageSlot, slideFrame, arrow, fieldAt } from './common.js';

export const name = 'modules';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const modules = fieldAt(slide, 'modules') ?? [];
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline modules__headline', fit: true, group: 'main' }),
    h('div', { class: 'modules__row', 'data-no-overlap': 'main' },
      modules.map((m, i) => h('article', { class: 'module' },
        imageSlot(slide, m.key, ctx, { class: 'module__shot' }),
        h('div', { class: 'module__copy', 'data-fit': true },
          text('h3', slide, `modules.${i}.name`, ctx, { class: 'module__name' }),
          text('p', slide, `modules.${i}.measures`, ctx, { class: 'module__measures' }),
          h('p', { class: 'module__feeds' }, arrow('module__arrow'),
            text('span', slide, `modules.${i}.feeds`, ctx)))))),
    text('p', slide, 'footer', ctx, { class: 'footer-line modules__footer', fit: true, group: 'main' }),
  );
  return el;
}
