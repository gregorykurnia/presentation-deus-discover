// Appendix divider: one word, the discs, nothing else.
import { text, slideFrame, disc } from './common.js';

export const name = 'divider';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx, { content: false });
  el.append(
    disc('one', 'divider__disc-one'),
    disc('two', 'divider__disc-two'),
    text('h2', slide, 'headline', ctx, { class: 't-headline-xl divider__headline', fit: true }),
  );
  return el;
}
