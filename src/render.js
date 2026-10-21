// renderDeck(deck, ctx) -> HTMLElement[]: one <section class="slide"> per slide,
// meant to be appended as siblings (print CSS breaks a page after each).
// ctx = { mode: "present" | "edit" | "print", highlight: boolean, assetBase: string }
// Hidden slides are skipped in present/print and kept (with .slide--hidden) in edit.
// Styles: src/styles/daybreak.css, then src/styles/layouts.css.
import { slideLabel, visibleSlides } from './model.js';
import { h, slideFrame, missingBox } from './layouts/common.js';
import * as title from './layouts/title.js';
import * as proof from './layouts/proof.js';
import * as problem from './layouts/problem.js';
import * as fit from './layouts/fit.js';
import * as video from './layouts/video.js';
import * as modules from './layouts/modules.js';
import * as report from './layouts/report.js';
import * as trust from './layouts/trust.js';
import * as pkg from './layouts/package.js';
import * as pilot from './layouts/pilot.js';
import * as divider from './layouts/divider.js';
import * as appendix from './layouts/appendix.js';
import * as table from './layouts/table.js';
import * as journey from './layouts/journey.js';
import * as gains from './layouts/gains.js';

export const LAYOUT_MODULES = Object.fromEntries(
  [title, proof, problem, fit, video, modules, report, trust, pkg, pilot, divider, appendix, table, journey, gains]
    .map((m) => [m.name, { name: m.name, render: m.render }]),
);

/** Renders one slide; an unknown layout becomes a labeled error slide. */
export function renderSlide(slide, ctx) {
  const layout = LAYOUT_MODULES[slide.layout];
  if (layout) return layout.render(slide, ctx);
  const el = slideFrame(slide, ctx);
  el.append(h('div', { class: 'slide-error' }, missingBox(`Unknown layout '${slide.layout}'`, ctx)));
  return el;
}

export function renderDeck(deck, ctx) {
  const slides = ctx.mode === 'edit' ? deck.slides : visibleSlides(deck);
  return slides.map((slide) => renderSlide(slide, { ...ctx, label: slideLabel(deck, slide.id) }));
}
