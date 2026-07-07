import { GLOBAL_USER_PUBLIC } from '@op/core';
import { describe, expect, it } from 'vitest';

import {
  orgUserCacheKey,
  profileUserCacheKey,
  resolveAccessUserIds,
} from './cacheKeys';

// Regression: profileUserCacheKey and orgUserCacheKey define the cache key
// shape for the durable `profileUser` / `orgUser` caches. The write site in
// getProfileAccessUser / getOrgAccessUser and every invalidator must produce
// the same shape, otherwise invalidations target a key the writes never touch
// and demoted or removed members keep their stale roles until the Redis TTL.

describe('resolveAccessUserIds', () => {
  it('returns own id ∪ public sentinel for an authenticated caller', () => {
    expect(resolveAccessUserIds({ id: 'user-1' })).toEqual([
      'user-1',
      GLOBAL_USER_PUBLIC,
    ]);
  });

  it('returns only the public sentinel for a no-jwt caller', () => {
    expect(resolveAccessUserIds(undefined)).toEqual([GLOBAL_USER_PUBLIC]);
  });

  it('does not duplicate when the caller IS the public sentinel', () => {
    expect(resolveAccessUserIds({ id: GLOBAL_USER_PUBLIC })).toEqual([
      GLOBAL_USER_PUBLIC,
    ]);
  });
});

describe('profileUserCacheKey', () => {
  it('produces [profileId, "<authUserId>:<GLOBAL_USER_PUBLIC>"] for an authenticated caller', () => {
    expect(
      profileUserCacheKey({ user: { id: 'user-1' }, profileId: 'profile-1' }),
    ).toEqual(['profile-1', `user-1:${GLOBAL_USER_PUBLIC}`]);
  });

  it('produces [profileId, "<GLOBAL_USER_PUBLIC>"] for a no-jwt caller', () => {
    expect(profileUserCacheKey({ profileId: 'profile-1' })).toEqual([
      'profile-1',
      GLOBAL_USER_PUBLIC,
    ]);
  });
});

describe('orgUserCacheKey', () => {
  it('produces [organizationId, "<authUserId>:<GLOBAL_USER_PUBLIC>"] for an authenticated caller', () => {
    expect(
      orgUserCacheKey({ user: { id: 'user-1' }, organizationId: 'org-1' }),
    ).toEqual(['org-1', `user-1:${GLOBAL_USER_PUBLIC}`]);
  });

  it('produces [organizationId, "<GLOBAL_USER_PUBLIC>"] for a no-jwt caller', () => {
    expect(orgUserCacheKey({ organizationId: 'org-1' })).toEqual([
      'org-1',
      GLOBAL_USER_PUBLIC,
    ]);
  });
});
