// Slide 7: the output HR uses. The report screenshot is the focal point, as
// large as the slide allows, with callout labels at percent coordinates
// (images.report.callouts[] = { label, x, y }; the dot sits at x/y). The
// percentages are of the screenshot as displayed (after fit and focus), not of
// the frame, so the dots stay on their features whatever the aspect ratio: once
// the image has loaded, its aspect ratio goes to CSS (.report__frame--sized).
import { h, text, imageSlot, slideFrame, setText } from './common.js';

export const name = 'report';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const callouts = slide.images?.report?.callouts ?? [];
  const marks = callouts.map((c, i) => {
    const label = setText(h('span', { class: 'callout__label' }), c.label, ctx);
    const mark = h('div', {
      // Labels sit right of the dot; near the right edge they flip to the left.
      class: `callout${c.x > 75 ? ' callout--left' : ''}`,
      'data-callout': i,
      'data-no-overlap': 'callouts',
    }, h('span', { class: 'callout__dot', 'aria-hidden': 'true' }), label);
    mark.style.left = `${c.x}%`;
    // top comes from --y in layouts.css, clamped so the label stays inside the screenshot.
    mark.style.setProperty('--y', `${c.y}%`);
    return mark;
  });
  const shot = imageSlot(slide, 'report', ctx, { class: 'report__shot' });
  // Callouts live beside the slot (not inside it) so labels near the edge are not clipped.
  const frame = h('div', { class: 'report__frame', 'data-no-overlap': 'main' },
    shot, h('div', { class: 'report__callouts', 'data-image-callouts': 'report' }, marks));
  placeOnImage(frame, shot, slide.images?.report);
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline-sm report__headline', fit: true, lines: true, group: 'main' }),
    frame,
    text('p', slide, 'footer', ctx, { class: 'pill pill--accent report__footer', fit: true, group: 'main' }),
  );
  return el;
}

/**
 * Hands the displayed image's geometry to CSS: fit and focus now, the aspect ratio
 * as soon as the image has loaded (right away when it already has, e.g. cached).
 * The print path (scripts/lib/print-deck.js) waits for .report__frame--sized.
 */
function placeOnImage(frame, shot, image = {}) {
  const [fx, fy] = Array.isArray(image.focus) ? image.focus : [50, 50];
  frame.dataset.fit = image.fit ?? 'cover';
  frame.style.setProperty('--img-fx', String(fx / 100));
  frame.style.setProperty('--img-fy', String(fy / 100));
  const img = shot.querySelector('img');
  if (!img) return;
  const size = () => {
    if (!img.naturalWidth || !img.naturalHeight) return false;
    frame.style.setProperty('--img-ar', String(img.naturalWidth / img.naturalHeight));
    frame.classList.add('report__frame--sized');
    return true;
  };
  if (!(img.complete && size())) img.addEventListener('load', size, { once: true });
}
