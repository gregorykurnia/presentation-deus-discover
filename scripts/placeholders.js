// Writes placeholders.md: every [bracketed placeholder] left in the deck, by slide
// number, plus the missing assets and other to-dos before the deck is final.
//
//   npm run placeholders
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checklistMarkdown } from '../src/checklist.js';
import { loadDeck, root } from './lib/print-deck.js';

const deck = loadDeck();

const md = checklistMarkdown(deck, {
  exists: (p) => existsSync(join(root, p)),
  assetNotes: {
    's-video.video': 'The presenter plays this file with controls; the PDF shows the poster instead.',
    's-video.poster': 'Shown in the PDF in place of the video (a frame from the demo works well).',
    's-video.qr': 'Encode the demo link, the same link as "Watch the demo: [link]" on this slide (still a placeholder).',
    's-title.clientLogo': 'Per client: add the logo next to "Prepared for [Company]".',
  },
  extraAssets: [
    {
      slideId: 's-report',
      text: "Replace report screenshot with one showing all four sections (Role fit, Culture fit, Motivation drivers, Recommendation); today Culture fit points at 'Strength patterns' and Motivation drivers at 'Development risks'. File: `assets/report-suitability.jpg` (same name), then re-check the callout positions in `content/deck.json`.",
    },
  ],
  notes: [
    {
      slideId: 'a1-profiles',
      text: 'The bracket text "[Example profiles: Finance vs Sales; example using company values]" was written as a placeholder for this deck (the brief only says "placeholder"). Replace it with the real example profiles.',
    },
    {
      text: 'Slides A2 to A5: "[Full measures list]" and the "Matching report section" boxes were written as placeholders for this deck (the brief says "as placeholders"). Replace each with the module\'s real measures list and report section.',
    },
  ],
});

writeFileSync(join(root, 'placeholders.md'), md);
console.log(`placeholders.md written (${md.split('\n').filter((l) => l.startsWith('- [ ]')).length} checklist items)`);
