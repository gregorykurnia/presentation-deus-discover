import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderDeck, LAYOUT_MODULES } from '../../src/render.js';
import { LAYOUTS } from '../../src/model.js';

const seed = JSON.parse(readFileSync(resolve(process.cwd(), 'content/deck.json'), 'utf8'));
const clone = () => structuredClone(seed);
const ctx = (over = {}) => ({ mode: 'present', highlight: true, assetBase: '', ...over });
const byId = (els, id) => els.find((el) => el.dataset.slideId === id);
const slideOf = (deck, id) => deck.slides.find((s) => s.id === id);

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
    expect(byId(els, 's-proof').querySelector('.slide-header__num').textContent).toBe('08');
    expect(byId(els, 'a9-pricing').querySelector('.slide-header__num').textContent).toBe('A8');
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

  it.each([
    'Grow to 1.5x faster. Now',
    'Built on v2.0 by Acme Co., Ltd. Really.',
    'Rp1.5 juta. That is it!',
    '?Leading marks! Then text',
    'Ends with no punctuation',
    'Two  spaces.  Then more?  Yes!',
    'Can they do the job? Will they fit in? What drives them?',
    '[X] days. [Y] weeks.',
    '',
  ])('one-sentence-per-line headlines keep every character: %j', (value) => {
    const deck = clone();
    deck.slides[0].fields.headline = value;
    for (const highlight of [true, false]) {
      const h1 = renderDeck(deck, ctx({ highlight }))[0].querySelector('[data-field="headline"]');
      const spans = [...h1.querySelectorAll(':scope > .line')];
      expect(spans.map((s) => s.textContent).join('')).toBe(value);
      expect(h1.textContent).toBe(value);
    }
  });

  it('splits headlines only at sentence ends (punctuation + space)', () => {
    const deck = clone();
    deck.slides[0].fields.headline = 'Grow to 1.5x faster. Now with v2.0? Yes!';
    const h1 = renderDeck(deck, ctx())[0].querySelector('[data-field="headline"]');
    expect([...h1.querySelectorAll('.line')].map((s) => s.textContent))
      .toEqual(['Grow to 1.5x faster. ', 'Now with v2.0? ', 'Yes!']);
  });

  it('renders the fit slide without a "One score" pill', () => {
    const fit = byId(renderDeck(seed, ctx()), 's-fit');
    expect(fit.querySelector('.fit__one-score, [data-field="pill"]')).toBeNull();
    expect(fit.querySelector('[data-field="footer"]').textContent).toBe('Profiles ready in 1 day.');
  });

  it('renders the modules slide without a footer, labels starting upper case', () => {
    const mods = byId(renderDeck(seed, ctx()), 's-modules');
    expect(mods.querySelector('[data-field="footer"]')).toBeNull();
    expect(mods.querySelector('[data-field="modules.0.measures"]').textContent).toBe('Work style, values, teamwork');
    expect(mods.querySelector('[data-field="modules.0.feeds"]').textContent).toBe('Culture fit');
  });

  it('renders the trust slide as four pillars, a title and a proof line each', () => {
    const trust = byId(renderDeck(seed, ctx()), 's-trust');
    expect(trust.querySelector('[data-field="headline"]').textContent).toBe('The science behind the games.');
    expect(trust.querySelectorAll('.trust__pillar')).toHaveLength(4);
    expect(trust.querySelector('[data-field="pillars.2.title"]').textContent).toBe('Measured against traditional tests');
    expect(trust.querySelector('mark.ph')).toBeNull();
  });

  it('renders the package slide as one card per tier and an "includes" strip', () => {
    const pkg = byId(renderDeck(seed, ctx()), 's-package');
    expect(pkg.querySelector('[data-field="headline"]').textContent).toBe('Personality Assessment Packages');
    expect(pkg.querySelectorAll('.package__tier')).toHaveLength(4);
    expect(pkg.querySelector('.package__tiers').style.getPropertyValue('--tiers')).toBe('4');
    expect(pkg.querySelector('[data-field="tiers.3.price"]').textContent).toBe('Rp15,999,000');
    expect(pkg.querySelectorAll('.package__includes-list .list__item')).toHaveLength(5);
    expect(pkg.querySelector('mark.ph')).toBeNull();

    const deck = clone();
    slideOf(deck, 's-package').fields.tiers.pop();
    expect(byId(renderDeck(deck, ctx()), 's-package').querySelectorAll('.package__tier')).toHaveLength(3);
  });

  it('renders the cognitive packages as two wide cards, price per test first', () => {
    const cog = byId(renderDeck(seed, ctx()), 's-package-cognitive');
    expect(cog.querySelector('[data-field="headline"]').textContent).toBe('Cognitive Assessment Packages');
    expect(cog.querySelectorAll('.package__tier')).toHaveLength(2);
    expect(cog.querySelector('.package__tiers').classList.contains('package__tiers--wide')).toBe(true);
    expect(cog.querySelector('[data-field="tiers.1.perTest"]').textContent).toBe('≈ Rp83,300 per test');
    // Price per test leads; the per-candidate line follows it, and is left out where a tier has none.
    expect(cog.querySelector('[data-field="tiers.1.perTest"] + [data-field="tiers.1.perCandidate"]')).not.toBeNull();
    expect(cog.querySelector('[data-field="tiers.0.perCandidate"]')).toBeNull();
    expect(cog.querySelector('[data-field="tiers.0.validity"]')).toBeNull();
    expect(cog.querySelector('[data-field="tiers.0.tests"]').textContent).toBe('1 test · 30 minutes');
    const pkg = byId(renderDeck(seed, ctx()), 's-package');
    expect(pkg.querySelector('.package__tiers--wide')).toBeNull();
  });

  it('highlights placeholders only when ctx.highlight is on', () => {
    const on = byId(renderDeck(seed, ctx()), 'a4-drive');
    expect(on.querySelector('[data-field="measures"] mark.ph').textContent).toBe('[Full measures list]');
    const off = byId(renderDeck(seed, ctx({ highlight: false })), 'a4-drive');
    expect(off.querySelector('mark.ph')).toBeNull();
    expect(off.querySelector('[data-field="measures"]').textContent).toBe('[Full measures list]');
  });

  it('spreads the pilot contact bar: email, website, phone in that order', () => {
    const pilot = byId(renderDeck(seed, ctx()), 's-pilot');
    const items = [...pilot.querySelectorAll('.pilot__contact [data-field]')];
    expect(items.map((el) => el.dataset.field)).toEqual(['email', 'website', 'phone']);
    expect(items.map((el) => el.textContent)).toEqual(['admin@deushcs.com', 'www.deushcs.com', '+62 823-1212-1660']);
    expect(pilot.querySelectorAll('.pilot__contact-text[data-fit]')).toHaveLength(3);
  });

  it('escapes HTML in deck text', () => {
    const deck = clone();
    deck.slides[0].fields.headline = '<img src=x onerror=alert(1)> & co';
    const title = renderDeck(deck, ctx())[0];
    expect(title.querySelector('[data-field="headline"]').textContent).toBe('<img src=x onerror=alert(1)> & co');
    expect(title.querySelector('[data-field="headline"] img')).toBeNull();
  });

  it('renders a labeled .img-missing box when an image src is null', () => {
    const deck = clone();
    Object.assign(slideOf(deck, 's-title').images.clientLogo, { src: null, label: 'Client logo' });
    const els = renderDeck(deck, ctx());
    const client = byId(els, 's-title').querySelector('[data-image="clientLogo"]');
    expect(client.querySelector('img')).toBeNull();
    expect(client.querySelector('.img-missing').textContent).toContain('Client logo');
    const report = byId(els, 'a4-drive').querySelector('[data-image="reportSection"] .img-missing');
    expect(report.textContent).toContain('Matching report section');
  });

  it('prefixes image paths with ctx.assetBase but leaves data/blob/http URLs alone', () => {
    const deck = clone();
    slideOf(deck, 's-modules').images.cognitive.src = 'data:image/png;base64,AAAA';
    const els = renderDeck(deck, ctx({ assetBase: '../' }));
    const proofImg = byId(els, 's-proof').querySelector('[data-image="photo"] img');
    expect(proofImg.getAttribute('src')).toBe('../assets/telkom-photo.jpg');
    const cog = byId(els, 's-modules').querySelector('[data-image="cognitive"] img');
    expect(cog.getAttribute('src')).toBe('data:image/png;base64,AAAA');
  });

  it('applies image fit and focus from deck.json', () => {
    const deck = clone();
    slideOf(deck, 's-proof').images.photo.focus = [30, 70];
    slideOf(deck, 's-proof').images.photo.fit = 'contain';
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

  it('cycles the Cognitive appendix screenshots in present mode only', () => {
    const shot = (mode) => byId(renderDeck(seed, ctx({ mode })), 'a3-cognitive').querySelector('[data-image="screenshot"]');
    const present = shot('present');
    expect(present.hasAttribute('data-cycle')).toBe(true);
    expect(present.querySelector('img:not(.img-slot__next)').getAttribute('src')).toBe('assets/cognitive-1.jpg');
    expect([...present.querySelectorAll('.img-slot__next')].map((el) => el.getAttribute('src')))
      .toEqual([2, 3, 4, 5, 6, 7].map((i) => `assets/cognitive-${i}.jpg`));
    for (const mode of ['edit', 'print']) {
      const still = shot(mode);
      expect(still.hasAttribute('data-cycle')).toBe(false);
      expect(still.querySelectorAll('img')).toHaveLength(1);
    }
  });

  it('renders the video with controls and poster in present mode', () => {
    const video = byId(renderDeck(seed, ctx({ assetBase: './' })), 's-video');
    const v = video.querySelector('[data-image="video"] video');
    expect(v).not.toBeNull();
    expect(v.hasAttribute('controls')).toBe(true);
    expect(v.getAttribute('src')).toBe('./assets/demo.mp4');
    expect(v.getAttribute('poster')).toBe('./assets/demo-poster.jpg');
    expect(v.hasAttribute('data-play-on-show')).toBe(true);
    expect(v.hasAttribute('autoplay') || v.hasAttribute('loop') || v.muted).toBe(false);
    expect(video.textContent).not.toContain('Watch the demo');
    expect(video.querySelector('blockquote')).toBeNull();
    // A video that fails to load becomes the labeled box too.
    v.dispatchEvent(new Event('error'));
    expect(video.querySelector('[data-image="video"] .img-missing').textContent).toContain('Product demo video');
  });

  it('renders the poster instead of <video> in print mode, with no link or QR', () => {
    const video = byId(renderDeck(seed, ctx({ mode: 'print', assetBase: './' })), 's-video');
    expect(video.querySelector('video')).toBeNull();
    const poster = video.querySelector('[data-image="poster"] img');
    expect(poster.getAttribute('src')).toBe('./assets/demo-poster.jpg');
    expect(video.querySelector('[data-field="linkLine"]')).toBeNull();
    expect(video.querySelector('[data-image="qr"]')).toBeNull();
  });

  it('plays the report video muted and looping in place of the screenshot and callouts in present mode', () => {
    const report = byId(renderDeck(seed, ctx({ assetBase: './' })), 's-report');
    const v = report.querySelector('.report__frame [data-image="video"] video');
    expect(v.getAttribute('src')).toBe('./assets/report-demo.mp4');
    expect(v.muted).toBe(true);
    expect(v.hasAttribute('autoplay') && v.hasAttribute('loop')).toBe(true);
    expect(v.hasAttribute('controls')).toBe(false);
    expect(report.querySelector('[data-image="report"]')).toBeNull();
    expect(report.querySelectorAll('[data-callout]')).toHaveLength(0);
  });

  it('keeps the report screenshot in print mode and adds the video as a corner slot in edit mode', () => {
    const print = byId(renderDeck(seed, ctx({ mode: 'print' })), 's-report');
    expect(print.querySelector('video')).toBeNull();
    expect(print.querySelector('[data-image="report"] img')).not.toBeNull();
    const edit = byId(renderDeck(seed, ctx({ mode: 'edit' })), 's-report');
    expect(edit.querySelector('[data-image="report"] .video__poster[data-image="video"] video')).not.toBeNull();
    expect(edit.querySelectorAll('[data-callout]').length).toBeGreaterThan(0);
  });

  it('positions the report callouts by percent coordinates', () => {
    const report = byId(renderDeck(seed, ctx({ mode: 'print' })), 's-report');
    const callouts = [...report.querySelectorAll('.report__frame [data-callout]')];
    const spec = seed.slides.find((s) => s.id === 's-report').images.report.callouts;
    expect(callouts).toHaveLength(spec.length);
    callouts.forEach((c, i) => {
      expect(c.dataset.callout).toBe(String(i));
      expect(c.style.left).toBe(`${spec[i].x}%`);
      expect(c.style.getPropertyValue('--y')).toBe(`${spec[i].y}%`);
      expect(c.textContent).toContain(spec[i].label);
      expect(c.dataset.noOverlap).toBe('callouts');
    });
  });

  it('places the callouts on the displayed screenshot: its aspect ratio, fit and focus go to CSS on load', () => {
    const deck = clone();
    deck.slides.find((s) => s.id === 's-report').images.report.focus = [0, 100];
    const report = byId(renderDeck(deck, ctx({ mode: 'print' })), 's-report');
    const frame = report.querySelector('.report__frame');
    const img = frame.querySelector('[data-image="report"] img');
    // Until the screenshot loads, the callouts use the whole frame.
    expect(frame.style.getPropertyValue('--img-ar')).toBe('');
    Object.defineProperty(img, 'naturalWidth', { value: 1600 });
    Object.defineProperty(img, 'naturalHeight', { value: 800 });
    img.dispatchEvent(new Event('load'));
    expect(frame.style.getPropertyValue('--img-ar')).toBe('2');
    expect(frame.dataset.fit).toBe('contain');
    expect(frame.style.getPropertyValue('--img-fx')).toBe('0');
    expect(frame.style.getPropertyValue('--img-fy')).toBe('1');
  });

  it('sizes the frame right away when the screenshot is already loaded (no wait for a load event, R5)', () => {
    const proto = HTMLImageElement.prototype;
    const saved = ['complete', 'naturalWidth', 'naturalHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(proto, k)]);
    Object.defineProperty(proto, 'complete', { configurable: true, get: () => true });
    Object.defineProperty(proto, 'naturalWidth', { configurable: true, get: () => 1600 });
    Object.defineProperty(proto, 'naturalHeight', { configurable: true, get: () => 1294 });
    try {
      const frame = byId(renderDeck(seed, ctx({ mode: 'print' })), 's-report').querySelector('.report__frame');
      expect(frame.classList.contains('report__frame--sized')).toBe(true);
      expect(Number(frame.style.getPropertyValue('--img-ar'))).toBeCloseTo(1600 / 1294, 6);
    } finally {
      for (const [k, d] of saved) {
        if (d) Object.defineProperty(proto, k, d);
        else delete proto[k];
      }
    }
  });

  it('adds a "poster" slot to the video slide in edit mode only', () => {
    const edit = byId(renderDeck(seed, ctx({ mode: 'edit' })), 's-video');
    expect(edit.querySelector('[data-image="video"] video').hasAttribute('data-play-on-show')).toBe(false);
    expect(edit.querySelectorAll('[data-image="poster"]')).toHaveLength(1);
    expect(edit.querySelectorAll('[data-image="video"]')).toHaveLength(1);
    const present = byId(renderDeck(seed, ctx()), 's-video');
    expect(present.querySelector('[data-image="poster"]')).toBeNull();
  });

  describe('image labels and src values cannot inject HTML', () => {
    const EVIL = '<img src=x onerror=alert(1)><script>alert(2)</script>';

    it('in a missing-image box', () => {
      const deck = clone();
      slideOf(deck, 's-proof').images.photo = { src: null, label: EVIL };
      const slot = byId(renderDeck(deck, ctx()), 's-proof').querySelector('[data-image="photo"]');
      expect(slot.querySelector('.img-missing').textContent).toBe(EVIL);
      expect(slot.querySelectorAll('img, script')).toHaveLength(0);
    });

    it('in alt text and src attributes', () => {
      const deck = clone();
      const evilSrc = 'x.jpg" onerror="alert(1)"><script>alert(2)</script>';
      slideOf(deck, 's-proof').images.photo = { src: evilSrc, label: EVIL };
      const slot = byId(renderDeck(deck, ctx()), 's-proof').querySelector('[data-image="photo"]');
      const imgs = slot.querySelectorAll('img');
      expect(imgs).toHaveLength(1);
      expect(imgs[0].getAttribute('src')).toBe(evilSrc);
      expect(imgs[0].getAttribute('alt')).toBe(EVIL);
      expect(imgs[0].hasAttribute('onerror')).toBe(false);
      expect(slot.querySelector('script')).toBeNull();
    });

    it('in a video and its poster', () => {
      const deck = clone();
      const video = deck.slides.find((s) => s.id === 's-video');
      video.images.video.src = 'a.mp4"><script>alert(1)</script>';
      video.images.poster.src = 'p.jpg" onload="alert(1)';
      const slide = byId(renderDeck(deck, ctx({ mode: 'edit' })), 's-video');
      const v = slide.querySelector('video');
      expect(v.getAttribute('src')).toBe('a.mp4"><script>alert(1)</script>');
      expect(v.getAttribute('poster')).toBe('p.jpg" onload="alert(1)');
      expect(slide.querySelectorAll('script, [onload], [onerror]')).toHaveLength(0);
    });

    it('in report callout labels', () => {
      const deck = clone();
      deck.slides.find((s) => s.id === 's-report').images.report.callouts[0].label = EVIL;
      const report = byId(renderDeck(deck, ctx({ mode: 'print' })), 's-report');
      expect(report.querySelector('[data-callout="0"] .callout__label').textContent).toBe(EVIL);
      expect(report.querySelectorAll('.report__callouts img, .report__callouts script')).toHaveLength(0);
    });
  });

  it('draws arrows as inline SVG, never the "→" glyph', () => {
    for (const el of renderDeck(seed, ctx())) {
      expect(visibleTextNodes(el).join(''), el.dataset.slideId).not.toContain('→');
    }
    const fit = byId(renderDeck(seed, ctx()), 's-fit');
    expect(fit.querySelectorAll('svg.arrow')).toHaveLength(3);
  });

  // Ruling R9: symbols missing from the bundled DM Sans render as inline SVG glyphs.
  // Painted text never holds them: the only copies of the character are inside
  // the glyph's SVG or its transparent .glyph__text overlay (kept for copy/paste),
  // and the glyph carries role="img" + aria-label for screen readers.
  const SYMBOL_CHARS = /[≤≈→]/;
  function visibleTextNodes(root) {
    const out = [];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.parentElement.closest('svg, .glyph__text')) out.push(n.textContent);
    }
    return out;
  }

  it('renders ≤ and ≈ as accessible inline SVG glyphs, never as raw text', () => {
    const els = renderDeck(seed, ctx());
    const pkg = byId(els, 's-package');
    const table = byId(els, 'a9-pricing');
    for (const el of [pkg, table]) {
      expect(visibleTextNodes(el).filter((t) => SYMBOL_CHARS.test(t)), el.dataset.slideId).toEqual([]);
    }
    const approx = pkg.querySelector('[data-field="tiers.0.perCandidate"] .glyph');
    expect(approx.getAttribute('role')).toBe('img');
    expect(approx.getAttribute('aria-label')).toBe('≈');
    expect(approx.querySelector('svg[aria-hidden="true"] path')).not.toBeNull();
    expect(approx.querySelector('.glyph__text').textContent).toBe('≈');
    const le = table.querySelector('[data-field="table.columns.1"] .glyph');
    expect(le.getAttribute('aria-label')).toBe('≤');
    // The field's text is unchanged (editor + copy/paste read it back verbatim).
    expect(pkg.querySelector('[data-field="tiers.0.perCandidate"]').textContent).toBe('≈ Rp199,800 per candidate');
    expect(table.querySelector('[data-field="table.columns.1"]').textContent).toBe('Starter (≤250 candidates)');
  });

  it('applies the glyphs everywhere text is rendered, with highlighting on or off', () => {
    const deck = clone();
    slideOf(deck, 's-problem').fields.bullets[0] = 'Score ≤ [X] ≈ fine';
    for (const highlight of [true, false]) {
      const el = byId(renderDeck(deck, ctx({ highlight })), 's-problem');
      expect(visibleTextNodes(el).filter((t) => SYMBOL_CHARS.test(t))).toEqual([]);
      const item = el.querySelector('[data-field="bullets.0"]');
      expect(item.querySelectorAll('.glyph')).toHaveLength(2);
      expect(item.textContent).toBe('Score ≤ [X] ≈ fine');
      expect(!!item.querySelector('mark.ph')).toBe(highlight);
    }
  });

  it('draws a typed "→" in text as an unsquashed glyph: its box has the viewBox aspect', () => {
    const deck = clone();
    slideOf(deck, 's-problem').fields.bullets[0] = 'Apply → Play ≤ Score ≈ Hire';
    const item = byId(renderDeck(deck, ctx()), 's-problem').querySelector('[data-field="bullets.0"]');
    const glyphs = [...item.querySelectorAll('.glyph')];
    expect(glyphs.map((g) => g.getAttribute('aria-label'))).toEqual(['→', '≤', '≈']);
    for (const g of glyphs) {
      const [, , vbW, vbH] = g.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
      const width = Number.parseFloat(g.style.getPropertyValue('--glyph-w'));
      // CSS box: width x 1em; 32 viewBox units = 1em, so the drawing is never scaled unevenly.
      expect(vbH, g.getAttribute('aria-label')).toBe(32);
      expect(width * 32, g.getAttribute('aria-label')).toBeCloseTo(vbW, 5);
    }
    expect(item.textContent).toBe('Apply → Play ≤ Score ≈ Hire');
  });

  it('gives the pricing table, "Prepared for" and the pilot contact line a sized data-fit box', () => {
    const els = renderDeck(seed, ctx({ mode: 'print' }));
    const table = byId(els, 'a9-pricing').querySelector('.price-table');
    expect(table.hasAttribute('data-fit')).toBe(false);
    expect(table.parentElement.matches('.price-table-box[data-fit]')).toBe(true);
    expect(byId(els, 's-title').querySelector('.title__prepared[data-fit]')).not.toBeNull();
    expect(byId(els, 's-pilot').querySelector('.pilot__contact-phone[data-fit]')).not.toBeNull();
  });

  it('marks fixed-size text boxes with data-fit', () => {
    for (const el of renderDeck(seed, ctx({ mode: 'print' }))) {
      expect(el.querySelectorAll('[data-fit]').length, el.dataset.slideId).toBeGreaterThan(0);
    }
  });

  it('skips hidden slides in present and print modes, keeps them in edit mode', () => {
    const deck = clone();
    slideOf(deck, 's-problem').hidden = true;
    slideOf(deck, 'a2-personality').hidden = true;
    for (const mode of ['present', 'print']) {
      const ids = renderDeck(deck, ctx({ mode })).map((el) => el.dataset.slideId);
      expect(ids).toHaveLength(20);
      expect(ids).not.toContain('s-problem');
      expect(ids).not.toContain('a2-personality');
    }
    const edit = renderDeck(deck, ctx({ mode: 'edit' }));
    expect(edit).toHaveLength(22);
    expect(byId(edit, 's-problem').classList.contains('slide--hidden')).toBe(true);
    // Numbering follows the visible slides: the fit slide is now number 2.
    expect(byId(edit, 's-fit').querySelector('.slide-header__num').textContent).toBe('02');
  });

  it('renders an unknown layout as a labeled error slide instead of throwing', () => {
    const deck = clone();
    deck.slides[2].layout = 'nope';
    const el = renderDeck(deck, ctx())[2];
    expect(el.classList.contains('slide')).toBe(true);
    expect(el.textContent).toContain("Unknown layout 'nope'");
  });
});
