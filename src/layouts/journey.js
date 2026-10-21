// "How it runs": what running it looks like for HR and candidates. Four numbered
// steps on one line, then a strip with how long each game takes and the device.
import { h, text, slideFrame, fieldAt } from './common.js';

export const name = 'journey';

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const steps = fieldAt(slide, 'steps') ?? [];
  const durations = fieldAt(slide, 'durations') ?? [];
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline journey__headline', fit: true, lines: true, group: 'main' }),
    h('ol', { class: 'journey__steps', 'data-no-overlap': 'main' },
      steps.map((_, i) => h('li', { class: 'journey__step' },
        h('span', { class: `journey__num${i === steps.length - 1 ? ' journey__num--accent' : ''}`, 'aria-hidden': 'true' }, String(i + 1)),
        h('div', { class: 'journey__copy', 'data-fit': true },
          text('h3', slide, `steps.${i}.title`, ctx, { class: 'journey__title' }),
          text('p', slide, `steps.${i}.text`, ctx, { class: 'journey__text' }))))),
    h('div', { class: 'glass journey__strip', 'data-fit': true, 'data-no-overlap': 'main' },
      text('p', slide, 'durationsTitle', ctx, { class: 'journey__strip-title' }),
      h('ul', { class: 'journey__durations' },
        durations.map((_, i) => h('li', { class: 'journey__duration' },
          text('span', slide, `durations.${i}.name`, ctx, { class: 'journey__game' }),
          text('span', slide, `durations.${i}.time`, ctx, { class: 'journey__time' })))),
      h('div', { class: 'journey__device' },
        text('span', slide, 'device.title', ctx, { class: 'journey__device-title' }),
        text('span', slide, 'device.text', ctx, { class: 'journey__device-text' }))),
  );
  return el;
}
