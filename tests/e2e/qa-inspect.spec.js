import { test, expect } from '@playwright/test';
import deck from '../../content/deck.json' with { type: 'json' };
import { inspectSlides } from '../../scripts/qa.js';

const OPTS = { minFont: 26, tol: 1 };

test('inspectSlides reports a forced overflow, an overlap and text under 26px', async ({ page }) => {
  await page.setContent(`
    <style>
      .slide { position: relative; width: 1920px; height: 1080px; font: 30px/1.3 sans-serif; }
      .slide > * { position: absolute; margin: 0; }
    </style>
    <section class="slide" data-slide-id="fx">
      <p data-field="headline" data-fit style="left: 40px; top: 40px; width: 200px; height: 40px">
        This sentence is far too long for a two hundred pixel box
      </p>
      <div data-field="left" data-no-overlap="main" style="left: 400px; top: 40px; width: 300px; height: 100px">A</div>
      <div data-field="right" data-no-overlap="main" style="left: 600px; top: 90px; width: 300px; height: 100px">B</div>
      <p data-field="tiny" style="left: 40px; top: 600px; font-size: 20px">tiny</p>
    </section>`);
  const found = await page.evaluate(inspectSlides, OPTS);
  expect(found).toEqual([
    expect.objectContaining({ slideId: 'fx', kind: 'overflow', what: 'field', name: 'headline', axis: 'down' }),
    expect.objectContaining({ slideId: 'fx', kind: 'overlap', group: 'main', a: { what: 'field', name: 'left' }, b: { what: 'field', name: 'right' }, w: 100, h: 50 }),
    expect.objectContaining({ slideId: 'fx', kind: 'font', text: 'tiny', size: 20 }),
  ]);
});

test('the pricing table, "Prepared for" and the pilot contact line report overflow when text grows', async ({ page }) => {
  const render = (d) => page.evaluate(async (data) => {
    const { renderDeck } = await import('/src/render.js');
    const root = document.getElementById('deck-root');
    root.replaceChildren(...renderDeck(data, { mode: 'print', highlight: true, assetBase: '' }));
    await document.fonts.ready;
  }, d);
  const overflows = async () => (await page.evaluate(inspectSlides, OPTS))
    .filter((p) => p.kind === 'overflow').map((p) => `${p.slideId} ${p.name}`);
  const watched = ['s-title preparedFor', 's-pilot contact', 'a9-pricing table.columns'];

  await page.goto('/present.html?print');
  await render(deck);
  expect(await overflows()).toEqual([]);

  const long = structuredClone(deck);
  const slide = (id) => long.slides.find((s) => s.id === id);
  slide('s-title').fields.preparedFor = `Prepared for ${'A very long company name '.repeat(4)}`;
  slide('s-pilot').fields.contact += ' · [Second name] · [Second WhatsApp] · another.person@deushcs.com';
  slide('a9-pricing').fields.table.rows[3][0] = '4 (full suite) '.concat('with every optional add-on module '.repeat(6));
  await render(long);
  expect(await overflows()).toEqual(expect.arrayContaining(watched));
});
