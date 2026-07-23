import type { CommonUser } from '@op/api/encoders';
import { isSafeRedirectPath } from '@op/common/client';

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
 */
export const buildOnboardingRedirect = (
  pathname: string | null,
  search?: string | null,
): string => {
  const dest = pathname ? `${pathname}${search ?? ''}` : pathname;

  return isSafeRedirectPath(dest)
    ? `/en/start?redirect=${encodeURIComponent(dest)}`
    : '/en/start';
};
