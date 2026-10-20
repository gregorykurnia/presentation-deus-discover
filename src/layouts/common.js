// Building blocks shared by every layout template.
// Markup contract (read by the presenter, editor, PDF export and QA):
//   <section class="slide [slide--content] layout-<name>" data-slide-id data-notes data-layout>
//   [data-field="<path under slide.fields>"]  editable text; textContent === the deck text
//   [data-image="<key under slide.images>"]   image/video slot (.img-slot)
//   [data-fit]                                fixed-size text box: must not overflow
//   [data-no-overlap="<group>"]               boxes in one group must not intersect
//   [data-callout="<index>"]                  report callout (images.report.callouts[i])
import { highlightPlaceholders } from '../placeholders.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const HEADER_LOGO = 'assets/logo-mark-wordmark-dark.svg';

/** Creates an element: h('p', { class: 'x', 'data-fit': '' }, child, 'text'). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c);
  }
  return el;
}

/** Reads a dotted path ("stats.2.label") from slide.fields. */
export function fieldAt(slide, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), slide.fields);
}

/**
 * An editable text element for one field. Text is escaped and placeholders are
 * highlighted per ctx.highlight. Options:
 *   fit: true       -> data-fit (fixed-size box)
 *   group: 'main'   -> data-no-overlap group
 *   lines: true     -> each sentence on its own line (spans; textContent unchanged)
 *   split: RegExp   -> wraps the first match in <span class="lead-part"> (e.g. the price)
 */
export function text(tag, slide, path, ctx, opts = {}) {
  const value = String(fieldAt(slide, path) ?? '');
  const el = h(tag, {
    class: opts.class,
    'data-field': path,
    'data-fit': opts.fit ? true : null,
    'data-no-overlap': opts.group,
  });
  if (opts.lines) {
    // Split only where sentence punctuation is followed by whitespace and then
    // more text ("1.5x", "v2.0", "Co.," stay whole). split() with a lookaround
    // never drops characters: the spaces stay at the end of each span, so the
    // spans joined (and textContent) equal the original text.
    const parts = value.split(/(?<=[.?!]\s+)(?=\S)/);
    el.innerHTML = parts.map((p) => `<span class="line">${highlightPlaceholders(p, ctx.highlight)}</span>`).join('');
  } else if (opts.split) {
    const m = value.match(opts.split);
    if (m) {
      const [lead] = m;
      const rest = value.slice(m.index + lead.length);
      el.innerHTML = highlightPlaceholders(value.slice(0, m.index), ctx.highlight)
        + `<span class="lead-part">${highlightPlaceholders(lead, ctx.highlight)}</span>`
        + `<span class="rest-part">${highlightPlaceholders(rest, ctx.highlight)}</span>`;
    } else {
      el.innerHTML = highlightPlaceholders(value, ctx.highlight);
    }
  } else {
    el.innerHTML = highlightPlaceholders(value, ctx.highlight);
  }
  return replaceSymbols(el);
}

/**
 * Symbols the bundled DM Sans subset lacks (Rulings R8, R9), drawn as inline
 * SVG in currentColor so they match the text around them. In text, a glyph box
 * is w/32 em wide and 1em tall (top at 0.8em above the baseline, see .glyph in
 * layouts.css): 32 viewBox units = 1em, math axis at y = 15, so a drawing is
 * never stretched or squashed. `deco` is the decorative arrow between items
 * (sized by .arrow).
 */
const SYMBOLS = {
  '→': { w: 28, d: 'M3 15h21M17 8.5l7 6.5-7 6.5', deco: { viewBox: '0 0 40 24', d: 'M2 12h34M26 3l10 9-10 9' } },
  '≤': { w: 20, d: 'M16 6L4 12.5 16 19M4 24.5h12' },
  '≈': { w: 20, d: 'M3.5 12.5q3.25-3.5 6.5 0t6.5 0M3.5 19.5q3.25-3.5 6.5 0t6.5 0' },
};
const SYMBOL_RE = new RegExp(`[${Object.keys(SYMBOLS).join('')}]`, 'g');

/**
 * A symbol drawn as inline SVG in currentColor.
 * Decorative (arrows between items): a bare aria-hidden <svg>.
 * In text: <span class="glyph" role="img" aria-label="≈"> holding the <svg> and
 * a transparent, same-width copy of the character (.glyph__text) laid over it,
 * so screen readers, copy/paste, innerText and the field's textContent all keep
 * the deck text, while nothing is painted in a fallback font.
 */
export function symbol(ch, { decorative = false, cls = '' } = {}) {
  const spec = decorative ? SYMBOLS[ch].deco : SYMBOLS[ch];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', (decorative ? cls : `glyph__svg ${cls}`).trim());
  svg.setAttribute('viewBox', spec.viewBox ?? `0 0 ${spec.w} 32`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', spec.d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  if (decorative) path.setAttribute('stroke-width', '3');
  svg.append(path);
  if (decorative) return svg;
  const glyph = h('span', { class: 'glyph', role: 'img', 'aria-label': ch },
    svg, h('span', { class: 'glyph__text', 'aria-hidden': 'true' }, ch));
  glyph.style.setProperty('--glyph-w', `${spec.w / 32}em`);
  return glyph;
}

/** Replaces every symbol character in el's text with its SVG glyph (in place). */
export function replaceSymbols(el) {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const hits = [];
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    SYMBOL_RE.lastIndex = 0;
    if (SYMBOL_RE.test(n.data) && !n.parentElement.closest('svg, .glyph')) hits.push(n);
  }
  for (const node of hits) {
    const parts = node.data.split(SYMBOL_RE);
    const chars = node.data.match(SYMBOL_RE);
    const frag = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (part) frag.append(part);
      if (i < chars.length) frag.append(symbol(chars[i]));
    });
    node.replaceWith(frag);
  }
  return el;
}

