// Slide 4: the core idea. Two overlapping discs (role fit, culture fit) meet
// in "One score"; the four-step process runs underneath.
import { h, text, slideFrame, stepFlow } from './common.js';

export const name = 'fit';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  el.append(
    text('h2', slide, 'headline', ctx, { class: 'fit__headline', fit: true, lines: true, group: 'main' }),
    h('div', { class: 'disc-one fit__disc fit__disc--one' }),
    h('div', { class: 'disc-two fit__disc fit__disc--two' }),
    h('div', { class: 'fit__copy fit__copy--one', 'data-fit': true, 'data-no-overlap': 'discs' },
      text('h3', slide, 'roleFit.title', ctx, { class: 'fit__title' }),
      text('p', slide, 'roleFit.text', ctx, { class: 'fit__text' })),
    h('div', { class: 'fit__copy fit__copy--two', 'data-fit': true, 'data-no-overlap': 'discs' },
      text('h3', slide, 'cultureFit.title', ctx, { class: 'fit__title' }),
      text('p', slide, 'cultureFit.text', ctx, { class: 'fit__text' })),
    h('div', { class: 'pill pill--ink fit__one-score', 'data-no-overlap': 'discs' }, 'One score'),
    stepFlow(slide, 'steps', ctx, { class: 'fit__flow', group: 'main' }),
    text('p', slide, 'footer', ctx, { class: 'footer-line fit__footer', fit: true, group: 'main' }),
  );
  return el;
}
