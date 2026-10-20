import { describe, it, expect } from 'vitest';
import { nullMissingSrcs, startsWithFlagScript } from '../../scripts/lib/offline-transform.js';
import { isUrlSrc } from '../../src/layouts/common.js';

describe('isUrlSrc', () => {
  it('recognises upload and external URLs, not repo-relative paths', () => {
    for (const u of ['data:image/png;base64,AAA', 'blob:http://x/1', 'https://a/b.png', 'http://a/b.png', '/uploads/a.png']) {
      expect(isUrlSrc(u), u).toBe(true);
    }
    for (const p of ['assets/a.png', './a.png', 'a.png']) expect(isUrlSrc(p), p).toBe(false);
  });
});

describe('nullMissingSrcs', () => {
  const deck = () => ({
    slides: [{
      images: {
        here: { src: 'assets/here.png' },
        gone: { src: 'assets/gone.mp4' },
        none: { src: null },
        up1: { src: 'data:image/png;base64,AAA' },
        up2: { src: 'blob:http://x/1' },
        up3: { src: 'https://cdn.example/a.png' },
        up4: { src: 'http://cdn.example/a.png' },
        up5: { src: '/uploads/a.png' },
      },
    }],
  });

  it('nulls only repo-relative srcs whose file is missing', () => {
    const out = nullMissingSrcs(deck(), (p) => p === 'assets/here.png');
    const img = out.slides[0].images;
    expect(img.here.src).toBe('assets/here.png');
    expect(img.gone.src).toBeNull();
    expect(img.none.src).toBeNull();
    expect(img.up1.src).toBe('data:image/png;base64,AAA');
    expect(img.up2.src).toBe('blob:http://x/1');
    expect(img.up3.src).toBe('https://cdn.example/a.png');
    expect(img.up4.src).toBe('http://cdn.example/a.png');
    expect(img.up5.src).toBe('/uploads/a.png');
  });

  it('never asks the file system about URL srcs', () => {
    const asked = [];
    nullMissingSrcs(deck(), (p) => { asked.push(p); return true; });
    expect(asked.sort()).toEqual(['assets/gone.mp4', 'assets/here.png']);
  });
});

describe('startsWithFlagScript', () => {
  const page = (v) => `<!doctype html><html><head>\n  <script>\n    const SHOW_PLACEHOLDER_HIGHLIGHT = ${v};\n  </script></head>`;
  it('accepts the flag script first with either value', () => {
    expect(startsWithFlagScript(page('true'))).toBe(true);
    expect(startsWithFlagScript(page('false'))).toBe(true);
  });
  it('rejects a page without the flag script', () => {
    expect(startsWithFlagScript('<html><head><script>var a=1;</script></head>')).toBe(false);
  });
});
