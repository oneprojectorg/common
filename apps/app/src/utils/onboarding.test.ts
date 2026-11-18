import { describe, expect, it } from 'vitest';

import { buildOnboardingRedirect } from './onboarding';

describe('buildOnboardingRedirect', () => {
  it('keeps the visitor in the locale of the page they came from', () => {
    expect(
      buildOnboardingRedirect('hu', '/hu/decisions/budget/current', '?tab=1'),
    ).toBe(
      `/hu/start?redirect=${encodeURIComponent('/hu/decisions/budget/current?tab=1')}`,
    );
  });

  it('falls back to the default locale for an unsupported locale', () => {
    expect(buildOnboardingRedirect('xx', '/info/tos')).toBe(
      `/en/start?redirect=${encodeURIComponent('/info/tos')}`,
    );
  });

  it('omits the redirect when the destination is unsafe or missing', () => {
    expect(buildOnboardingRedirect('ar', '//evil.example')).toBe('/ar/start');
    expect(buildOnboardingRedirect('ar', null)).toBe('/ar/start');
  });
});
