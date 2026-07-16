import type { CommonUser } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import { shouldReacceptPolicies } from './eligibility';

const AFTER_CUTOFF = '2026-08-01T00:00:00.000Z';

const makeUser = (overrides: Partial<CommonUser>): CommonUser =>
  ({
    id: 'u1',
    authUserId: 'auth1',
    isAnonymous: false,
    tosAcceptedOn: AFTER_CUTOFF,
    privacyAcceptedOn: AFTER_CUTOFF,
    ...overrides,
  }) as CommonUser;

describe('shouldReacceptPolicies', () => {
  it('returns false for public (no-session) visitors', () => {
    expect(shouldReacceptPolicies(undefined)).toBe(false);
    expect(shouldReacceptPolicies(null)).toBe(false);
  });

  it('excludes anonymous sign-ins even with stale acceptance', () => {
    expect(
      shouldReacceptPolicies(
        makeUser({
          isAnonymous: true,
          tosAcceptedOn: null,
          privacyAcceptedOn: null,
        }),
      ),
    ).toBe(false);
  });

  it('includes users who have never accepted (null)', () => {
    expect(
      shouldReacceptPolicies(
        makeUser({ tosAcceptedOn: null, privacyAcceptedOn: null }),
      ),
    ).toBe(true);
  });

  it('includes users who accepted on or before July 12, 2026', () => {
    expect(
      shouldReacceptPolicies(
        makeUser({
          tosAcceptedOn: '2026-07-12T23:00:00.000Z',
          privacyAcceptedOn: '2026-07-12T23:00:00.000Z',
        }),
      ),
    ).toBe(true);
  });

  it('includes users where only one of the two is stale', () => {
    expect(
      shouldReacceptPolicies(
        makeUser({ tosAcceptedOn: AFTER_CUTOFF, privacyAcceptedOn: null }),
      ),
    ).toBe(true);
    expect(
      shouldReacceptPolicies(
        makeUser({
          tosAcceptedOn: '2026-05-01T00:00:00.000Z',
          privacyAcceptedOn: AFTER_CUTOFF,
        }),
      ),
    ).toBe(true);
  });

  it('excludes users who accepted after the cutoff', () => {
    expect(
      shouldReacceptPolicies(
        makeUser({
          tosAcceptedOn: '2026-07-13T00:00:00.000Z',
          privacyAcceptedOn: '2026-07-13T00:00:00.000Z',
        }),
      ),
    ).toBe(false);
    expect(shouldReacceptPolicies(makeUser({}))).toBe(false);
  });
});
