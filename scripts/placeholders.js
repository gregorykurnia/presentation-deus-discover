// Writes placeholders.md: every [bracketed placeholder] left in the deck, by slide
// number, plus the missing assets and other to-dos before the deck is final.
//
//   npm run placeholders      (DECK_FILE / DECK_OUT_DIR: see scripts/lib/print-deck.js)
//
// The to-dos below name their slides by what is on them (layout, text, picture),
// so they follow the slides when they move and drop out when a slide is hidden or deleted.
import { existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { checklistMarkdown, slideHasText } from '../src/checklist.js';
import { loadDeck, paths, root } from './lib/print-deck.js';

const REPORT_SHOT = 'assets/report-suitability.jpg';

const deck = loadDeck();

const md = checklistMarkdown(deck, {
  exists: (p) => existsSync(join(root, p)),
  assetNotes: {
    's-video.video': 'The presenter plays this file with controls; the PDF shows the poster instead.',
    's-video.poster': 'Shown in the PDF in place of the video (a frame from the trailer works well).',
  },
  extraAssets: [
    {
      // Only while the report slide still shows today's screenshot.
      match: (s) => s.layout === 'report' && s.images?.report?.src === REPORT_SHOT,
      text: "Replace report screenshot with one showing all four sections (Role fit, Culture fit, Motivation drivers, Recommendation); today Culture fit points at 'Strength patterns' and Motivation drivers at 'Development risks'. File: `assets/report-suitability.jpg` (same name), then re-check the callout positions in `content/deck.json`.",
    },
  ],
  notes: [
    {
      match: (s) => slideHasText(s, '[Full measures list]'),
      text: '"[Full measures list]" and the "Matching report section" boxes were written as placeholders for this deck (the brief says "as placeholders"). Replace each with the module\'s real measures list and report section.',
    },
  ],
});

writeFileSync(paths.placeholders, md);
const shown = relative(root, paths.placeholders);
console.log(`${shown.startsWith('..') ? paths.placeholders : shown} written (${md.split('\n').filter((l) => l.startsWith('- [ ]')).length} checklist items)`);
