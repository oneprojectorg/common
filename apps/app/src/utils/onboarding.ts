import type { CommonUser } from '@op/api/encoders';
import { isSafeRedirectPath, isSupportedLocale } from '@op/common/client';

import { i18nConfig } from '@/lib/i18n/config';

/**
 * Whether a viewer must be sent through the onboarding flow at /start.
 *
 * Only a genuine, not-yet-onboarded account qualifies. Public (no-session)
 * visitors have no account, and anonymous sign-ins are intentionally
 * email-less and never onboarded — neither should be pulled into onboarding.
 */
export const shouldRedirectToOnboarding = (
  user: CommonUser | null | undefined,
): boolean => Boolean(user && !user.isAnonymous && !user.onboardedAt);

/**
 * The `/start` redirect target, preserving the full destination (the proxy's
 * `x-pathname` + `x-search` headers) via `?redirect=` so the user returns there
 * — query string and all — after onboarding.
 *
 * Onboarding stays in the visitor's locale: an English /start in front of a
 * non-English visitor invites a browser translator to rewrite the DOM, and
 * React then crashes on the next navigation.
 */
export const buildOnboardingRedirect = (
  locale: string,
  pathname: string | null,
  search?: string | null,
): string => {
  const start = `/${isSupportedLocale(locale) ? locale : i18nConfig.defaultLocale}/start`;
  const dest = pathname ? `${pathname}${search ?? ''}` : pathname;

  return isSafeRedirectPath(dest)
    ? `${start}?redirect=${encodeURIComponent(dest)}`
    : start;
};
