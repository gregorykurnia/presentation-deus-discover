// Slide 4: the game trailer. Present/edit: <video controls>. Print: the poster
// image. Edit mode adds the poster as a small slot over the video's corner, so it
// can be replaced too.
import { h, text, imageSlot, slideFrame } from './common.js';

export const name = 'video';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const print = ctx.mode === 'print';
  const media = print
    ? imageSlot(slide, 'poster', ctx, { class: 'video__media', group: 'main' })
    : imageSlot(slide, 'video', ctx, {
      class: 'video__media', group: 'main', tag: 'video', poster: 'poster',
      overlay: ctx.mode === 'edit' ? [imageSlot(slide, 'poster', ctx, { class: 'video__poster' })] : undefined,
    });
  const side = h('div', { class: 'video__side', 'data-no-overlap': 'main' },
    h('blockquote', { class: 'quote quote--large video__quote', 'data-fit': true },
      text('p', slide, 'quote', ctx, { class: 'quote__text' }),
      text('cite', slide, 'quoteBy', ctx, { class: 'quote__by' })));
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline video__headline', fit: true, group: 'main' }),
    media,
    side,
  );
  return el;
}
