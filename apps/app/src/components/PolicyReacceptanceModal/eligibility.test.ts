import type { CommonUser } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import { shouldReacceptPolicies } from './eligibility';

const makeUser = (overrides: Partial<CommonUser>): CommonUser =>
  ({
    id: 'u1',
    authUserId: 'auth1',
    isAnonymous: false,
    onboardedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as CommonUser;

describe('shouldReacceptPolicies', () => {
  it('returns false for public (no-session) visitors', () => {
    expect(shouldReacceptPolicies(undefined)).toBe(false);
    expect(shouldReacceptPolicies(null)).toBe(false);
  });

  it('excludes anonymous sign-ins', () => {
    expect(
      shouldReacceptPolicies(
        makeUser({
          isAnonymous: true,
          onboardedAt: '2026-01-01T00:00:00.000Z',
        }),
      ),
    ).toBe(false);
  });

  it('excludes users who have not onboarded yet', () => {
    expect(shouldReacceptPolicies(makeUser({ onboardedAt: null }))).toBe(false);
    expect(shouldReacceptPolicies(makeUser({ onboardedAt: undefined }))).toBe(
      false,
    );
  });

  it('includes users onboarded on or before July 12, 2026', () => {
    expect(
      shouldReacceptPolicies(
        makeUser({ onboardedAt: '2026-07-12T23:00:00.000Z' }),
      ),
    ).toBe(true);
    // Postgres tz-string form (space-separated, offset suffix) also parses.
    expect(
      shouldReacceptPolicies(
        makeUser({ onboardedAt: '2026-05-01 09:30:00+00' }),
      ),
    ).toBe(true);
  });

  it('excludes users onboarded after the cutoff', () => {
    expect(
      shouldReacceptPolicies(
        makeUser({ onboardedAt: '2026-07-13T00:00:00.000Z' }),
      ),
    ).toBe(false);
    expect(
      shouldReacceptPolicies(
        makeUser({ onboardedAt: '2026-08-01T12:00:00.000Z' }),
      ),
    ).toBe(false);
  });

  it('excludes an unparseable onboardedAt', () => {
    expect(
      shouldReacceptPolicies(makeUser({ onboardedAt: 'not-a-date' })),
    ).toBe(false);
  });
});
