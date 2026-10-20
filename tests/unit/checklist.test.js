import { describe, it, expect } from 'vitest';
import { placeholdersBySlide, missingAssets, checklistMarkdown, slidesName, slideHasText } from '../../src/checklist.js';

const deck = {
  id: 't',
  slides: [
    { id: 's1', layout: 'title', section: 'main', fields: { headline: 'Hi', preparedFor: 'For [Company]' }, images: {
      clientLogo: { src: null, label: 'Client logo' },
      logo: { src: 'assets/logo.svg', label: 'Logo' },
    } },
    { id: 's2', layout: 'problem', section: 'main', hidden: true, fields: { headline: '[Hidden]' }, images: {} },
    { id: 's3', layout: 'package', section: 'main', fields: {
      changes: { title: 'What', bullets: ['Not [X weeks]', '[Telkom: X%]'] },
      recommended: { title: 'For your [MT program]', bullets: ['Again [X weeks]'] },
      small: 'Role setup [included].',
    }, images: {} },
    { id: 's4', layout: 'problem', section: 'main', fields: { headline: 'No brackets' }, images: {} },
    { id: 'd', layout: 'divider', section: 'appendix', fields: { headline: 'Appendix [x]' }, images: {} },
    { id: 'a1', layout: 'appendix', section: 'appendix', fields: { headline: 'One', placeholder: '[Example]' }, images: {
      shot: { src: 'assets/gone.jpg', label: 'Screenshot' },
    } },
  ],
};

describe('placeholdersBySlide', () => {
  it('groups placeholders by slide label in deck order, skipping hidden and empty slides', () => {
    const groups = placeholdersBySlide(deck);
    // Main slides number visible slides only: s3 is the 2nd visible main slide -> "2".
    expect(groups.map((g) => g.label)).toEqual(['1', '2', 'A', 'A1']);
  });

  it('dedupes within a slide and keeps first-seen order across nested fields', () => {
    const groups = placeholdersBySlide(deck);
    const pkg = groups.find((g) => g.slideId === 's3');
    expect(pkg.items.map((i) => i.text)).toEqual(['[X weeks]', '[Telkom: X%]', '[MT program]', '[included]']);
    expect(pkg.items[0].field).toBe('changes.bullets.0');
    expect(pkg.items[2].field).toBe('recommended.title');
  });

  it('records the headline when the slide has one', () => {
    const groups = placeholdersBySlide(deck);
    expect(groups.find((g) => g.slideId === 'a1').headline).toBe('One');
    expect(groups.find((g) => g.slideId === 's3').headline).toBe('What'); // no headline: falls back to changes.title
  });
});

describe('missingAssets', () => {
  it('lists null srcs and srcs whose file does not exist, with slide labels', () => {
    const exists = (p) => p === 'assets/logo.svg';
    expect(missingAssets(deck, exists)).toEqual([
      { label: '1', slideId: 's1', key: 'clientLogo', assetLabel: 'Client logo', path: null },
      { label: 'A1', slideId: 'a1', key: 'shot', assetLabel: 'Screenshot', path: 'assets/gone.jpg' },
    ]);
  });
});

describe('checklistMarkdown', () => {
  const md = checklistMarkdown(deck, { exists: (p) => p === 'assets/logo.svg' });

  it('writes one heading per slide with checklist items', () => {
    expect(md).toContain('## Slide 1: Hi');
    expect(md).toContain('## Appendix divider: Appendix [x]');
    expect(md).toContain('## Slide A1: One');
    expect(md).toMatch(/^- \[ \] `\[X weeks\]`/m);
    expect(md.match(/`\[X weeks\]`/g)).toHaveLength(1);
  });

  it('has a Missing assets section listing every missing image', () => {
    const section = md.slice(md.indexOf('## Missing assets'));
    expect(section).toContain('- [ ] Slide 1: Client logo');
    expect(section).toContain('- [ ] Slide A1: Screenshot');
    expect(section).toContain('`assets/gone.jpg`');
  });
});

describe('slidesName', () => {
  it('names one slide, a run of slides, or a list', () => {
    expect(slidesName(['A1'])).toBe('Slide A1');
    expect(slidesName(['A'])).toBe('Appendix divider');
    expect(slidesName(['A2', 'A3', 'A4', 'A5'])).toBe('Slides A2 to A5');
    expect(slidesName(['3', '4'])).toBe('Slides 3 and 4');
    expect(slidesName(['3', '5', 'A2'])).toBe('Slides 3, 5 and A2');
  });
});

describe('checklist to-dos are tied to the slides they are about', () => {
  const opts = {
    extraAssets: [{ match: (s) => s.layout === 'package', text: 'Replace the package art.' }],
    notes: [
      { match: (s) => slideHasText(s, '[Example]'), text: 'Write the real example.' },
      { match: (s) => slideHasText(s, '[Hidden]'), text: 'About a hidden slide.' },
      { slideId: 'gone', text: 'About a deleted slide.' },
      { slideId: 's2', text: 'About a hidden slide by id.' },
      { text: 'For the whole deck.' },
    ],
  };

  it('names the slide by its current number, wherever it moved', () => {
    const md = checklistMarkdown(deck, opts);
    expect(md).toContain('- [ ] Slide 2: Replace the package art.');
    expect(md).toContain('- [ ] Slide A1: Write the real example.');
    expect(md).toContain('- [ ] For the whole deck.');
    const moved = { ...deck, slides: [deck.slides[2], ...deck.slides.filter((_, i) => i !== 2)] };
    expect(checklistMarkdown(moved, opts)).toContain('- [ ] Slide 1: Replace the package art.');
  });

  it('skips to-dos about hidden or deleted slides', () => {
    const md = checklistMarkdown(deck, opts);
    expect(md).not.toContain('About a hidden slide');
    expect(md).not.toContain('About a deleted slide');
    const without = { ...deck, slides: deck.slides.filter((s) => s.id !== 'a1') };
    expect(checklistMarkdown(without, opts)).not.toContain('Write the real example.');
  });

  it('lists several matching slides under one to-do', () => {
    const md = checklistMarkdown(deck, { notes: [{ match: (s) => s.section === 'main', text: 'Check.' }] });
    expect(md).toContain('- [ ] Slides 1 to 3: Check.');
  });
});
