import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isSearchQueryLongEnough } from './isSearchQueryLongEnough';

describe('isSearchQueryLongEnough', () => {
  /**
   * Given a query shorter than two characters
   * When the search checks it
   * Then the check refuses it
   */
  it('refuses a query shorter than two characters', () => {
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
   * Then the check refuses it
   */
  it('counts an emoji as one character', () => {
    expect(isSearchQueryLongEnough('😀')).toBe(false);
  });

  /**
   * Given a letter plus a combining mark, which is two code points
   * When the search checks it
   * Then the check accepts it, because it counts code points, not graphemes
   */
  it('counts a combining mark as its own character', () => {
    expect(isSearchQueryLongEnough('é')).toBe(true);
  });

  /**
   * Given the input schema the search endpoints use
   * When the check and the schema see the same query
   * Then they agree, so the client never sends a query the API rejects
   */
  it.each(['', 'a', 'ab', '😀', '😀😀', 'é'])(
    'agrees with z.string().min(2) for %j',
    (query) => {
      expect(isSearchQueryLongEnough(query)).toBe(
        z.string().min(2).safeParse(query).success,
      );
    },
  );
});