/** Escaped, placeholder-highlighted HTML set on el, with symbols as SVG glyphs. */
export function setText(el, value, ctx) {
  el.innerHTML = highlightPlaceholders(value, ctx.highlight);
  return replaceSymbols(el);
}

/** A right-pointing arrow between items (Ruling R8). Decorative. */
export function arrow(cls = '') {
  return symbol('→', { decorative: true, cls: `arrow ${cls}`.trim() });
}

/** True for a src that is already a URL (upload or external link), not a repo-relative path. */
export function isUrlSrc(src) {
  return /^(data:|blob:|https?:|\/)/.test(src);
}

/** Resolves an image src against ctx.assetBase (uploads keep their own URL). */
export function assetUrl(src, ctx) {
  if (isUrlSrc(src)) return src;
  return `${ctx.assetBase ?? ''}${src}`;
}

/** The clean labeled box shown when an image is missing (Ruling R3). */
export function missingBox(label, ctx) {
  return h('div', { class: 'img-missing' }, setText(h('span'), label ?? 'Image', ctx));
}

/**
 * An image slot for slide.images[key]. src null -> missing box; a load error
 * swaps the <img> for the same box. opts: class, group, tag ('img' | 'video'),
 * video attrs via opts.poster.
 */
export function imageSlot(slide, key, ctx, opts = {}) {
  const img = slide.images?.[key] ?? { src: null, label: key };
  const focus = Array.isArray(img.focus) ? img.focus : [50, 50];
  const slot = h('div', {
    class: `img-slot ${opts.class ?? ''}`.trim(),
    'data-image': key,
    'data-no-overlap': opts.group,
  });
  slot.style.setProperty('--img-fit', img.fit ?? 'cover');
  slot.style.setProperty('--img-focus', `${focus[0]}% ${focus[1]}%`);
  const showMissing = () => {
    slot.classList.add('img-slot--missing');
    slot.replaceChildren(missingBox(img.label, ctx), ...(opts.overlay ?? []));
  };
  if (!img.src) {
    showMissing();
    return slot;
  }
  let media;
  if (opts.tag === 'video') {
    media = h('video', { controls: true, preload: 'metadata', playsinline: true });
    const poster = slide.images?.[opts.poster];
    if (poster?.src) media.setAttribute('poster', assetUrl(poster.src, ctx));
  } else {
    media = h('img', { alt: img.label ?? '', decoding: 'async', draggable: 'false' });
  }
  media.addEventListener('error', showMissing, { once: true });
  media.setAttribute('src', assetUrl(img.src, ctx));
  slot.append(media, ...(opts.overlay ?? []));
  return slot;
}

/** Two-digit slide numbers for main slides ("02"), appendix labels as is ("A9"). */
export function displayLabel(label) {
  return /^\d$/.test(label) ? `0${label}` : (label ?? '');
}

/**
 * The <section class="slide"> frame. Content slides get the small
 * "logo · slide number" header.
 */
export function slideFrame(slide, ctx, { content = true } = {}) {
  const section = h('section', {
    class: `slide layout-${slide.layout}${content ? ' slide--content' : ''}${slide.hidden ? ' slide--hidden' : ''}`,
    'data-slide-id': slide.id,
    'data-layout': slide.layout,
    'data-notes': slide.notes ?? '',
  });
  if (content) {
    section.append(h('header', { class: 'slide-header' },
      h('img', { class: 'slide-header__logo', src: assetUrl(HEADER_LOGO, ctx), alt: 'DEUS' }),
      h('span', { class: 'slide-header__num' }, displayLabel(ctx.label ?? ''))));
  }
  return section;
}

/** A vertical list of bullet fields (fields[path][i]); each item is a data-field. */
export function bulletList(slide, path, ctx, opts = {}) {
  const items = fieldAt(slide, path) ?? [];
  return h('ul', { class: `list ${opts.class ?? ''}`.trim(), 'data-no-overlap': opts.group },
    items.map((_, i) => h('li', { class: 'list__item' },
      text('span', slide, `${path}.${i}`, ctx, { class: 'list__text' }))));
}

/** A row of step pills joined by arrows (fit flow, A8 method). The last step is accented. */
export function stepFlow(slide, path, ctx, opts = {}) {
  const steps = fieldAt(slide, path) ?? [];
  const flow = h('div', { class: `flow ${opts.class ?? ''}`.trim(), 'data-fit': true, 'data-no-overlap': opts.group });
  steps.forEach((_, i) => {
    if (i > 0) flow.append(arrow('flow__arrow'));
    flow.append(text('span', slide, `${path}.${i}`, ctx, {
      class: `pill flow__step${i === steps.length - 1 ? ' pill--accent' : ''}`,
    }));
  });
  return flow;
}

/** Decorative disc (no content). */
export function disc(which, cls) {
  return h('div', { class: `disc-${which} ${cls}`, 'aria-hidden': 'true' });
}
