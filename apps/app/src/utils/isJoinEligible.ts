import type { CommonUser } from '@op/api/encoders';

/**
 * Whether a visitor may claim an account through the join flow.
 *
 * Logged-out visitors and anonymous accounts. Not the complement of
 * `userCanInteract`: a full account without a `currentProfile` may neither
 * act nor join — it sees the user menu, not Join.
 */
export const isJoinEligible = (user: CommonUser | null | undefined): boolean =>
  !user || user.isAnonymous;
