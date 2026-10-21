import { describe, expect, it } from 'vitest';

import { isSearchQueryLongEnough } from './isSearchQueryLongEnough';

describe('isSearchQueryLongEnough', () => {
  /**
   * Given a query of one character
   * When the search checks it
   * Then the check refuses it
   */
  it('refuses a one-character query', () => {
    expect(isSearchQueryLongEnough('')).toBe(false);
    expect(isSearchQueryLongEnough('a')).toBe(false);
  });

  /**
   * Given a query of two characters
   * When the search checks it
   * Then the check accepts it
   */
  it('accepts a two-character query', () => {
    expect(isSearchQueryLongEnough('ab')).toBe(true);
    expect(isSearchQueryLongEnough('😀😀')).toBe(true);
  });

  /**
   * Given one emoji, which is two UTF-16 units but one character
   * When the search checks it
   * Then the check refuses it, as the API's `.min(2)` does
   */
  it('counts an emoji as one character', () => {
    expect(isSearchQueryLongEnough('😀')).toBe(false);
  });
});
