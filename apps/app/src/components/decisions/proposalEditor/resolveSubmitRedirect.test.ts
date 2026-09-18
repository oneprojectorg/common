import { describe, expect, it } from 'vitest';

import { resolveSubmitRedirect } from './resolveSubmitRedirect';

describe('resolveSubmitRedirect', () => {
  it('appends the promote param for an anonymous author submitting a draft', () => {
    expect(
      resolveSubmitRedirect({
        didSubmitDraft: true,
        isAnonymous: true,
        profileId: 'profile-1',
        backHref: '/instance/1',
      }),
    ).toBe('/instance/1?promote=1&proposal=profile-1');
  });

  it('goes back to backHref for a non-anonymous author', () => {
    expect(
      resolveSubmitRedirect({
        didSubmitDraft: true,
        isAnonymous: false,
        profileId: 'profile-1',
        backHref: '/instance/1',
      }),
    ).toBe('/instance/1');
  });

  it('goes back to backHref for a checkpoint update (not a draft submit)', () => {
    expect(
      resolveSubmitRedirect({
        didSubmitDraft: false,
        isAnonymous: true,
        profileId: 'profile-1',
        backHref: '/instance/1',
      }),
    ).toBe('/instance/1');
  });

  it('goes back to backHref when there is no profileId to promote', () => {
    expect(
      resolveSubmitRedirect({
        didSubmitDraft: true,
        isAnonymous: true,
        profileId: undefined,
        backHref: '/instance/1',
      }),
    ).toBe('/instance/1');
  });
});
