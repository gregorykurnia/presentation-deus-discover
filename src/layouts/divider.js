// Appendix divider: one word, nothing else.
import { text, slideFrame } from './common.js';

export const name = 'divider';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx, { content: false });
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline-xl divider__headline', fit: true }),
  );
  return el;
}
