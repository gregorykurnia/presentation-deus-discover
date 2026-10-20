import { describe, it, expect } from 'vitest';
import { findPlaceholders, highlightPlaceholders } from '../../src/placeholders.js';

describe('findPlaceholders', () => {
  it('returns the bracketed text, brackets included', () => {
    expect(findPlaceholders('Shortlist in 1 day, not [X weeks]')).toEqual(['[X weeks]']);
  });

  it('returns several placeholders in order', () => {
    expect(findPlaceholders('[A] then [B c] then [A]')).toEqual(['[A]', '[B c]', '[A]']);
  });

  it('returns an empty list when there are none', () => {
    expect(findPlaceholders('No placeholders here.')).toEqual([]);
    expect(findPlaceholders('')).toEqual([]);
  });

  it('ignores empty brackets', () => {
    expect(findPlaceholders('a [] b')).toEqual([]);
  });

  it('tolerates null and undefined', () => {
    expect(findPlaceholders(null)).toEqual([]);
    expect(findPlaceholders(undefined)).toEqual([]);
  });
});

describe('highlightPlaceholders', () => {
  it('escapes HTML and marks the placeholder', () => {
    expect(highlightPlaceholders('<b>[X]</b>', true)).toBe(
      '&lt;b&gt;<mark class="ph">[X]</mark>&lt;/b&gt;',
    );
  });

  it('escapes all five special characters', () => {
    expect(highlightPlaceholders(`a & b < c > d " e ' f`, true)).toBe(
      'a &amp; b &lt; c &gt; d &quot; e &#39; f',
    );
  });

  it('escapes text inside a placeholder before marking it', () => {
    expect(highlightPlaceholders('[A & <B>]', true)).toBe(
      '<mark class="ph">[A &amp; &lt;B&gt;]</mark>',
    );
  });

  it('marks every placeholder', () => {
    expect(highlightPlaceholders('Prepared for [Company], [X] days', true)).toBe(
      'Prepared for <mark class="ph">[Company]</mark>, <mark class="ph">[X]</mark> days',
    );
  });

  it('returns escaped text with no <mark> when disabled', () => {
    const s = '<b>[X]</b> & [Y]';
    const out = highlightPlaceholders(s, false);
    expect(out).toBe('&lt;b&gt;[X]&lt;/b&gt; &amp; [Y]');
    expect(out).not.toContain('<mark');
  });

  it('tolerates null and undefined', () => {
    expect(highlightPlaceholders(null, true)).toBe('');
    expect(highlightPlaceholders(undefined, false)).toBe('');
  });
});
