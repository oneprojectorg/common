import type { CommonUser } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import { isJoinEligible } from './isJoinEligible';

const makeUser = (overrides: Partial<CommonUser>): CommonUser => ({
  id: 'u1',
  authUserId: 'auth1',
  name: null,
  email: null,
  lastOrgId: null,
  profileId: null,
  currentProfileId: null,
  tos: null,
  privacy: null,
  createdAt: new Date().toISOString(),
  isAnonymous: false,
  isNetworkMember: false,
  ...overrides,
});

describe('isJoinEligible', () => {
  it('admits a logged-out visitor with no user object', () => {
    expect(isJoinEligible(undefined)).toBe(true);
    expect(isJoinEligible(null)).toBe(true);
  });

  it('admits an anonymous account', () => {
    expect(isJoinEligible(makeUser({ isAnonymous: true }))).toBe(true);
  });

  it('refuses a full account', () => {
    expect(isJoinEligible(makeUser({}))).toBe(false);
  });

  it('refuses a full account without a currentProfile — it sees the user menu, not Join', () => {
    expect(isJoinEligible(makeUser({ currentProfile: null }))).toBe(false);
  });
});
