// Slide 9: value and price together. "What it changes" on the left; the
// recommendation panel on the right with the price as the focal number.
import { h, text, bulletList, slideFrame } from './common.js';

export const name = 'package';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  el.append(
    h('div', { class: 'package__col package__changes', 'data-fit': true, 'data-no-overlap': 'main' },
      text('h2', slide, 'changes.title', ctx, { class: 't-headline-sm package__title' }),
      bulletList(slide, 'changes.bullets', ctx, { class: 'list--check' })),
    h('div', { class: 'glass package__col package__recommended', 'data-fit': true, 'data-no-overlap': 'main' },
      text('h2', slide, 'recommended.title', ctx, { class: 't-headline-sm package__title' }),
      bulletList(slide, 'recommended.bullets', ctx, { class: 'list--plain package__modules' }),
      h('div', { class: 'package__price' },
        // "Rp119,000" big, "per candidate" beside it; textContent stays the field text.
        text('p', slide, 'recommended.price', ctx, { class: 'price', split: /^\S+/ }),
        text('p', slide, 'recommended.priceNote', ctx, { class: 'price__note' }))),
    text('p', slide, 'smallPrint', ctx, { class: 'small-print package__small', fit: true, group: 'main' }),
  );
  return el;
}
