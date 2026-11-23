// The Indonesian deck (content/deck-id.json, the separate Indonesian site) and the
// two layout options it added: {accent} text on the report headline and the
// divider's optional subtitle. Both leave the English deck's output unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderDeck } from '../../src/render.js';
import { validateDeck, visibleSlides } from '../../src/model.js';

const load = (f) => JSON.parse(readFileSync(resolve(process.cwd(), 'content', f), 'utf8'));
const id = load('deck-id.json');
const en = load('deck.json');
const ctx = { mode: 'present', highlight: true, assetBase: '' };
const slideEl = (deck, slideId) => renderDeck(deck, ctx).find((el) => el.dataset.slideId === slideId);

describe('Indonesian deck', () => {
  it('is a valid deck of the 22 Canva slides plus the trailer, all visible, with lang "id"', () => {
    expect(validateDeck(id)).toEqual([]);
    expect(visibleSlides(id)).toHaveLength(23);
    expect(id.lang).toBe('id');
  });

  it('keeps the two screen recordings the Canva could not show', () => {
    const src = (sid, key) => id.slides.find((s) => s.id === sid).images[key].src;
    expect(src('s-video', 'video')).toBe('assets/demo.mp4');
    expect(src('s-report', 'video')).toBe('assets/report-demo.mp4');
  });

  it('shows the braced part of the report question in the accent colour, without the braces', () => {
    const h = slideEl(id, 's-report').querySelector('.report__headline');
    expect(h.querySelector('.accent').textContent).toBe('Posisi, Budaya, serta Nilai Perusahaan?');
    expect(h.textContent).not.toMatch(/[{}]/);
  });

  it('renders the divider subtitle only when the deck has one', () => {
    expect(slideEl(id, 's-appendix').querySelector('.divider__subtitle').textContent)
      .toBe('Detail modul, jenis laporan, fitur platform, dan harga.');
    expect(slideEl(en, 's-appendix').querySelector('.divider__subtitle')).toBeNull();
  });

  it('leaves the English report headline without accent spans', () => {
    expect(slideEl(en, 's-report').querySelector('.report__headline .accent')).toBeNull();
  });
});

describe('HoAFL trailer slide', () => {
  it.each([['English', en], ['Indonesian', id]])('%s deck plays it right after the four modules', (_, deck) => {
    const ids = visibleSlides(deck).map((s) => s.id);
    expect(ids.indexOf('s-trailer')).toBe(ids.indexOf('s-modules') + 1);
    const slide = deck.slides.find((s) => s.id === 's-trailer');
    expect(slide.images.video.src).toBe('assets/hoafl-trailer.mp4');
    expect(slide.images.poster.src).toBe('assets/hoafl-trailer-poster.jpg');
    expect(slideEl(deck, 's-trailer').querySelector('video')).not.toBeNull();
  });

  it.each([['English', en, '45 min'], ['Indonesian', id, '45 menit']])(
    '%s journey slide gives Personality the 45 minutes the trailer says',
    (_, deck, time) => {
      const j = deck.slides.find((s) => s.id === 's-journey');
      expect(j.fields.durations.find((d) => d.name === 'Personality').time).toBe(time);
    },
  );
});
