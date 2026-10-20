// Slide 5: the product working. Present/edit: <video controls>. Print: the
// poster image + "Watch the demo: [link]" + a QR slot.
import { h, text, imageSlot, slideFrame } from './common.js';

export const name = 'video';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const print = ctx.mode === 'print';
  const media = print
    ? imageSlot(slide, 'poster', ctx, { class: 'video__media', group: 'main' })
    : imageSlot(slide, 'video', ctx, { class: 'video__media', group: 'main', tag: 'video', poster: 'poster' });
  const side = h('div', { class: 'video__side', 'data-no-overlap': 'main' },
    h('blockquote', { class: 'quote quote--large video__quote', 'data-fit': true },
      text('p', slide, 'quote', ctx, { class: 'quote__text' }),
      text('cite', slide, 'quoteBy', ctx, { class: 'quote__by' })));
  // The link and QR are for the PDF; edit mode shows them too so they can be edited.
  if (ctx.mode !== 'present') {
    side.append(h('div', { class: 'video__link' },
      imageSlot(slide, 'qr', ctx, { class: 'video__qr' }),
      text('p', slide, 'linkLine', ctx, { class: 'video__link-text', fit: true })));
  }
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline video__headline', fit: true, group: 'main' }),
    media,
    side,
  );
  return el;
}
