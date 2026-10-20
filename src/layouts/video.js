// Slide 4: the game trailer, centred under the headline and as large as the
// margins allow. Present/edit: <video controls>, which starts from the beginning
// whenever the slide is shown while presenting. Print: the poster image. Edit
// mode adds the poster as a small slot over the video's corner, so it can be
// replaced too.
import { text, imageSlot, slideFrame } from './common.js';

export const name = 'video';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const print = ctx.mode === 'print';
  const media = print
    ? imageSlot(slide, 'poster', ctx, { class: 'video__media', group: 'main' })
    : imageSlot(slide, 'video', ctx, {
      class: 'video__media', group: 'main', tag: 'video', poster: 'poster', playOnShow: ctx.mode === 'present',
      overlay: ctx.mode === 'edit' ? [imageSlot(slide, 'poster', ctx, { class: 'video__poster' })] : undefined,
    });
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline video__headline', fit: true, group: 'main' }),
    media,
  );
  return el;
}
