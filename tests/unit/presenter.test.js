import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

  describe('touch', () => {
    const touch = (type, x, y, target = window) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      const pt = [{ clientX: x, clientY: y }];
      Object.defineProperty(e, 'touches', { value: type === 'touchstart' ? pt : [] });
      Object.defineProperty(e, 'changedTouches', { value: pt });
      target.dispatchEvent(e);
      return e;
    };
    const gesture = (x1, y1, x2, y2, target) => { touch('touchstart', x1, y1, target); return touch('touchend', x2, y2, target); };
    const current = (root) => root.querySelector('.slide.is-current').dataset.slideId;
    let root; let p;
    beforeEach(() => {
      window.innerWidth = 390; window.innerHeight = 844;
      root = document.getElementById('deck-root');
      window.history.replaceState(null, '', '#2');
      p = startPresenter({ id: 'd', slides: ['a', 'b', 'c'].map((id) => slide(id, false)) }, root, { highlight: true, print: false, window });
      expect(current(root)).toBe('b');
    });
    afterEach(() => p.destroy());

    it('swipe left or up goes forward', () => {
      gesture(300, 400, 100, 410); expect(current(root)).toBe('c');
      gesture(100, 400, 300, 400); expect(current(root)).toBe('b');
      gesture(200, 600, 205, 300); expect(current(root)).toBe('c');
    });

    it('swipe right or down goes back', () => {
      gesture(100, 400, 300, 390); expect(current(root)).toBe('a');
      gesture(200, 300, 200, 600); expect(current(root)).toBe('a'); // already first
    });

    it('swipe down goes back from the middle', () => {
      gesture(200, 300, 210, 600); expect(current(root)).toBe('a');
    });

    it('tap right goes forward, tap left goes back, and the follow-up click is cancelled', () => {
      const end = gesture(350, 400, 352, 401);
      expect(current(root)).toBe('c');
      expect(end.defaultPrevented).toBe(true);
      gesture(40, 400, 40, 400); expect(current(root)).toBe('b');
    });

    it('a short drag between tap and swipe does nothing', () => {
      gesture(200, 400, 225, 400); expect(current(root)).toBe('b');
    });

    it('touches on links and video are left alone', () => {
      const link = document.createElement('a'); link.href = '#x';
      root.querySelector('.slide.is-current').append(link);
      const end = gesture(350, 400, 350, 400, link);
      expect(current(root)).toBe('b');
      expect(end.defaultPrevented).toBe(false);
    });

    it('destroy removes the touch handlers', () => {
      p.destroy();
      gesture(350, 400, 350, 400); expect(current(root)).toBe('b');
    });
  });
});

