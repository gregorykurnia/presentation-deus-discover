// "Trusted by": the headline, then every client logo in one wall on a white panel, in
// deck.json order (images "logo-01".."logo-NN"; each group's brands side by side, as on
// deushcs.com/en/clients). Logos differ wildly in shape (Watchout is 13:1, Boga Group
// taller than wide), so each one is sized to about the same visual area once it loads,
// capped by its cell; until then it simply fits the cell.
import { h, text, imageSlot, slideFrame } from './common.js';

export const name = 'logos';

const CELL_W = 200;
const CELL_H = 72;
const AREA = 8200; // px²: Telkom (4:1) comes out ~180x45, Boga Group ~59x72

/** Width and height for a logo of this aspect ratio (w/h), same area, inside the cell. */
export function logoBox(aspect) {
  let w = Math.sqrt(AREA * aspect);
  let hgt = w / aspect;
  if (w > CELL_W) { w = CELL_W; hgt = w / aspect; }
  if (hgt > CELL_H) { hgt = CELL_H; w = hgt * aspect; }
  return { w: Math.round(w), h: Math.round(hgt) };
}

export function render(slide, ctx) {
  const el = slideFrame(slide, ctx);
  const keys = Object.keys(slide.images ?? {}).filter((k) => k.startsWith('logo-')).sort();
  el.append(
    text('h2', slide, 'headline', ctx, { class: 't-headline logos__headline', fit: true, group: 'main' }),
    h('div', { class: 'glass logos__panel', 'data-no-overlap': 'main' },
      h('div', { class: 'logos__grid', 'data-fit': true },
        keys.map((key) => h('div', { class: 'logos__cell' }, sized(imageSlot(slide, key, ctx, { class: 'logos__logo' })))))),
  );
  return el;
}

function sized(slot) {
  const img = slot.querySelector('img');
  if (!img) return slot;
  const apply = () => {
    if (!img.naturalWidth || !img.naturalHeight) return;
    const { w, h: hgt } = logoBox(img.naturalWidth / img.naturalHeight);
    slot.style.width = `${w}px`;
    slot.style.height = `${hgt}px`;
  };
  if (img.complete) apply(); else img.addEventListener('load', apply, { once: true });
  return slot;
}
