// A7: personality packages as a comparison matrix. One column per tier (name, price,
// assessments, price per assessment), then groups of rows ("Modules", "What you
// receive") with a check or a cross per tier. The empty top-left cell holds the note
// (what one assessment is). Marks are booleans in deck.json, so the editor changes the
// wording but not which tier has what.
import { h, text, slideFrame, fieldAt } from './common.js';

export const name = 'compare';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const tiers = fieldAt(slide, 'tiers') ?? [];
  const groups = fieldAt(slide, 'groups') ?? [];
  const table = h('table', { class: 'compare__table' },
    h('thead', {}, h('tr', {},
      h('th', { class: 'compare__corner', scope: 'col' },
        fieldAt(slide, 'note') == null ? null : text('span', slide, 'note', ctx, { class: 'compare__note' })),
      tiers.map((_, t) => h('th', { class: 'compare__tier', scope: 'col' },
        text('span', slide, `tiers.${t}.name`, ctx, { class: 'compare__name' }),
        text('span', slide, `tiers.${t}.price`, ctx, { class: 'compare__price' }),
        text('span', slide, `tiers.${t}.amount`, ctx, { class: 'compare__amount' }),
        text('span', slide, `tiers.${t}.each`, ctx, { class: 'compare__each' }))))),
    groups.map((group, g) => h('tbody', { class: 'compare__group' },
      h('tr', { class: 'compare__group-row' },
        text('th', slide, `groups.${g}.title`, ctx, { class: 'compare__group-title', scope: 'colgroup' }),
        tiers.map(() => h('td', {}))),
      (group.rows ?? []).map((row, r) => h('tr', { class: 'compare__row' },
        text('th', slide, `groups.${g}.rows.${r}.label`, ctx, { class: 'compare__label', scope: 'row' }),
        tiers.map((_, t) => h('td', { class: 'compare__cell' }, mark(Boolean(row.marks?.[t])))))))));
  table.style.setProperty('--tiers', Math.max(tiers.length, 1));
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline compare__headline', fit: true, group: 'main' }),
    h('div', { class: 'glass compare__panel', 'data-no-overlap': 'main' },
      h('div', { class: 'compare__box', 'data-fit': true }, table)),
  );
  return el;
}

/** A check (included) or a faint cross (not included), with the words for screen readers. */
function mark(included) {
  return h('span', {
    class: `compare__mark compare__mark--${included ? 'yes' : 'no'}`,
    role: 'img',
    'aria-label': included ? 'Included' : 'Not included',
  });
}
