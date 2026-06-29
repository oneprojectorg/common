import { describe, expect, it } from 'vitest';

import { truncateDescription } from './metaDescription';

describe('truncateDescription', () => {
  it('returns empty for empty or whitespace-only input', () => {
    expect(truncateDescription('')).toBe('');
    expect(truncateDescription('   \n\t ')).toBe('');
  });

  it('collapses runs of internal whitespace to single spaces', () => {
    expect(truncateDescription('a   b\n c')).toBe('a b c');
  });

  it('returns the text verbatim under and exactly at the limit', () => {
    expect(truncateDescription('abc', 5)).toBe('abc');
    expect(truncateDescription('abcde', 5)).toBe('abcde');
  });

  it('clamps over-limit text with an ellipsis, staying within max', () => {
    const out = truncateDescription('abcdef', 5);
    expect(out).toBe('abcd…');
    expect([...out].length).toBeLessThanOrEqual(5);
  });

  it('trims a trailing space before the ellipsis', () => {
    expect(truncateDescription('ab cdef', 4)).toBe('ab…');
  });

  it('does not split a surrogate pair at the boundary', () => {
    // 😀 is one code point but two UTF-16 units; a .length-based slice would
    // cut it in half and emit a lone surrogate.
    expect(truncateDescription('😀😀😀', 2)).toBe('😀…');
  });
});
