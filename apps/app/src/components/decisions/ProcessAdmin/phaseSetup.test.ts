import { describe, expect, it } from 'vitest';

import { getSetupBlurbKey } from './phaseSetup';

const phase = { id: 'row-1', slug: 'a1b2c3d4', phaseId: 'phase-1' };

describe('getSetupBlurbKey', () => {
  it.each([
    [
      { reviews: { submit: true }, proposals: { submit: true } },
      'setupBlurbReview',
    ],
    [{ proposals: { submit: true } }, 'setupBlurbCollect'],
    [{ proposals: { develop: true } }, 'setupBlurbDevelop'],
    [{ voting: { submit: true } }, 'setupBlurbVote'],
    [{}, 'setupBlurbResults'],
  ])('picks the blurb from the capabilities %j', (rules, key) => {
    expect(getSetupBlurbKey({ ...phase, rules })).toBe(key);
  });
});
