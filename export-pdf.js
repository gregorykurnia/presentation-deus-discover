// Exports the deck to DEUS-Pitch.pdf: one 1920x1080 page per visible slide,
// backgrounds printed, fonts bundled (works offline).
//
//   npm run pdf [-- --source local|published]
//
// Loads dist/offline/deck.html?print over file:// (rebuilding it first when it is
// missing or older than its sources), waits for document.fonts.ready and every
// image's decode(), prints, and checks the page count equals the visible slides.
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import {
  ensureOfflineBuild, loadDeck, openPrintDeck, pdfPageCount, pdfPath, visibleCount,
} from './scripts/lib/print-deck.js';

function parseSource(argv) {
  const eq = argv.find((a) => a.startsWith('--source='));
  const i = argv.indexOf('--source');
  return eq ? eq.slice('--source='.length) : i >= 0 ? argv[i + 1] : 'local';
}

/** Writes DEUS-Pitch.pdf; throws when the page count is wrong or the page had errors. */
export async function exportPdf() {
  ensureOfflineBuild();
  const expected = visibleCount(loadDeck());
  const browser = await chromium.launch();
  try {
    const { page, problems } = await openPrintDeck(browser);
    const rendered = await page.locator('section.slide').count();
    if (rendered !== expected) {
      throw new Error(`print view rendered ${rendered} slides, expected ${expected} visible slides`);
    }
    if (problems.length) throw new Error(`deck did not load cleanly:\n  ${problems.join('\n  ')}`);
    await page.pdf({
      path: pdfPath,
      width: '1920px',
      height: '1080px',
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
  const pages = pdfPageCount(pdfPath);
  if (pages !== expected) {
    throw new Error(`DEUS-Pitch.pdf has ${pages} pages, expected ${expected} (one per visible slide)`);
  }
  return { pages };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const source = parseSource(process.argv.slice(2));
  if (source === 'published') {
    console.error('--source published is available after Phase 3 (Task 12)');
    process.exit(1);
  }
  if (source !== 'local') {
    console.error(`unknown --source "${source}" (expected local)`);
    process.exit(1);
  }
  exportPdf()
    .then(({ pages }) => console.log(`DEUS-Pitch.pdf: ${pages} pages (one per visible slide)`))
    .catch((err) => {
      console.error(`FAIL ${err.message}`);
      process.exit(1);
    });
}
