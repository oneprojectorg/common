import type { CommonUser } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import { shouldReacceptPolicies } from './eligibility';

const makeUser = (overrides: Partial<CommonUser>): CommonUser =>
  ({
    id: 'u1',
    authUserId: 'auth1',
    isAnonymous: false,
    tosAcceptedOn: '2026-08-01T00:00:00.000Z',
    privacyAcceptedOn: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }) as CommonUser;

describe('shouldReacceptPolicies', () => {
  it('returns false for public (no-session) visitors', () => {
    expect(shouldReacceptPolicies(undefined)).toBe(false);
    expect(shouldReacceptPolicies(null)).toBe(false);
  });

  it('excludes anonymous sign-ins even when acceptance dates are missing', () => {
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

  it('includes users who have not accepted the current policies', () => {
    expect(
      shouldReacceptPolicies(
        makeUser({ tosAcceptedOn: null, privacyAcceptedOn: null }),
      ),
    ).toBe(true);
  });

  it('includes users who accepted only one of the two', () => {
    expect(
      shouldReacceptPolicies(
        makeUser({
          tosAcceptedOn: '2026-08-01T00:00:00.000Z',
          privacyAcceptedOn: null,
        }),
      ),
    ).toBe(true);
    expect(
      shouldReacceptPolicies(
        makeUser({
          tosAcceptedOn: null,
          privacyAcceptedOn: '2026-08-01T00:00:00.000Z',
        }),
      ),
    ).toBe(true);
  });

  it('excludes users who have accepted both', () => {
    expect(
      shouldReacceptPolicies(
        makeUser({
          tosAcceptedOn: '2026-08-01T00:00:00.000Z',
          privacyAcceptedOn: '2026-08-01T00:00:00.000Z',
        }),
      ),
    ).toBe(false);
  });
});
