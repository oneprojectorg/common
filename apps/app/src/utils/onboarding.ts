import type { CommonUser } from '@op/api/encoders';

/**
 * Whether a viewer must be sent through the onboarding flow at /start.
 *
 * Only a genuine, not-yet-onboarded account qualifies. Public (no-session)
 * visitors have no account, and anonymous sign-ins are intentionally
 * email-less and never onboarded — neither should be pulled into onboarding.
 */
export const shouldRedirectToOnboarding = (
  user: CommonUser | null | undefined,
): boolean => Boolean(user && !user.authUser?.isAnonymous && !user.onboardedAt);
