import { describe, expect, it } from 'vitest';

import { clipCommentContext } from './commentContext';

describe('clipCommentContext', () => {
  it('keeps a short comment whole and strips the whitespace around it', () => {
    expect(clipCommentContext('  Fund the park  ')).toBe('Fund the park');
  });

  it('cuts a long comment to fifty characters and marks the cut', () => {
    const long = `${'a'.repeat(50)} ${'b'.repeat(20)}`;

    expect(clipCommentContext(long)).toBe(`${'a'.repeat(50)}...`);
  });

  it('never returns more than fifty-three characters', () => {
    expect(clipCommentContext('x'.repeat(200))).toHaveLength(53);
  });
});
