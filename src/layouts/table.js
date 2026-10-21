// A7: full pricing table. Numbers right-aligned in tabular figures.
import { h, text, slideFrame, fieldAt } from './common.js';

export const name = 'table';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const columns = fieldAt(slide, 'table.columns') ?? [];
  const rows = fieldAt(slide, 'table.rows') ?? [];
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline table__headline', fit: true, group: 'main' }),
    text('p', slide, 'subtitle', ctx, { class: 't-lead table__subtitle', fit: true, group: 'main' }),
    // A table grows to fit its cells, so the fixed-size box around it is what overflows.
    h('div', { class: 'glass table__panel', 'data-no-overlap': 'main' },
      h('div', { class: 'price-table-box', 'data-fit': true },
        h('table', { class: 'price-table' },
          h('thead', {}, h('tr', {}, columns.map((_, c) => text('th', slide, `table.columns.${c}`, ctx, { class: c ? 'num' : null })))),
          h('tbody', {}, rows.map((row, r) => h('tr', {},
            row.map((_, c) => text('td', slide, `table.rows.${r}.${c}`, ctx, { class: c ? 'num' : null })))))))),
    text('p', slide, 'footer', ctx, { class: 'footer-line table__footer', fit: true, group: 'main' }),
  );
  return el;
}
