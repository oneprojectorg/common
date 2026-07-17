import type { CommonUser } from '@op/api/encoders';

/**
 * Instant the updated Terms of Use / Privacy Policy / Code of Conduct went live.
 * Exclusive upper bound: start of 2026-07-13 UTC, so "accepted on or before
 * July 12" (i.e. accepted the old policies) counts as stale.
 */
const POLICY_REACCEPTANCE_CUTOFF = Date.UTC(2026, 6, 13, 0, 0, 0);

/**
 * An acceptance date is stale when it is missing (never accepted the current
 * policies) or predates the update (accepted the old ones). An unparseable
 * value yields `NaN`, and `NaN <` is false, so it is treated as not stale.
 */
const isStale = (acceptedOn: string | null | undefined): boolean =>
  !acceptedOn || Date.parse(acceptedOn) < POLICY_REACCEPTANCE_CUTOFF;

/**
 * Whether a viewer must re-accept the updated policies before continuing.
 *
 * Gated on the acceptance-date columns: a user whose `tosAcceptedOn` or
 * `privacyAcceptedOn` is null or predates the policy update must re-accept.
 * Accepting stamps both dates to now (see `completeOnboarding`), which closes
 * the gate.
 *
 * Only genuine accounts qualify. Public (no-session) visitors have no account
 * and anonymous sign-ins never accept policies — neither should see the gate.
 * Mid-onboarding users (no `onboardedAt`) are redirected to `/start` by the
 * layout before this modal mounts.
 */
export const shouldReacceptPolicies = (
  user: CommonUser | null | undefined,
): boolean =>
  Boolean(
    user &&
    !user.isAnonymous &&
    (isStale(user.tosAcceptedOn) || isStale(user.privacyAcceptedOn)),
  );
