import { describe, expect, it } from 'vitest';

import { areCommentsAllowed } from './processSettings';

describe('areCommentsAllowed', () => {
  it('reads config.allowComments', () => {
    expect(areCommentsAllowed({ config: { allowComments: true } })).toBe(true);
    expect(areCommentsAllowed({ config: { allowComments: false } })).toBe(
      false,
    );
  });

  // Every process configured before the toggle existed has no key, and all of
  // them have working comments today.
  it('defaults to allowed when the toggle was never set', () => {
    expect(areCommentsAllowed({ config: {} })).toBe(true);
    expect(areCommentsAllowed({})).toBe(true);
    expect(areCommentsAllowed(null)).toBe(true);
    expect(areCommentsAllowed(undefined)).toBe(true);
  });
});
