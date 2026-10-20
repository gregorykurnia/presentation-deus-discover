import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateDeck } from '../../src/model.js';

const deck = JSON.parse(readFileSync(resolve(process.cwd(), 'content/deck.json'), 'utf8'));
const brief = readFileSync(resolve(process.cwd(), 'deck-brief.md'), 'utf8');

// Every string value anywhere in the deck (fields, notes, table cells...).
function strings(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => strings(n, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => strings(n, out));
  return out;
}
const all = strings(deck.slides);
const text = all.join('\n');

describe('deck.json structure', () => {
  it('has the deck header', () => {
    expect(deck.id).toBe('deus-pitch');
    expect(typeof deck.rev).toBe('number');
  });

  it('has 10 main slides and 12 appendix slides (divider + A1-A11)', () => {
    expect(deck.slides.filter((s) => s.section === 'main')).toHaveLength(10);
    expect(deck.slides.filter((s) => s.section === 'appendix')).toHaveLength(12);
    expect(deck.slides.filter((s) => s.layout === 'divider')).toHaveLength(1);
  });

  it('validates cleanly', () => {
    expect(validateDeck(deck)).toEqual([]);
  });
});

describe('deck.json content is verbatim from the brief', () => {
  it.each([
    'Rp119,000 per candidate',
    '1,000 applicants ≈ Rp119 juta',
    'Profiles ready in 1 day.',
  ])('contains %s', (s) => {
    expect(all).toContain(s);
  });

  it.each(['99,000', '169,000', '229,000', '279,000', '69,000', '119,000', '159,000', '199,000'])(
    'pricing table contains %s',
    (v) => {
      const pricing = deck.slides.find((s) => s.layout === 'table');
      expect(strings(pricing.fields.table.rows)).toContain(v);
    },
  );

  // Placeholders that have since been filled in with real content.
  const FILLED = ['[Company]'];

  it('keeps every [bracketed placeholder] from the slides section of the brief, unless filled', () => {
    const slidesPart = brief.slice(brief.indexOf('## Slides'), brief.indexOf('## Step 2'));
    const placeholders = [...new Set(slidesPart.match(/\[[^\]]+\]/g))].filter((p) => !FILLED.includes(p));
    expect(placeholders.length).toBeGreaterThan(10);
    for (const p of placeholders) expect(text, p).toContain(p);
  });

  // The deck's slide order may differ from the brief's (the Telkom proof slide moved to 8).
  it('keeps speaker notes verbatim for the main slides', () => {
    const notes = [...brief.matchAll(/^Notes: (.+)$/gm)].map((m) => m[1]);
    expect(notes).toHaveLength(10);
    const main = deck.slides.filter((s) => s.section === 'main');
    expect(main.map((s) => s.notes).sort()).toEqual(notes.sort());
  });

  it('has no branding that must not appear', () => {
    expect(text).not.toMatch(/Agat[eé]|Level Up|Next Chapter/i);
  });
});
