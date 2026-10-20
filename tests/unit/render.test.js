import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderDeck, LAYOUT_MODULES } from '../../src/render.js';
import { LAYOUTS } from '../../src/model.js';

const seed = JSON.parse(readFileSync(resolve(process.cwd(), 'content/deck.json'), 'utf8'));
const clone = () => structuredClone(seed);
const ctx = (over = {}) => ({ mode: 'present', highlight: true, assetBase: '', ...over });
const byId = (els, id) => els.find((el) => el.dataset.slideId === id);

// Walks a value by a dotted path ("stats.2.label", "table.rows.1.2").
const at = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

// Every string leaf under `fields`, as [path, value].
function leaves(node, prefix = '', out = []) {
  if (typeof node === 'string') out.push([prefix, node]);
  else if (Array.isArray(node)) node.forEach((n, i) => leaves(n, prefix ? `${prefix}.${i}` : String(i), out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

// Ignores ids used by the model, not shown as text.
const NON_TEXT_KEYS = new Set(['key']);

describe('layout modules', () => {
  it('provide one { name, render } module per layout name', () => {
    expect(Object.keys(LAYOUT_MODULES).sort()).toEqual([...LAYOUTS].sort());
    for (const [name, mod] of Object.entries(LAYOUT_MODULES)) {
      expect(mod.name).toBe(name);
      expect(typeof mod.render).toBe('function');
    }
  });
});

describe('renderDeck', () => {
  it('renders the 22 seed slides as <section class="slide"> elements with id and notes', () => {
    const els = renderDeck(seed, ctx());
    expect(els).toHaveLength(22);
    els.forEach((el, i) => {
      const slide = seed.slides[i];
      expect(el.tagName).toBe('SECTION');
      expect(el.classList.contains('slide')).toBe(true);
      expect(el.dataset.slideId).toBe(slide.id);
      expect(el.hasAttribute('data-notes')).toBe(true);
      expect(el.dataset.notes).toBe(slide.notes);
      if (slide.notes) expect(el.dataset.notes.length).toBeGreaterThan(0);
    });
    // The brief gives notes for all 10 main slides.
    expect(els.slice(0, 10).every((el) => el.dataset.notes.trim().length > 0)).toBe(true);
  });

  it('puts the logo + slide-number header on content slides only', () => {
    const els = renderDeck(seed, ctx({ assetBase: './' }));
    for (const el of els) {
      const layout = el.dataset.layout;
      const header = el.querySelector(':scope > .slide-header');
      if (layout === 'title' || layout === 'divider') {
        expect(header).toBeNull();
        expect(el.classList.contains('slide--content')).toBe(false);
      } else {
        expect(header).not.toBeNull();
        expect(el.classList.contains('slide--content')).toBe(true);
        expect(header.querySelector('img.slide-header__logo').getAttribute('src'))
          .toBe('./assets/logo-mark-wordmark-dark.svg');
      }
    }
    expect(byId(els, 's-proof').querySelector('.slide-header__num').textContent).toBe('02');
    expect(byId(els, 'a9-pricing').querySelector('.slide-header__num').textContent).toBe('A9');
  });

  it('renders every text field verbatim inside a [data-field] element', () => {
    const els = renderDeck(seed, ctx({ mode: 'edit', highlight: false }));
    seed.slides.forEach((slide, i) => {
      const el = els[i];
      for (const [path, value] of leaves(slide.fields)) {
        if (NON_TEXT_KEYS.has(path.split('.').pop())) continue;
        const node = el.querySelector(`[data-field="${path}"]`);
        expect(node, `${slide.id} ${path}`).not.toBeNull();
        expect(node.textContent.replace(/\s+/g, ' ').trim(), `${slide.id} ${path}`).toBe(value);
      }
      // ...and every data-field points at a real string.
      el.querySelectorAll('[data-field]').forEach((node) => {
        expect(typeof at(slide.fields, node.dataset.field), `${slide.id} ${node.dataset.field}`).toBe('string');
      });
    });
  });

  it('highlights placeholders only when ctx.highlight is on', () => {
    const on = byId(renderDeck(seed, ctx()), 's-fit');
    expect(on.querySelector('[data-field="footer"] mark.ph').textContent).toBe('[X]');
    const off = byId(renderDeck(seed, ctx({ highlight: false })), 's-fit');
    expect(off.querySelector('mark.ph')).toBeNull();
    expect(off.querySelector('[data-field="footer"]').textContent).toBe('Profiles ready in [X] days.');
  });

  it('escapes HTML in deck text', () => {
    const deck = clone();
    deck.slides[0].fields.headline = '<img src=x onerror=alert(1)> & co';
    const title = renderDeck(deck, ctx())[0];
    expect(title.querySelector('[data-field="headline"]').textContent).toBe('<img src=x onerror=alert(1)> & co');
    expect(title.querySelector('[data-field="headline"] img')).toBeNull();
  });

  it('renders a labeled .img-missing box when an image src is null', () => {
    const els = renderDeck(seed, ctx());
    const client = byId(els, 's-title').querySelector('[data-image="clientLogo"]');
    expect(client.querySelector('img')).toBeNull();
    expect(client.querySelector('.img-missing').textContent).toContain('Client logo');
    const report = byId(els, 'a2-personality').querySelector('[data-image="reportSection"] .img-missing');
    expect(report.textContent).toContain('Matching report section');
  });

  it('prefixes image paths with ctx.assetBase but leaves data/blob/http URLs alone', () => {
    const deck = clone();
    deck.slides[5].images.cognitive.src = 'data:image/png;base64,AAAA';
    const els = renderDeck(deck, ctx({ assetBase: '../' }));
    const proofImg = byId(els, 's-proof').querySelector('[data-image="photo"] img');
    expect(proofImg.getAttribute('src')).toBe('../assets/telkom-photo.jpg');
    const cog = byId(els, 's-modules').querySelector('[data-image="cognitive"] img');
    expect(cog.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });

  it('applies image fit and focus from deck.json', () => {
    const deck = clone();
    deck.slides[1].images.photo.focus = [30, 70];
    deck.slides[1].images.photo.fit = 'contain';
    const slot = byId(renderDeck(deck, ctx()), 's-proof').querySelector('[data-image="photo"]');
    expect(slot.style.getPropertyValue('--img-fit')).toBe('contain');
    expect(slot.style.getPropertyValue('--img-focus')).toBe('30% 70%');
  });

  it('swaps an image that fails to load for the labeled missing box', () => {
    const slot = byId(renderDeck(seed, ctx()), 's-proof').querySelector('[data-image="photo"]');
    slot.querySelector('img').dispatchEvent(new Event('error'));
    expect(slot.querySelector('img')).toBeNull();
    expect(slot.querySelector('.img-missing').textContent).toContain('Telkom photo');
  });

  it('renders the video with controls and poster in present mode', () => {
    const video = byId(renderDeck(seed, ctx({ assetBase: './' })), 's-video');
    const v = video.querySelector('[data-image="video"] video');
    expect(v).not.toBeNull();
    expect(v.hasAttribute('controls')).toBe(true);
    expect(v.getAttribute('src')).toBe('./assets/demo.mp4');
    expect(v.getAttribute('poster')).toBe('./assets/demo-poster.jpg');
    expect(video.textContent).not.toContain('Watch the demo');
    // A video that fails to load becomes the labeled box too.
    v.dispatchEvent(new Event('error'));
    expect(video.querySelector('[data-image="video"] .img-missing').textContent).toContain('Product demo video');
  });

  it('renders poster + "Watch the demo: [link]" + QR slot instead of <video> in print mode', () => {
    const video = byId(renderDeck(seed, ctx({ mode: 'print', assetBase: './' })), 's-video');
    expect(video.querySelector('video')).toBeNull();
    const poster = video.querySelector('[data-image="poster"] img');
    expect(poster.getAttribute('src')).toBe('./assets/demo-poster.jpg');
    expect(video.querySelector('[data-field="linkLine"]').textContent).toBe('Watch the demo: [link]');
    const qr = video.querySelector('[data-image="qr"]');
    expect(qr.querySelector('.img-missing').textContent).toContain('QR code to the demo');
  });

  it('positions the report callouts by percent coordinates', () => {
    const report = byId(renderDeck(seed, ctx()), 's-report');
    const callouts = [...report.querySelectorAll('.report__frame [data-callout]')];
    const spec = seed.slides.find((s) => s.id === 's-report').images.report.callouts;
    expect(callouts).toHaveLength(spec.length);
    callouts.forEach((c, i) => {
      expect(c.dataset.callout).toBe(String(i));
      expect(c.style.left).toBe(`${spec[i].x}%`);
      expect(c.style.top).toBe(`${spec[i].y}%`);
      expect(c.textContent).toContain(spec[i].label);
      expect(c.dataset.noOverlap).toBe('callouts');
    });
  });

  it('draws arrows as inline SVG, never the "→" glyph', () => {
    for (const el of renderDeck(seed, ctx())) {
      expect(el.textContent, el.dataset.slideId).not.toContain('→');
    }
    const fit = byId(renderDeck(seed, ctx()), 's-fit');
    expect(fit.querySelectorAll('svg.arrow')).toHaveLength(3);
  });

  it('marks fixed-size text boxes with data-fit', () => {
    for (const el of renderDeck(seed, ctx({ mode: 'print' }))) {
      expect(el.querySelectorAll('[data-fit]').length, el.dataset.slideId).toBeGreaterThan(0);
    }
  });

  it('skips hidden slides in present and print modes, keeps them in edit mode', () => {
    const deck = clone();
    deck.slides[2].hidden = true;
    deck.slides[12].hidden = true;
    for (const mode of ['present', 'print']) {
      const ids = renderDeck(deck, ctx({ mode })).map((el) => el.dataset.slideId);
      expect(ids).toHaveLength(20);
      expect(ids).not.toContain('s-problem');
      expect(ids).not.toContain('a2-personality');
    }
    const edit = renderDeck(deck, ctx({ mode: 'edit' }));
    expect(edit).toHaveLength(22);
    expect(byId(edit, 's-problem').classList.contains('slide--hidden')).toBe(true);
    // Numbering follows the visible slides: the fit slide is now number 3.
    expect(byId(edit, 's-fit').querySelector('.slide-header__num').textContent).toBe('03');
  });

  it('renders an unknown layout as a labeled error slide instead of throwing', () => {
    const deck = clone();
    deck.slides[2].layout = 'nope';
    const el = renderDeck(deck, ctx())[2];
    expect(el.classList.contains('slide')).toBe(true);
    expect(el.textContent).toContain("Unknown layout 'nope'");
  });
});
