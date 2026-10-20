import { describe, it, expect, beforeEach } from 'vitest';
import { startPresenter } from '../../src/present/presenter.js';

const slide = (id, hidden) => ({ id, layout: 'problem', section: 'main', hidden, fields: { headline: id }, images: {}, notes: '' });

describe('startPresenter', () => {
  beforeEach(() => {
    document.body.className = '';
    document.body.innerHTML = '<div id="deck-root"></div>';
  });

  it('shows a calm empty state instead of throwing when every slide is hidden', () => {
    const root = document.getElementById('deck-root');
    const deck = { id: 'd', slides: [slide('a', true), slide('b', true)] };
    const p = startPresenter(deck, root, { highlight: true, print: false, window });
    expect(p.slides).toHaveLength(0);
    const empty = root.querySelector('.present-empty');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toContain('No slides to show');
    expect(empty.textContent).toContain('Every slide in this deck is hidden.');
    // Keys do nothing (and throw nothing) with no slides.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    p.destroy();
  });

  it('still shows the first visible slide otherwise', () => {
    const root = document.getElementById('deck-root');
    const p = startPresenter({ id: 'd', slides: [slide('a', true), slide('b', false)] }, root, { highlight: true, print: false, window });
    expect(root.querySelector('.slide.is-current').dataset.slideId).toBe('b');
    expect(root.querySelector('.present-empty')).toBeNull();
    p.destroy();
  });
});
