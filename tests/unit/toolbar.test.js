import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { attachToolbar, renderProblems } from '../../src/editor/toolbar.js';

const seed = JSON.parse(readFileSync(resolve(process.cwd(), 'content/deck.json'), 'utf8'));

describe('renderProblems (Upload JSON renders every slide before using a file)', () => {
  it('is empty for the seed deck', () => {
    expect(renderProblems(seed)).toEqual([]);
  });

  it('names each slide that cannot be drawn, with the reason', () => {
    const deck = structuredClone(seed);
    const proof = deck.slides.find((s) => s.id === 's-proof');
    proof.fields.stats = [null]; // passes validateDeck, breaks the layout
    const modules = deck.slides.find((s) => s.id === 's-modules');
    modules.fields.modules = 'oops';
    const problems = renderProblems(deck);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/^Slide 2 \(s-proof\): /);
    expect(problems[1]).toMatch(/^Slide \d+ \(s-modules\): /);
  });
});

function setupToolbar({ commit }) {
  document.body.innerHTML = `
    <button data-action="preview"></button><button data-action="download"></button>
    <button data-action="upload"></button><button data-action="publish"></button>
    <button data-action="lock"></button><input type="file" data-upload-json>`;
  const buttons = Object.fromEntries([...document.querySelectorAll('[data-action]')].map((b) => [b.dataset.action, b]));
  const api = { deck: seed, rev: 1, commit, notify: vi.fn(), clearNotice: vi.fn(), apply: vi.fn(), readOnly: false, onReadOnly: () => {} };
  attachToolbar(api, { buttons, uploadInput: document.querySelector('[data-upload-json]') });
  return { buttons, api };
}

describe('Preview', () => {
  it('opens its window right away (inside the click, so popup blockers allow it), then points it at the draft once saved', async () => {
    let saved;
    const commit = vi.fn(() => new Promise((ok) => { saved = ok; }));
    const popup = { closed: false, location: { href: 'about:blank' }, document: document.implementation.createHTMLDocument('') };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup);
    const { buttons } = setupToolbar({ commit });
    buttons.preview.click();
    expect(open).toHaveBeenCalledTimes(1); // before the save finished
    expect(popup.location.href).toBe('about:blank');
    saved();
    await vi.waitFor(() => expect(popup.location.href).toMatch(/\/present\.html\?source=draft$/));
    open.mockRestore();
  });
});
