// QA for the PDF deck. Loads dist/offline/deck.html?print (file://, print media,
// 1920x1080, fonts and images loaded) and checks every visible slide:
//   - [data-fit] boxes: scrollHeight > clientHeight + 1 or scrollWidth > clientWidth + 1
//     -> "FAIL slide 4 field steps.0: overflows by 38px"
//   - [data-no-overlap="<group>"]: bounding boxes in one group on one slide must not intersect
//   - text fields and callouts must sit inside the 1920x1080 slide (nothing cut off)
//   - no rendered text under 26px (global constraint)
// Then rasterises DEUS-Pitch.pdf (re-exported if older than the build) to qa/page-NN.png
// with pdftoppm for the by-eye check. Exits 1 on any failure.
//
//   npm run qa
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { slideLabel } from '../src/model.js';
import { exportPdf } from '../export-pdf.js';
import {
  ensureOfflineBuild, loadDeck, openPrintDeck, pdfIsStale, pdfPageCount, pdfPath, root, visibleCount,
} from './lib/print-deck.js';

const MIN_FONT_PX = 26;
const TOLERANCE_PX = 1; // sub-pixel rounding only; see the plan's check

/**
 * Runs in the page (page.evaluate(inspectSlides, { minFont, tol })), so it must not
 * use anything outside its own body. Returns [{ slideId, kind, ... }] for every
 * problem found: kind 'overflow' | 'outside' | 'overlap' | 'font'.
 */
export function inspectSlides({ minFont, tol }) {
  const out = [];
  const nameOf = (el) => {
    if (el.dataset.field) return { what: 'field', name: el.dataset.field };
    if (el.dataset.image) return { what: 'image', name: el.dataset.image };
    if (el.dataset.callout != null) return { what: 'callout', name: el.dataset.callout };
    const child = el.querySelector('[data-field]');
    if (child) return { what: 'field', name: child.dataset.field.replace(/\.\d+$/, '') };
    return { what: 'box', name: `.${[...el.classList].join('.')}` };
  };
  const visible = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    }
    return true;
  };

  for (const slide of document.querySelectorAll('section.slide')) {
    const slideId = slide.dataset.slideId;
    const sr = slide.getBoundingClientRect();

    for (const el of slide.querySelectorAll('[data-fit]')) {
      const dy = el.scrollHeight - el.clientHeight;
      const dx = el.scrollWidth - el.clientWidth;
      if (dy > tol || dx > tol) out.push({ slideId, kind: 'overflow', ...nameOf(el), by: Math.max(dy, dx), axis: dy >= dx ? 'down' : 'across' });
    }

    for (const el of slide.querySelectorAll('[data-field], [data-callout], [data-image]')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      const out_ = Math.max(sr.left - r.left, sr.top - r.top, r.right - sr.right, r.bottom - sr.bottom);
      // The proof photo is full-bleed by design; other slots must sit inside the slide.
      if (out_ > tol) out.push({ slideId, kind: 'outside', ...nameOf(el), by: out_ });
    }

    const groups = new Map();
    for (const el of slide.querySelectorAll('[data-no-overlap]')) {
      const g = el.dataset.noOverlap;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(el);
    }
    for (const [group, els] of groups) {
      for (let i = 0; i < els.length; i++) {
        for (let j = i + 1; j < els.length; j++) {
          const a = els[i]; const b = els[j];
          if (a.contains(b) || b.contains(a)) continue;
          const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
          const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const hgt = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (w > tol && hgt > tol) out.push({ slideId, kind: 'overlap', group, a: nameOf(a), b: nameOf(b), w, h: hgt });
        }
      }
    }

    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!n.data.trim() || seen.has(el) || el.closest('svg, .glyph__text')) continue;
      seen.add(el);
      if (!visible(el)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < minFont) out.push({ slideId, kind: 'font', text: el.textContent.trim().slice(0, 50), size });
    }
  }
  return out;
}

function message(deck, p) {
  const where = `slide ${slideLabel(deck, p.slideId) || p.slideId}`;
  const px = (n) => `${Math.round(n)}px`;
  switch (p.kind) {
    case 'overflow': return `FAIL ${where} ${p.what} ${p.name}: overflows by ${px(p.by)}`;
    case 'outside': return `FAIL ${where} ${p.what} ${p.name}: extends ${px(p.by)} outside the slide`;
    case 'overlap': return `FAIL ${where} ${p.a.what} ${p.a.name}: overlaps ${p.b.what} ${p.b.name} by ${px(p.w)}x${px(p.h)} (group ${p.group})`;
    case 'font': return `FAIL ${where} text "${p.text}": ${p.size}px is under the ${MIN_FONT_PX}px minimum`;
    default: return `FAIL ${where}: ${JSON.stringify(p)}`;
  }
}

/** pdftoppm -> qa/page-NN.png (old pages removed first). Returns the file names. */
function rasterise() {
  const dir = join(root, 'qa');
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (/^page-\d+\.png$/.test(f)) rmSync(join(dir, f));
  execFileSync('pdftoppm', ['-png', '-scale-to', '1920', pdfPath, join(dir, 'page')]);
  return readdirSync(dir).filter((f) => /^page-\d+\.png$/.test(f)).sort();
}

async function main() {
  ensureOfflineBuild();
  const deck = loadDeck();
  const expected = visibleCount(deck);
  const failures = [];

  const browser = await chromium.launch();
  try {
    const { page, problems } = await openPrintDeck(browser);
    for (const p of problems) failures.push(`FAIL ${p}`);
    const rendered = await page.locator('section.slide').count();
    if (rendered !== expected) failures.push(`FAIL print view has ${rendered} slides, expected ${expected}`);
    const found = await page.evaluate(inspectSlides, { minFont: MIN_FONT_PX, tol: TOLERANCE_PX });
    failures.push(...found.map((p) => message(deck, p)));
  } finally {
    await browser.close();
  }

  if (pdfIsStale()) {
    console.log('DEUS-Pitch.pdf is missing or older than the build; exporting ...');
    await exportPdf();
  }
  const pages = pdfPageCount(pdfPath);
  if (pages !== expected) failures.push(`FAIL DEUS-Pitch.pdf has ${pages} pages, expected ${expected}`);
  const pngs = rasterise();
  if (pngs.length !== expected) failures.push(`FAIL qa/ has ${pngs.length} page images, expected ${expected}`);

  console.log(`Checked ${expected} slides; PDF ${pages} pages; ${pngs.length} page images in qa/ (${pngs[0]} .. ${pngs.at(-1)}).`);
  if (failures.length) {
    for (const f of failures) console.log(f);
    console.log(`QA: ${failures.length} failure(s).`);
    process.exit(1);
  }
  console.log('QA: all checks passed (overflow, overlap, inside slide, text >= 26px, page count).');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(`FAIL ${err.stack ?? err.message}`);
    process.exit(1);
  });
}
