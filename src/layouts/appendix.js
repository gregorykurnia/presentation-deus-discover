// Appendix reference slides (A1-A7, A9, A10): simpler than the main deck, same
// system. The variant follows the fields present:
//   placeholder         -> one framed placeholder block
//   measures + images   -> measures line, screenshot, matching report section
//   bullets             -> a list
//   steps               -> a step flow
import { h, text, bulletList, imageSlot, slideFrame, stepFlow } from './common.js';

export const name = 'appendix';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const f = slide.fields ?? {};
  el.append(text('h2', slide, 'headline', ctx, { class: 't-headline appendix__headline', fit: true, group: 'main' }));
  if (f.measures != null) {
    el.classList.add('appendix--module');
    el.append(
      text('p', slide, 'measures', ctx, { class: 't-lead appendix__measures', fit: true, group: 'main' }),
      h('div', { class: 'appendix__shots', 'data-no-overlap': 'main' },
        imageSlot(slide, 'screenshot', ctx, { class: 'appendix__shot' }),
        imageSlot(slide, 'reportSection', ctx, { class: 'appendix__shot' })),
    );
  }
  if (f.placeholder != null) {
    el.classList.add('appendix--placeholder');
    el.append(h('div', { class: 'glass appendix__panel', 'data-no-overlap': 'main' },
      text('p', slide, 'placeholder', ctx, { class: 'appendix__placeholder', fit: true })));
  }
  if (Array.isArray(f.bullets)) {
    el.classList.add('appendix--list');
    el.append(bulletList(slide, 'bullets', ctx, { class: 'list--rule appendix__list', group: 'main' }));
    el.querySelector('.appendix__list').setAttribute('data-fit', '');
  }
  if (Array.isArray(f.steps)) {
    el.classList.add('appendix--steps');
    el.append(stepFlow(slide, 'steps', ctx, { class: 'appendix__flow', group: 'main' }));
  }
  return el;
}
