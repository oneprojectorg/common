import type { CommonUser } from '@op/api/encoders';

/**
 * Whether a user may perform write actions (react, comment, post, …).
 *
 * Only a signed-in, non-anonymous account qualifies. Anonymous accounts still
 * get a `currentProfile`, so the profile check alone isn't enough — the real
 * discriminator is `isAnonymous`. Logged-out visitors have no user at all.
 *
 * This is the single source of truth for "who may act" — keep interactive
 * surfaces gating on this rather than re-deriving the predicate inline.
 */
export const userCanInteract = (
  user: CommonUser | null | undefined,
): user is CommonUser => Boolean(user?.currentProfile) && !user?.isAnonymous;
