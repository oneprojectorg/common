import { describe, expect, it } from 'vitest';

import {
  ALL_PROCESS_CAPABILITIES,
  areCommentsAllowed,
  getProcessCapabilities,
} from './processSettings';

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

describe('getProcessCapabilities', () => {
  it('resolves every capability from the instance data', () => {
    expect(
      getProcessCapabilities({ config: { allowComments: false } }),
    ).toEqual({ comments: false });
    expect(getProcessCapabilities({ config: { allowComments: true } })).toEqual(
      {
        comments: true,
      },
    );
  });

  // The context default stands in for an unconfigured process, so it has to
  // agree with what an unconfigured process actually resolves to. Drift here
  // would hide a disabled capability on any surface without a provider.
  it('matches ALL_PROCESS_CAPABILITIES for an unconfigured process', () => {
    expect(getProcessCapabilities({})).toEqual(ALL_PROCESS_CAPABILITIES);
    expect(getProcessCapabilities(undefined)).toEqual(ALL_PROCESS_CAPABILITIES);
  });
});
