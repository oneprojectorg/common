import type { CommonUser } from '@op/api/encoders';

/**
 * Instant the updated Terms of Use / Privacy Policy / Code of Conduct went live.
 * Any real account that finished onboarding before this (i.e. accepted the old
 * policies) must review and re-accept. Exclusive upper bound: start of
 * 2026-07-13 UTC, so all of July 12 UTC counts as "on or before July 12".
 */
const POLICY_REACCEPTANCE_CUTOFF = Date.UTC(2026, 6, 13, 0, 0, 0);

/**
 * Whether a viewer must re-accept the updated policies before continuing.
 *
 * Only a genuine, already-onboarded account qualifies. Public (no-session)
 * visitors have no account, anonymous sign-ins are intentionally never
 * onboarded, and mid-onboarding users (no `onboardedAt`) are sent to `/start`
 * instead — none should see the gate. An unparseable `onboardedAt` yields
 * `NaN`, and `NaN <` comparisons are false, so it safely falls through to
 * "not eligible".
 */
export const shouldReacceptPolicies = (
  user: CommonUser | null | undefined,
): boolean =>
  Boolean(
    user &&
    !user.isAnonymous &&
    user.onboardedAt &&
    Date.parse(user.onboardedAt) < POLICY_REACCEPTANCE_CUTOFF,
  );
