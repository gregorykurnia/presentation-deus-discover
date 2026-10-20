// Slide 7: the output HR uses. The report screenshot is the focal point, as
// large as the slide allows, with callout labels at percent coordinates
// (images.report.callouts[] = { label, x, y }; the dot sits at x/y).
import { h, text, imageSlot, slideFrame } from './common.js';
import { highlightPlaceholders } from '../placeholders.js';

export const name = 'report';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const callouts = slide.images?.report?.callouts ?? [];
  const marks = callouts.map((c, i) => {
    const label = h('span', { class: 'callout__label' });
    label.innerHTML = highlightPlaceholders(c.label, ctx.highlight);
    const mark = h('div', {
      // Labels sit right of the dot; near the right edge they flip to the left.
      class: `callout${c.x > 75 ? ' callout--left' : ''}`,
      'data-callout': i,
      'data-no-overlap': 'callouts',
    }, h('span', { class: 'callout__dot', 'aria-hidden': 'true' }), label);
    mark.style.left = `${c.x}%`;
    mark.style.top = `${c.y}%`;
    return mark;
  });
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline-sm report__headline', fit: true, lines: true, group: 'main' }),
    // Callouts live beside the slot (not inside it) so labels near the edge are not clipped.
    h('div', { class: 'report__frame', 'data-no-overlap': 'main' },
      imageSlot(slide, 'report', ctx, { class: 'report__shot' }),
      h('div', { class: 'report__callouts', 'data-image-callouts': 'report' }, marks)),
    text('p', slide, 'footer', ctx, { class: 'pill pill--accent report__footer', fit: true, group: 'main' }),
  );
  return el;
}
