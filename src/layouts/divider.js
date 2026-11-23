// Appendix divider: one word, with an optional one-line subtitle under it.
import { text, slideFrame } from './common.js';

export const name = 'divider';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx, { content: false });
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline-xl divider__headline', fit: true }),
  );
  if (slide.fields?.subtitle) el.append(text('p', slide, 'subtitle', ctx, { class: 't-lead divider__subtitle', fit: true }));
  return el;
}
