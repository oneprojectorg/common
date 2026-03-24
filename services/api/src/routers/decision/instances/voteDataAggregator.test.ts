import { aggregateVoteData } from '@op/common';
import { describe, expect, it } from 'vitest';

describe.concurrent('aggregateVoteData', () => {
  it('returns empty object for an empty proposals array', async () => {
    const result = await aggregateVoteData([]);
    expect(result).toEqual({});
  });
});
